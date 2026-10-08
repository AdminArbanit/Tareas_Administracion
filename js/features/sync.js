// Sincronización con Google Sheets (Apps Script, ver apps_script/README.md).
// Cada sincronización: leer lo guardado en la hoja -> fusionar con lo local -> enviar si hay algo nuevo.
// Con "automático" apagado la computadora solo lee (modo lectura) y no envía nada.
(function () {
  const { el, fmtTime } = App;
  const KEY = 'tareas.sync';
  // Acepta la URL normal (/macros/s/ID/exec) y la de Google Workspace (/a/macros/dominio/s/ID/exec)
  const URL_OK = /^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+|macros)\/s\/[\w-]+\/exec$/;
  const DEBOUNCE_MS = 5000;
  const MIN_VISIBLE_GAP_MS = 60000;
  const PERIODIC_MS = 5 * 60000;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = patch => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* sin almacenamiento */ } };

  const ui = { busy: false, error: null, again: false, lastRun: 0 };
  let timer = null;

  async function call(action, extra = {}) {
    const cfg = read();
    // text/plain evita el preflight CORS, que Apps Script no soporta.
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: cfg.token, action, ...extra }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Respuesta inválida');
    return j;
  }

  async function sync(manual) {
    const cfg = read();
    if (!cfg.url || !cfg.token) return;
    if (ui.busy) { ui.again = true; return; }
    ui.busy = true; ui.error = null; ui.lastRun = Date.now(); App.refresh();
    let summary = '';
    try {
      const { data: remote } = await call('pull');
      if (remote) Store.merge(remote);
      const local = Store.get();
      const canPush = manual || cfg.auto;
      const differs = !remote || Store.signature(remote) !== Store.signature(local);
      if (canPush && differs) {
        await call('push', { data: local });
        summary = `☁ Sincronizadas ${local.tasks.length} tareas`;
      } else {
        summary = '☁ Todo al día';
      }
      write({ last: new Date().toISOString() });
      if (manual) App.toast(summary, 4000);
    } catch (e) {
      ui.error = e.message || String(e);
      if (manual) App.toast('⚠️ No se pudo sincronizar: ' + ui.error, 10000);
    } finally {
      ui.busy = false;
      const again = ui.again; ui.again = false;
      App.refresh();
      if (again) schedule();
    }
  }

  // Solo se programa al cambiar datos locales y con "automático" activo.
  function schedule() {
    if (!read().auto) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync(false), DEBOUNCE_MS);
  }
  Store.subscribe(schedule);

  // Al abrir y al volver a la pestaña se lee lo más reciente (también en modo lectura).
  window.addEventListener('load', () => setTimeout(() => sync(false), 1500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - ui.lastRun > MIN_VISIBLE_GAP_MS) sync(false);
  });

  // Con la pestaña visible, se vuelve a leer la hoja cada tanto (útil en la computadora de lectura).
  setInterval(() => { if (document.visibilityState === 'visible') sync(false); }, PERIODIC_MS);

  function openSettings() {
    const cfg = read();
    const dlg = el('dialog', { class: 'editor' },
      el('form', {
        method: 'dialog',
        onsubmit: e => {
          const f = e.target;
          const url = f.url.value.trim();
          if (url && !URL_OK.test(url)) { e.preventDefault(); App.toast('⚠️ La URL debe ser la de la aplicación web (script.google.com/…/exec)', 8000); return; }
          write({ url, token: f.token.value.trim(), auto: f.auto.checked });
          sync(false);
        },
      },
        el('h2', {}, 'Sincronización con Google Sheets'),
        el('p', { class: 'meta' }, 'Los datos de la hoja se fusionan con los de esta computadora. Instrucciones en apps_script/README.md.'),
        el('input', { name: 'url', value: cfg.url || '', placeholder: 'URL de la aplicación web (…/exec)' }),
        el('input', { name: 'token', type: 'password', value: cfg.token || '', placeholder: 'Token', autocomplete: 'off' }),
        el('label', { class: 'meta' }, el('input', { name: 'auto', type: 'checkbox', checked: cfg.auto !== false }), // por defecto activado; se apaga a propósito en la computadora de lectura
          ' Enviar mis cambios automáticamente'),
        el('p', { class: 'meta' }, 'Desactivalo en la computadora que solo usás para leer: trae los datos pero no envía nada.'),
        el('div', { class: 'actions' },
          el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancelar'),
          el('button', { class: 'btn primary' }, 'Guardar'))));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  App.registerFeature({
    id: 'sync',
    render() {
      const cfg = read();
      const configured = cfg.url && cfg.token;
      const status = ui.busy ? 'sincronizando…' : ui.error ? '⚠ error' : cfg.last ? `✓ ${fmtTime(cfg.last)}` : '';
      const mode = configured ? (cfg.auto ? 'automática' : 'solo lectura') : '';
      return el('span', {},
        el('button', { class: 'btn', onclick: openSettings, title: ui.error || (mode ? `Modo: ${mode}` : '') },
          `☁ Sincronización${mode ? ' (' + mode + ')' : ''}${status ? ' · ' + status : ''}`),
        configured ? [' ', el('button', { class: 'btn', disabled: ui.busy, onclick: () => sync(true) }, 'Sincronizar ahora')] : '');
    },
  });
})();
