let thumbStrip = null;
let thumbCanvas = [];
let visible = false;
let hideTimer = null;
let onJumpTo = null;

const THUMB_HEIGHT = 72;
const AUTO_HIDE_MS = 3000;

function initThumbnails(jumpCallback) {
  onJumpTo = jumpCallback;
  thumbStrip = document.getElementById('thumbnail-strip');
  if (!thumbStrip) return;

  thumbStrip.addEventListener('click', (e) => {
    const thumb = e.target.closest('.thumb-item');
    if (thumb && onJumpTo) {
      const page = parseInt(thumb.dataset.page, 10);
      onJumpTo(page);
      highlightThumb(page);
      scheduleHide();
    }
  });
}

async function renderThumbnails(pdfDoc) {
  if (!thumbStrip) return;

  thumbStrip.innerHTML = '';
  thumbCanvas = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const scale = THUMB_HEIGHT / vp.height;
    const viewport = page.getViewport({ scale });

    const wrapper = document.createElement('div');
    wrapper.className = 'thumb-item';
    wrapper.dataset.page = i;

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const label = document.createElement('span');
    label.className = 'thumb-label';
    label.textContent = i;

    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    thumbStrip.appendChild(wrapper);
    thumbCanvas.push(wrapper);
  }

  highlightThumb(1);
}

function highlightThumb(pageNum) {
  thumbCanvas.forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === pageNum);
  });

  // scroll active into view
  const active = thumbStrip.querySelector('.thumb-item.active');
  if (active) {
    active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function toggleThumbnails() {
  visible = !visible;
  thumbStrip.classList.toggle('visible', visible);
  if (visible) scheduleHide();
}

function showThumbnails() {
  visible = true;
  thumbStrip.classList.add('visible');
  scheduleHide();
}

function hideThumbnails() {
  visible = false;
  thumbStrip.classList.remove('visible');
  clearTimeout(hideTimer);
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideThumbnails, AUTO_HIDE_MS);
}

function isThumbnailsVisible() {
  return visible;
}

export {
  initThumbnails,
  renderThumbnails,
  highlightThumb,
  toggleThumbnails,
  showThumbnails,
  hideThumbnails,
  isThumbnailsVisible
};
