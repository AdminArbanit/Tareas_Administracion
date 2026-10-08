// Tareas programadas: la próxima ocurrencia pendiente de cada tarea que se repite.
(function () {
  const { el } = App;
  const GROUPS = [['daily', 'Cada día'], ['weekdays', 'Días hábiles'], ['weekly', 'Cada semana'], ['monthly', 'Cada mes']];
  const isActive = t => t.repeat && !t.completedAt;

  App.registerView({
    id: 'programadas',
    label: 'Programadas',
    badge: s => s.tasks.filter(isActive).length,
    render(state) {
      const active = state.tasks.filter(isActive);
      if (!active.length) {
        return el('div', { class: 'empty' }, 'No hay tareas que se repitan. Creá una eligiendo "Repetir" al agregarla.');
      }
      return el('div', {}, GROUPS.map(([key, name]) => {
        const items = active.filter(t => t.repeat === key)
          .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title));
        if (!items.length) return '';
        return [
          el('div', { class: 'day' }, `${name} (${items.length})`),
          el('ul', { class: 'list' }, items.map(t => {
            const row = App.taskRow(t);
            const n = state.tasks.filter(x => x.completedAt && x.repeat === t.repeat && x.title === t.title).length;
            row.querySelector('.meta').append(` · Completada ${n} ${n === 1 ? 'vez' : 'veces'}`);
            return row;
          })),
        ];
      }));
    },
  });
})();
