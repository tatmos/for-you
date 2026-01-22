import * as THREE from "three";
import type { GraphData } from "../graph/sampleGraph";

export type ScalarFields = {
  coherence: number;
  entropy: number;
  flowStrength: number;
};

export type FlowField = {
  vectors: THREE.Vector3[];
  sample: (position: THREE.Vector3) => THREE.Vector3;
  sampleFields: (position: THREE.Vector3) => ScalarFields;
  getNodeFields: (nodeIndex: number) => ScalarFields;
};

export const createFlowField = (graph: GraphData): FlowField => {
  const vectors = graph.nodes.map(() => new THREE.Vector3());
  const nodeFields: ScalarFields[] = [];

  graph.nodes.forEach((node, index) => {
    const neighbors = graph.adjacency.get(node.id) ?? [];
    const flow = new THREE.Vector3();
    let totalWeight = 0;
    let alignmentSum = 0;
    
    neighbors.forEach((neighborId) => {
      const neighbor = graph.nodes[neighborId];
      const edge = graph.edges.find(
        (candidate) =>
          (candidate.source === node.id && candidate.target === neighborId) ||
          (candidate.target === node.id && candidate.source === neighborId)
      );
      const weight = edge?.weight ?? 0.3;
      const direction = neighbor.position.clone().sub(node.position);
      flow.add(direction.clone().multiplyScalar(weight));
      totalWeight += weight;
    });

    const flowStrength = flow.length() / Math.max(neighbors.length, 1);
    const normalizedFlow = flow.lengthSq() > 0 ? flow.clone().normalize() : new THREE.Vector3();
    
    // Calculate coherence: alignment between neighbors' directions
    let coherenceSum = 0;
    if (neighbors.length > 1) {
      neighbors.forEach((neighborId) => {
        const neighbor = graph.nodes[neighborId];
        const dir1 = neighbor.position.clone().sub(node.position).normalize();
        neighbors.forEach((otherId) => {
          if (otherId !== neighborId) {
            const other = graph.nodes[otherId];
            const dir2 = other.position.clone().sub(node.position).normalize();
            coherenceSum += Math.max(0, dir1.dot(dir2));
          }
        });
      });
      coherenceSum /= neighbors.length * (neighbors.length - 1);
    }

    const coherence = THREE.MathUtils.clamp(coherenceSum, 0, 1);
    const entropy = 1 - coherence;

    vectors[index] = normalizedFlow;
    nodeFields[index] = {
      coherence,
      entropy,
      flowStrength: THREE.MathUtils.clamp(flowStrength, 0, 1)
    };
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

  const sampleFields = (position: THREE.Vector3): ScalarFields => {
    // Find 3 closest nodes and interpolate
    const distances: { index: number; dist: number }[] = [];
    graph.nodes.forEach((node, index) => {
      const dist = node.position.distanceToSquared(position);
      distances.push({ index, dist });
    });
    distances.sort((a, b) => a.dist - b.dist);
    
    const nearest = distances.slice(0, 3);
    const totalInvDist = nearest.reduce((sum, item) => sum + 1 / (item.dist + 0.1), 0);
    
    let coherence = 0;
    let entropy = 0;
    let flowStrength = 0;
    
    nearest.forEach(({ index, dist }) => {
      const weight = (1 / (dist + 0.1)) / totalInvDist;
      coherence += nodeFields[index].coherence * weight;
      entropy += nodeFields[index].entropy * weight;
      flowStrength += nodeFields[index].flowStrength * weight;
    });

    return { coherence, entropy, flowStrength };
  };

  const getNodeFields = (nodeIndex: number): ScalarFields => {
    return nodeFields[nodeIndex] ?? { coherence: 0, entropy: 1, flowStrength: 0 };
  };

  return { vectors, sample, sampleFields, getNodeFields };
};
