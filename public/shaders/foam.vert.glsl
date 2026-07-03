// Foam Bubble Vertex Shader
// Reference: Mineradio-MacOS 泡沫·珍珠虹彩·柔波浮沉 preset
// Multi-layer sphere groups with audio-driven float and rotation

uniform float uTime; 

uniform float uBass; 

uniform float uMid; 

uniform float uTreble; 

uniform float uEnergy; 


attribute float aSize; 

attribute float aPhase; 

attribute float aFrequency; 

attribute float aLayer; 


varying float vHeight; 

varying float vAlpha; 

varying vec3 vNormal; 

varying float vPhase; 


float hash(float n) {
  return fract(sin(n) * 43758.5453123); 

}

void main() {
  vPhase = aPhase; 


  // Each bubble floats up and down with a different sine wave frequency
  // Multiple frequency layers create complex organic motion
  float floatWave = sin(uTime * (0.4 + aFrequency * 0.8) + aPhase * 6.28318); 


  // Audio-driven amplitude per layer
  float bassAmp = uBass * mix(0.5, 1.5, 1.0 - aLayer); 

  float midAmp = uMid * mix(0.3, 1.0, abs(aLayer - 0.5) * 2.0); 

  float trebleAmp = uTreble * mix(0.5, 1.0, aLayer); 


  float audioAmp = bassAmp + midAmp + trebleAmp; 


  // Position with float animation
  vec3 pos = position; 

  float floatHeight = (0.8 + audioAmp) * floatWave; 

  pos.y += floatHeight; 


  // Subtle horizontal drift
  float driftX = sin(uTime * 0.3 + aPhase * 3.0) * 0.15 * (1.0 + audioAmp); 

  float driftZ = cos(uTime * 0.35 + aPhase * 2.5) * 0.15 * (1.0 + audioAmp); 

  pos.x += driftX; 

  pos.z += driftZ; 


  // Scale pulsing
  float scalePulse = 1.0 + floatWave * (0.15 + audioAmp * 0.3); 

  float size = aSize * scalePulse; 


  vHeight = floatHeight; 

  vAlpha = 0.55 + floatWave * 0.2 + audioAmp * 0.25; 

  vNormal = normalize(normalMatrix * normal); 


  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0); 

  gl_PointSize = size * (200.0 / -mvPosition.z); 

  gl_Position = projectionMatrix * mvPosition; 

}
