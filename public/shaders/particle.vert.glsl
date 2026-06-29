// Particle Cover Vertex Shader
// Reference: Mineradio-MacOS emily cover particle preset
// Multi-layer frequency-driven particle elevation

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uEnergy;
uniform float uTransition;  // 0=dissolved, 1=formed
uniform float uLayerDepth;  // 0=front(Bass), 0.5=Mid, 1.0=back(Treble)
uniform sampler2D uCoverTexture;
uniform vec2 uTextureSize;

attribute float aRandom;
attribute float aLayer;

varying vec3 vColor;
varying float vAlpha;
varying float vHeight;
varying vec2 vUv;

// Simplex-like noise
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z
  );
}

void main() {
  vUv = uv;

  // Sample cover texture for original position
  vec4 texColor = texture2D(uCoverTexture, uv);
  float brightness = (texColor.r + texColor.g + texColor.b) / 3.0;
  float alpha = texColor.a;

  // Base particle position — grid on XY plane
  vec3 pos = position;

  // Target position (Z depth based on brightness — darker pixels recede)
  float targetZ = (brightness - 0.5) * 0.8 * (1.0 - uLayerDepth * 0.5);
  pos.z = mix(0.0, targetZ, brightness > 0.05 ? 1.0 : 0.0);

  // Dissolve animation — particles scatter randomly, then converge
  float scatter = 1.0 - uTransition;
  float scatterStrength = scatter * 4.0;

  // Frequency-driven depth variation
  float bassLift = uBass * (1.0 - uLayerDepth) * 2.5;
  float midLift = uMid * abs(uLayerDepth - 0.5) * 2.0 * 2.5;
  float trebleLift = uTreble * uLayerDepth * 2.0;

  float audioLift = bassLift + midLift + trebleLift;

  // Noise for organic scatter
  float angle = aRandom * 6.28318;
  float radius = hash(aRandom + uTime * 0.05) * scatterStrength;
  float scatterX = cos(angle) * radius;
  float scatterY = sin(angle) * radius;
  float scatterZ = (hash(aRandom * 2.0) - 0.5) * scatterStrength * 2.0;

  // Apply scatter with non-linear transition
  float easeTransition = uTransition * uTransition * (3.0 - 2.0 * uTransition);
  pos.x += scatterX * (1.0 - easeTransition);
  pos.y += scatterY * (1.0 - easeTransition);
  pos.z += scatterZ * (1.0 - easeTransition);

  // Audio-driven Z displacement
  pos.z += audioLift * (0.3 + uLayerDepth * 0.7);

  // Color: white with slight blue/warm tint based on layer
  float warmTint = mix(0.0, uBass * 0.15, 1.0 - uLayerDepth);
  float coolTint = mix(0.0, uTreble * 0.15, uLayerDepth);
  vColor = vec3(
    0.9 + warmTint - coolTint * 0.3,
    0.9 - abs(uLayerDepth - 0.5) * 0.2,
    0.9 + coolTint - warmTint * 0.3
  );

  // Alpha: hide very dark particles
  vAlpha = alpha > 0.02 ? 0.85 : 0.0;
  vAlpha *= easeTransition;
  vHeight = pos.z;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = mix(2.5, 4.0, 1.0 - uLayerDepth) * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
