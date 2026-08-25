import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Building2, MapPin, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import PoliciaModal from './PoliciaModal';

const PAGE_SIZE = 1000;

// Supabase/PostgREST cap cada respuesta a PAGE_SIZE filas por defecto.
// ciudades y policias_ciudades ya superan eso, así que hay que paginar
// con .range() hasta que una página vuelva incompleta.
async function fetchAllRows(table, select = '*', orderBy = null) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (orderBy) query = query.order(orderBy);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export default function PoliceAndCitiesTab() {
  const [policias, setPolicias] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Modals state
  const [isEditingPolicia, setIsEditingPolicia] = useState(false);
  const [currentPolicia, setCurrentPolicia] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Intentar cargar policías, ciudades y relaciones. Las tres tablas ya
      // superan el límite por defecto de PostgREST (1000 filas/consulta),
      // así que se paginan con fetchAllRows en vez de un .select('*') plano.
      let policiasData, ciudadesData, relData;
      try {
        [policiasData, ciudadesData, relData] = await Promise.all([
          fetchAllRows('policias', '*', 'nombre'),
          fetchAllRows('ciudades', '*', 'nombre'),
          fetchAllRows('policias_ciudades', '*'),
        ]);
      } catch (err) {
        if (err.code === '42P01') {
          throw new Error('Las tablas no existen aún. Por favor, ejecuta el script SQL en Supabase.');
        }
        throw err;
      }

      // Combinar relaciones en los objetos de policía
      const policiasConCiudades = (policiasData || []).map(p => {
        const rels = (relData || []).filter(r => r.policia_id === p.id);
        const pCiudades = rels.map(r => ciudadesData.find(c => c.id === r.ciudad_id)).filter(Boolean);
        return { ...p, ciudades: pCiudades };
      });

      setPolicias(policiasConCiudades);
      setCiudades(ciudadesData || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
      // Fallback a mock data para demostrar UI si no hay tablas
      setPolicias([
        { id: 1, nombre: 'Policía Federal de São Paulo', direccion: 'Rua Bela Cintra, 123', email: 'pf.sp@gov.br', ciudades: [{ id: 1, nombre: 'São Paulo' }, { id: 2, nombre: 'Campinas' }] },
        { id: 2, nombre: 'Polícia Civil Rio de Janeiro', direccion: 'Av. Presidente Vargas', email: 'pc.rj@gov.br', ciudades: [{ id: 3, nombre: 'Rio de Janeiro' }] }
      ]);
    } finally {
      setLoading(false);
    }
  }

  const normalize = (s) =>
    (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

  const normalizedSearch = normalize(search);
  const filteredPolicias = policias.filter(
    (p) =>
      normalize(p.nombre).includes(normalizedSearch) ||
      (p.ciudades || []).some((c) => normalize(c.nombre).includes(normalizedSearch))
  );

  return (
    <div className="h-full flex flex-col p-8 overflow-auto">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-72">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-chrome-text-muted" />
          <input
            type="text"
            placeholder="Buscar comisarías..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-chrome-bg border border-chrome-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-chrome-bg border border-chrome-border rounded-lg text-sm hover:bg-chrome-bg-hover transition-colors">
            <MapPin size={16} />
            Gestionar Ciudades
          </button>
          <button 
            onClick={() => { setCurrentPolicia(null); setIsEditingPolicia(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-primary/90 transition-colors"
          >
            <Plus size={16} />
            Añadir Policía
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg text-sm">
          <strong>Aviso:</strong> {error} <br/> 
          <em>(Mostrando datos de prueba temporales. Usa el botón "Añadir Policía" para probar la UI.)</em>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-chrome-text-muted">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolicias.map(policia => (
            <div key={policia.id} className="bg-chrome-bg border border-chrome-border rounded-xl p-5 hover:border-brand-primary/50 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-chrome-bg-active flex items-center justify-center text-chrome-text">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-chrome-text">{policia.nombre}</h3>
                    <p className="text-xs text-chrome-text-muted">{policia.email || 'Sin email'}</p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setCurrentPolicia(policia); setIsEditingPolicia(true); }}
                    className="p-1.5 text-chrome-text-muted hover:text-brand-primary rounded-md hover:bg-chrome-bg-hover"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button className="p-1.5 text-chrome-text-muted hover:text-red-500 rounded-md hover:bg-chrome-bg-hover" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-4 text-sm text-chrome-text-muted">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{policia.direccion || 'Dirección no especificada'}</span>
                </div>
              </div>

              <div className="border-t border-chrome-border pt-4">
                <p className="text-xs font-medium text-chrome-text-muted mb-2 uppercase tracking-wider">Ciudades Cubiertas</p>
                <div className="flex flex-wrap gap-2">
                  {policia.ciudades && policia.ciudades.length > 0 ? (
                    policia.ciudades.map(c => (
                      <span key={c.id} className="px-2 py-1 bg-chrome-bg-active border border-chrome-border text-chrome-text text-xs rounded-md">
                        {c.nombre}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-chrome-text-muted italic">Ninguna ciudad asignada</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <PoliciaModal
        isOpen={isEditingPolicia}
        onClose={() => setIsEditingPolicia(false)}
        policia={currentPolicia}
        ciudades={ciudades}
        onSave={fetchData}
      />
    </div>
  );
}
