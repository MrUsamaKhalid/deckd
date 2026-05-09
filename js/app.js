import { initPdfViewer, loadPdf, nextSlide, prevSlide, zoomIn, zoomOut, resetZoom, renderPage, getState } from './pdf-viewer.js';
import { initGesture, startWebcam, stopWebcam, getIndexFingerTip } from './gesture.js';
import {
  initUI,
  drawHandSkeleton,
  updateGestureBadge,
  updateSlideCounter,
  showLaserPointer,
  hideLaserPointer,
  setupDragDrop,
  showScreen,
  showCameraError
} from './ui.js';

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
      updateSlideCounter(1, getState().totalPages);
    }
  } catch (err) {
    console.error('[Deckd] Init error:', err);
  }
}

async function onPdfLoaded(arrayBuffer) {
  try {
    await startPresenter();
    await loadPdf(arrayBuffer);
    updateSlideCounter(1, getState().totalPages);
  } catch (err) {
    console.error('[Deckd] PDF load error:', err);
  }
}

async function startPresenter() {
  showScreen('presenter');

  const slideCanvas = document.getElementById('slide-canvas');
  await initPdfViewer(slideCanvas, (current, total) => {
    updateSlideCounter(current, total);
  });

  const skeletonCanvas = document.getElementById('skeleton-canvas');
  initUI(skeletonCanvas);

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
  currentGesture = gesture;
  updateGestureBadge(gesture);

  switch (gesture) {
    case 'swipe_right':
      nextSlide();
      break;
    case 'swipe_left':
      prevSlide();
      break;
    case 'thumbs_up':
      handleZoomGesture(landmarks, 'in');
      break;
    case 'thumbs_down':
      handleZoomGesture(landmarks, 'out');
      break;
    case 'fist':
      resetZoom();
      break;
    case 'open_palm':
      break;
    case 'none':
      hideLaserPointer();
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
  drawHandSkeleton(landmarks);

  if (currentGesture === 'open_palm' && landmarks) {
    const tip = getIndexFingerTip(landmarks);
    if (tip) {
      const container = document.getElementById('slide-container');
      showLaserPointer(tip.x, tip.y, container);
    }
  } else if (currentGesture !== 'open_palm') {
    hideLaserPointer();
  }
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
        nextSlide();
        break;
      case 'ArrowLeft':
        prevSlide();
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case 'Escape':
        stopWebcam();
        hideLaserPointer();
        showScreen('landing');
        break;
    }
  });
}

window.addEventListener('resize', () => {
  const state = getState();
  if (state.totalPages > 0) renderPage();
});

init();
