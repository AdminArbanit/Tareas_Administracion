// Panel lateral: formulario para agregar tareas. Se crea una sola vez (slot 'sidebar').
(function () {
  const { el } = App;
  const ymd = d => d.toLocaleDateString('en-CA');

  const quickDates = () => {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    const today = ymd(d);
    d.setDate(d.getDate() + 1);
    const tomorrow = ymd(d);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
    return [['Hoy', today], ['Mañana', tomorrow], ['Lunes', ymd(d)]];
  };

  App.registerFeature({
    id: 'nueva',
    slot: 'sidebar',
    render() {
      let ignoreParse = false; // el usuario descartó la fecha detectada en el título
      let parsed = null;

      const hint = el('div', { class: 'hint', hidden: true });
      const updateHint = f => {
        parsed = ignoreParse || f.due.value ? null : App.parseQuick(f.title.value);
        hint.hidden = !parsed;
        if (!parsed) return;
        hint.replaceChildren(`📅 ${parsed.label} `,
          el('button', { type: 'button', class: 'link', title: 'Ignorar la fecha del título', onclick: () => { ignoreParse = true; updateHint(f); } }, 'ignorar'));
      };

      const quick = el('div', { class: 'quick' }, quickDates().map(([label, date]) =>
        el('button', {
          type: 'button', class: 'chip', title: date,
          onclick: e => { const f = e.target.form; f.due.value = date; updateHint(f); f.due.dispatchEvent(new Event('change')); },
        }, label)));

      const form = el('form', {
        class: 'add',
        oninput: e => { if (e.target.name === 'title' || e.target.name === 'due') { if (e.target.name === 'title') ignoreParse = ignoreParse && !!e.target.value; updateHint(e.currentTarget); } },
        onsubmit: e => {
          e.preventDefault();
          const f = e.target;
          let title = f.title.value, due = f.due.value || null, time = f.time.value || null;
          if (parsed && !due) { title = parsed.title; due = parsed.due; time = time || parsed.time; }
          const t = Store.add(title, {
            due,
            time: due && time ? time : null,
            priority: f.priority.value || null,
            tags: App.parseTags(f.tags.value),
            ...App.readRepeat(f),
          });
          if (!t) return;
          f.reset();
          f.repeat.dispatchEvent(new Event('change'));
          ignoreParse = false; parsed = null; hint.hidden = true;
          f.title.focus();
          App.go('pendientes'); // mostrar la tarea recién creada
        },
      },
        el('input', { name: 'title', placeholder: 'Nueva tarea… (ej: llamar a Pérez mañana 15:00)', autocomplete: 'off', required: true }),
        hint,
        quick,
        el('div', { class: 'opts' },
          el('input', { name: 'due', type: 'date', title: 'Fecha límite' }),
          el('input', { name: 'time', type: 'time', title: 'Hora del aviso' }),
          el('select', { name: 'priority', title: 'Prioridad' },
            el('option', { value: '' }, 'Prioridad'), ['alta', 'media', 'baja'].map(p => el('option', { value: p }, p))),
          App.repeatControls(),
          el('input', { name: 'tags', placeholder: 'etiquetas, separadas, por coma' })),
        el('button', { class: 'btn primary' }, 'Agregar'));
      return form;
    },
  });
})();
