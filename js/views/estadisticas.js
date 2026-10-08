(function () {
  const { el, dayKey } = App;
  const ymd = d => d.toLocaleDateString('en-CA');
  const dayDiff = (a, b) => Math.round((new Date(a + 'T12:00') - new Date(b + 'T12:00')) / 864e5); // a - b en días
  const fmtShort = d => new Date(d + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

  function fmtDuration(ms) {
    const h = ms / 36e5;
    return h < 1 ? `${Math.round(ms / 6e4)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} días`;
  }

  const stat = (n, label, cls = '') => el('div', { class: 'stat' }, el('b', { class: cls }, String(n)), el('span', {}, label));
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  App.registerView({
    id: 'estadisticas',
    label: 'Estadísticas',
    badge: s => { const today = ymd(new Date()); return s.tasks.filter(t => !t.completedAt && t.due && t.due < today).length || null; },
    render(state) {
      const today = ymd(new Date());
      const done = state.tasks.filter(t => t.completedAt);

      // Con fecha límite: a tiempo, tardías (completadas después) y vencidas (siguen sin completar)
      const onTime = done.filter(t => t.due && dayKey(t.completedAt) <= t.due);
      const late = done.filter(t => t.due && dayKey(t.completedAt) > t.due)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      const missed = state.tasks.filter(t => !t.completedAt && t.due && t.due < today)
        .sort((a, b) => a.due.localeCompare(b.due));
      const measured = onTime.length + late.length + missed.length;

      if (!done.length && !missed.length) return el('div', { class: 'empty' }, 'Completá tareas para ver estadísticas.');

      const byDay = {};
      done.forEach(t => { const k = dayKey(t.completedAt); byDay[k] = (byDay[k] || 0) + 1; });
      const days = [];
      for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(ymd(d)); }
      const max = Math.max(1, ...days.map(k => byDay[k] || 0));

      let streak = 0; const d = new Date();
      if (!byDay[ymd(d)]) d.setDate(d.getDate() - 1);
      while (byDay[ymd(d)]) { streak++; d.setDate(d.getDate() - 1); }

      const last7 = days.slice(-7).reduce((s, k) => s + (byDay[k] || 0), 0);
      const avg = done.length ? done.reduce((s, t) => s + (new Date(t.completedAt) - new Date(t.createdAt)), 0) / done.length : 0;

      const tagCount = {};
      done.forEach(t => (t.tags || []).forEach(g => { tagCount[g] = (tagCount[g] || 0) + 1; }));
      const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

      const row = (t, text, cls) => el('li', { class: 'task' },
        el('div', { class: 'body' }, el('div', { class: 'title', onclick: () => App.editTask(t.id) }, t.title),
          el('div', { class: 'meta' }, `Límite ${fmtShort(t.due)} · `, el('span', { class: cls }, text))));

      return el('div', {},
        el('div', { class: 'stats' },
          stat(done.length, 'completadas en total'),
          stat(last7, 'últimos 7 días'),
          stat(streak, streak === 1 ? 'día de racha' : 'días de racha'),
          stat(done.length ? fmtDuration(avg) : '–', 'tiempo medio')),

        el('div', { class: 'day' }, 'Cumplimiento de fechas límite'),
        el('div', { class: 'stats' },
          stat(measured ? Math.round((onTime.length / measured) * 100) + '%' : '–', `a tiempo (${onTime.length} de ${measured})`),
          stat(missed.length, 'vencidas sin completar', missed.length ? 'late' : ''),
          stat(late.length, 'completadas con atraso')),
        missed.length ? [el('div', { class: 'day overdue' }, 'Vencidas sin completar'),
          el('ul', { class: 'list plain' }, missed.map(t => row(t, `${plural(dayDiff(today, t.due), 'día', 'días')} de atraso`, 'late')))] : '',
        late.length ? [el('div', { class: 'day' }, 'Completadas fuera de plazo'),
          el('ul', { class: 'list plain' }, late.slice(0, 10).map(t => row(t, `completada ${fmtShort(dayKey(t.completedAt))} (+${plural(dayDiff(dayKey(t.completedAt), t.due), 'día', 'días')})`, 'late')))] : '',

        el('div', { class: 'day' }, 'Completadas por día (14 días)'),
        el('div', { class: 'bars' }, days.map(k => {
          const n = byDay[k] || 0;
          return el('div', { class: 'bar', title: `${k}: ${n}` },
            el('i', { style: `height:${(n / max) * 100}%` }), el('small', {}, k.slice(8)));
        })),
        tags.length ? el('div', {}, el('div', { class: 'day' }, 'Por etiqueta'),
          el('div', { class: 'chips' }, tags.map(([g, n]) => el('span', { class: 'chip' }, `#${g} · ${n}`)))) : '');
    },
  });
})();
