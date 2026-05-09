let annoCanvas = null;
let annoCtx = null;
let isDrawing = false;
let lastPoint = null;

const PEN_COLOR = '#ff3b30';
const PEN_WIDTH = 3;

function initAnnotations(slideContainer) {
  annoCanvas = document.getElementById('annotation-canvas');
  if (!annoCanvas) {
    annoCanvas = document.createElement('canvas');
    annoCanvas.id = 'annotation-canvas';
    annoCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    slideContainer.appendChild(annoCanvas);
  }
  annoCtx = annoCanvas.getContext('2d');
  resizeAnnotationCanvas();
}

function resizeAnnotationCanvas() {
  if (!annoCanvas) return;
  const parent = annoCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  annoCanvas.width = parent.clientWidth * dpr;
  annoCanvas.height = parent.clientHeight * dpr;
  annoCtx.scale(dpr, dpr);
  annoCtx.strokeStyle = PEN_COLOR;
  annoCtx.lineWidth = PEN_WIDTH;
  annoCtx.lineCap = 'round';
  annoCtx.lineJoin = 'round';
}

function drawAt(x, y) {
  if (!annoCtx) return;

  const parent = annoCanvas.parentElement;
  const px = (1.0 - x) * parent.clientWidth;
  const py = y * parent.clientHeight;

  if (!isDrawing || !lastPoint) {
    isDrawing = true;
    lastPoint = { x: px, y: py };
    return;
  }

  annoCtx.beginPath();
  annoCtx.moveTo(lastPoint.x, lastPoint.y);
  annoCtx.lineTo(px, py);
  annoCtx.stroke();
  lastPoint = { x: px, y: py };
}

function stopDrawing() {
  isDrawing = false;
  lastPoint = null;
}

function clearAnnotations() {
  if (!annoCtx || !annoCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  annoCtx.clearRect(0, 0, annoCanvas.width / dpr, annoCanvas.height / dpr);
  stopDrawing();
}

export {
  initAnnotations,
  resizeAnnotationCanvas,
  drawAt,
  stopDrawing,
  clearAnnotations
};
