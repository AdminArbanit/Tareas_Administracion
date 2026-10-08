// Recordatorios: avisa (aviso en pantalla + notificación del sistema si está permitida)
// cuando llega la fecha/hora de una tarea. Solo funciona con la página abierta.
(function () {
  const { el } = App;


  const supported = 'Notification' in window;
  const perm = () => (supported ? Notification.permission : 'denied');

  function notify(title, body) {
    try { new Notification(title, { body }); } catch (e) { console.warn('Notification falló', e); }
  }

  function check() {
    const now = new Date();
    for (const t of Store.get().tasks) {
      if (t.completedAt || t.deletedAt || t.reminded || !t.due || !t.time) continue;
      if (new Date(`${t.due}T${t.time}`) > now) continue;
      Store.patch(t.id, { reminded: true });
      App.toast('⏰ ' + t.title, 15000);
      if (perm() === 'granted') notify('Tarea pendiente', t.title);
    }
  }

  setInterval(check, 30000);
  window.addEventListener('load', check);

  const BLOCKED_HELP = location.protocol === 'file:'
    ? 'El navegador no permite notificaciones en páginas abiertas como archivo. Abrí la app con iniciar.bat (usa http://localhost:5174).'
    : 'Notificaciones bloqueadas. Permitilas desde el candado de la barra de direcciones → Notificaciones.';

  async function onClick() {
    if (perm() === 'default') {
      try { await Notification.requestPermission(); } catch (e) { console.warn(e); }
    }
    if (perm() === 'granted') {
      notify('Avisos activados', 'Así se verá un recordatorio.');
      App.toast('✅ Avisos del sistema activados', 5000);
    } else {
      App.toast('⚠️ ' + BLOCKED_HELP, 12000);
    }
    App.refresh();
  }

  App.registerFeature({
    id: 'recordatorios',
    render() {
      if (!supported) return '';
      const label = { default: 'Activar avisos del sistema', granted: 'Avisos activados ✓ (probar)', denied: 'Avisos bloqueados (ver ayuda)' }[perm()];
      return el('button', { class: 'btn', onclick: onClick }, label);
    },
  });
})();
