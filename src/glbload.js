// Carga de .glb sin red ni WebAssembly (compatible con páginas con CSP estricta):
// el archivo va incrustado y comprimido en gzip; se descomprime con DecompressionStream y se interpreta desde memoria.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function gunzip(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
export async function parseGlb(u8gz) {
  const buf = await gunzip(u8gz);
  const loader = new GLTFLoader();
  // las texturas se cargan con <img> (blob:) y no con fetch, que una CSP estricta puede bloquear
  const ua = navigator.userAgent;
  try { Object.defineProperty(navigator, 'userAgent', { value: ua + ' Firefox/90.0', configurable: true }); } catch (e) { /* sin truco */ }
  let promise;
  try { promise = new Promise((res, rej) => loader.parse(buf, '', res, rej)); }
  finally { try { Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true }); } catch (e) { /* nada */ } }
  return promise;
}
