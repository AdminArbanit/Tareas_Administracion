// Vista "Hoy": lo atrasado, lo de hoy y lo ya completado hoy.
(function () {
  const { el, dayKey } = App;
  const PRIO = { alta: 0, media: 1, baja: 2 };
  const ymd = d => d.toLocaleDateString('en-CA');

  const byTimePrio = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')
    || (PRIO[a.priority] ?? 3) - (PRIO[b.priority] ?? 3) || a.createdAt.localeCompare(b.createdAt);

  const dueNow = (s, today) => s.tasks.filter(t => !t.completedAt && t.due && t.due <= today);

  function section(title, tasks, cls = '') {
    return tasks.length ? [el('div', { class: 'day ' + cls }, `${title} (${tasks.length})`), el('ul', { class: 'list' }, tasks.map(App.taskRow))] : '';
  }

  App.registerView({
    id: 'hoy',
    label: 'Hoy',
    badge: s => dueNow(s, ymd(new Date())).length || null,
    render(state) {
      const today = ymd(new Date());
      const pend = dueNow(state, today);
      const overdue = pend.filter(t => t.due < today).sort((a, b) => a.due.localeCompare(b.due) || byTimePrio(a, b));
      const todays = pend.filter(t => t.due === today).sort(byTimePrio);
      const done = state.tasks.filter(t => t.completedAt && dayKey(t.completedAt) === today)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

      const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const summary = pend.length
        ? `${todays.length} para hoy · ${overdue.length} atrasadas · ${done.length} completadas hoy`
        : done.length ? `Todo al día · ${done.length} completadas hoy` : 'Nada para hoy';

      return el('div', {},
        el('h2', { class: 'today-title' }, date),
        el('div', { class: 'meta today-sum' }, summary),
        pend.length ? '' : el('div', { class: 'empty' }, 'No hay tareas para hoy 🎉'),
        section('Atrasadas', overdue, 'overdue'),
        section('Hoy', todays),
        section('Completadas hoy', done));
    },
  });
})();
