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

  // Muestreo adaptativo del fondo del papel en las 4 esquinas del recorte
  let cornerLumSum = 0;
  let cornerCount = 0;
  const sampleW = Math.max(2, Math.floor(cropW * 0.08));
  const sampleH = Math.max(2, Math.floor(cropH * 0.08));

  for (let sy = 0; sy < sampleH; sy++) {
    for (let sx = 0; sx < sampleW; sx++) {
      // 4 esquinas
      const corners = [
        (sy * cropW + sx) * 4,
        (sy * cropW + (cropW - 1 - sx)) * 4,
        ((cropH - 1 - sy) * cropW + sx) * 4,
        ((cropH - 1 - sy) * cropW + (cropW - 1 - sx)) * 4
      ];
      for (const idx of corners) {
        if (data[idx + 3] > 100) {
          cornerLumSum += (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          cornerCount++;
        }
      }
    }
  }

  const paperLum = cornerCount > 0 ? (cornerLumSum / cornerCount) : 220;
  // Umbral inteligente: adaptado a la iluminación real de la foto
  const effThreshold = Math.min(threshold, Math.max(120, Math.round(paperLum - 24)));

  // Analizar color de tinta solicitado
  const isOriginalInk = !inkColor || inkColor === 'original';
  const isBicBlue = inkColor === '#0033aa' || inkColor === 'caneta_azul';
  let rTarget = 0, gTarget = 51, bTarget = 170; // #0033aa por defecto
  if (!isOriginalInk && !isBicBlue) {
    const hex = inkColor.replace('#', '');
    rTarget = parseInt(hex.substring(0, 2), 16) || 0;
    gTarget = parseInt(hex.substring(2, 4), 16) || 0;
    bTarget = parseInt(hex.substring(4, 6), 16) || 0;
  }

  // Matriz booleana de tinta para análisis de línea base y filtrado de motas
  const inkMask = new Uint8Array(cropW * cropH);
  const rowInkCounts = new Int32Array(cropH);

  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      const a = data[idx + 3];
      if (a < 35) continue;

      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const isInk = invert ? (lum >= effThreshold) : (lum <= effThreshold);

      if (isInk) {
        inkMask[py * cropW + px] = 1;
        rowInkCounts[py]++;
      }
    }
  }

  // Detección y atenuación de línea guía horizontal impresa (ej: línea "Firma del titular")
  // Una línea de formulario típicamente ocupa > 60% del ancho del recuadro con grosor de 1 a 2px
  const isGuideRow = new Uint8Array(cropH);
  for (let y = 1; y < cropH - 1; y++) {
    if (rowInkCounts[y] > cropW * 0.62 && rowInkCounts[y - 1] < cropW * 0.35 && rowInkCounts[y + 1] < cropW * 0.35) {
      isGuideRow[y] = 1;
    }
  }

  let minX = cropW;
  let minY = cropH;
  let maxX = 0;
  let maxY = 0;
  let inkCount = 0;

  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const pIdx = py * cropW + px;
      const i = pIdx * 4;

      if (!inkMask[pIdx]) {
        data[i + 3] = 0; // Fondo transparente
        continue;
      }

      // Si pertenece a una línea de guía horizontal continua impresa, borrar o atenuar
      if (isGuideRow[py]) {
        // Verificar si es un trazo vertical de la firma que cruza la línea
        const hasVerticalNeighbors = (py > 1 && inkMask[(py - 1) * cropW + px] && inkMask[(py - 2) * cropW + px]) ||
                                     (py < cropH - 2 && inkMask[(py + 1) * cropW + px] && inkMask[(py + 2) * cropW + px]);
        if (!hasVerticalNeighbors) {
          data[i + 3] = 0;
          inkMask[pIdx] = 0;
          continue;
        }
      }

      // Filtro de motas / ruido aislado (Despeckle): si un píxel no tiene vecinos de tinta, se descarta
      let neighborCount = 0;
      if (px > 0 && inkMask[pIdx - 1]) neighborCount++;
      if (px < cropW - 1 && inkMask[pIdx + 1]) neighborCount++;
      if (py > 0 && inkMask[pIdx - cropW]) neighborCount++;
      if (py < cropH - 1 && inkMask[pIdx + cropW]) neighborCount++;

      if (neighborCount === 0 && !enhanceThinLines) {
        data[i + 3] = 0;
        inkMask[pIdx] = 0;
        continue;
      }

      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      inkCount++;

      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // Intensidad de trazo proporcional a la presión física de la punta
      let intensity = invert
        ? (lum / 255)
        : (1 - (lum / Math.max(1, effThreshold)));

      if (enhanceThinLines) {
        intensity = Math.pow(Math.max(0.14, intensity), 0.70);
      }

      if (!isOriginalInk) {
        if (isBicBlue) {
          // Modelado fotorrealista de tinta azul Bic Cristal (3 niveles de presión):
          // 1. Núcleo denso por presión: Azul marino profundo real
          // 2. Cuerpo del trazo: Azul zafiro brillante Bic
          // 3. Cola y bordes suavizados: Azul eléctrico translúcido
          if (intensity > 0.65) {
            data[i] = 0;
            data[i + 1] = Math.round(26 + (1 - intensity) * 18);
            data[i + 2] = 135;
          } else if (intensity > 0.32) {
            data[i] = Math.round(4 * (1 - intensity));
            data[i + 1] = Math.round(48 + (1 - intensity) * 30);
            data[i + 2] = Math.round(180 + intensity * 20);
          } else {
            data[i] = 16;
            data[i + 1] = 85;
            data[i + 2] = 235;
          }
        } else {
          data[i] = rTarget;
          data[i + 1] = gTarget;
          data[i + 2] = bTarget;
        }
      }

      // Suavizado anti-aliasing de calidad cartorial
      const alphaMultiplier = enhanceThinLines ? 1.35 : 1.15;
      data[i + 3] = Math.min(255, Math.floor(Math.max(0.35, intensity) * 255 * alphaMultiplier));
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
    const pad = 10; // 10px de margen perimetral de seguridad
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
