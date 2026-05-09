const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let handLandmarker = null;
let webcamStream = null;
let videoElement = null;
let gestureCallback = null;
let landmarkCallback = null;
let running = false;

// Swipe detection
const SWIPE_THRESHOLD = 0.15;
const MIN_VELOCITY = 0.0005;
const SWIPE_TIME_WINDOW = 300;

// Hysteresis state machine
const CONFIRM_FRAMES = 6;
let candidateGesture = null;
let candidateFrames = 0;
let confirmedGesture = 'none';

// Per-type cooldowns
const COOLDOWN_SWIPE = 600;
const COOLDOWN_STATIC = 300;
let lastSwipeTime = 0;
let lastStaticTime = 0;

// Finger margin for confidence
const FINGER_MARGIN = 0.04;

let wristHistory = [];

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
      modelAssetPath: MODEL_URL,
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
    updateStateMachine('none', null, now);
  }

  requestAnimationFrame(detectLoop);
}

function processGestures(landmarks, now) {
  const wrist = landmarks[0];

  wristHistory.push({ x: wrist.x, time: now });
  wristHistory = wristHistory.filter(p => now - p.time < SWIPE_TIME_WINDOW);

  // Check swipes first (instant, no hysteresis)
  if (now - lastSwipeTime >= COOLDOWN_SWIPE && wristHistory.length >= 2) {
    const first = wristHistory[0];
    const last = wristHistory[wristHistory.length - 1];
    const deltaX = last.x - first.x;
    const deltaTime = last.time - first.time;

    if (deltaTime > 0 && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const velocity = Math.abs(deltaX) / deltaTime;
      if (velocity > MIN_VELOCITY) {
        // Webcam is mirrored — negate so user's right = swipe_right
        const gesture = deltaX > 0 ? 'swipe_left' : 'swipe_right';
        emitGesture(gesture, landmarks);
        lastSwipeTime = now;
        wristHistory = [];
        return;
      }
    }
  }

  // Static gestures go through hysteresis
  const raw = classifyStaticGesture(landmarks);
  updateStateMachine(raw, landmarks, now);
}

function updateStateMachine(raw, landmarks, now) {
  if (raw === candidateGesture) {
    candidateFrames++;
  } else {
    candidateGesture = raw;
    candidateFrames = 1;
  }

  if (candidateFrames >= CONFIRM_FRAMES && candidateGesture !== confirmedGesture) {
    if (candidateGesture === 'none' || now - lastStaticTime >= COOLDOWN_STATIC) {
      confirmedGesture = candidateGesture;
      if (candidateGesture !== 'none') lastStaticTime = now;
      emitGesture(confirmedGesture, landmarks);
    }
  }
}

function classifyStaticGesture(landmarks) {
  const isRight = isRightHand(landmarks);
  const fingers = getFingerStates(landmarks, isRight);

  // Peace sign: index + middle up, rest down
  if (!fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    return 'peace';
  }

  // Thumbs up/down: only thumb extended
  if (fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    return thumbTip.y < thumbBase.y ? 'thumbs_up' : 'thumbs_down';
  }

  // Open palm: all extended
  if (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
    return 'open_palm';
  }

  // Fist: none extended
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
  const thumb = isRight
    ? (thumbTip.x < thumbIP.x - FINGER_MARGIN)
    : (thumbTip.x > thumbIP.x + FINGER_MARGIN);

  const index = landmarks[8].y < landmarks[6].y - FINGER_MARGIN;
  const middle = landmarks[12].y < landmarks[10].y - FINGER_MARGIN;
  const ring = landmarks[16].y < landmarks[14].y - FINGER_MARGIN;
  const pinky = landmarks[20].y < landmarks[18].y - FINGER_MARGIN;

  return { thumb, index, middle, ring, pinky };
}

function emitGesture(gesture, landmarks) {
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
