import * as THREE from "three";
import type { FlowField, ScalarFields } from "../field/flow";

export enum VisualizationMode {
  Default = "default",
  Internalized = "internalized"
}

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
  getMode: () => VisualizationMode;
  toggleMode: () => void;
  update: (
    delta: number,
    cameraPos: THREE.Vector3,
    alignment: number,
    driftEnabled: boolean,
    hoveredIndex: number | null
  ) => void;
};

export const createParamBus = (flowField: FlowField): ParamBus => {
  let mode: VisualizationMode = VisualizationMode.Default;
  
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

  // Smoothing for Internalized Mode
  let smoothedCoherence = 0;
  let smoothedEntropy = 1;
  let smoothedFlowStrength = 0;

  const getCameraParams = () => cameraParams;
  const getHoverParams = () => hoverParams;
  const getMode = () => mode;
  
  const toggleMode = () => {
    mode = mode === VisualizationMode.Default 
      ? VisualizationMode.Internalized 
      : VisualizationMode.Default;
  };

  const update = (
    delta: number,
    cameraPos: THREE.Vector3,
    alignment: number,
    driftEnabled: boolean,
    hoveredIndex: number | null
  ) => {
    const fields = flowField.sampleFields(cameraPos);
    
    // Apply stronger smoothing in Internalized Mode
    const smoothFactor = mode === VisualizationMode.Internalized ? 0.02 : 0.1;
    smoothedCoherence = THREE.MathUtils.lerp(smoothedCoherence, fields.coherence, smoothFactor);
    smoothedEntropy = THREE.MathUtils.lerp(smoothedEntropy, fields.entropy, smoothFactor);
    smoothedFlowStrength = THREE.MathUtils.lerp(smoothedFlowStrength, fields.flowStrength, smoothFactor);
    
    cameraParams = {
      coherence: mode === VisualizationMode.Internalized ? smoothedCoherence : fields.coherence,
      entropy: mode === VisualizationMode.Internalized ? smoothedEntropy : fields.entropy,
      flowStrength: mode === VisualizationMode.Internalized ? smoothedFlowStrength : fields.flowStrength,
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

  return { getCameraParams, getHoverParams, getMode, toggleMode, update };
};
