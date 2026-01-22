import * as THREE from "three";

export type GraphNode = {
  id: number;
  label: string;
  position: THREE.Vector3;
};

export type GraphEdge = {
  source: number;
  target: number;
  weight: number;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: Map<number, number[]>;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const createSampleGraph = (nodeCount = 300, seed = 42): GraphData => {
  const rand = mulberry32(seed);
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: index,
    label: `Concept ${index + 1}`,
    position: new THREE.Vector3(
      (rand() - 0.5) * 40,
      (rand() - 0.5) * 40,
      (rand() - 0.5) * 40
    )
  }));

  const edges: GraphEdge[] = [];
  const adjacency = new Map<number, number[]>();

  const connect = (a: number, b: number, weight: number) => {
    edges.push({ source: a, target: b, weight });
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  };

  for (let i = 0; i < nodeCount; i += 1) {
    const connections = 2 + Math.floor(rand() * 5);
    for (let c = 0; c < connections; c += 1) {
      const target = Math.floor(rand() * nodeCount);
      if (target !== i) {
        const weight = 0.2 + rand() * 0.8;
        connect(i, target, weight);
      }
    }
  }

  return { nodes, edges, adjacency };
};
