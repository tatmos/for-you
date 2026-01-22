import * as THREE from "three";
import type { FlowField } from "../field/flow";
import type { GraphData } from "../graph/sampleGraph";
import { VisualizationMode } from "../metrics/paramBus";
import type { BreathState } from "../metrics/breath";

export type StreamlineSystem = {
  mesh: THREE.LineSegments;
  heroMesh: THREE.LineSegments;
  update: (
    cameraPos: THREE.Vector3, 
    cameraDir: THREE.Vector3, 
    coherenceFactor: number, 
    delta: number, 
    mode: VisualizationMode,
    breath: BreathState
  ) => void;
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

type SegmentFields = {
  coherence: number;
  entropy: number;
  flowStrength: number;
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
  const bakedFields: SegmentFields[] = [];
  const baseColor = new THREE.Color("#4080ff");
  const dimColor = new THREE.Color("#1a2840");

  // Generate background streamlines with baked fields
  for (let s = 0; s < streamlineCount; s++) {
    const startNode = graph.nodes[Math.floor(rand() * graph.nodes.length)];
    const startPos = startNode.position.clone();
    
    const fields = flowField.sampleFields(startPos);
    // Use both coherence AND flowStrength for step count
    const maxSteps = Math.floor(10 + fields.coherence * 25 + fields.flowStrength * 15);
    const stepSize = 1.2;

    let currentPos = startPos.clone();
    const streamline: THREE.Vector3[] = [currentPos.clone()];

    for (let step = 0; step < maxSteps; step++) {
      const direction = flowField.sample(currentPos);
      if (direction.lengthSq() < 0.001) break;
      
      currentPos.addScaledVector(direction, stepSize);
      streamline.push(currentPos.clone());
      
      let minDist = Infinity;
      graph.nodes.forEach(node => {
        const dist = currentPos.distanceToSquared(node.position);
        if (dist < minDist) minDist = dist;
      });
      if (minDist > 400) break;
    }

    // Bake fields for each segment
    for (let i = 0; i < streamline.length - 1; i++) {
      const p1 = streamline[i];
      const p2 = streamline[i + 1];
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      
      // Bake local fields at segment midpoint
      const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const segmentFields = flowField.sampleFields(midpoint);
      bakedFields.push(segmentFields);
      
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

  // Hero streamlines (forward-facing, visible during drift)
  const heroGeometry = new THREE.BufferGeometry();
  const heroMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color("#6fb0ff"),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    linewidth: 2
  });
  const heroMesh = new THREE.LineSegments(heroGeometry, heroMaterial);

  let updateTimer = 0;
  const updateInterval = 0.1; // 10fps for color updates
  let lastCameraPos = new THREE.Vector3();

  const updateHeroStreamlines = (cameraPos: THREE.Vector3, cameraDir: THREE.Vector3) => {
    const heroCount = 5;
    const heroPositions: number[] = [];
    const heroColors: number[] = [];
    const heroColor = new THREE.Color("#6fb0ff");

    for (let h = 0; h < heroCount; h++) {
      const angle = (h / heroCount) * Math.PI * 0.5 - Math.PI * 0.25;
      const offset = new THREE.Vector3(
        Math.sin(angle) * 8,
        (h - heroCount / 2) * 3,
        0
      );
      offset.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        cameraDir
      ));

      let currentPos = cameraPos.clone().add(offset);
      const heroLine: THREE.Vector3[] = [currentPos.clone()];

      for (let step = 0; step < 30; step++) {
        const direction = flowField.sample(currentPos);
        if (direction.lengthSq() < 0.001) break;
        currentPos.addScaledVector(direction, 1.5);
        heroLine.push(currentPos.clone());
      }

      for (let i = 0; i < heroLine.length - 1; i++) {
        const p1 = heroLine[i];
        const p2 = heroLine[i + 1];
        heroPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        const alpha = 1 - (i / heroLine.length) * 0.7;
        heroColors.push(
          heroColor.r * alpha, heroColor.g * alpha, heroColor.b * alpha,
          heroColor.r * alpha, heroColor.g * alpha, heroColor.b * alpha
        );
      }
    }

    heroGeometry.setAttribute("position", new THREE.Float32BufferAttribute(heroPositions, 3));
    heroGeometry.setAttribute("color", new THREE.Float32BufferAttribute(heroColors, 3));
  };

  const update = (
    cameraPos: THREE.Vector3,
    cameraDir: THREE.Vector3,
    coherenceFactor: number,
    delta: number,
    mode: VisualizationMode,
    breath: BreathState
  ) => {
    updateTimer += delta;

    const fields = flowField.sampleFields(cameraPos);
    const coherence = fields.coherence;
    
    // Non-linear coherence emphasis (coh^2)
    const cohSquared = coherence * coherence;
    
    const isInternalized = mode === VisualizationMode.Internalized;
    
    // Breathing modulation for Internalized Mode
    // Inhale = expand, Exhale = contract
    const breathModulation = isInternalized ? (1.0 + breath.phase * 0.2) : 1.0;
    
    // Background streamlines: de-emphasize in Internalized Mode
    let targetOpacity = 0.05 + cohSquared * coherenceFactor * 0.5;
    if (isInternalized) {
      targetOpacity *= 0.3; // Reduce to 30% in Internalized
    }
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);

    // Hero streamlines: always prominent in Internalized, drift-dependent in Default
    // Breath modulates hero intensity: inhale = brighter
    let heroTarget: number;
    if (isInternalized) {
      // Always visible in Internalized, stronger with coherence
      heroTarget = (0.5 + cohSquared * 0.4) * breathModulation;
    } else {
      // Original behavior: only during drift
      heroTarget = coherenceFactor > 0.8 ? cohSquared * 0.8 : 0;
    }
    heroMaterial.opacity = THREE.MathUtils.lerp(heroMaterial.opacity, heroTarget, 0.08);

    // Update hero streamlines more frequently in Internalized Mode
    const updateThreshold = isInternalized ? 3 : 5;
    const cameraMoved = lastCameraPos.distanceTo(cameraPos) > updateThreshold;
    const shouldUpdate = cameraMoved || (heroMaterial.opacity > 0.1);
    if (shouldUpdate) {
      updateHeroStreamlines(cameraPos, cameraDir);
      lastCameraPos.copy(cameraPos);
    }

    // Throttled color updates (10fps instead of 60fps)
    if (updateTimer >= updateInterval) {
      updateTimer = 0;

      const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
      const globalCoherence = fields.coherence;

      // Use baked fields instead of per-frame sampling
      for (let i = 0; i < bakedFields.length; i++) {
        const segmentFields = bakedFields[i];
        
        // Combine baked local coherence with global camera coherence
        const effectiveCoherence = segmentFields.coherence * 0.7 + globalCoherence * 0.3;
        const brightness = 0.25 + effectiveCoherence * 0.75;
        
        const color = baseColor.clone().lerp(dimColor, segmentFields.entropy * 0.5);
        const idx = i * 2;
        colorAttr.setXYZ(idx, color.r * brightness, color.g * brightness, color.b * brightness);
        colorAttr.setXYZ(idx + 1, color.r * brightness, color.g * brightness, color.b * brightness);
      }
      colorAttr.needsUpdate = true;
    }
  };

  return { mesh, heroMesh, update };
};
