import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { POSTOS, REGIONS } from './postosPfBrasil.data';

function normalize(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const NO_DATA_RE = /n[ãa]o localizado/i;
const EXCLUDE_FROM_COUNT_RE = /n[ãa]o localizado|todo o estado|cerca de|praticamente/i;

const TOTAL_MUNICIPIOS = POSTOS.reduce(
  (acc, p) => acc + p.municipios.filter((m) => !EXCLUDE_FROM_COUNT_RE.test(m)).length,
  0
);
const TOTAL_UFS = new Set(POSTOS.map((p) => p.uf)).size;

export default function PostosPfBrasilTab() {
  const [query, setQuery] = useState('');
  const [openUfs, setOpenUfs] = useState(() => new Set());
  const ufRefs = useRef(new Map());

  const normQuery = normalize(query.trim());
  const isSearching = normQuery.length > 0;

  const search = useMemo(() => {
    if (!isSearching) return null;
    const matchedUfs = new Set();
    const cityMatches = new Map(); // sigla -> Set(matched municipio strings)
    let matchCount = 0;

    for (const p of POSTOS) {
      const localMatches = new Set();
      for (const m of p.municipios) {
        if (normalize(m).includes(normQuery)) {
          localMatches.add(m);
          matchCount++;
        }
      }
      const postoLevelMatch =
        normalize(p.sede).includes(normQuery) || normalize(p.sigla).includes(normQuery);
      if (localMatches.size > 0 || postoLevelMatch || normalize(p.uf).includes(normQuery)) {
        matchedUfs.add(p.uf);
      }
      if (localMatches.size > 0) cityMatches.set(p.sigla, localMatches);
    }

    return { matchedUfs, cityMatches, matchCount };
  }, [normQuery, isSearching]);

  const firstMatchedUf = useMemo(() => {
    if (!isSearching || !search) return null;
    for (const region of REGIONS) {
      for (const uf of region.ufs) {
        if (search.matchedUfs.has(uf)) return uf;
      }
    }
    return null;
  }, [isSearching, search]);

  const prevFirstMatch = useRef(null);
  if (firstMatchedUf && firstMatchedUf !== prevFirstMatch.current) {
    prevFirstMatch.current = firstMatchedUf;
    const node = ufRefs.current.get(firstMatchedUf);
    if (node) {
      requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  } else if (!firstMatchedUf) {
    prevFirstMatch.current = null;
  }

  const toggleUf = useCallback((uf) => {
    setOpenUfs((prev) => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  }, []);

  const isUfOpen = (uf) => (isSearching ? search.matchedUfs.has(uf) : openUfs.has(uf));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-chrome-bg text-chrome-text">
      <div className="flex-shrink-0 px-8 py-6 border-b border-chrome-border">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary mb-1">
          Polícia Federal · Brasil
        </p>
        <h2 className="text-lg font-semibold text-chrome-text-active mb-1">
          Postos de atendimento migratório
        </h2>
        <p className="text-sm text-chrome-text max-w-[42rem] mb-4">
          Qué municipio corresponde a cada posto/delegacia da PF para trámites de migración
          (CRNM/extranjeros) — los {POSTOS.length} postos del país, por región.
        </p>
        <div className="relative max-w-[36rem]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una ciudad… (ej. Divinópolis, Criciúma, Petrolina)"
            className="w-full bg-chrome-bg-raised border border-chrome-border rounded-md pl-9 pr-4 py-2.5 text-sm text-chrome-text-active placeholder:text-chrome-text outline-none focus:border-brand-primary transition-colors"
          />
        </div>
        {isSearching && (
          <p className="text-xs text-chrome-text mt-2">
            {search.matchCount === 0 ? (
              <>
                Ningún municipio coincide con &quot;
                <strong className="text-chrome-text-active">{query}</strong>&quot;. Prueba sin
                acentos o con solo una parte del nombre.
              </>
            ) : (
              <>
                <strong className="text-chrome-text-active">{search.matchCount}</strong>{' '}
                coincidencia{search.matchCount === 1 ? '' : 's'} para &quot;
                <strong className="text-chrome-text-active">{query}</strong>&quot;.
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox value={POSTOS.length} label="Postos/delegacias" />
          <StatBox value={TOTAL_UFS} label="Estados + DF" />
          <StatBox value={`${TOTAL_MUNICIPIOS.toLocaleString('pt-BR')}+`} label="Municípios mapeados" />
          <StatBox value={3} label="Sedes sin fuente oficial" />
        </div>

        <div className="mb-6 rounded-md border border-chrome-border bg-brand-primary/10 px-4 py-3 text-sm text-chrome-text">
          <strong className="text-brand-primary">Cómo leer esto:</strong> cada posto lista los
          municipios bajo su circunscrição oficial (a quién debe ir un extranjero que vive en esa
          ciudad). Fuente principal: Portaria DG/PF nº 3.997/2013 y nº 16.145/2022, más la Tabela
          de Circunscrição PF publicada en gov.br/pf. Tres sedes quedaron sin confirmación oficial
          (Feira de Santana/BA, Petrolina/PE, Picos/PI) — marcadas abajo.
        </div>

        {REGIONS.map((region) => {
          const ufsInRegion = region.ufs.filter((uf) => POSTOS.some((p) => p.uf === uf));
          if (!ufsInRegion.length) return null;
          const visibleUfs = isSearching
            ? ufsInRegion.filter((uf) => search.matchedUfs.has(uf))
            : ufsInRegion;
          if (isSearching && !visibleUfs.length) return null;

          return (
            <section key={region.name} className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-primary border-b border-chrome-border pb-2 mb-3">
                {region.name}
              </h3>
              <div className="flex flex-col gap-2">
                {visibleUfs.map((uf) => {
                  const postos = POSTOS.filter((p) => p.uf === uf);
                  const nCities = postos.reduce(
                    (a, p) => a + (NO_DATA_RE.test(p.municipios[0]) ? 0 : p.municipios.length),
                    0
                  );
                  const open = isUfOpen(uf);
                  return (
                    <div
                      key={uf}
                      ref={(node) => {
                        if (node) ufRefs.current.set(uf, node);
                        else ufRefs.current.delete(uf);
                      }}
                      className="rounded-md border border-chrome-border bg-chrome-bg-raised overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleUf(uf)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-chrome-bg-active transition-colors"
                      >
                        <span className="font-medium text-chrome-text-active">{uf}</span>
                        <span className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[11px] font-mono text-chrome-text whitespace-nowrap">
                            {postos.length} posto{postos.length > 1 ? 's' : ''} · {nCities}{' '}
                            município{nCities === 1 ? '' : 's'}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`text-chrome-text transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </button>
                      {open && (
                        <div className="px-4 pb-4 flex flex-col gap-2.5">
                          {postos.map((p) => (
                            <PostoCard
                              key={p.sigla}
                              posto={p}
                              matchedCities={isSearching ? search.cityMatches.get(p.sigla) : null}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div className="rounded-md border border-chrome-border bg-chrome-bg-raised px-4 py-3">
      <div className="text-xl font-semibold text-chrome-text-active tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-chrome-text mt-0.5">{label}</div>
    </div>
  );
}

function PostoCard({ posto, matchedCities }) {
  const isMissing = posto.municipios.length === 1 && NO_DATA_RE.test(posto.municipios[0]);
  return (
    <div className="rounded-md border border-chrome-border bg-chrome-bg px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <span className="font-semibold text-chrome-text-active">{posto.sede}</span>
        <span className="font-mono text-[11px] text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded">
          {posto.sigla}
        </span>
      </div>
      <div className="text-[11px] text-chrome-text/70 mb-2">{posto.fonte}</div>
      {isMissing ? (
        <span className="inline-block text-xs text-danger bg-danger-bg border border-danger-border rounded px-2 py-1">
          {posto.municipios[0]}
        </span>
      ) : (
        <div className="text-sm text-chrome-text leading-relaxed">
          {posto.municipios.map((m, i) => (
            <React.Fragment key={m}>
              <span
                className={
                  matchedCities?.has(m)
                    ? 'bg-warning/25 text-chrome-text-active font-medium rounded px-0.5'
                    : undefined
                }
              >
                {m}
              </span>
              {i < posto.municipios.length - 1 ? ', ' : ''}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
