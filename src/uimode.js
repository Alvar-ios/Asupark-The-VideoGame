// La interfaz clásica se eliminó: solo queda la nueva. Se mantienen las funciones por compatibilidad con el resto del código.
export const isUi2 = () => true;
export const onUi = () => {};
export function setUi() { /* interfaz única */ }
export function initUiToggle() { document.documentElement.classList.add('ui2'); }
export const uiToggleHtml = () => '';

// Modo oscuro: clase `dark` en <html> (se pone ya en el <head> para evitar parpadeo) y botón luna/sol arriba a la derecha.
const TK = 'dr.theme';
export const isDark = () => document.documentElement.classList.contains('dark');
export function setDark(on) {
  document.documentElement.classList.toggle('dark', on);
  try { localStorage.setItem(TK, on ? 'dark' : 'light'); } catch (_) { /* sin almacenamiento */ }
  const b = document.getElementById('hmTheme');
  if (b) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Modo claro' : 'Modo oscuro'); }
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', on ? '#111111' : '#f3eee3');
}
export function initTheme() {
  setDark(isDark());
  const b = document.getElementById('hmTheme'); if (b) b.onclick = () => setDark(!isDark());
}
