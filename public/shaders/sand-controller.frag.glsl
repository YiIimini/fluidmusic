// Sand Controller Fragment Shader
// Particle-sand feel for controller bar
// Particles compress and recover on interaction

uniform float uTime;
uniform vec2 uResolution;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uHoverPosition; // -1 to 1, where mouse hovers
uniform float uPressIntensity; // 0 to 1, press strength

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Sand particle field
  vec2 sandUV = uv * vec2(80.0, 20.0);
  float sand = noise(sandUV + uTime * 0.05);

  // Compression around hover point
  float hoverDist = abs(uv.x - (uHoverPosition * 0.5 + 0.5));
  float compression = exp(-hoverDist * 3.0) * uPressIntensity;

  // Particles compress (get darker/closer) under pressure
  float density = sand * (1.0 - compression * 0.5);

  // Audio-reactive particle glow
  float energyGlow = uEnergy * noise(sandUV * 0.5 + uTime * 0.2) * 0.3;

  // Color: warm sand tones that react to audio
  vec3 sandColor = vec3(0.65, 0.55, 0.4);
  vec3 glowColor = vec3(0.3, 0.5, 0.7) * uTreble + vec3(0.7, 0.3, 0.2) * uBass;

  vec3 color = mix(sandColor, glowColor, energyGlow);

  // Brighter where compressed
  color += compression * 0.1;

  // Alpha
  float alpha = 0.4 + density * 0.3 + energyGlow * 0.3;

  gl_FragColor = vec4(color, alpha);
}
