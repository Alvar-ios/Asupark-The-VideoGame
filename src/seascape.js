// Paisaje marino de un circuito importado: cielo con nubes, mar y bancos de bruma. El mar y el cielo acaban en el
// mismo color que la niebla de la escena, así el horizonte se difumina y no se ve dónde termina nada.
import * as THREE from 'three';

const NOISE = `
float sh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float sn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sh(i),sh(i+vec2(1,0)),f.x),mix(sh(i+vec2(0,1)),sh(i+vec2(1,1)),f.x),f.y); }
float sfbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*sn(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return v; }
`;

export function seaSky(sea) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(sea.skyTop) }, mid: { value: new THREE.Color(sea.skyMid) }, haze: { value: new THREE.Color(sea.haze) }, cloud: { value: new THREE.Color(sea.cloud) }, glow: { value: new THREE.Color(sea.glow) }, sunDir: { value: new THREE.Vector3(...sea.sunDir).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, haze, cloud, glow, sunDir; varying vec3 vDir; ${NOISE}
      void main(){
        vec3 d=normalize(vDir); float h=max(d.y,0.0);
        vec3 col=mix(haze, mid, smoothstep(0.015,0.22,h)); col=mix(col, top, smoothstep(0.18,0.75,h));
        col+=glow*pow(max(dot(d,sunDir),0.0),7.0)*0.35;
        // nubes: planas a lo lejos, más sueltas arriba
        vec2 uv=d.xz/(h+0.16)*1.15; float n=sfbm(uv*1.3), m=sfbm(uv*3.1+31.0);
        float c=smoothstep(0.50,0.80,n+m*0.18)*smoothstep(0.03,0.16,h);
        col=mix(col, mix(cloud, mid, smoothstep(0.62,0.95,m)*0.35), c*0.9);
        // franja de bruma sobre el horizonte, con el borde irregular
        float a=atan(d.x,d.z); float bank=1.0-smoothstep(0.0, 0.045+0.05*sfbm(vec2(a*5.0,3.0)), h);
        col=mix(col, haze, bank);
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Group(); sky.add(new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 20), mat)); return sky;
}

export function seaWater(sea) {
  const m = new THREE.MeshLambertMaterial({ color: sea.water });
  const u = { uDeep: { value: new THREE.Color(sea.deep) }, uFoam: { value: new THREE.Color(sea.foam) }, uTime: { value: 0 } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vSea;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSea=(modelMatrix*vec4(transformed,1.0)).xyz;');
    s.fragmentShader = 'uniform vec3 uDeep, uFoam; uniform float uTime; varying vec3 vSea;\n' + NOISE + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 p=vSea.xz; float swell=sfbm(p*0.018+vec2(uTime*0.012,0.0)); float rip=sn(p*0.21+vec2(uTime*0.35,uTime*0.2))*sn(p*0.33-vec2(uTime*0.25,0.0));
        diffuseColor.rgb=mix(diffuseColor.rgb, uDeep, smoothstep(0.38,0.68,swell));
        float near=1.0-smoothstep(60.0,320.0,length(p-cameraPosition.xz));
        diffuseColor.rgb=mix(diffuseColor.rgb, uFoam, smoothstep(0.50,0.72,rip)*0.35*near); }`);
  };
  m.customProgramCacheKey = () => 'sea';
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1880, 64).rotateX(-Math.PI / 2), m);
  mesh.position.y = sea.level;
  mesh.onBeforeRender = () => { u.uTime.value = (performance.now() / 1000) % 1000; };
  return mesh;
}

// bancos de niebla sobre el mar, a lo lejos y alrededor de la isla
export function mistBanks(sea) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 46; i++) {
    const px = 40 + rnd() * 176, py = 74 + rnd() * 24 - 18 * Math.sin(((px - 40) / 176) * Math.PI), r = 14 + rnd() * 24;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2, far = i % 2, r = far ? 640 + rnd() * 160 : 370 + rnd() * 120, w = (far ? 300 : 170) * (0.7 + rnd() * 0.7);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: sea.mist, transparent: true, opacity: far ? 0.85 : 0.55, depthWrite: false, fog: false }));
    sp.scale.set(w, w * (0.2 + rnd() * 0.08), 1); sp.position.set(Math.sin(a) * r, sea.level + w * 0.075, Math.cos(a) * r); group.add(sp);
  }
  return group;
}
