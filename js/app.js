import { initPdfViewer, loadPdf, nextSlide, prevSlide, goToPage, zoomIn, zoomOut, resetZoom, renderPage, getState, getPdfDoc } from './pdf-viewer.js?v=3';
import { initGesture, startWebcam, stopWebcam, getIndexFingerTip } from './gesture.js?v=4';
import {
  initUI,
  drawHandSkeleton,
  showGestureToast,
  updateSlideCounter,
  showLaserPointer,
  hideLaserPointer,
  setupDragDrop,
  showScreen,
  showCameraError,
  showOnboarding,
  hideOnboarding
} from './ui.js?v=3';
import { getAction, isOnboarded, setOnboarded } from './settings.js?v=3';
import { initAnnotations, resizeAnnotationCanvas, drawAt, stopDrawing, clearAnnotations } from './annotations.js?v=3';
import { initThumbnails, renderThumbnails, highlightThumb, toggleThumbnails, hideThumbnails } from './thumbnails.js?v=3';

let currentGesture = 'none';
let gestureHoldTimer = null;
const ZOOM_REPEAT_MS = 400;

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('pdf');

    setupDragDrop(
      document.getElementById('drop-zone'),
      document.getElementById('file-input'),
      onPdfLoaded
    );

    setupKeyboard();

    if (pdfUrl) {
      await startPresenter();
      await loadPdf(pdfUrl);
      afterPdfLoaded();
    }
  } catch (err) {
    console.error('[Deckd] Init error:', err);
  }
}

async function onPdfLoaded(arrayBuffer) {
  try {
    await startPresenter();
    await loadPdf(arrayBuffer);
    afterPdfLoaded();
  } catch (err) {
    console.error('[Deckd] PDF load error:', err);
  }
}

function afterPdfLoaded() {
  const state = getState();
  updateSlideCounter(1, state.totalPages);

  const pdfDoc = getPdfDoc();
  if (pdfDoc) {
    renderThumbnails(pdfDoc);
  }

  if (!isOnboarded()) {
    showOnboarding();
  }
}

async function startPresenter() {
  showScreen('presenter');

  const slideCanvas = document.getElementById('slide-canvas');
  await initPdfViewer(slideCanvas, (current, total) => {
    updateSlideCounter(current, total);
    highlightThumb(current);
  });

  initUI(null); // no skeleton canvas in cinema minimal
  initAnnotations(document.getElementById('slide-container'));
  initThumbnails((page) => goToPage(page));

  // Onboarding dismiss
  const dismissBtn = document.getElementById('onboarding-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hideOnboarding();
      setOnboarded();
    });
  }

  try {
    const video = document.getElementById('webcam-video');
    await initGesture(video, onGesture, onLandmarks);
    await startWebcam();
  } catch (err) {
    console.warn('[Deckd] Gesture init failed:', err);
    if (err.name === 'NotAllowedError') {
      showCameraError('denied');
    } else {
      showCameraError('unavailable');
    }
  }
}

function onGesture(gesture, landmarks) {
  if (gesture === currentGesture) return;

  clearGestureHold();
  const prevGesture = currentGesture;
  currentGesture = gesture;

  // Stop annotation drawing when leaving peace gesture
  if (prevGesture === 'peace' && gesture !== 'peace') {
    stopDrawing();
  }

  showGestureToast(gesture);

  const action = getAction(gesture);
  if (!action) return;

  executeAction(action, landmarks);
}

function executeAction(action, landmarks) {
  switch (action) {
    case 'next':
      nextSlide();
      clearAnnotations();
      break;
    case 'prev':
      prevSlide();
      clearAnnotations();
      break;
    case 'zoomIn':
      handleZoomGesture(landmarks, 'in');
      break;
    case 'zoomOut':
      handleZoomGesture(landmarks, 'out');
      break;
    case 'resetZoom':
      resetZoom();
      break;
    case 'laser':
      // laser handled in onLandmarks
      break;
    case 'annotate':
      // annotation drawing handled in onLandmarks
      break;
    case 'thumbnails':
      toggleThumbnails();
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
  }
}

function handleZoomGesture(landmarks, direction) {
  if (direction === 'in' && landmarks) {
    const tip = getIndexFingerTip(landmarks);
    if (tip) zoomIn(1.0 - tip.x, tip.y);
  } else {
    zoomOut();
  }

  gestureHoldTimer = setInterval(() => {
    if (direction === 'in') {
      const state = getState();
      if (state.zoomLevel < 3.0) zoomIn();
    } else {
      zoomOut();
    }
  }, ZOOM_REPEAT_MS);
}

function clearGestureHold() {
  if (gestureHoldTimer) {
    clearInterval(gestureHoldTimer);
    gestureHoldTimer = null;
  }
}

function onLandmarks(landmarks) {
  // Laser pointer mode
  if (currentGesture === 'open_palm' && landmarks) {
    const action = getAction('open_palm');
    if (action === 'laser') {
      const tip = getIndexFingerTip(landmarks);
      if (tip) {
        const container = document.getElementById('slide-container');
        showLaserPointer(tip.x, tip.y, container);
      }
    }
  } else if (currentGesture !== 'open_palm') {
    hideLaserPointer();
  }

  // Annotation mode
  if (currentGesture === 'peace' && landmarks) {
    const action = getAction('peace');
    if (action === 'annotate') {
      const tip = getIndexFingerTip(landmarks);
      if (tip) {
        drawAt(tip.x, tip.y);
      }
    }
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
        nextSlide();
        clearAnnotations();
        break;
      case 'ArrowLeft':
        prevSlide();
        clearAnnotations();
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 't':
      case 'T':
        toggleThumbnails();
        break;
      case 'c':
      case 'C':
        clearAnnotations();
        break;
      case '?':
        showOnboarding();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          stopWebcam();
          hideLaserPointer();
          hideThumbnails();
          showScreen('landing');
        }
        break;
    }
  });
}

window.addEventListener('resize', () => {
  const state = getState();
  if (state.totalPages > 0) {
    renderPage();
    resizeAnnotationCanvas();
  }
});

init();
