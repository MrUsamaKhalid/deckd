const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let handLandmarker = null;
let webcamStream = null;
let videoElement = null;
let gestureCallback = null;
let landmarkCallback = null;
let running = false;

// --- Tuning constants ---

// Swipe detection (uses index fingertip for more signal)
const SWIPE_THRESHOLD = 0.12;
const MIN_VELOCITY = 0.0004;
const SWIPE_TIME_WINDOW = 350;

// Hysteresis — reduced from 6 to 3 for snappier response
const CONFIRM_FRAMES = 3;
let candidateGesture = null;
let candidateFrames = 0;
let confirmedGesture = 'none';

// Per-type cooldowns
const COOLDOWN_SWIPE = 500;
const COOLDOWN_STATIC = 200;
let lastSwipeTime = 0;
let lastStaticTime = 0;

// Finger margin — lowered because EMA smoothing handles jitter
const FINGER_MARGIN = 0.015;

// EMA smoothing (alpha = 0.4 → 40% new data, 60% smoothed history)
const SMOOTH_ALPHA = 0.4;
let smoothedLandmarks = null;

// Throttle detection to ~30fps for performance
const DETECT_INTERVAL_MS = 33;
let lastDetectTime = 0;

// Swipe history (tracks index fingertip, not just wrist)
let swipeHistory = [];

// Handedness from MediaPipe
let detectedHandedness = 'Right';

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
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6
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
  smoothedLandmarks = null;
  detectLoop();
}

function stopWebcam() {
  running = false;
  smoothedLandmarks = null;
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
  }
}

function detectLoop() {
  if (!running || !handLandmarker) return;

  const now = performance.now();

  // Throttle to ~30fps — reduces GPU pressure and lag
  if (now - lastDetectTime < DETECT_INTERVAL_MS) {
    requestAnimationFrame(detectLoop);
    return;
  }
  lastDetectTime = now;

  const results = handLandmarker.detectForVideo(videoElement, now);

  if (results.landmarks && results.landmarks.length > 0) {
    const rawLandmarks = results.landmarks[0];

    // Get handedness from MediaPipe (much more accurate than computing)
    if (results.handedness && results.handedness.length > 0) {
      detectedHandedness = results.handedness[0][0].categoryName; // "Left" or "Right"
    }

    // Apply EMA smoothing to reduce jitter
    const landmarks = smoothLandmarks(rawLandmarks);

    if (landmarkCallback) landmarkCallback(landmarks);
    processGestures(landmarks, now);
  } else {
    smoothedLandmarks = null;
    if (landmarkCallback) landmarkCallback(null);
    updateStateMachine('none', null, now);
  }

  requestAnimationFrame(detectLoop);
}

// Exponential moving average on all 21 landmarks
function smoothLandmarks(raw) {
  if (!smoothedLandmarks) {
    smoothedLandmarks = raw.map(p => ({ x: p.x, y: p.y, z: p.z }));
    return smoothedLandmarks;
  }

  smoothedLandmarks = raw.map((p, i) => ({
    x: SMOOTH_ALPHA * p.x + (1 - SMOOTH_ALPHA) * smoothedLandmarks[i].x,
    y: SMOOTH_ALPHA * p.y + (1 - SMOOTH_ALPHA) * smoothedLandmarks[i].y,
    z: SMOOTH_ALPHA * p.z + (1 - SMOOTH_ALPHA) * smoothedLandmarks[i].z
  }));

  return smoothedLandmarks;
}

function processGestures(landmarks, now) {
  // Use index fingertip (landmark 8) for swipe — more movement than wrist
  const indexTip = landmarks[8];

  swipeHistory.push({ x: indexTip.x, time: now });
  swipeHistory = swipeHistory.filter(p => now - p.time < SWIPE_TIME_WINDOW);

  // Check swipes first (bypass hysteresis — swipes are instant)
  if (now - lastSwipeTime >= COOLDOWN_SWIPE && swipeHistory.length >= 3) {
    const first = swipeHistory[0];
    const last = swipeHistory[swipeHistory.length - 1];
    const deltaX = last.x - first.x;
    const deltaTime = last.time - first.time;

    if (deltaTime > 0 && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const velocity = Math.abs(deltaX) / deltaTime;
      if (velocity > MIN_VELOCITY) {
        // Check direction consistency — at least 60% of movement should agree
        if (isSwipeConsistent(deltaX > 0)) {
          // Webcam is mirrored — negate so user's right = swipe_right
          const gesture = deltaX > 0 ? 'swipe_left' : 'swipe_right';
          emitGesture(gesture, landmarks);
          lastSwipeTime = now;
          swipeHistory = [];
          return;
        }
      }
    }
  }

  // Static gestures go through hysteresis
  const raw = classifyStaticGesture(landmarks);
  updateStateMachine(raw, landmarks, now);
}

// Verify swipe direction is consistent (not jittery back-and-forth)
function isSwipeConsistent(isPositive) {
  if (swipeHistory.length < 3) return false;
  let agree = 0;
  for (let i = 1; i < swipeHistory.length; i++) {
    const dx = swipeHistory[i].x - swipeHistory[i - 1].x;
    if ((dx > 0) === isPositive) agree++;
  }
  return agree / (swipeHistory.length - 1) >= 0.55;
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
  // Use MediaPipe handedness (mirrored in webcam: MP says "Right" for user's right hand)
  const isRight = detectedHandedness === 'Right';
  const fingers = getFingerStates(landmarks, isRight);

  // Peace sign: index + middle up, rest down
  if (!fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    return 'peace';
  }

  // Thumbs up/down: only thumb extended (allow ring/pinky ambiguity)
  if (fingers.thumb && !fingers.index && !fingers.middle) {
    const thumbTip = landmarks[4];
    const wrist = landmarks[0];
    // Use wrist as reference for vertical direction — more robust
    if (thumbTip.y < wrist.y - 0.08) return 'thumbs_up';
    if (thumbTip.y > wrist.y + 0.04) return 'thumbs_down';
  }

  // Open palm: all 5 extended
  if (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
    return 'open_palm';
  }

  // Fist: none extended (relaxed check — allow thumb ambiguity)
  if (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    return 'fist';
  }

  return 'none';
}

function getFingerStates(landmarks, isRight) {
  // Thumb: compare tip (4) vs CMC base (1) in x-axis
  // More robust than using IP joint — bigger distance, less noise
  const thumbTip = landmarks[4];
  const thumbCMC = landmarks[1];
  const thumb = isRight
    ? (thumbTip.x < thumbCMC.x - FINGER_MARGIN)
    : (thumbTip.x > thumbCMC.x + FINGER_MARGIN);

  // Fingers: tip vs PIP — the standard 2-joint check
  // With EMA smoothing, this is reliable even with low margin
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
