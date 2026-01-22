import "./style.css";
import * as THREE from "three";
import { createScene } from "./scene";
import { createSampleGraph } from "./graph/sampleGraph";
import { layoutGraph } from "./layout/force";
import { createFlowField } from "./field/flow";
import { setupPicking } from "./interaction/picking";
import { createDriftController } from "./interaction/drift";
import { updateLod } from "./render/lod";
import { createStreamlines } from "./render/streamlines";
import { createPostProcessor } from "./render/postprocess";
import { createPointMaterial } from "./render/pointShader";
import { createParamBus, VisualizationMode } from "./metrics/paramBus";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app container");
}

const hint = document.createElement("div");
hint.className = "hint";
hint.textContent = "Drag to orbit · Scroll to zoom · Space toggles drift · M shows metrics · I toggles internalized mode";
app.appendChild(hint);

const metrics = document.createElement("div");
metrics.className = "metrics";
metrics.style.display = "none";
app.appendChild(metrics);

const modeIndicator = document.createElement("div");
modeIndicator.className = "mode-indicator";
modeIndicator.style.display = "none";
app.appendChild(modeIndicator);

const { scene, camera, renderer, controls } = createScene(app);

const graph = createSampleGraph();
layoutGraph(graph);
const flowField = createFlowField(graph);
const paramBus = createParamBus(flowField);

const nodePositions = new Float32Array(graph.nodes.length * 3);
const nodeColors = new Float32Array(graph.nodes.length * 3);

// Diverse color palette: blues, purples, oranges, reds, whites, yellows
const colorPalette = [
  new THREE.Color("#4080ff"), // Bright blue
  new THREE.Color("#6fb0ff"), // Light blue
  new THREE.Color("#8b5cf6"), // Purple
  new THREE.Color("#a78bfa"), // Light purple
  new THREE.Color("#fb923c"), // Orange
  new THREE.Color("#f97316"), // Bright orange
  new THREE.Color("#ef4444"), // Red
  new THREE.Color("#f87171"), // Light red
  new THREE.Color("#ffffff"), // White
  new THREE.Color("#fbbf24"), // Yellow
  new THREE.Color("#fde047"), // Light yellow
];

const baseColor = new THREE.Color("#7b88a8");
const neighborColor = new THREE.Color("#c0d4ff");
const hoverColor = new THREE.Color("#f4f8ff");

// Assign diverse colors to nodes based on position
const updateNodeBuffers = () => {
  graph.nodes.forEach((node, index) => {
    nodePositions[index * 3] = node.position.x;
    nodePositions[index * 3 + 1] = node.position.y;
    nodePositions[index * 3 + 2] = node.position.z;
    
    // Use position-based color assignment for variety
    const colorIndex = Math.floor((node.position.length() * 0.1 + index * 0.03) % colorPalette.length);
    const nodeColor = colorPalette[colorIndex];
    nodeColor.toArray(nodeColors, index * 3);
  });
};

updateNodeBuffers();

// Store original node colors (before any modifications)
const originalNodeColors = new Float32Array(nodeColors.length);
nodeColors.forEach((val, idx) => { originalNodeColors[idx] = val; });

const pointsGeometry = new THREE.BufferGeometry();
pointsGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(nodePositions, 3)
);
pointsGeometry.setAttribute(
  "color",
  new THREE.BufferAttribute(nodeColors, 3)
);

const pointsMaterial = createPointMaterial();

const points = new THREE.Points(pointsGeometry, pointsMaterial);
scene.add(points);

const edgePositions: number[] = [];
const edgeColors: number[] = [];

const edgeBase = new THREE.Color("#3f516e");
const edgeHighlight = new THREE.Color("#8fb2ff");

// Create curved edges using Catmull-Rom spline
const createCurvedEdge = (start: THREE.Vector3, end: THREE.Vector3, segments = 8): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Add some curvature based on distance
  const dist = start.distanceTo(end);
  const curvature = dist * 0.3;
  const perp = new THREE.Vector3().subVectors(end, start).normalize();
  const offset = new THREE.Vector3(
    -perp.y * curvature * (Math.random() - 0.5),
    perp.x * curvature * (Math.random() - 0.5),
    curvature * (Math.random() - 0.5) * 0.5
  );
  mid.add(offset);
  
  // Catmull-Rom spline interpolation
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Simple bezier curve
    const p0 = start;
    const p1 = mid;
    const p2 = end;
    
    const point = new THREE.Vector3();
    point.x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    point.y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    point.z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;
    
    points.push(point);
  }
  
  return points;
};

