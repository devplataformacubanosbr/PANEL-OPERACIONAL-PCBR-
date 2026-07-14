import { supabase } from '../supabaseClient';

// Campos que ya no son columnas reales de `clientes` (se movieron a
// campos_personalizados JSONB, ver clientView.constants.js FIXED_FIELDS_CATALOG
// vs. config_campos_clientes) — si vinieran en `mergedData` como columnas
// sueltas, un .update() plano los escribiría en columnas que ya nadie lee.
const DYNAMIC_MERGE_FIELDS = new Set([
    'rnm', 'numero_refugio', 'fecha_vencimiento_refugio', 'numero_pasaporte',
    'fecha_emision_pasaporte', 'fecha_vencimiento_pasaporte', 'carnet_identidad',
    'policia_federal', 'fecha_entrada_brasil', 'lugar_entrada_brasil',
    'nombre_madre', 'nombre_padre', 'tramite',
]);

// Función para fusionar múltiples contactos (2 o más)
export const mergeContacts = async (keepContactId, contactIdsToDelete, mergedData) => {
    try {
        if (!Array.isArray(contactIdsToDelete)) {
            contactIdsToDelete = [contactIdsToDelete];
        }

        // Validar que hay contactos a eliminar
        if (contactIdsToDelete.length === 0) {
            throw new Error('Debe proporcionar al menos un contacto para eliminar');
        }

        // Transferir todos los datos relacionados de los contactos a eliminar al contacto a mantener
        for (const contactToDelete of contactIdsToDelete) {
            // 1. Transferir documentos
            await supabase
                .from('documentos_operacionales')
                .update({ id_cliente: keepContactId })
                .eq('id_cliente', contactToDelete);



            // 3. Actualizar relaciones donde el contacto a eliminar es el principal
            await supabase
                .from('relaciones_clientes')
                .update({ cliente_id: keepContactId })
                .eq('cliente_id', contactToDelete);

            // 4. Actualizar relaciones donde el contacto a eliminar es el secundario
            await supabase
                .from('relaciones_clientes')
                .update({ cliente_relacionado_id: keepContactId })
                .eq('cliente_relacionado_id', contactToDelete);

            // 5. Transferir entradas (trámites)
            await supabase
                .from('entradas')
                .update({ id_cliente: keepContactId })
                .eq('id_cliente', contactToDelete);
        }

        // Eliminamos los contactos duplicados
        for (const contactToDelete of contactIdsToDelete) {
            const { error: deleteError } = await supabase
                .from('clientes')
                .delete()
                .eq('id', contactToDelete);

            if (deleteError) {
                console.error(`Error al eliminar contacto ${contactToDelete}:`, deleteError);
            }
        }

        // Separar los campos que viven en campos_personalizados (JSONB) de las
        // columnas reales — mergeados aparte para no pisar otras claves que ya
        // tuviera guardadas el contacto que se mantiene.
        const flatData = {};
        const dynamicData = {};
        for (const [key, value] of Object.entries(mergedData)) {
            if (DYNAMIC_MERGE_FIELDS.has(key)) {
                dynamicData[key] = value;
            } else {
                flatData[key] = value;
            }
        }

        if (Object.keys(dynamicData).length > 0) {
            const { data: currentClient } = await supabase
                .from('clientes')
                .select('campos_personalizados')
                .eq('id', keepContactId)
                .single();
            flatData.campos_personalizados = { ...(currentClient?.campos_personalizados || {}), ...dynamicData };
        }

        // Actualizar el contacto que se va a mantener con los datos fusionados (se hace al final para evitar conflictos de campos únicos)
        const { error: updateError } = await supabase
            .from('clientes')
            .update(flatData)
            .eq('id', keepContactId);

        if (updateError) {
            console.error('Detalles del error de actualización (Supabase):', updateError);
            throw new Error(`Error al actualizar el contacto fusionado: ${updateError.message || JSON.stringify(updateError)}`);
        }

        return { success: true, keptContactId: keepContactId, mergedCount: contactIdsToDelete.length };
    } catch (error) {
        console.error('Error en la fusión de contactos:', error);
        return { success: false, error: error.message };
    }
};