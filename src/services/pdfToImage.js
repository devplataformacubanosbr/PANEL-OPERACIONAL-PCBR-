import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Convierte la primera página de un archivo PDF a una imagen en Base64 (JPEG)
 * Esto es necesario porque los modelos de visión de la IA requieren imágenes.
 * @param {File} file 
 * @returns {Promise<string>} Base64 Data URL (image/jpeg)
 */
export async function convertPdfPageToImageBase64(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the document
    const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    const pdf = await loadingTask.promise;
    
    // Extract the first page
    const page = await pdf.getPage(1);
    
    // Use a high enough scale for good OCR (2.0 or 3.0)
    const scale = 2.5; 
    const viewport = page.getViewport({ scale });
    
    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render the page on the canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    await page.render(renderContext).promise;
    
    // Export as Base64 JPEG to keep size reasonable for the API
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (error) {
    console.error('[pdfToImage] Error converting PDF to image:', error);
    throw error;
  }
}