graph.edges.forEach((edge) => {
  const start = graph.nodes[edge.source].position;
  const end = graph.nodes[edge.target].position;
  
  // Create curved edge
  const curvePoints = createCurvedEdge(start, end, 8);
  
  // Add line segments for the curve
  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i];
    const p2 = curvePoints[i + 1];
    edgePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    
    // Use colors from connected nodes, blended
    const startColor = new THREE.Color();
    startColor.fromArray(nodeColors, edge.source * 3);
    const endColor = new THREE.Color();
    endColor.fromArray(nodeColors, edge.target * 3);
    
    const t = i / (curvePoints.length - 1);
    const color1 = startColor.clone().lerp(endColor, t);
    const color2 = startColor.clone().lerp(endColor, (i + 1) / (curvePoints.length - 1));
    
    color1.toArray(edgeColors, edgeColors.length);
    color2.toArray(edgeColors, edgeColors.length);
  }
});

const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(edgePositions, 3)
);
edgeGeometry.setAttribute(
  "color",
  new THREE.Float32BufferAttribute(edgeColors, 3)
);

const edgeMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.3,
  blending: THREE.AdditiveBlending
});

const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
scene.add(edges);

// Create arrow path (highlighted path from lower-left to upper-right)
const arrowPathGroup = new THREE.Group();
const arrowPathMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color("#ff6b35"), // Bright orange-red for arrow
  transparent: true,
  opacity: 0.9,
  linewidth: 3,
  blending: THREE.AdditiveBlending
});

// Find nodes that form a diagonal path (lower-left to upper-right)
const findArrowPath = (): number[] => {
  // Find node closest to lower-left
  let startIdx = 0;
  let minDist = Infinity;
  graph.nodes.forEach((node, idx) => {
    const dist = Math.sqrt(node.position.x * node.position.x + 
                          node.position.y * node.position.y + 
                          (node.position.z + 20) * (node.position.z + 20));
    if (dist < minDist) {
      minDist = dist;
      startIdx = idx;
    }
  });
  
  // Find path to upper-right
  const path: number[] = [startIdx];
  const visited = new Set<number>([startIdx]);
  let current = startIdx;
  const targetDir = new THREE.Vector3(1, 1, 0).normalize();
  
  for (let i = 0; i < 8 && path.length < 10; i++) {
    const neighbors = graph.adjacency.get(current) || [];
    let bestNext = -1;
    let bestScore = -Infinity;
    
    neighbors.forEach(next => {
      if (visited.has(next)) return;
      const dir = new THREE.Vector3().subVectors(
        graph.nodes[next].position,
        graph.nodes[current].position
      ).normalize();
      const score = dir.dot(targetDir) + Math.random() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestNext = next;
      }
    });
    
    if (bestNext === -1) break;
    path.push(bestNext);
    visited.add(bestNext);
    current = bestNext;
  }
  
  return path;
};

