import * as THREE from "three";

export type LodOptions = {
  camera: THREE.PerspectiveCamera;
  edges: THREE.LineSegments;
  labels: THREE.Sprite[];
  hoveredIndex: number | null;
  neighborSet: Set<number>;
};

export const updateLod = ({
  camera,
  edges,
  labels,
  hoveredIndex,
  neighborSet
}: LodOptions) => {
  const distance = camera.position.length();
  const showEdges = distance < 120;

  if (edges.visible !== showEdges) {
    edges.visible = showEdges;
  }

  labels.forEach((label, index) => {
    const shouldShow =
      hoveredIndex !== null &&
      (index === hoveredIndex || neighborSet.has(index));
    label.visible = shouldShow;
    if (shouldShow) {
      const scale = THREE.MathUtils.clamp(120 / distance, 0.6, 1.4);
      label.scale.setScalar(scale * 6);
    }
  });
};
