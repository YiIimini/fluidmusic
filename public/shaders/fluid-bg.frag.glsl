// Fluid Background Fragment Shader
// Full-screen water ripple dynamic background
// Reference: Mineradio-MacOS ShojiWM liquid-terminal shader parameters
// Deep base (#0a0a14), multi-layer radial ripples

uniform float uTime; 

uniform vec2 uResolution; 

uniform float uIntensity; 
   // 0.0 - 1.0, default 0.8
uniform float uSpeed; 
       // ripple speed
uniform vec3 uColorBase; 
    // #0a0a14
uniform vec3 uColorAccent; 
  // blue-ish tint
uniform float uBass; 

uniform float uMid; 

uniform float uTreble; 

uniform float uEnergy; 


float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); 

}

// Simplex-like noise
float noise(vec2 p) {
  vec2 i = floor(p); 

  vec2 f = fract(p); 

  f = f * f * (3.0 - 2.0 * f); 

  float a = hash(i); 

  float b = hash(i + vec2(1.0, 0.0)); 

  float c = hash(i + vec2(0.0, 1.0)); 

  float d = hash(i + vec2(1.0, 1.0)); 

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); 

}

float fbm(vec2 p) {
  float value = 0.0; 

  float amplitude = 0.5; 

  float frequency = 1.0; 

  for (int i = 0; 
 i < 5; 
 i++) {
    value += amplitude * noise(p * frequency); 

    frequency *= 2.0; 

    amplitude *= 0.5; 

  }
  return value; 

}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution; 

  vec2 center = uv - vec2(0.5); 


  // Aspect ratio correction
  float aspect = uResolution.x / uResolution.y; 

  vec2 uvAspect = vec2(center.x * aspect, center.y); 


  float dist = length(uvAspect); 


  // ── Multi-layer radial ripples ──
  // Slow, wide ripples
  float ripple1 = sin(dist * 15.0 - uTime * uSpeed * 0.6) * 0.5 + 0.5; 

  ripple1 *= smoothstep(1.0, 0.0, dist) * 0.3; 


  // Medium faster ripples
  float ripple2 = sin(dist * 25.0 - uTime * uSpeed * 1.2) * 0.5 + 0.5; 

  ripple2 *= smoothstep(0.8, 0.2, dist) * 0.25; 


  // Fine fast ripples at center
  float ripple3 = sin(dist * 40.0 - uTime * uSpeed * 1.8 + noise(uv * 3.0) * 2.0) * 0.5 + 0.5; 

  ripple3 *= smoothstep(0.5, 0.0, dist) * 0.2; 


  // ── FBM flowing texture ──
  vec2 flowUV = uv + vec2(
    sin(uv.y * 4.0 + uTime * 0.3) * 0.05,
    cos(uv.x * 4.0 + uTime * 0.25) * 0.05
  ); 

  float flow = fbm(flowUV * 3.0 + uTime * 0.15); 


  // ── Audio-reactive elements ──
  // Bass creates slow deep pulses
  float bassPulse = uBass * sin(dist * 8.0 + uTime * 0.8) * 0.5 + 0.5; 

  bassPulse *= smoothstep(0.9, 0.3, dist) * 0.15; 


  // Mid creates medium ring movements
  float midRing = uMid * sin(dist * 20.0 + uTime * 1.5 + noise(uv * 5.0)) * 0.5 + 0.5; 

  midRing *= smoothstep(0.7, 0.1, dist) * 0.12; 


  // Treble creates sparkle
  float sparkle = uTreble * hash(uv * uResolution * 0.5 + uTime * 10.0) * smoothstep(0.4, 0.0, dist) * 0.08; 


  // ── Compose layers ──
  float fluidValue = flow * 0.15; 

  fluidValue += (ripple1 + ripple2 + ripple3) * uIntensity; 

  fluidValue += bassPulse; 

  fluidValue += midRing; 

  fluidValue += sparkle; 


  // Edge vignette
  float vignette = 1.0 - smoothstep(0.3, 1.2, dist) * 0.6; 


  // Color composition
  vec3 color = uColorBase; 


  // Lighter fluid ripples
  vec3 rippleColor = mix(uColorBase, uColorAccent * 0.4, fluidValue * 2.0); 

  color = mix(color, rippleColor, fluidValue * uIntensity); 


  // Center glow
  float centerGlow = exp(-dist * 2.5) * 0.06; 

  color += uColorAccent * centerGlow; 


  // Apply vignette
  color *= vignette; 


  // Subtle energy brightness
  color += uEnergy * 0.02; 


  gl_FragColor = vec4(color, 0.55); 

}
