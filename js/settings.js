const STORAGE_KEY = 'deckd-settings';
const ONBOARDED_KEY = 'deckd-onboarded';

const DEFAULT_MAPPINGS = {
  swipe_right: 'next',
  swipe_left: 'prev',
  thumbs_up: 'zoomIn',
  thumbs_down: 'zoomOut',
  open_palm: 'laser',
  fist: 'resetZoom',
  peace: 'annotate'
};

const ACTION_LABELS = {
  next: 'Next Slide',
  prev: 'Previous Slide',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  resetZoom: 'Reset Zoom',
  laser: 'Laser Pointer',
  annotate: 'Annotate',
  thumbnails: 'Thumbnails',
  fullscreen: 'Fullscreen',
  none: 'Do Nothing'
};

let mappings = { ...DEFAULT_MAPPINGS };

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      mappings = { ...DEFAULT_MAPPINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    mappings = { ...DEFAULT_MAPPINGS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

function getAction(gesture) {
  return mappings[gesture] || null;
}

function setMapping(gesture, action) {
  mappings[gesture] = action;
  saveSettings();
}

function getMappings() {
  return { ...mappings };
}

function getActionLabels() {
  return { ...ACTION_LABELS };
}

function isOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

function setOnboarded() {
  localStorage.setItem(ONBOARDED_KEY, 'true');
}

function resetSettings() {
  mappings = { ...DEFAULT_MAPPINGS };
  saveSettings();
}

// Initialize on import
loadSettings();

export {
  getAction,
  setMapping,
  getMappings,
  getActionLabels,
  isOnboarded,
  setOnboarded,
  resetSettings,
  DEFAULT_MAPPINGS
};
