import { supabase } from '../supabaseClient';

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

        // Actualizar el contacto que se va a mantener con los datos fusionados (se hace al final para evitar conflictos de campos únicos)
        const { error: updateError } = await supabase
            .from('clientes')
            .update(mergedData)
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