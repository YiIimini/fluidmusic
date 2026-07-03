// Foam Bubble Fragment Shader
// Pearl iridescence with semi-transparency
// Reference: Mineradio-MacOS foam preset

uniform float uTime; 

uniform float uEnergy; 

uniform vec3 uColorBase; 
     // Pearl white base
uniform vec3 uColorAccent; 
   // Iridescent accent (changes every 30s)
uniform float uIridescence; 


varying float vHeight; 

varying float vAlpha; 

varying vec3 vNormal; 

varying float vPhase; 


void main() {
  vec2 center = gl_PointCoord - vec2(0.5); 

  float dist = length(center); 


  // Soft spherical shading
  float sphere = 1.0 - smoothstep(0.42, 0.5, dist); 


  // Inner highlight (specular pearl effect)
  float highlight = exp(-dist * 8.0) * 0.4; 

  float specular = pow(1.0 - dist, 3.0) * 0.3; 


  // Iridescent color shift based on angle and time
  float iriShift = sin(dist * 10.0 - uTime * 0.5 + vPhase * 3.0) * 0.5 + 0.5; 

  vec3 iriColor = mix(uColorBase, uColorAccent, iriShift * uIridescence); 


  // Pearl luster — mix white with accent
  vec3 pearl = uColorBase * 0.7 + iriColor * 0.3; 


  // Color with specular highlights
  vec3 color = pearl; 

  color += vec3(1.0, 0.95, 0.9) * highlight * 0.5; 

  color += vec3(1.0) * specular * 0.25; 


  // Edge darkening for 3D feel
  float edge = smoothstep(0.15, 0.45, dist); 

  color *= mix(0.6, 1.0, edge); 


  // Energy-driven brightness
  color *= 0.9 + uEnergy * 0.3; 


  float alpha = sphere * vAlpha; 

  if (alpha < 0.01) discard; 


  gl_FragColor = vec4(color, alpha); 

}
