import * as THREE from "three";
import type { FlowField } from "../field/flow";
import type { GraphData } from "../graph/sampleGraph";

export type StreamlineSystem = {
  mesh: THREE.LineSegments;
  update: (cameraPos: THREE.Vector3, coherenceFactor: number) => void;
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

export const createStreamlines = (
  graph: GraphData,
  flowField: FlowField,
  streamlineCount = 200,
  seed = 123
): StreamlineSystem => {
  const rand = mulberry32(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const baseColor = new THREE.Color("#4080ff");
  const dimColor = new THREE.Color("#1a2840");

  // Generate streamlines by integrating flow field
  for (let s = 0; s < streamlineCount; s++) {
    const startNode = graph.nodes[Math.floor(rand() * graph.nodes.length)];
    const startPos = startNode.position.clone();
    
    const fields = flowField.sampleFields(startPos);
    const maxSteps = Math.floor(10 + fields.coherence * 30);
    const stepSize = 1.2;

    let currentPos = startPos.clone();
    const streamline: THREE.Vector3[] = [currentPos.clone()];

    for (let step = 0; step < maxSteps; step++) {
      const direction = flowField.sample(currentPos);
      if (direction.lengthSq() < 0.001) break;
      
      currentPos.addScaledVector(direction, stepSize);
      streamline.push(currentPos.clone());
      
      // Stop if too far from any node
      let minDist = Infinity;
      graph.nodes.forEach(node => {
        const dist = currentPos.distanceToSquared(node.position);
        if (dist < minDist) minDist = dist;
      });
      if (minDist > 400) break;
    }

    // Add streamline as line segments
    for (let i = 0; i < streamline.length - 1; i++) {
      const p1 = streamline[i];
      const p2 = streamline[i + 1];
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      
      const t = i / (streamline.length - 1);
      const alpha = 1 - t * 0.5;
      colors.push(
        baseColor.r * alpha, baseColor.g * alpha, baseColor.b * alpha,
        baseColor.r * alpha, baseColor.g * alpha, baseColor.b * alpha
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const mesh = new THREE.LineSegments(geometry, material);

  const update = (cameraPos: THREE.Vector3, coherenceFactor: number) => {
    const fields = flowField.sampleFields(cameraPos);
    const coherence = fields.coherence;
    const entropy = fields.entropy;
    
    // Coherence increases visibility and brightness
    const targetOpacity = 0.08 + coherence * coherenceFactor * 0.4;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    
    // Update colors based on local coherence
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    
    for (let i = 0; i < colorAttr.count; i += 2) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);
      const pos = new THREE.Vector3(px, py, pz);
      
      const localFields = flowField.sampleFields(pos);
      const brightness = 0.3 + localFields.coherence * 0.7;
      
      const color = baseColor.clone().lerp(dimColor, localFields.entropy * 0.6);
      colorAttr.setXYZ(i, color.r * brightness, color.g * brightness, color.b * brightness);
      colorAttr.setXYZ(i + 1, color.r * brightness, color.g * brightness, color.b * brightness);
    }
    colorAttr.needsUpdate = true;
  };

  return { mesh, update };
};
