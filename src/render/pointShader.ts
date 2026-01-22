import * as THREE from "three";

export const createPointMaterial = (): THREE.ShaderMaterial => {
  const vertexShader = `
    attribute vec3 color;
    varying vec3 vColor;
    varying float vDistance;
    uniform float time;
    uniform vec3 fogColor;
    
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vDistance = length(mvPosition.xyz);
      
      // Distance-based size
      float size = 1.6;
      gl_PointSize = size * (300.0 / -mvPosition.z);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    varying float vDistance;
    uniform float time;
    uniform vec3 fogColor;
    
    void main() {
      // Circular point shape
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      
      // Soft edge
      float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
      
      // Three-layer depth expression: near/mid/far
      float nearLayer = smoothstep(50.0, 30.0, vDistance);   // sharp
      float midLayer = smoothstep(100.0, 50.0, vDistance);   // soft
      float farLayer = smoothstep(150.0, 100.0, vDistance);  // hazy, mixes with fog
      
      // Alpha composition: near is opaque, mid fades, far dissolves into fog
      alpha *= nearLayer * 1.0 + midLayer * 0.6 + farLayer * 0.2;
      
      // Far layer mixes with fog color (nebula effect)
      float fogMix = smoothstep(100.0, 150.0, vDistance);
      vec3 color = mix(vColor, fogColor * 0.5, fogMix * 0.7);
      
      // Subtle time-based twinkle in brightness (not position)
      float twinkle = sin(time * 0.5 + vDistance * 0.1) * 0.15 + 0.85;
      
      vec3 finalColor = color * twinkle;
      gl_FragColor = vec4(finalColor, alpha * 0.9);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      fogColor: { value: new THREE.Color("#05060b") }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return material;
};
