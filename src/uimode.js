// La interfaz clásica se eliminó: solo queda la nueva. Se mantienen las funciones por compatibilidad con el resto del código.
export const isUi2 = () => true;
export const onUi = () => {};
export function setUi() { /* interfaz única */ }
export function initUiToggle() { document.documentElement.classList.add('ui2'); }
export const uiToggleHtml = () => '';
