// Tema: auto (sigue al sistema) -> claro -> oscuro. Se recuerda en localStorage.
(function () {
  const { el } = App;
  const KEY = 'tareas.theme';
  const MODES = ['auto', 'light', 'dark'];
  const LABEL = { auto: '🌗 Auto', light: '☀️ Claro', dark: '🌙 Oscuro' };

  const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
  function apply(mode) {
    if (mode === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    try { localStorage.setItem(KEY, mode); } catch { /* sin almacenamiento: solo dura la sesión */ }
  }

  apply(get());

  App.registerFeature({
    id: 'tema',
    slot: 'header',
    render() {
      const mode = get();
      return el('button', {
        class: 'btn', title: 'Cambiar tema',
        onclick: () => { apply(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); App.refresh(); },
      }, LABEL[mode]);
    },
  });
})();
