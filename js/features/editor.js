// Diálogo de edición de tareas: App.editTask(id)
(function () {
  const { el } = App;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  App.editTask = function (id) {
    const t = Store.get().tasks.find(x => x.id === id);
    if (!t) return;
    const opt = (v, label, cur) => el('option', { value: v, selected: v === (cur || '') }, label);
    const subs = (t.subtasks || []).map(s => ({ ...s }));

    // --- lista de pasos (se redibuja al agregar/quitar) ---
    const subList = el('ul', { class: 'sub edit' });
    const drawSubs = () => subList.replaceChildren(...subs.map(s => el('li', {},
      el('input', { type: 'checkbox', checked: !!s.done, onchange: e => { s.done = e.target.checked; } }),
      el('input', { class: 'sub-title', value: s.title, oninput: e => { s.title = e.target.value; } }),
      el('button', { type: 'button', class: 'x', title: 'Quitar paso', onclick: () => { subs.splice(subs.indexOf(s), 1); drawSubs(); } }, '×'))));
    const addSub = () => {
      const v = newSub.value.trim();
      if (!v) return;
      subs.push({ id: uid(), title: v, done: false });
      newSub.value = '';
      drawSubs();
      newSub.focus();
    };
    const newSub = el('input', {
      placeholder: 'Agregar paso…',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }, // Enter agrega el paso, no guarda
    });
    drawSubs();

    const dlg = el('dialog', { class: 'editor' },
      el('form', {
        method: 'dialog',
        onsubmit: e => {
          const f = e.target;
          if (!f.title.value.trim()) return;
          addSub(); // por si quedó un paso escrito sin confirmar
          Store.update(id, {
            title: f.title.value.trim(),
            due: f.due.value || null,
            time: f.due.value && f.time.value ? f.time.value : null,
            priority: f.priority.value || null,
            tags: App.parseTags(f.tags.value),
            ...App.readRepeat(f),
            notes: f.notes.value.trim(),
            subtasks: subs.filter(s => s.title.trim()),
          });
        },
      },
        el('h2', {}, 'Editar tarea'),
        el('input', { name: 'title', value: t.title, required: true }),
        el('div', { class: 'opts' },
          el('input', { name: 'due', type: 'date', value: t.due || '' }),
          el('input', { name: 'time', type: 'time', value: t.time || '' }),
          el('select', { name: 'priority' }, opt('', 'Sin prioridad', t.priority), opt('alta', 'alta', t.priority), opt('media', 'media', t.priority), opt('baja', 'baja', t.priority)),
          App.repeatControls(t),
          el('input', { name: 'tags', value: (t.tags || []).join(', '), placeholder: 'etiquetas' })),
        el('label', { class: 'field' }, 'Notas', el('textarea', { name: 'notes', rows: 3, placeholder: 'Detalles, links, contexto…' }, t.notes || '')),
        el('div', { class: 'field' }, 'Pasos', subList, newSub),
        el('div', { class: 'actions' },
          el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancelar'),
          el('button', { class: 'btn primary' }, 'Guardar'))));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  };
})();
