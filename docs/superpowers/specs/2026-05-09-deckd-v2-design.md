# Deckd v2 Design Spec

## Overview
Major upgrade: gesture reliability, cinema minimal visual redesign, new features (thumbnails, annotations, fullscreen, gesture customization), and first-use onboarding.

## 1. Gesture Reliability

### Hysteresis State Machine
- Static gestures require 6 consecutive frames (~200ms) of same classification before triggering
- Swipes remain instant (already time-windowed)
- Gesture state: `idle → candidate(gesture, frameCount) → confirmed → cooldown`

### Confidence Filtering
- Finger extension check uses margin threshold: `tip.y < pip.y - MARGIN` where MARGIN = 0.04
- Borderline poses classify as `none` instead of flickering

### Swipe Improvements  
- Add velocity check: `deltaX / deltaTime > MIN_VELOCITY`
- MIN_VELOCITY = 0.0005 px/ms

### Per-Type Cooldowns
- Swipes: 600ms
- Static gestures: 300ms

## 2. Visual — Cinema Minimal

### Webcam PiP
- Floating 64px circle, bottom-left corner, 12px margin
- `border-radius: 50%; border: 2px solid rgba(255,255,255,0.15)`
- No skeleton overlay in PiP (too small to be useful)

### Gesture Toast
- Centered floating pill, appears on gesture trigger
- Fade in 150ms, hold 800ms, fade out 400ms
- `background: rgba(255,255,255,0.12); backdrop-filter: blur(20px); border-radius: 20px`
- Shows gesture emoji + action text

### Slide Transitions
- CSS transition on canvas opacity: fade out 150ms, render new page, fade in 150ms

### Slide Counter
- Bottom-right, `opacity: 0.3`, bumps to `opacity: 0.8` for 2s after navigation, then fades back

### Laser Pointer Trail
- Add 3 trailing dots that follow with decreasing opacity and size
- Trail fades over 150ms using requestAnimationFrame

### Landing Page Polish
- Logo fade-in on load (0.5s)
- Drop zone subtle scale pulse animation
- Feature badges stagger fade-in

## 3. New Features

### Slide Thumbnails (thumbnails.js)
- Toggle with keyboard `T` or two-finger peace sign gesture
- Horizontal strip at bottom, overlaying slide area, 80px tall
- Render thumbnail canvases at low resolution for each page
- Click or gesture-point to jump to slide
- Auto-hide after 3s of no interaction

### Annotations (annotations.js)  
- Activate with peace sign (index + middle extended, rest closed)
- Canvas overlay on top of slide, same dimensions
- Track index fingertip movement, draw with `ctx.lineTo()`
- Pen color: red (#ff3b30), line width: 3px
- Clear annotations on slide change
- Keyboard `C` to clear current slide annotations

### Fullscreen
- `F` key or double-fist gesture triggers `document.documentElement.requestFullscreen()`
- Exit with Escape (browser native) 
- Hide all browser chrome for clean stage look

### Gesture Customization (settings.js)
- Settings panel accessible via gear icon on landing page or `S` key during presentation
- Simple dropdown mapping: each gesture → action
- Default mappings as current, stored in localStorage
- Actions: next, prev, zoomIn, zoomOut, resetZoom, laser, annotate, thumbnails, fullscreen

## 4. Onboarding

### First-Visit Tutorial
- Detect first visit via `localStorage.getItem('deckd-onboarded')`
- After PDF loads, show overlay with gesture guide cards
- 6 cards, one per gesture, with hand illustration + action label
- "Got it" button dismisses and sets localStorage flag
- Can re-trigger from settings or `?` key

## File Structure

```
js/
  app.js          — controller (updated wiring)
  gesture.js      — improved detection + state machine
  pdf-viewer.js   — add slide transitions
  ui.js           — cinema minimal redesign + toast + PiP
  thumbnails.js   — NEW: slide thumbnail strip
  annotations.js  — NEW: drawing overlay
  settings.js     — NEW: gesture customization + onboarding
```
