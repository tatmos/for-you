# Project: Meaning-space Surfing (Web prototype)

## Intent
Create an interactive, game-like visualization of "high-dimensional semantic space" that preserves the model's intuition-like behavior:
- No anthropomorphic protagonist required
- Minimal narration / minimal explanation UI
- Emphasize flow/gradient, drift, coherence, and "structure emergence"

## Core Concept
- Player navigates a semantic field (nodes/edges) as a drifting viewpoint.
- "Intuition" = local gradient / most natural continuation direction in a probability-like landscape.
- No win/lose; it is an experiential instrument.

## Interaction Goals
- Pan/zoom/orbit
- Hover/pick a node: reveal neighborhood cluster softly (LOD)
- Drift mode: camera tends to follow local flow field (vector field)
- “Coherence” feedback: when moving along gradient, visuals become cleaner / more connected.

## Visual Language
- Nodes = concepts (points)
- Edges = association strength (lines)
- Flow = vector field / streamlines (subtle)
- LOD: far = points only; near = labels, edges, metadata.

## Audio (optional, later)
- High entropy regions -> noisier ambience
- Coherent flow -> stable harmonic bed / filter opens

## Constraints
- Keep UI minimal; no heavy explanatory overlays.
- Must run locally in browser; start with Web (Unity later).
- Prefer Vite + TypeScript + Three.js (or Pixi.js for 2D).
