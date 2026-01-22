import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { ScalarFields } from "../field/flow";

export type PostProcessor = {
  composer: EffectComposer;
  update: (fields: ScalarFields) => void;
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

  const update = (fields: ScalarFields) => {
    const { coherence, entropy } = fields;
    
    // Non-linear coherence curve using smoothstep for artistic feel
    const cohCurve = THREE.MathUtils.smoothstep(coherence, 0, 1);
    const cohSquared = coherence * coherence;
    
    // Bloom as "atmosphere clarity" not "white blowout"
    // Strength increases with coherence but stays moderate
    targetStrength = 0.35 + cohSquared * 0.55; // 0.35-0.9 range
    
    // Radius increases slightly with coherence (spread, not intensity)
    targetRadius = 0.3 + cohCurve * 0.35; // 0.3-0.65 range
    
    // Threshold stays high to prevent washout, lowers slightly in high coherence
    targetThreshold = 0.92 - cohSquared * 0.18; // 0.92-0.74 range
    
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
