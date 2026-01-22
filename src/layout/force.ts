import * as THREE from "three";
import type { GraphData } from "../graph/sampleGraph";

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const layoutGraph = (graph: GraphData, seed = 7) => {
  const rand = mulberry32(seed);
  const radiusStep = 0.6;
  const angleStep = 0.5;

  graph.nodes.forEach((node, index) => {
    const radius = radiusStep * Math.sqrt(index);
    const angle = index * angleStep;
    node.position.set(
      Math.cos(angle) * radius + (rand() - 0.5) * 3,
      (rand() - 0.5) * 10,
      Math.sin(angle) * radius + (rand() - 0.5) * 3
    );
  });

  const temp = new THREE.Vector3();
  for (let iteration = 0; iteration < 30; iteration += 1) {
    for (let i = 0; i < graph.nodes.length; i += 1) {
      const node = graph.nodes[i];
      temp.set(0, 0, 0);
      for (let j = 0; j < graph.nodes.length; j += 1) {
        if (i === j) continue;
        const other = graph.nodes[j];
        const delta = node.position.clone().sub(other.position);
        const distance = Math.max(delta.length(), 0.6);
        temp.add(delta.multiplyScalar(0.02 / (distance * distance)));
      }
      node.position.add(temp);
    }
  }
};
