import * as THREE from "three";
import { VisualizationMode } from "../metrics/paramBus";

export type LodOptions = {
  camera: THREE.PerspectiveCamera;
  edges: THREE.LineSegments;
  labels: THREE.Sprite[];
  hoveredIndex: number | null;
  neighborSet: Set<number>;
  mode: VisualizationMode;
};

export const updateLod = ({
  camera,
  edges,
  labels,
  hoveredIndex,
  neighborSet,
  mode
}: LodOptions) => {
  const distance = camera.position.length();
  const isInternalized = mode === VisualizationMode.Internalized;
  
  // In Internalized Mode: hide edges entirely (de-emphasize network structure)
  let showEdges = distance < 120;
  if (isInternalized) {
    showEdges = false;
  }

  if (edges.visible !== showEdges) {
    edges.visible = showEdges;
  }

  // In Internalized Mode: hide labels (no explanatory text)
  labels.forEach((label, index) => {
    const shouldShow = !isInternalized &&
      hoveredIndex !== null &&
      (index === hoveredIndex || neighborSet.has(index));
    label.visible = shouldShow;
    if (shouldShow) {
      const scale = THREE.MathUtils.clamp(120 / distance, 0.6, 1.4);
      label.scale.setScalar(scale * 6);
    }
  });
};