const arrowPath = findArrowPath();
if (arrowPath.length > 1) {
  const arrowPositions: number[] = [];
  const arrowColors: number[] = [];
  const arrowColorStart = new THREE.Color("#4080ff"); // Bright blue
  const arrowColorEnd = new THREE.Color("#ff6b35"); // Bright orange-red
  
  for (let i = 0; i < arrowPath.length - 1; i++) {
    const start = graph.nodes[arrowPath[i]].position;
    const end = graph.nodes[arrowPath[i + 1]].position;
    
    // Create smooth curve for arrow path
    const curvePoints = createCurvedEdge(start, end, 12);
    
    for (let j = 0; j < curvePoints.length - 1; j++) {
      const p1 = curvePoints[j];
      const p2 = curvePoints[j + 1];
      arrowPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      
      const t = (i + j / curvePoints.length) / (arrowPath.length - 1);
      const color = arrowColorStart.clone().lerp(arrowColorEnd, t);
      color.toArray(arrowColors, arrowColors.length);
      color.toArray(arrowColors, arrowColors.length);
    }
  }
  
  const arrowGeometry = new THREE.BufferGeometry();
  arrowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(arrowPositions, 3));
  arrowGeometry.setAttribute("color", new THREE.Float32BufferAttribute(arrowColors, 3));
  
  const arrowLines = new THREE.LineSegments(arrowGeometry, arrowPathMaterial);
  arrowPathGroup.add(arrowLines);
  
  // Add bright nodes along the arrow path
  arrowPath.forEach(nodeIdx => {
    const node = graph.nodes[nodeIdx];
    const nodeColor = new THREE.Color("#ffffff"); // White for arrow nodes
    nodeColor.toArray(nodeColors, nodeIdx * 3);
  });
  
  scene.add(arrowPathGroup);
  
  // Update originalNodeColors after arrow path nodes are set
  arrowPath.forEach(nodeIdx => {
    const nodeColor = new THREE.Color("#ffffff"); // White for arrow nodes
    nodeColor.toArray(originalNodeColors, nodeIdx * 3);
  });
}

const labelSprites: THREE.Sprite[] = [];
const labelGroup = new THREE.Group();

const createLabelSprite = (text: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context missing");
  }
  const fontSize = 28;
  context.font = `600 ${fontSize}px Inter, sans-serif`;
  const padding = 12;
  const metrics = context.measureText(text);
  canvas.width = metrics.width + padding * 2;
  canvas.height = fontSize + padding * 2;

  context.fillStyle = "rgba(8, 14, 28, 0.75)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(120, 150, 220, 0.4)";
  context.strokeRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f0f4ff";
  context.textBaseline = "middle";
  context.font = `600 ${fontSize}px Inter, sans-serif`;
  context.fillText(text, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(8);
  return sprite;
};

graph.nodes.forEach((node) => {
  const sprite = createLabelSprite(node.label);
  sprite.position.copy(node.position).add(new THREE.Vector3(0, 2.5, 0));
  sprite.visible = false;
  labelGroup.add(sprite);
  labelSprites.push(sprite);
});

scene.add(labelGroup);

let hoveredIndex: number | null = null;
let neighborSet = new Set<number>();

const updateHighlights = () => {
  graph.nodes.forEach((_, index) => {
    const colorIndex = index * 3;
    let targetColor = new THREE.Color();
    targetColor.fromArray(originalNodeColors, colorIndex);
    
    if (hoveredIndex !== null) {
      if (index === hoveredIndex) {
        targetColor = hoverColor;
      } else if (neighborSet.has(index)) {
        // Brighten neighbor color while keeping original hue
        targetColor.lerp(neighborColor, 0.5);
      }
    }
    targetColor.toArray(nodeColors, colorIndex);
  });
  const colorAttr = pointsGeometry.getAttribute("color") as THREE.BufferAttribute;
  colorAttr.needsUpdate = true;

  // Update edge colors - now curved edges have multiple segments
  const edgeColorAttr = edgeGeometry.getAttribute("color") as THREE.BufferAttribute;
  if (edgeColorAttr) {
    let segmentIndex = 0;
    graph.edges.forEach((edge) => {
      const isNeighbor =
        hoveredIndex !== null &&
        (edge.source === hoveredIndex ||
          edge.target === hoveredIndex ||
          neighborSet.has(edge.source) ||
          neighborSet.has(edge.target));
      
      // Each edge has 8 segments (from createCurvedEdge with segments=8)
      // Each segment has 2 vertices, each vertex has 3 color components
      const segments = 8;
      for (let s = 0; s < segments; s++) {
        const edgeOffset = segmentIndex * 6;
        
        // Check bounds
        if (edgeOffset + 5 >= edgeColors.length) break;
        
        // Get colors from connected nodes
        const startColor = new THREE.Color();
        startColor.fromArray(originalNodeColors, edge.source * 3);
        const endColor = new THREE.Color();
        endColor.fromArray(originalNodeColors, edge.target * 3);
        
        const t = s / segments;
        const color1 = startColor.clone().lerp(endColor, t);
        const color2 = startColor.clone().lerp(endColor, (s + 1) / segments);
        
        if (isNeighbor) {
          color1.lerp(edgeHighlight, 0.6);
          color2.lerp(edgeHighlight, 0.6);
        }
        
        color1.toArray(edgeColors, edgeOffset);
        color2.toArray(edgeColors, edgeOffset + 3);
        segmentIndex++;
      }
    });
    edgeColorAttr.needsUpdate = true;
  }
};

