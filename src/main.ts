import "./style.css";
import * as THREE from "three";
import { createScene } from "./scene";
import { createSampleGraph } from "./graph/sampleGraph";
import { layoutGraph } from "./layout/force";
import { createFlowField } from "./field/flow";
import { setupPicking } from "./interaction/picking";
import { createDriftController } from "./interaction/drift";
import { updateLod } from "./render/lod";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app container");
}

const hint = document.createElement("div");
hint.className = "hint";
hint.textContent = "Drag to orbit · Scroll to zoom · Space toggles drift";
app.appendChild(hint);

const { scene, camera, renderer, controls } = createScene(app);

const graph = createSampleGraph();
layoutGraph(graph);
const flowField = createFlowField(graph);

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

const pointsMaterial = new THREE.PointsMaterial({
  size: 1.6,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  sizeAttenuation: true
});

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

const drift = createDriftController(camera, flowField);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    drift.toggle();
  }
});

const clock = new THREE.Clock();

const animate = () => {
  const delta = clock.getDelta();
  controls.update();
  const alignment = drift.update(delta);
  const coherence = THREE.MathUtils.clamp((alignment + 1) * 0.5, 0, 1);
  edgeMaterial.opacity = 0.12 + coherence * 0.35;

  updateLod({
    camera,
    edges,
    labels: labelSprites,
    hoveredIndex,
    neighborSet
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

window.addEventListener("beforeunload", () => {
  disposePicking();
});
