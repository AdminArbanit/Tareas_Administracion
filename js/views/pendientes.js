(function () {
  const { el, fmtDateTime } = App;
  const REPEAT = { daily: 'cada día', weekly: 'cada semana', monthly: 'cada mes', weekdays: 'días hábiles (lun–vie)' };
  const UNIT = { daily: 'días', weekly: 'semanas', monthly: 'meses' };
  const ui = { tag: null };
  const expanded = new Set(); // tareas con pasos/notas desplegados (solo en memoria)

  const parseTags = s => [...new Set((s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean))];

  const repeatLabel = t => {
    const n = parseInt(t.every, 10) || 1;
    return n > 1 && UNIT[t.repeat] ? `cada ${n} ${UNIT[t.repeat]}` : REPEAT[t.repeat];
  };

  // Selector de repetición + "cada N" (solo para día/semana/mes). Los nombres `repeat` y `every` los lee el formulario.
  function repeatControls(cur = {}) {
    const sel = el('select', { name: 'repeat', title: 'Repetir' },
      el('option', { value: '' }, 'No repetir'),
      Object.entries(REPEAT).map(([k, v]) => el('option', { value: k, selected: cur.repeat === k }, v)));
    const num = el('input', { name: 'every', type: 'number', min: 1, max: 99, value: cur.every || 1 });
    const unit = el('span');
    const wrap = el('label', { class: 'every' }, 'Cada ', num, ' ', unit);
    const sync = () => { wrap.hidden = !UNIT[sel.value]; unit.textContent = UNIT[sel.value] || ''; };
    sel.addEventListener('change', sync);
    sync();
    return [sel, wrap];
  }
  const readRepeat = f => {
    const repeat = f.repeat.value || null;
    const every = UNIT[repeat] ? Math.max(1, parseInt(f.every.value, 10) || 1) : null;
    return { repeat, every: every > 1 ? every : null };
  };

  function taskRow(t) {
    const overdue = t.due && !t.completedAt && new Date(t.due + 'T23:59') < new Date();
    const subs = t.subtasks || [];
    const hasDetail = subs.length || t.notes;
    const open = hasDetail && expanded.has(t.id);
    const meta = [`Creada ${fmtDateTime(t.createdAt)}`];
    if (t.due) meta.push(el('span', { class: overdue ? 'overdue' : '' },
      `Vence ${new Date(t.due + 'T00:00').toLocaleDateString('es-AR')}${t.time ? ' ' + t.time : ''}`));
    if (t.repeat) meta.push(`↻ ${repeatLabel(t)}`);
    if (t.snoozed) meta.push(`pospuesta ${t.snoozed}×`);
    if (hasDetail) {
      const label = subs.length ? `${subs.filter(s => s.done).length}/${subs.length} pasos` : 'nota';
      meta.push(el('button', { class: 'link', onclick: () => { expanded.has(t.id) ? expanded.delete(t.id) : expanded.add(t.id); App.refresh(); } },
        `${open ? '▾' : '▸'} ${label}`));
    }
    return el('li', { class: 'task' + (t.completedAt ? ' done' : '') + (t.priority ? ' p-' + t.priority : '') },
      el('input', {
        type: 'checkbox', checked: !!t.completedAt,
        onchange: () => App.act(`${t.completedAt ? 'Reabierta' : 'Completada'}: ${t.title}`, () => Store.toggle(t.id)),
      }),
      el('div', { class: 'body' },
        el('div', { class: 'title', onclick: () => App.editTask(t.id), title: 'Editar' }, t.title,
          (t.tags || []).map(g => el('span', { class: 'tag' }, '#' + g))),
        el('div', { class: 'meta' }, meta.flatMap((m, i) => i ? [' · ', m] : [m]))),
      el('button', { class: 'x', title: 'Opciones', onclick: e => App.rowMenu(t, e.currentTarget) }, '⋯'),
      open ? el('div', { class: 'detail' },
        t.notes ? el('div', { class: 'notes' }, t.notes) : '',
        subs.length ? el('ul', { class: 'sub' }, subs.map(s => el('li', {},
          el('label', { class: s.done ? 'done' : '' },
            el('input', { type: 'checkbox', checked: !!s.done, onchange: () => Store.edit(t.id, x => { const q = x.subtasks.find(z => z.id === s.id); if (q) q.done = !q.done; }) }),
            ' ', s.title)))) : '') : '');
  }
  App.taskRow = taskRow;
  App.parseTags = parseTags;
  App.REPEAT = REPEAT;
  App.repeatControls = repeatControls;
  App.readRepeat = readRepeat;
  App.repeatLabel = repeatLabel;

  const PRIO = { alta: 0, media: 1, baja: 2 };

  App.registerView({
    id: 'pendientes',
    label: 'Pendientes',
    badge: s => s.tasks.filter(t => !t.completedAt).length,
    render(state) {
      const all = state.tasks.filter(t => !t.completedAt);
      const tags = [...new Set(all.flatMap(t => t.tags || []))].sort();
      if (ui.tag && !tags.includes(ui.tag)) ui.tag = null;
      const chips = tags.length ? el('div', { class: 'chips' },
        el('button', { class: 'chip' + (!ui.tag ? ' on' : ''), onclick: () => { ui.tag = null; App.go('pendientes'); } }, 'todas'),
        tags.map(g => el('button', { class: 'chip' + (ui.tag === g ? ' on' : ''), onclick: () => { ui.tag = g; App.go('pendientes'); } }, '#' + g))) : '';

      const pending = all.filter(t => !ui.tag || (t.tags || []).includes(ui.tag))
        .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')
          || (PRIO[a.priority] ?? 3) - (PRIO[b.priority] ?? 3)
          || a.createdAt.localeCompare(b.createdAt));

      // Agrupar por día: Atrasadas, Hoy, Mañana, cada fecha, Sin fecha
      const today = new Date().toLocaleDateString('en-CA');
      const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA');
      const groups = new Map();
      for (const t of pending) {
        const k = !t.due ? 'none' : t.due < today ? 'overdue' : t.due;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }
      const longDate = d => new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const label = k => k === 'overdue' ? 'Atrasadas' : k === 'none' ? 'Sin fecha'
        : k === today ? `Hoy · ${longDate(k)}` : k === tomorrow ? `Mañana · ${longDate(k)}` : longDate(k);
      const order = [...groups.keys()].sort((a, b) => {
        const rank = k => k === 'overdue' ? 0 : k === 'none' ? 2 : 1;
        return rank(a) - rank(b) || a.localeCompare(b);
      });

      return el('div', {}, chips,
        pending.length
          ? order.map(k => [
              el('div', { class: 'day' + (k === 'overdue' ? ' overdue' : '') }, `${label(k)} (${groups.get(k).length})`),
              el('ul', { class: 'list' }, groups.get(k).map(taskRow))])
          : el('div', { class: 'empty' }, 'No hay tareas pendientes 🎉'));
    },
  });
})();
