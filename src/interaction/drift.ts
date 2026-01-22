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
    if (targetDirection.lengthSq() === 0) {
      return 0;
    }

    velocity.lerp(targetDirection.multiplyScalar(driftSpeed), 0.08);
    camera.position.addScaledVector(velocity, delta);
    const alignment = camera.getWorldDirection(new THREE.Vector3()).dot(
      targetDirection.clone().normalize()
    );
    return alignment;
  };

  return { enabled, toggle, update };
};
