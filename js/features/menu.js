// Menú de opciones de una tarea (botón ⋯): editar, posponer, saltear, eliminar. App.rowMenu(tarea, botón)
(function () {
  const { el } = App;
  let open = null;

  function close() {
    if (!open) return;
    open.remove(); open = null;
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', close, true);
  }
  const onOutside = e => { if (open && !open.contains(e.target)) close(); };
  const onKey = e => { if (e.key === 'Escape') close(); };

  function items(t) {
    const list = [['Editar', () => App.editTask(t.id)]];
    if (!t.completedAt) {
      list.push(['Posponer a mañana', () => App.act(`Pospuesta a mañana: ${t.title}`, () => Store.snooze(t.id, 'tomorrow'))]);
      list.push(['Posponer al lunes', () => App.act(`Pospuesta al lunes: ${t.title}`, () => Store.snooze(t.id, 'monday'))]);
      list.push(['Posponer una semana', () => App.act(`Pospuesta una semana: ${t.title}`, () => Store.snooze(t.id, 'week'))]);
      if (t.repeat) list.push(['Saltear esta vez', () => App.act(`Salteada: ${t.title}`, () => Store.skip(t.id))]);
    }
    list.push(['Eliminar', () => App.act(`Eliminada: ${t.title}`, () => Store.remove(t.id)), 'danger']);
    return list;
  }

  App.rowMenu = function (t, anchor) {
    close();
    const menu = el('div', { class: 'menu', role: 'menu' }, items(t).map(([label, fn, cls]) =>
      el('button', { class: cls || '', role: 'menuitem', onclick: () => { close(); fn(); } }, label)));
    document.body.append(menu);
    open = menu;
    // Alineado al botón; si no entra abajo, se abre hacia arriba
    const r = anchor.getBoundingClientRect();
    const h = menu.offsetHeight, w = menu.offsetWidth;
    menu.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    menu.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
    menu.querySelector('button').focus();
  };
})();
