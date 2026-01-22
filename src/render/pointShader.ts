import * as THREE from "three";

export const createPointMaterial = (): THREE.ShaderMaterial => {
  const vertexShader = `
    attribute vec3 color;
    varying vec3 vColor;
    varying float vDistance;
    varying vec3 vWorldPos;
    uniform float time;
    uniform vec3 fogColor;
    uniform vec3 cameraPosition;
    
    void main() {
      vColor = color;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      vec4 mvPosition = viewMatrix * worldPosition;
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
    varying vec3 vWorldPos;
    uniform float time;
    uniform vec3 fogColor;
    uniform vec3 cameraPosition;
    uniform float localityRadius;
    uniform float coherence;
    uniform float breathPhase;
    
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
      
      // Locality bias: brighter within radius (breathes with phase)
      float worldDist = distance(vWorldPos, cameraPosition);
      float localityFactor = smoothstep(localityRadius * 1.5, localityRadius * 0.5, worldDist);
      
      // Breathing modulation: inhale = slightly brighter locality
      float breathModulation = 1.0 + breathPhase * 0.15;
      alpha *= 1.0 + localityFactor * 0.4 * breathModulation;
      
      // Far layer mixes with fog color (nebula effect)
      float fogMix = smoothstep(100.0, 150.0, vDistance);
      vec3 color = mix(vColor, fogColor * 0.5, fogMix * 0.7);
      
      // Twinkle regularity controlled by coherence AND breath
      float twinkleAmount = mix(0.15, 0.08, coherence); // Less random when coherent
      
      // Breath modulates twinkle frequency: inhale = calmer
      float baseFreq = mix(0.5, 0.3, coherence);
      float twinkleFreq = baseFreq * (1.0 - breathPhase * 0.2); // Slower on inhale
      
      float twinkle = sin(time * twinkleFreq + vDistance * 0.1) * twinkleAmount + (1.0 - twinkleAmount);
      
      vec3 finalColor = color * twinkle;
      gl_FragColor = vec4(finalColor, alpha * 0.9);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      fogColor: { value: new THREE.Color("#05060b") },
      cameraPosition: { value: new THREE.Vector3() },
      localityRadius: { value: 60.0 },
      coherence: { value: 0.5 },
      breathPhase: { value: 0.5 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return material;
};
