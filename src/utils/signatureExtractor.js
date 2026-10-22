/**
 * Utilidades avanzadas para la extracción, limpieza y procesamiento digital de firmas
 * a partir de pasaportes, carnets y documentos de identidad.
 */

export const PASSPORT_SIGNATURE_PRESETS = [
  {
    id: 'pasaporte_cubano',
    label: 'Pasaporte Cubano (Bajo la foto)',
    description: 'Recuadro estándar "Firma del titular" debajo de la foto biométrica',
    crop: { unit: '%', x: 8, y: 64, width: 38, height: 18 }
  },
  {
    id: 'carnet_identidad',
    label: 'Carnet de Identidad Cubano',
    description: 'Área de firma en tarjeta plástica de identidad',
    crop: { unit: '%', x: 10, y: 55, width: 42, height: 22 }
  },
  {
    id: 'rnm_brasil',
    label: 'RNM / CRNM Brasil',
    description: 'Tarjeta de Registro Nacional Migratorio',
    crop: { unit: '%', x: 8, y: 58, width: 45, height: 20 }
  },
  {
    id: 'centro',
    label: 'Centrado General',
    description: 'Área amplia para firmas en hojas en blanco o contratos',
    crop: { unit: '%', x: 15, y: 35, width: 70, height: 30 }
  }
];

export const INK_COLOR_OPTIONS = [
  {
    id: 'caneta_azul',
    label: 'Caneta Azul Bic',
    hex: '#0033aa',
    description: 'Azul vibrante estándar preferido en trámites y cartórios de Brasil'
  },
  {
    id: 'azul_cartorio',
    label: 'Azul Cartório / Marino',
    hex: '#001b6b',
    description: 'Azul oscuro formal y elegante'
  },
  {
    id: 'negro_documental',
    label: 'Negro Documental',
    hex: '#111111',
    description: 'Negro profundo para formularios de Policía Federal'
  },
  {
    id: 'original',
    label: 'Tinta Original',
    hex: null,
    description: 'Conserva el color real del bolígrafo eliminando únicamente el fondo'
  }
];

/**
 * Procesa el recorte de la firma en un canvas:
 * 1. Elimina el fondo de papel / tramas de seguridad guilloché mediante umbral adaptativo.
 * 2. Transforma los trazos al color de tinta deseado (Caneta Azul, Negro o Tinta Original).
 * 3. Suaviza bordes (anti-aliasing) y opcionalmente refuerza trazos débiles.
 * 4. Recorta automáticamente los márgenes transparentes vacíos (autotrim).
 *
 * @param {HTMLImageElement|HTMLCanvasElement} image - Elemento de imagen fuente
 * @param {object} pixelCrop - Dimensiones del recorte en píxeles sobre la imagen mostrada
 * @param {object} options - Opciones de configuración
 * @returns {{ base64: string, width: number, height: number, isEmpty: boolean }}
 */
export function processSignatureImage(image, pixelCrop, options = {}) {
  const {
    threshold = 155,
    invert = false,
    inkColor = '#0033aa',
    enhanceThinLines = true,
    autoTrim = true
  } = options;

  if (!image || !pixelCrop || !pixelCrop.width || !pixelCrop.height) {
    return null;
  }

  // Escalar de las dimensiones visuales (renderizadas) a las naturales de la imagen original
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const displayWidth = image.width || naturalWidth;
  const displayHeight = image.height || naturalHeight;

  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  const cropX = Math.max(0, Math.round(pixelCrop.x * scaleX));
  const cropY = Math.max(0, Math.round(pixelCrop.y * scaleY));
  const cropW = Math.min(naturalWidth - cropX, Math.round(pixelCrop.width * scaleX));
  const cropH = Math.min(naturalHeight - cropY, Math.round(pixelCrop.height * scaleY));

  if (cropW <= 0 || cropH <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.drawImage(
    image,
    cropX, cropY, cropW, cropH,
    0, 0, cropW, cropH
  );

  const imageData = ctx.getImageData(0, 0, cropW, cropH);
  const data = imageData.data;

  // Analizar color de tinta solicitado
  const isOriginalInk = !inkColor || inkColor === 'original';
  let rTarget = 0, gTarget = 51, bTarget = 170; // #0033aa por defecto
  if (!isOriginalInk) {
    const hex = inkColor.replace('#', '');
    rTarget = parseInt(hex.substring(0, 2), 16) || 0;
    gTarget = parseInt(hex.substring(2, 4), 16) || 0;
    bTarget = parseInt(hex.substring(4, 6), 16) || 0;
  }

  let minX = cropW;
  let minY = cropH;
  let maxX = 0;
  let maxY = 0;
  let inkCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignorar píxeles transparentes previos
    if (a < 35) {
      data[i + 3] = 0;
      continue;
    }

    // Luminancia percibida
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isBackground = invert ? (lum < threshold) : (lum > threshold);

    if (isBackground) {
      data[i + 3] = 0; // Fondo transparente
    } else {
      const pixelIndex = i / 4;
      const px = pixelIndex % cropW;
      const py = Math.floor(pixelIndex / cropW);

      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      inkCount++;

      // Intensidad de trazo: entre más oscuro el pixel original, más opaco
      let intensity = invert
        ? (lum / 255)
        : (1 - (lum / Math.max(1, threshold)));

      if (enhanceThinLines) {
        intensity = Math.pow(Math.max(0.1, intensity), 0.75);
      }

      if (!isOriginalInk) {
        data[i] = rTarget;
        data[i + 1] = gTarget;
        data[i + 2] = bTarget;
      }
      // Suavizado de bordes anti-aliasing
      data[i + 3] = Math.min(255, Math.floor(Math.max(0.25, intensity) * 255 * (enhanceThinLines ? 1.4 : 1.15)));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Si no se detectó suficiente tinta, devolver imagen actual
  if (inkCount < 10) {
    return {
      base64: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      isEmpty: true
    };
  }

  // Recorte automático de márgenes transparentes (Autotrim)
  if (autoTrim && maxX >= minX && maxY >= minY) {
    const pad = 12; // 12px de margen de seguridad
    const trimX = Math.max(0, minX - pad);
    const trimY = Math.max(0, minY - pad);
    const trimW = Math.min(cropW - trimX, (maxX - minX) + pad * 2);
    const trimH = Math.min(cropH - trimY, (maxY - minY) + pad * 2);

    if (trimW > 0 && trimH > 0) {
      const trimCanvas = document.createElement('canvas');
      trimCanvas.width = trimW;
      trimCanvas.height = trimH;
      const trimCtx = trimCanvas.getContext('2d');
      trimCtx.drawImage(canvas, trimX, trimY, trimW, trimH, 0, 0, trimW, trimH);

      return {
        base64: trimCanvas.toDataURL('image/png'),
        width: trimW,
        height: trimH,
        isEmpty: false
      };
    }
  }

  return {
    base64: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    isEmpty: false
  };
}
