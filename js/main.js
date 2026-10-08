App.start();

// Instalable / sin conexión: solo con http(s) (no con file://)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker no disponible', e));
}
