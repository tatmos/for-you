import * as THREE from "three";
import type { GraphData } from "../graph/sampleGraph";

export type FlowField = {
  vectors: THREE.Vector3[];
  sample: (position: THREE.Vector3) => THREE.Vector3;
};

export const createFlowField = (graph: GraphData): FlowField => {
  const vectors = graph.nodes.map(() => new THREE.Vector3());

  graph.nodes.forEach((node, index) => {
    const neighbors = graph.adjacency.get(node.id) ?? [];
    const flow = new THREE.Vector3();
    neighbors.forEach((neighborId) => {
      const neighbor = graph.nodes[neighborId];
      const edge = graph.edges.find(
        (candidate) =>
          (candidate.source === node.id && candidate.target === neighborId) ||
          (candidate.target === node.id && candidate.source === neighborId)
      );
      const weight = edge?.weight ?? 0.3;
      flow.add(
        neighbor.position.clone().sub(node.position).multiplyScalar(weight)
      );
    });
    vectors[index] = flow.lengthSq() > 0 ? flow.normalize() : new THREE.Vector3();
  });

  const sample = (position: THREE.Vector3) => {
    let closest = 0;
    let closestDist = Infinity;
    graph.nodes.forEach((node, index) => {
      const dist = node.position.distanceToSquared(position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = index;
      }
    });
    return vectors[closest].clone();
  };

  return { vectors, sample };
};
