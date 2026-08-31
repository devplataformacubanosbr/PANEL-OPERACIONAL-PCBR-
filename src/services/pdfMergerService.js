import { PDFDocument } from 'pdf-lib';
import { supabase } from '../supabaseClient';

const BUCKET = 'documentos_operacionales';

// Helper robusto para descargar bytes evitando expiración de URLs firmadas
async function fetchDocumentBytes(urlOrPath) {
  let path = urlOrPath;
  if (path && path.startsWith('http')) {
    const urlParts = path.split(`/${BUCKET}/`);
    if (urlParts.length === 2) {
      path = urlParts[1].split('?')[0];
      path = decodeURIComponent(path);
    }
  }

  // Intentar descargar directo desde Supabase para usar la sesión actual
  if (path && !path.startsWith('http')) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (!error && data) {
      return await data.arrayBuffer();
    }
    console.warn('[pdfMergerService] Falló descarga directa, cayendo a fetch.', error);
  }

  // Fallback a fetch normal (puede ser URL pública o firmada)
  const res = await fetch(urlOrPath);
  if (!res.ok) {
    throw new Error(`Error al descargar el archivo: HTTP ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
}

// pdf-lib solo sabe embeber PNG/JPEG reales, y los toma "tal cual" sin
// leer el tag EXIF de orientación (a diferencia de un <img>/canvas del
// navegador). Eso rompía dos cosas con fotos de celular: (1) un WebP/GIF
// (o un JPEG progresivo/CMYK) hacía crashear embedJpg porque los bytes no
// son un JPEG baseline válido, y (2) fotos con EXIF Orientation salían
// giradas o al revés en el PDF final aunque se vieran bien en cualquier
// visor. Decodificar vía <img>+canvas resuelve ambos: el navegador aplica
// la orientación EXIF al dibujar, y toDataURL siempre produce un
// PNG/JPEG baseline limpio sin importar el formato de entrada.
async function normalizeImageForEmbed(bytes, tipoContenido) {
  const isPng = tipoContenido === 'image/png';
  const blob = new Blob([bytes], { type: tipoContenido || 'image/jpeg' });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!isPng) {
      // JPEG no soporta transparencia: fondo blanco para que un PNG/WebP
      // con canal alfa no termine con áreas negras.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92);
    const outBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    return { bytes: outBytes, isPng };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Junta varios documentos (PDFs e imágenes) en un solo archivo PDF.
 * @param {Array} documents - Arreglo de objetos documento (deben tener url_archivo y tipo_contenido)
 * @returns {Promise<Blob>} - Blob del PDF resultante
 */
export async function mergeDocumentsToPdf(documents) {
  const mergedPdf = await PDFDocument.create();

  for (const doc of documents) {
    try {
      const bytes = await fetchDocumentBytes(doc.url_archivo);
      const isPdf = doc.tipo_contenido === 'application/pdf' || doc.nombre_archivo?.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // Cargar y copiar todas las páginas del PDF
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } else if (doc.tipo_contenido?.startsWith('image/')) {
        // Insertar imagen — normalizamos primero (ver normalizeImageForEmbed)
        // para que WebP/GIF no crasheen y las fotos con EXIF no salgan giradas.
        const { bytes: normalizedBytes, isPng } = await normalizeImageForEmbed(bytes, doc.tipo_contenido);
        const image = isPng ? await mergedPdf.embedPng(normalizedBytes) : await mergedPdf.embedJpg(normalizedBytes);

        const imgDims = image.scale(1);
        
        // Crear una página A4 estándar (o ajustar a la imagen si se desea, usaremos el tamaño de la imagen por simplicidad)
        // Usar tamaño de la imagen o escalar a A4 si es muy grande.
        // A4 es aprox 595.28 x 841.89 points
        const A4_WIDTH = 595.28;
        const A4_HEIGHT = 841.89;

        // Escalar imagen para que quepa en A4
        let width = imgDims.width;
        let height = imgDims.height;

        if (width > A4_WIDTH || height > A4_HEIGHT) {
          const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height);
          width *= scale;
          height *= scale;
        }

        const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        
        // Centrar la imagen
        page.drawImage(image, {
          x: (A4_WIDTH / 2) - (width / 2),
          y: (A4_HEIGHT / 2) - (height / 2),
          width,
          height,
        });
      } else {
        console.warn(`Tipo de archivo no soportado para juntar: ${doc.tipo_contenido}`);
      }
    } catch (err) {
      console.error(`Error al procesar el documento ${doc.nombre_archivo}:`, err);
      throw new Error(`Error procesando ${doc.nombre_archivo}: ${err.message}`);
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
