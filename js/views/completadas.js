(function () {
  const { el, fmtDate, fmtTime, dayKey } = App;

  App.registerView({
    id: 'completadas',
    label: 'Completadas',
    render(state) {
      const done = state.tasks.filter(t => t.completedAt)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      if (!done.length) return el('div', { class: 'empty' }, 'Todavía no completaste ninguna tarea.');

      const out = [];
      let last = null, ul = null;
      for (const t of done) {
        const k = dayKey(t.completedAt);
        if (k !== last) {
          last = k;
          out.push(el('div', { class: 'day' }, fmtDate(t.completedAt)));
          ul = el('ul', { class: 'list' });
          out.push(ul);
        }
        const row = App.taskRow(t);
        row.querySelector('.meta').textContent = `Completada ${fmtTime(t.completedAt)}`;
        ul.append(row);
      }
      return el('div', {}, out);
    },
  });
})();
