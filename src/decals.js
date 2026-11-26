// Calcomanías del Kart de alquiler. Se pintan en el propio material de la carrocería a partir de la posición de cada
// punto (metros: morro +Z, izquierda +X), así no dependen del despiece de texturas y valen sobre cualquier color.
import * as THREE from 'three';

const HEAD = `
uniform vec3 uBase;
varying vec3 vKart;
float kzig(float v){ return abs(fract(v)-0.5)*2.0; }
float khash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float knoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(khash(i),khash(i+vec3(1,0,0)),f.x),mix(khash(i+vec3(0,1,0)),khash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(khash(i+vec3(0,0,1)),khash(i+vec3(1,0,1)),f.x),mix(khash(i+vec3(0,1,1)),khash(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;
// cada una deja en `ink` el color y en `mask` dónde va
const PATTERNS = {
  franjas: `float a=abs(p.x); mask=max(step(abs(a-0.085),0.042), step(abs(a-0.575),0.018)); ink=lum>0.55?vec3(0.03):vec3(0.92);`,
  cuadros: `float c=mod(floor(p.x/0.1)+floor(p.z/0.1)+floor(p.y/0.1),2.0); mask=max(step(p.z,-0.42), step(0.46,abs(p.x))*step(p.z,0.28)); ink=c<0.5?vec3(0.92):vec3(0.012);`,
  camuflaje: `float n=knoise(p*7.5), m=knoise(p*11.0+4.7); mask=max(step(0.56,n),step(0.62,m)); ink=step(0.56,n)>0.5?uBase*0.32:mix(uBase,vec3(0.62,0.55,0.33),0.75);`,
  llamas: `float side=step(0.45,abs(p.x)); float k=mix(p.x*5.2+p.y*1.5, p.y*8.5+p.x*0.6, side); float edge=mix(0.5,-0.1,side)+0.3*kzig(k)+0.13*kzig(k*2.7+0.3); float d=p.z-edge; mask=step(0.0,d); ink=mix(vec3(0.75,0.015,0.0),mix(vec3(1.0,0.2,0.0),vec3(1.0,0.72,0.02),clamp((d-0.14)*5.0,0.0,1.0)),clamp(d*8.0,0.0,1.0));`,
  rayo: `float side=step(0.4,abs(p.x))*step(abs(p.y-(0.2+0.085*(kzig(p.z*2.6)-0.5)*2.0)),0.032); float top=(1.0-step(0.4,abs(p.x)))*step(abs(abs(p.x)-(0.12+0.07*(kzig(p.z*3.1)-0.5)*2.0)),0.028); mask=max(side,top); ink=vec3(1.0,0.78,0.0);`,
};

// material: carrocería ya clonada; toKart: de coordenadas de la malla a coordenadas del kart
export function applyDecal(material, name, toKart) {
  const body = PATTERNS[name]; if (!body) return;
  const base = material.color.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uToKart = { value: toKart };
    shader.uniforms.uBase = { value: base };
    shader.vertexShader = 'uniform mat4 uToKart;\nvarying vec3 vKart;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKart=(uToKart*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 p=vKart; vec3 ink=vec3(1.0); float mask=0.0; float lum=dot(uBase,vec3(0.3,0.6,0.1)); float shade=1.0;
        #ifdef USE_MAP
        shade=clamp(dot(sampledDiffuseColor.rgb,vec3(0.333))*1.35,0.25,1.15); // conserva las sombras pintadas en la textura
        #endif
        ${body}
        diffuseColor.rgb=mix(diffuseColor.rgb, ink*shade, mask);
      }`);
  };
  material.customProgramCacheKey = () => 'decal-' + name;
}

// dibujo para la tienda y el garaje
export function decalSvg(name) {
  const art = {
    franjas: '<path d="M25 8h5v48h-5zM34 8h5v48h-5z" fill="#fff"/>',
    cuadros: Array.from({ length: 16 }, (_, i) => ((i % 4 + Math.floor(i / 4)) % 2 ? '' : `<path d="M${12 + (i % 4) * 10} ${12 + Math.floor(i / 4) * 10}h10v10h-10z" fill="#fff"/>`)).join(''),
    camuflaje: '<path d="M12 18q10-12 18-2t14-4q8 8 0 16t-18 2q-16 6-14-12z" fill="#55603a"/><path d="M20 44q8-14 18-4t16 2q-2 18-18 12t-16-10z" fill="#b6a46a"/><path d="M40 20q10-2 12 10t-10 8z" fill="#2c3320"/>',
    llamas: '<path d="M10 54Q8 36 20 22q0 12 6 14-2-18 12-28-4 16 6 24 2-8 8-10-2 10 4 18 4 12-4 14z" fill="#ff5a00"/><path d="M18 54q-2-12 7-20 0 8 6 10 0-12 9-18-1 12 7 19 5 6 0 9z" fill="#ffc400"/>',
    rayo: '<path d="M38 6L14 36h15l-6 22 27-34H34z" fill="#ffc400"/>',
  }[name] || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="10" fill="#2a2e37"/>${art}</svg>`;
}
export const IDENTITY = new THREE.Matrix4();
