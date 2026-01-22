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
const baseColor = new THREE.Color("#7b88a8");
const neighborColor = new THREE.Color("#c0d4ff");
const hoverColor = new THREE.Color("#f4f8ff");

const updateNodeBuffers = () => {
  graph.nodes.forEach((node, index) => {
    nodePositions[index * 3] = node.position.x;
    nodePositions[index * 3 + 1] = node.position.y;
    nodePositions[index * 3 + 2] = node.position.z;
    baseColor.toArray(nodeColors, index * 3);
  });
};

updateNodeBuffers();

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

graph.edges.forEach((edge) => {
  const start = graph.nodes[edge.source].position;
  const end = graph.nodes[edge.target].position;
  edgePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  edgeBase.toArray(edgeColors, edgeColors.length);
  edgeBase.toArray(edgeColors, edgeColors.length);
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
  opacity: 0.2
});

const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
scene.add(edges);

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
    const color = nodeColors;
    const colorIndex = index * 3;
    let targetColor = baseColor;
    if (hoveredIndex !== null) {
      if (index === hoveredIndex) {
        targetColor = hoverColor;
      } else if (neighborSet.has(index)) {
        targetColor = neighborColor;
      }
    }
    targetColor.toArray(color, colorIndex);
  });
  const colorAttr = pointsGeometry.getAttribute("color") as THREE.BufferAttribute;
  colorAttr.needsUpdate = true;

  const edgeColorAttr = edgeGeometry.getAttribute("color") as THREE.BufferAttribute;
  graph.edges.forEach((edge, edgeIndex) => {
    const edgeOffset = edgeIndex * 6;
    const isNeighbor =
      hoveredIndex !== null &&
      (edge.source === hoveredIndex ||
        edge.target === hoveredIndex ||
        neighborSet.has(edge.source) ||
        neighborSet.has(edge.target));
    const color = isNeighbor ? edgeHighlight : edgeBase;
    color.toArray(edgeColors, edgeOffset);
    color.toArray(edgeColors, edgeOffset + 3);
  });
  edgeColorAttr.needsUpdate = true;
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

const animate = () => {
  const delta = clock.getDelta();
  elapsedTime += delta;
  
  controls.update();
  const alignment = drift.update(delta);
  
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
  pointsMaterial.uniforms.cameraPosition.value.copy(camera.position);
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
