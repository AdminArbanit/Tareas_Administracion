(function () {
  const { el, fmtDateTime } = App;
  const LABEL = { created: 'Creada', completed: 'Completada', reopened: 'Reabierta', edited: 'Editada', deleted: 'Eliminada',
    snoozed: 'Pospuesta', skipped: 'Salteada', restored: 'Restaurada', undone: 'Deshecho' };

  App.registerView({
    id: 'actividad',
    label: 'Historial',
    render(state) {
      if (!state.log.length) return el('div', { class: 'empty' }, 'Sin actividad todavía.');
      const items = [...state.log].reverse().map(e =>
        el('li', { class: 'task' },
          el('div', { class: 'body' },
            el('div', { class: 'title' }, `${LABEL[e.type] || e.type}: ${e.title}`),
            el('div', { class: 'meta' }, fmtDateTime(e.at)))));
      const clear = el('button', {
        class: 'btn danger',
        onclick: () => {
          if (confirm(`¿Borrar las ${state.log.length} entradas del historial?\nLas tareas no se tocan. Se borra también en las otras computadoras al sincronizar.`)) Store.clearLog();
        },
      }, 'Borrar historial');
      return el('div', {}, el('div', { class: 'chips' }, clear), el('ul', { class: 'list' }, items));
    },
  });
})();