const disposePicking = setupPicking(points, camera, renderer.domElement, (index) => {
  hoveredIndex = index;
  neighborSet = new Set(
    index !== null ? graph.adjacency.get(index) ?? [] : []
  );
  updateHighlights();
});

updateHighlights();

const streamlineSystem = createStreamlines(graph, flowField, 200);
scene.add(streamlineSystem.mesh);
scene.add(streamlineSystem.heroMesh);

const postProcessor = createPostProcessor(scene, camera, renderer);

const drift = createDriftController(camera, flowField);

let metricsVisible = false;
let wasInInternalizedMode = false;

const updateUIForMode = () => {
  const mode = paramBus.getMode();
  const isInternalized = mode === VisualizationMode.Internalized;
  
  // In Internalized Mode: hide UI elements
  if (isInternalized) {
    hint.style.display = "none";
    metrics.style.display = "none";
    modeIndicator.style.display = "block";
    modeIndicator.textContent = "◉"; // Subtle glyph
    
    // Disable orbit controls
    controls.enabled = false;
    
    // Enable drift by default
    if (!drift.enabled) {
      drift.toggle();
    }
  } else {
    hint.style.display = "block";
    metrics.style.display = metricsVisible ? "block" : "none";
    modeIndicator.style.display = "none";
    
    // Re-enable orbit controls
    controls.enabled = true;
  }
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault(); // Prevent page scroll
    drift.toggle();
  } else if (event.code === "KeyM") {
    metricsVisible = !metricsVisible;
    const mode = paramBus.getMode();
    if (mode === VisualizationMode.Default) {
      metrics.style.display = metricsVisible ? "block" : "none";
    }
  } else if (event.code === "KeyI") {
    paramBus.toggleMode();
    updateUIForMode();
  }
});

const clock = new THREE.Clock();
let elapsedTime = 0;

// Cycle management: reset camera to far position when it gets close to center
let centerDistance = Infinity;
let stableTime = 0;
let isResetting = false;
let resetTarget = new THREE.Vector3();
let lastCameraPosition = new THREE.Vector3();
const CENTER_THRESHOLD = 30.0; // Distance from center to trigger reset
const STABLE_TIME_THRESHOLD = 0.5; // Seconds of stability before reset (very short)
const RESET_DISTANCE = 80.0; // Distance to reset camera to
const VELOCITY_THRESHOLD = 5.0; // Minimum velocity to consider moving (very lenient)

// Initialize last camera position
lastCameraPosition.copy(camera.position);

