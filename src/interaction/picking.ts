import * as THREE from "three";

export type HoverHandler = (index: number | null) => void;

export const setupPicking = (
  points: THREE.Points,
  camera: THREE.Camera,
  domElement: HTMLElement,
  onHover: HoverHandler
) => {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 1.2;
  const pointer = new THREE.Vector2();
  let lastIndex: number | null = null;

  const updatePointer = (event: PointerEvent) => {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onMove = (event: PointerEvent) => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(points);
    const hitIndex = hits.length > 0 ? hits[0].index ?? null : null;
    if (hitIndex !== lastIndex) {
      lastIndex = hitIndex;
      onHover(hitIndex);
    }
  };

  domElement.addEventListener("pointermove", onMove);

  return () => {
    domElement.removeEventListener("pointermove", onMove);
  };
};
