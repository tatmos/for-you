import * as THREE from "three";
import type { FlowField, ScalarFields } from "../field/flow";

export type CameraParams = ScalarFields & {
  alignment: number;
  driftEnabled: boolean;
  position: THREE.Vector3;
};

export type HoverParams = {
  hoveredIndex: number | null;
  hoveredFields: ScalarFields | null;
};

export type ParamBus = {
  getCameraParams: () => CameraParams;
  getHoverParams: () => HoverParams;
  update: (
    delta: number,
    cameraPos: THREE.Vector3,
    alignment: number,
    driftEnabled: boolean,
    hoveredIndex: number | null
  ) => void;
};

export const createParamBus = (flowField: FlowField): ParamBus => {
  let cameraParams: CameraParams = {
    coherence: 0,
    entropy: 1,
    flowStrength: 0,
    alignment: 0,
    driftEnabled: false,
    position: new THREE.Vector3()
  };

  let hoverParams: HoverParams = {
    hoveredIndex: null,
    hoveredFields: null
  };

  const getCameraParams = () => cameraParams;
  const getHoverParams = () => hoverParams;

  const update = (
    delta: number,
    cameraPos: THREE.Vector3,
    alignment: number,
    driftEnabled: boolean,
    hoveredIndex: number | null
  ) => {
    const fields = flowField.sampleFields(cameraPos);
    
    cameraParams = {
      ...fields,
      alignment,
      driftEnabled,
      position: cameraPos.clone()
    };

    hoverParams = {
      hoveredIndex,
      hoveredFields: hoveredIndex !== null 
        ? flowField.getNodeFields(hoveredIndex)
        : null
    };
  };

  return { getCameraParams, getHoverParams, update };
};