const animate = () => {
  const delta = clock.getDelta();
  elapsedTime += delta;
  
  controls.update();
  
  let alignment = 0;
  
  // Smoothly move camera to reset position
  if (isResetting) {
    const resetSpeed = 0.03; // Slightly faster reset
    camera.position.lerp(resetTarget, resetSpeed);
    
    // Look at center
    const center = new THREE.Vector3(0, 0, 0);
    camera.lookAt(center);
    
    // Check if close enough to target
    if (camera.position.distanceTo(resetTarget) < 3.0) {
      isResetting = false;
      stableTime = 0;
      // Re-enable drift if it was enabled before reset
      if (!drift.enabled) {
        drift.toggle();
      }
    }
  } else {
    // Normal drift update
    alignment = drift.update(delta);
    
    // Check if camera is close to center and stable (only when drift is enabled)
    if (drift.enabled) {
      centerDistance = camera.position.length();
      
      // Calculate velocity from position change (avoid division by zero)
      let velocity = 0;
      if (delta > 0.001) {
        velocity = camera.position.clone().sub(lastCameraPosition).length() / delta;
      }
      lastCameraPosition.copy(camera.position);
      
      // Check if camera is close to center
      if (centerDistance < CENTER_THRESHOLD) {
        // Check if velocity is low (stable)
        if (velocity < VELOCITY_THRESHOLD) {
          stableTime += delta;
          
          if (stableTime > STABLE_TIME_THRESHOLD) {
            // Reset camera to a random far position
            isResetting = true;
            stableTime = 0;
            
            // Temporarily disable drift during reset
            if (drift.enabled) {
              drift.toggle(); // Disable drift
            }
            
            // Generate random position on a sphere at RESET_DISTANCE
            const theta = Math.random() * Math.PI * 2; // Azimuth
            const phi = Math.acos(Math.random() * 2 - 1); // Elevation
            resetTarget.set(
              RESET_DISTANCE * Math.sin(phi) * Math.cos(theta),
              RESET_DISTANCE * Math.sin(phi) * Math.sin(theta) * 0.5 + 20, // Slight bias upward
              RESET_DISTANCE * Math.cos(phi)
            );
          }
        } else {
          stableTime = 0;
        }
      } else {
        stableTime = 0;
      }
    } else {
      lastCameraPosition.copy(camera.position);
    }
  }
  
  // Update ParamBus (central state for all systems)
  paramBus.update(delta, camera.position, alignment, drift.enabled, hoveredIndex);
  const params = paramBus.getCameraParams();
  const mode = paramBus.getMode();
  const breath = paramBus.getBreath();
  const isInternalized = mode === VisualizationMode.Internalized;
  
  // Breathing modulation for locality radius: inhale = expand, exhale = contract
  const baseRadius = isInternalized ? 50.0 : 60.0;
  const breathingRadius = isInternalized 
    ? baseRadius + (breath.phase - 0.5) * 10.0  // 45-55 range
    : baseRadius;
  
  // Update fog based on coherence (clearer in high coherence)
  // In Internalized Mode, fog is more responsive to local coherence
  const fogResponsiveness = isInternalized ? 0.03 : 0.02;
  const fogNear = 30 + params.coherence * 20;
  const fogFar = 140 + params.coherence * 40;
  if (scene.fog && scene.fog instanceof THREE.Fog) {
    scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, fogNear, fogResponsiveness);
    scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, fogFar, fogResponsiveness);
  }
  
  // Update edge opacity based on coherence (non-linear)
  const cohSquared = params.coherence * params.coherence;
  const targetEdgeOpacity = 0.06 + cohSquared * 0.4;
  edgeMaterial.opacity = THREE.MathUtils.lerp(edgeMaterial.opacity, targetEdgeOpacity, 0.05);
  
  // Update point shader uniforms
  pointsMaterial.uniforms.time.value = elapsedTime;
  pointsMaterial.uniforms.uCameraPosition.value.copy(camera.position);
  pointsMaterial.uniforms.coherence.value = params.coherence;
  pointsMaterial.uniforms.localityRadius.value = breathingRadius;
  pointsMaterial.uniforms.breathPhase.value = isInternalized ? breath.phase : 0.5;
  
  // Update streamlines with camera direction for hero streamlines
  const cameraDir = camera.getWorldDirection(new THREE.Vector3());
  const coherenceFactor = drift.enabled ? 1.0 : 0.3;
  streamlineSystem.update(camera.position, cameraDir, coherenceFactor, delta, mode, breath);
  
  // Update postprocessing from ParamBus
  postProcessor.update(params, mode, breath);

  updateLod({
    camera,
    edges,
    labels: labelSprites,
    hoveredIndex,
    neighborSet,
    mode
  });

  // Update metrics UI if visible
  if (metricsVisible) {
    metrics.innerHTML = `
      <div>mode: ${mode}</div>
      <div>coh: ${params.coherence.toFixed(2)}</div>
      <div>ent: ${params.entropy.toFixed(2)}</div>
      <div>flow: ${params.flowStrength.toFixed(2)}</div>
      <div>align: ${params.alignment.toFixed(2)}</div>
      <div>drift: ${params.driftEnabled ? "ON" : "OFF"}</div>
      ${isInternalized ? `<div>breath: ${breath.phase.toFixed(2)}</div>` : ''}
    `;
  }

  postProcessor.composer.render();
  requestAnimationFrame(animate);
};

animate();

window.addEventListener("resize", () => {
  const width = app.clientWidth;
  const height = app.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  postProcessor.resize(width, height);
});

window.addEventListener("beforeunload", () => {
  disposePicking();
});
