let skeletonCanvas = null;
let skeletonCtx = null;
let toastTimer = null;
let counterFadeTimer = null;

const GESTURE_DISPLAY = {
  'none':        { icon: '🤚', text: 'Waiting...' },
  'swipe_left':  { icon: '👈', text: 'Previous' },
  'swipe_right': { icon: '👉', text: 'Next' },
  'thumbs_up':   { icon: '👍', text: 'Zoom In' },
  'thumbs_down': { icon: '👎', text: 'Zoom Out' },
  'open_palm':   { icon: '🖐', text: 'Pointer' },
  'fist':        { icon: '✊', text: 'Reset Zoom' },
  'peace':       { icon: '✌️', text: 'Annotate' }
};

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function initUI(skeletonCanvasEl) {
  skeletonCanvas = skeletonCanvasEl;
  if (skeletonCanvas) {
    skeletonCtx = skeletonCanvas.getContext('2d');
  }
}

function drawHandSkeleton(landmarks) {
  if (!skeletonCanvas || !skeletonCtx) return;

  const w = skeletonCanvas.width = skeletonCanvas.offsetWidth * window.devicePixelRatio;
  const h = skeletonCanvas.height = skeletonCanvas.offsetHeight * window.devicePixelRatio;
  skeletonCtx.clearRect(0, 0, w, h);

  if (!landmarks) return;

  skeletonCtx.strokeStyle = '#00ff88';
  skeletonCtx.lineWidth = 2;
  for (const [i, j] of HAND_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    skeletonCtx.beginPath();
    skeletonCtx.moveTo(a.x * w, a.y * h);
    skeletonCtx.lineTo(b.x * w, b.y * h);
    skeletonCtx.stroke();
  }

  skeletonCtx.fillStyle = '#00ff88';
  for (const lm of landmarks) {
    skeletonCtx.beginPath();
    skeletonCtx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
    skeletonCtx.fill();
  }
}

function showGestureToast(gesture) {
  const display = GESTURE_DISPLAY[gesture] || GESTURE_DISPLAY['none'];
  if (gesture === 'none' || gesture === 'open_palm') return;

  const toast = document.getElementById('gesture-toast');
  if (!toast) return;

  toast.querySelector('.toast-icon').textContent = display.icon;
  toast.querySelector('.toast-text').textContent = display.text;
  toast.classList.remove('visible');

  // Force reflow to restart animation
  void toast.offsetWidth;
  toast.classList.add('visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 1200);
}

function updateSlideCounter(current, total) {
  const counter = document.getElementById('slide-counter');
  if (!counter) return;

  document.getElementById('current-slide').textContent = current;
  document.getElementById('total-slides').textContent = total;

  // Flash visible then fade
  counter.classList.add('visible');
  clearTimeout(counterFadeTimer);
  counterFadeTimer = setTimeout(() => {
    counter.classList.remove('visible');
  }, 2000);
}

function showLaserPointer(x, y, slideContainer) {
  const pointer = document.getElementById('laser-pointer');
  pointer.hidden = false;
  const rect = slideContainer.getBoundingClientRect();
  const mirroredX = 1.0 - x;
  pointer.style.left = `${mirroredX * rect.width}px`;
  pointer.style.top = `${y * rect.height}px`;
}

function hideLaserPointer() {
  const pointer = document.getElementById('laser-pointer');
  if (pointer) pointer.hidden = true;
}

function showCameraError(type) {
  const toast = document.getElementById('gesture-toast');
  if (!toast) return;

  const icon = toast.querySelector('.toast-icon');
  const text = toast.querySelector('.toast-text');

  if (type === 'denied') {
    icon.textContent = '🚫';
    text.textContent = 'Camera blocked — click lock icon to allow';
  } else {
    icon.textContent = '⚠️';
    text.textContent = 'Camera unavailable — keyboard only';
  }
  toast.classList.add('visible', 'error');
}

function setupDragDrop(dropZone, fileInput, onFileLoad) {
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) readPdfFile(file, onFileLoad);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      readPdfFile(file, onFileLoad);
    }
  });
}

function readPdfFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => callback(e.target.result);
  reader.readAsArrayBuffer(file);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function showOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.add('visible');
}

function hideOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('visible');
}

export {
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
};
