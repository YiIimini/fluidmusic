// Particle Cover Fragment Shader
// Soft circular point sprites with subtle glow

varying vec3 vColor; 

varying float vAlpha; 

varying float vHeight; 

varying vec2 vUv; 


uniform float uTime; 

uniform float uEnergy; 


void main() {
  // Circular point sprite
  vec2 center = gl_PointCoord - vec2(0.5); 

  float dist = length(center); 


  // Soft circular falloff
  float alpha = 1.0 - smoothstep(0.4, 0.5, dist); 


  // Subtle inner glow
  float glow = exp(-dist * 4.0) * 0.3; 


  // Color with slight energy-driven warmth
  vec3 color = vColor + glow * vec3(0.2, 0.15, 0.3) * uEnergy; 


  // Edge darkening for sand-like grain
  float grain = 1.0 - dist * 0.3; 


  float finalAlpha = alpha * vAlpha * grain; 


  if (finalAlpha < 0.01) discard; 


  gl_FragColor = vec4(color, finalAlpha); 

}
