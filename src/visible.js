// Modo solo karts (DOCUMENTO-MAESTRO.md, fase 1). Lo que no está aquí se oculta en menús, ligas y reto, pero no se borra:
// para reactivar algo basta con añadir su id a la lista.
export const VISIBLE_CARS = ['kart']; // un solo kart: lo demás son aspectos (colores, calcomanías y carrocerías)
// karting = Fórmula 0, asupark = Asupark (karts propios), muralla = Gran Muralla (circuito de karts sobre la muralla)
// misty y mariocircuit son importados; con muralla forman la fila de circuitos ficticios
// lider = kartódromo importado (circuito real, nombre inventado)
export const VISIBLE_TRACKS = ['karting', 'asupark', 'lider', 'lemans', 'muralla', 'misty', 'mariocircuit'];
export const isVisibleCar = (c) => VISIBLE_CARS.includes(c.id);
export const isVisibleTrack = (k) => VISIBLE_TRACKS.includes(k);
