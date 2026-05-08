const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22';

let handLandmarker = null;
let webcamStream = null;
let videoElement = null;
let gestureCallback = null;
let landmarkCallback = null;
let running = false;

const SWIPE_THRESHOLD = 0.15;
const SWIPE_TIME_WINDOW = 300;
const COOLDOWN_MS = 500;

let wristHistory = [];
let lastGestureTime = 0;
let lastGesture = 'none';

async function initGesture(videoEl, onGesture, onLandmarks) {
  videoElement = videoEl;
  gestureCallback = onGesture;
  landmarkCallback = onLandmarks;

  const vision = await import(`${MEDIAPIPE_CDN}/vision_bundle.mjs`);
  const { HandLandmarker, FilesetResolver } = vision;

  const wasmFileset = await FilesetResolver.forVisionTasks(
    `${MEDIAPIPE_CDN}/wasm`
  );

  handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      modelAssetPath: `${MEDIAPIPE_CDN}/hand_landmarker.task`,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 1
  });
}

async function startWebcam() {
  webcamStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' }
  });
  videoElement.srcObject = webcamStream;
  await new Promise(resolve => {
    videoElement.onloadedmetadata = resolve;
  });
  running = true;
  detectLoop();
}

function stopWebcam() {
  running = false;
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
  }
}

function detectLoop() {
  if (!running || !handLandmarker) return;

  const now = performance.now();
  const results = handLandmarker.detectForVideo(videoElement, now);

  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    if (landmarkCallback) landmarkCallback(landmarks);
    processGestures(landmarks, now);
  } else {
    if (landmarkCallback) landmarkCallback(null);
    emitGesture('none', null, now);
  }

  requestAnimationFrame(detectLoop);
}

function processGestures(landmarks, now) {
  const wrist = landmarks[0];

  wristHistory.push({ x: wrist.x, time: now });
  wristHistory = wristHistory.filter(p => now - p.time < SWIPE_TIME_WINDOW);

  if (now - lastGestureTime < COOLDOWN_MS) {
    const staticGesture = classifyStaticGesture(landmarks);
    emitGesture(staticGesture, landmarks, now);
    return;
  }

  if (wristHistory.length >= 2) {
    const first = wristHistory[0];
    const last = wristHistory[wristHistory.length - 1];
    const deltaX = last.x - first.x;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const gesture = deltaX > 0 ? 'swipe_right' : 'swipe_left';
      emitGesture(gesture, landmarks, now);
      lastGestureTime = now;
      wristHistory = [];
      return;
    }
  }

  const staticGesture = classifyStaticGesture(landmarks);
  emitGesture(staticGesture, landmarks, now);

  if (staticGesture === 'thumbs_up' || staticGesture === 'thumbs_down' || staticGesture === 'fist') {
    if (lastGesture !== staticGesture) {
      lastGestureTime = now;
    }
  }
}

function classifyStaticGesture(landmarks) {
  const dominated = isRightHand(landmarks);
  const fingers = getFingerStates(landmarks, dominated);

  const thumbUp = fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
  if (thumbUp) {
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    if (thumbTip.y < thumbBase.y) return 'thumbs_up';
    else return 'thumbs_down';
  }

  if (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
    return 'open_palm';
  }

  if (!fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    return 'fist';
  }

  return 'none';
}

function isRightHand(landmarks) {
  return landmarks[17].x < landmarks[5].x;
}

function getFingerStates(landmarks, isRight) {
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumb = isRight ? (thumbTip.x < thumbIP.x) : (thumbTip.x > thumbIP.x);

  const index = landmarks[8].y < landmarks[6].y;
  const middle = landmarks[12].y < landmarks[10].y;
  const ring = landmarks[16].y < landmarks[14].y;
  const pinky = landmarks[20].y < landmarks[18].y;

  return { thumb, index, middle, ring, pinky };
}

function emitGesture(gesture, landmarks, now) {
  lastGesture = gesture;
  if (gestureCallback) {
    gestureCallback(gesture, landmarks);
  }
}

function getIndexFingerTip(landmarks) {
  if (!landmarks) return null;
  return { x: landmarks[8].x, y: landmarks[8].y };
}

export {
  initGesture,
  startWebcam,
  stopWebcam,
  getIndexFingerTip
};
