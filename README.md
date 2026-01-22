# Meaning-space Surfing (Web Prototype)

A minimal Three.js + Vite prototype for drifting through a semantic field. Nodes represent concepts, edges show association strength, and a flow field gently influences drift mode.

## Features
- Deterministic graph generation (~300 nodes + weighted edges)
- Subtle starfield-like node cloud with faint edges
- Hover to highlight a neighborhood and reveal labels
- Drift mode (spacebar) aligns camera velocity with the local flow field

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Controls
- Drag: orbit
- Scroll: zoom
- Space: toggle drift mode
