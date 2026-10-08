// Papelera: tareas eliminadas, recuperables durante Store.TRASH_DAYS días.
(function () {
  const { el, fmtDateTime } = App;

  App.registerView({
    id: 'papelera',
    label: 'Papelera',
    render(state) {
      const trash = [...state.trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
      if (!trash.length) return el('div', { class: 'empty' }, `La papelera está vacía. Las tareas eliminadas se conservan ${Store.TRASH_DAYS} días.`);

      const empty = el('button', {
        class: 'btn danger',
        onclick: () => { if (confirm(`¿Eliminar definitivamente ${trash.length} tareas? No se puede deshacer.`)) Store.emptyTrash(); },
      }, 'Vaciar papelera');

      return el('div', {}, el('div', { class: 'chips' }, empty),
        el('ul', { class: 'list' }, trash.map(t => {
          const left = Math.max(0, Math.ceil(Store.TRASH_DAYS - (Date.now() - new Date(t.deletedAt)) / 864e5));
          return el('li', { class: 'task' },
            el('div', { class: 'body' },
              el('div', { class: 'title trash-title' }, t.title),
              el('div', { class: 'meta' }, `Eliminada ${fmtDateTime(t.deletedAt)} · se borra en ${left} ${left === 1 ? 'día' : 'días'}`)),
            el('button', { class: 'btn', onclick: () => { Store.restore(t.id); App.toast(`Restaurada: ${t.title}`, 3000); } }, 'Restaurar'),
            el('button', {
              class: 'x', title: 'Eliminar definitivamente',
              onclick: () => { if (confirm('¿Eliminar definitivamente esta tarea?')) Store.purge(t.id); },
            }, '×'));
        })));
    },
  });
})();
