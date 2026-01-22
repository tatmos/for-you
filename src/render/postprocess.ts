import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { ScalarFields } from "../field/flow";
import { VisualizationMode } from "../metrics/paramBus";
import type { BreathState } from "../metrics/breath";

export type PostProcessor = {
  composer: EffectComposer;
  update: (fields: ScalarFields, mode: VisualizationMode, breath: BreathState) => void;
  resize: (width: number, height: number) => void;
};

export const createPostProcessor = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
): PostProcessor => {
  const composer = new EffectComposer(renderer);
  
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5,  // strength (moderate default)
    0.35, // radius
    0.88  // threshold (higher to prevent washout)
  );
  composer.addPass(bloomPass);

  let targetStrength = 0.5;
  let targetRadius = 0.35;
  let targetThreshold = 0.88;

  const update = (fields: ScalarFields, mode: VisualizationMode, breath: BreathState) => {
    const { coherence, entropy } = fields;
    
    // Non-linear coherence curve using smoothstep for artistic feel
    const cohCurve = THREE.MathUtils.smoothstep(coherence, 0, 1);
    const cohSquared = coherence * coherence;
    
    const isInternalized = mode === VisualizationMode.Internalized;
    
    // Breathing modulation: inhale = slightly stronger bloom (luminosity of attention)
    const breathModulation = isInternalized ? (1.0 + breath.phase * 0.12) : 1.0;
    
    // Bloom as "atmosphere clarity" not "white blowout"
    // In Internalized Mode: reduce global bloom, emphasize presence over brightness
    let strengthMultiplier = 1.0;
    let radiusMultiplier = 1.0;
    let thresholdOffset = 0;
    
    if (isInternalized) {
      strengthMultiplier = 0.7 * breathModulation; // Reduce global bloom, modulate with breath
      radiusMultiplier = 0.8; // Tighter radius
      thresholdOffset = 0.05; // Slightly higher threshold
    }
    
    // Strength increases with coherence but stays moderate
    targetStrength = (0.35 + cohSquared * 0.55) * strengthMultiplier;
    
    // Radius increases slightly with coherence (spread, not intensity)
    targetRadius = (0.3 + cohCurve * 0.35) * radiusMultiplier;
    
    // Threshold stays high to prevent washout
    targetThreshold = 0.92 - cohSquared * 0.18 + thresholdOffset;
    
    // Smooth interpolation
    bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, targetStrength, 0.03);
    bloomPass.radius = THREE.MathUtils.lerp(bloomPass.radius, targetRadius, 0.03);
    bloomPass.threshold = THREE.MathUtils.lerp(bloomPass.threshold, targetThreshold, 0.03);
  };

  const resize = (width: number, height: number) => {
    composer.setSize(width, height);
  };

  return { composer, update, resize };
};
