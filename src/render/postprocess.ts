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
    0.6,  // strength
    0.4,  // radius
    0.85  // threshold
  );
  composer.addPass(bloomPass);

  let targetStrength = 0.6;
  let targetRadius = 0.4;
  let targetThreshold = 0.85;

  const update = (fields: ScalarFields) => {
    const { coherence, entropy } = fields;
    
    // High coherence = stronger, more visible bloom
    targetStrength = 0.3 + coherence * 0.9;
    targetRadius = 0.3 + coherence * 0.5;
    targetThreshold = 0.9 - coherence * 0.25;
    
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
