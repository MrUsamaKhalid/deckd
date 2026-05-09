const PDF_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.mjs';
const WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs';

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let zoomLevel = 1.0;
let zoomOrigin = { x: 0.5, y: 0.5 };
let rendering = false;

const ZOOM_STEP = 0.5;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.0;

let canvas = null;
let ctx = null;
let onSlideChange = null;

async function initPdfViewer(canvasEl, slideChangeCallback) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  onSlideChange = slideChangeCallback;

  const pdfjsLib = await import(PDF_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
  window.pdfjsLib = pdfjsLib;
}

async function loadPdf(source) {
  const pdfjsLib = window.pdfjsLib;
  let loadingTask;

  if (source instanceof ArrayBuffer) {
    loadingTask = pdfjsLib.getDocument({ data: source });
  } else if (typeof source === 'string') {
    loadingTask = pdfjsLib.getDocument(source);
  } else {
    throw new Error('Invalid PDF source');
  }

  pdfDoc = await loadingTask.promise;
  totalPages = pdfDoc.numPages;
  currentPage = 1;
  zoomLevel = 1.0;
  await renderPage();
  notifySlideChange();
}

async function renderPage() {
  if (!pdfDoc || rendering) return;
  rendering = true;

  try {
    const page = await pdfDoc.getPage(currentPage);
    const container = canvas.parentElement;

    // Wait a frame for layout to settle
    await new Promise(r => requestAnimationFrame(r));

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) {
      console.warn('Container has zero dimensions, retrying...');
      rendering = false;
      setTimeout(() => renderPage(), 100);
      return;
    }

    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      containerWidth / unscaledViewport.width,
      containerHeight / unscaledViewport.height
    );
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

    applyZoomTransform();

    const renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;
  } catch (err) {
    console.error('Render error:', err);
  } finally {
    rendering = false;
  }
}

function applyZoomTransform() {
  if (zoomLevel === 1.0) {
    canvas.style.transform = 'none';
  } else {
    canvas.style.transformOrigin = `${zoomOrigin.x * 100}% ${zoomOrigin.y * 100}%`;
    canvas.style.transform = `scale(${zoomLevel})`;
  }
}

function nextSlide() {
  if (!pdfDoc || currentPage >= totalPages) return;
  currentPage++;
  zoomLevel = 1.0;
  renderPage();
  notifySlideChange();
}

function prevSlide() {
  if (!pdfDoc || currentPage <= 1) return;
  currentPage--;
  zoomLevel = 1.0;
  renderPage();
  notifySlideChange();
}

function zoomIn(originX = 0.5, originY = 0.5) {
  if (zoomLevel >= ZOOM_MAX) return;
  zoomOrigin = { x: originX, y: originY };
  zoomLevel = Math.min(zoomLevel + ZOOM_STEP, ZOOM_MAX);
  applyZoomTransform();
}

function zoomOut() {
  if (zoomLevel <= ZOOM_MIN) return;
  zoomLevel = Math.max(zoomLevel - ZOOM_STEP, ZOOM_MIN);
  applyZoomTransform();
}

function resetZoom() {
  zoomLevel = 1.0;
  canvas.style.transform = 'none';
}

function notifySlideChange() {
  if (onSlideChange) {
    onSlideChange(currentPage, totalPages);
  }
}

function getState() {
  return { currentPage, totalPages, zoomLevel };
}

export {
  initPdfViewer,
  loadPdf,
  renderPage,
  nextSlide,
  prevSlide,
  zoomIn,
  zoomOut,
  resetZoom,
  getState
};
