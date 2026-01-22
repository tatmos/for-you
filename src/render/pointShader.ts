import * as THREE from "three";

export const createPointMaterial = (): THREE.ShaderMaterial => {
  const vertexShader = `
    attribute vec3 color;
    varying vec3 vColor;
    varying float vDistance;
    uniform float time;
    
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
    
    void main() {
      // Circular point shape
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      
      // Soft edge
      float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
      
      // Distance-based fade
      float distFade = smoothstep(150.0, 80.0, vDistance);
      alpha *= distFade;
      
      // Subtle time-based twinkle in brightness
      float twinkle = sin(time * 0.5 + vDistance * 0.1) * 0.15 + 0.85;
      
      vec3 finalColor = vColor * twinkle;
      gl_FragColor = vec4(finalColor, alpha * 0.9);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return material;
};
