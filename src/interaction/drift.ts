import * as THREE from "three";
import type { FlowField } from "../field/flow";

export type DriftController = {
  enabled: boolean;
  toggle: () => void;
  update: (delta: number) => number;
};

export const createDriftController = (
  camera: THREE.PerspectiveCamera,
  flow: FlowField
): DriftController => {
  const velocity = new THREE.Vector3();
  const targetDirection = new THREE.Vector3();
  const driftSpeed = 6;
  let enabled = false;

  const toggle = () => {
    enabled = !enabled;
  };

  const update = (delta: number) => {
    if (!enabled) {
      velocity.multiplyScalar(0.85);
      camera.position.addScaledVector(velocity, delta);
      return 0;
    }

    targetDirection.copy(flow.sample(camera.position));
    
    // If flow field is zero, decay velocity to prevent jittering at center
    if (targetDirection.lengthSq() < 0.001) {
      velocity.multiplyScalar(0.92); // Decay velocity when no flow
      camera.position.addScaledVector(velocity, delta);
      return 0;
    }

    // Normalize target direction
    targetDirection.normalize();
    
    // Lerp velocity towards target direction
    // Use slightly stronger lerp to prevent oscillation
    const lerpFactor = 0.1;
    const targetVelocity = targetDirection.multiplyScalar(driftSpeed);
    velocity.lerp(targetVelocity, lerpFactor);
    
    // Add small damping to prevent jittering
    velocity.multiplyScalar(0.98);
    
    camera.position.addScaledVector(velocity, delta);
    
    const alignment = camera.getWorldDirection(new THREE.Vector3()).dot(targetDirection);
    return alignment;
  };

  // Return object with getter for enabled property
  return { 
    get enabled() { return enabled; },
    toggle, 
    update 
  };
};
