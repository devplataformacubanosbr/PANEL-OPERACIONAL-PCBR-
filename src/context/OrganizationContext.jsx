import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../features/auth/context/AuthContext';
import { supabase } from '../shared/config/supabaseClient';

const OrganizationContext = createContext(null);

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const shadeColor = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const shade = (c) => Math.round((t - c) * p) + c;
  return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
};

// Aplica (o revierte) el color de marca de la organización como CSS custom properties
// en <html>. El estilo inline tiene mayor prioridad que :root/[data-theme] en tokens.css,
// así que pisa el valor por defecto sin tocar el modo claro/oscuro. Si no hay color
// configurado, se remueve el override y el tema vuelve a su valor por defecto.
const applyBrandColor = (hex) => {
  const root = document.documentElement;
  if (!hex) {
    root.style.removeProperty('--brand-primary');
    root.style.removeProperty('--brand-primary-dark');
    root.style.removeProperty('--brand-primary-light');
    root.style.removeProperty('--brand-primary-glow');
    return;
  }
  const { r, g, b } = hexToRgb(hex);
  root.style.setProperty('--brand-primary', hex);
  root.style.setProperty('--brand-primary-dark', shadeColor(hex, -15));
  root.style.setProperty('--brand-primary-light', `rgba(${r}, ${g}, ${b}, 0.1)`);
  root.style.setProperty('--brand-primary-glow', `rgba(${r}, ${g}, ${b}, 0.2)`);
};

const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const SURFACE_VARS = [
  '--surface-canvas', '--surface-base', '--surface-raised', '--surface-elevated',
  '--border-subtle', '--border-default', '--border-strong',
];

// Tiñe el fondo de TODA la app (lienzo, paneles y tarjetas), no solo el lienzo exterior.
// A partir de un único hex se derivan las superficies (progresivamente más claras, igual
// que hace tokens.css con negro/blanco) y, según la luminancia del color elegido, bordes
// claros u oscuros. El color de texto se resuelve aparte (ver applyTextPalette) porque
// puede venir de acá automáticamente o de un override manual del admin.
const applyBackgroundColor = (hex) => {
  const root = document.documentElement;
  if (!hex) {
    SURFACE_VARS.forEach(v => root.style.removeProperty(v));
    return;
  }

  root.style.setProperty('--surface-canvas', hex);
  root.style.setProperty('--surface-base', shadeColor(hex, 4));
  root.style.setProperty('--surface-raised', shadeColor(hex, 8));
  root.style.setProperty('--surface-elevated', shadeColor(hex, 12));

  if (luminance(hex) < 0.5) {
    root.style.setProperty('--border-subtle', shadeColor(hex, 15));
    root.style.setProperty('--border-default', shadeColor(hex, 15));
    root.style.setProperty('--border-strong', shadeColor(hex, 25));
  } else {
    root.style.setProperty('--border-subtle', shadeColor(hex, -10));
    root.style.setProperty('--border-default', shadeColor(hex, -10));
    root.style.setProperty('--border-strong', shadeColor(hex, -20));
  }
};

const TEXT_VARS = ['--text-primary', '--text-secondary', '--text-muted', '--text-disabled'];

// Prioridad del color de texto: color_texto manual (si el admin lo definió) > contraste
// automático según la luminancia de color_fondo > tema por defecto (sin override, se limpia).
const applyTextPalette = (fondoHex, textoHex) => {
  const root = document.documentElement;

  if (textoHex) {
    const dark = luminance(textoHex) < 0.5;
    root.style.setProperty('--text-primary', textoHex);
    root.style.setProperty('--text-secondary', shadeColor(textoHex, dark ? 40 : -40));
    root.style.setProperty('--text-muted', shadeColor(textoHex, dark ? 65 : -65));
    root.style.setProperty('--text-disabled', shadeColor(textoHex, dark ? 80 : -80));
    return;
  }

  if (fondoHex) {
    if (luminance(fondoHex) < 0.5) {
      // Fondo oscuro → texto claro (igual que el tema dark de tokens.css)
      root.style.setProperty('--text-primary', '#fafafa');
      root.style.setProperty('--text-secondary', '#a1a1aa');
      root.style.setProperty('--text-muted', '#71717a');
      root.style.setProperty('--text-disabled', '#52525b');
    } else {
      // Fondo claro → texto oscuro (igual que el tema light de tokens.css)
      root.style.setProperty('--text-primary', '#09090b');
      root.style.setProperty('--text-secondary', '#71717a');
      root.style.setProperty('--text-muted', '#a1a1aa');
      root.style.setProperty('--text-disabled', '#d4d4d8');
    }
    return;
  }

  TEXT_VARS.forEach(v => root.style.removeProperty(v));
};

// Empresa única, sin multi-tenant: la marca/branding vive en una sola fila
// de `configuracion_empresa` en vez de una fila de `organizaciones` por
// tenant. No depende de userProfile — cualquier usuario autenticado ve la
// misma configuración.
export const OrganizationProvider = ({ children }) => {
  const { loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    setLoading(true);
    supabase
      .from('configuracion_empresa')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching configuracion_empresa:', error);
          setError(error);
          setOrganization(null);
        } else {
          setOrganization(data);
          setError(null);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Catch error fetching configuracion_empresa:', err);
        setError(err);
        setOrganization(null);
        setLoading(false);
      });
  }, [authLoading]);

  useEffect(() => {
    applyBrandColor(organization?.color_primario);
    applyBackgroundColor(organization?.color_fondo);
    applyTextPalette(organization?.color_fondo, organization?.color_texto);
    return () => {
      applyBrandColor(null);
      applyBackgroundColor(null);
      applyTextPalette(null, null);
    };
  }, [organization?.color_primario, organization?.color_fondo, organization?.color_texto]);

  // Actualiza el logo/color en memoria tras guardar en MarcaSettings, sin recargar la app.
  const updateBranding = ({ logoUrl, colorPrimario, colorFondo, colorTexto }) => {
    setOrganization(prev => prev ? { ...prev, logo_url: logoUrl, color_primario: colorPrimario, color_fondo: colorFondo, color_texto: colorTexto } : prev);
  };

  const value = {
    organization,
    loading: authLoading || loading,
    error,
    organizationName: organization?.nombre || 'Mi empresa',
    logoUrl: organization?.logo_url || null,
    colorPrimario: organization?.color_primario || null,
    colorFondo: organization?.color_fondo || null,
    colorTexto: organization?.color_texto || null,
    updateBranding,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

export default OrganizationContext;
