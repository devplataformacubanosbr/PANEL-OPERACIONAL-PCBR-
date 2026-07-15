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
        // Insertar imagen
        let image;
        if (doc.tipo_contenido === 'image/png' || doc.url_archivo.toLowerCase().endsWith('.png')) {
          image = await mergedPdf.embedPng(bytes);
        } else {
          image = await mergedPdf.embedJpg(bytes); // Asume JPG/WebP convertido a JPG o soportado
        }

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
