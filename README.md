# Deckd

**Control presentations with your hands.**

Deckd is a browser-based PDF presentation tool controlled entirely by hand gestures via your webcam. No install, no server, no sign-up. Your files stay 100% on your machine.

## How to Use

1. Open Deckd
2. Drop a PDF file onto the page (or click to browse)
3. Allow webcam access when prompted
4. Present using hand gestures!

You can also link directly to a PDF via URL parameter: `?pdf=https://example.com/slides.pdf`

## Gesture Controls

| Gesture | Action |
|---------|--------|
| Swipe Right | Next slide |
| Swipe Left | Previous slide |
| Thumbs Up | Zoom in (follows hand position) |
| Thumbs Down | Zoom out |
| Open Palm | Laser pointer mode |
| Fist | Reset zoom |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Right Arrow | Next slide |
| Left Arrow | Previous slide |
| + | Zoom in |
| - | Zoom out |
| Esc | Back to landing page |

## Tech Stack

- [MediaPipe Hands](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) - real-time hand tracking
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering
- Vanilla HTML/CSS/JS - no framework, no build step

## Privacy

Everything runs in your browser. Your PDF files and webcam feed are never uploaded anywhere.

## Development

Just serve the files locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`.

## License

MIT
