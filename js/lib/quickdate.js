// Interpreta fechas y horas escritas en el título: "llamar a Pérez mañana 15:00", "el lunes", "en 3 días", "15/10".
// App.parseQuick(texto[, hoy]) -> { title, due: 'YYYY-MM-DD'|null, time: 'HH:MM'|null, label } | null
(function () {
  const ymd = d => d.toLocaleDateString('en-CA');
  const B = '(?<![\\p{L}\\d])', E = '(?![\\p{L}\\d])';
  const rx = src => new RegExp(B + src + E, 'iu');

  const DOW = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // "por la mañana" / "esta mañana" no es la fecha de mañana
  const MANANA = rx('(?<!\\bla\\s)(?<!\\besta\\s)(?:para\\s+)?ma[ñn]ana');

  App.parseQuick = function (text, today = new Date()) {
    const base = new Date(today); base.setHours(12, 0, 0, 0);
    const addDays = n => { const d = new Date(base); d.setDate(d.getDate() + n); return ymd(d); };
    let rest = text;
    let due = null, time = null;

    const take = (re, fn) => {
      const m = rest.match(re);
      if (!m) return false;
      const val = fn(m);
      if (val === null || val === undefined) return false;
      rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
      return val;
    };

    // --- fecha (la primera que coincida) ---
    const dateRules = [
      [rx('pasado\\s+ma[ñn]ana'), () => addDays(2)],
      [MANANA, () => addDays(1)],
      [rx('hoy'), () => addDays(0)],
      [rx('en\\s+(\\d{1,3})\\s+(d[ií]as?|semanas?)'), m => addDays(parseInt(m[1], 10) * (/^s/i.test(m[2]) ? 7 : 1))],
      [rx('(?:(?:el|este|pr[oó]ximo)\\s+)*(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)'), m => {
        const diff = (DOW[plain(m[1])] - base.getDay() + 7) % 7 || 7; // siempre hacia adelante
        return addDays(diff);
      }],
      [rx('(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?'), m => {
        const day = +m[1], mon = +m[2];
        let year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : base.getFullYear();
        let d = new Date(year, mon - 1, day, 12);
        if (d.getMonth() !== mon - 1 || d.getDate() !== day) return null; // fecha inexistente
        if (!m[3] && ymd(d) < ymd(base)) d = new Date(year + 1, mon - 1, day, 12);
        return ymd(d);
      }],
    ];
    for (const [re, fn] of dateRules) { const v = take(re, fn); if (v) { due = v; break; } }

    // --- hora ---
    const hhmm = (h, m = '00') => {
      h = +h; m = +m;
      return h <= 23 && m <= 59 ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') : null;
    };
    const timeRules = [
      [rx('a\\s+las?\\s+(\\d{1,2})(?::(\\d{2}))?(?:\\s*(?:hs?|hrs?))?'), m => hhmm(m[1], m[2])],
      [rx('(\\d{1,2}):(\\d{2})(?:\\s*(?:hs?|hrs?))?'), m => hhmm(m[1], m[2])],
      [rx('(\\d{1,2})\\s*(?:hs|hrs|h)'), m => hhmm(m[1])],
    ];
    for (const [re, fn] of timeRules) { const v = take(re, fn); if (v) { time = v; break; } }

    if (!due && !time) return null;

    // Solo hora: hoy si todavía no pasó, si no mañana
    if (!due) {
      const [h, mi] = time.split(':').map(Number);
      const t = new Date(today);
      due = (h * 60 + mi > t.getHours() * 60 + t.getMinutes()) ? addDays(0) : addDays(1);
    }

    // Limpiar conectores sueltos ("para", "el", "de"...) y espacios
    let title = rest.replace(/\s+/g, ' ').trim();
    const dangling = /(?:^|\s)(para|el|de|a|en|este|la|las|pr[oó]ximo)$/i;
    while (dangling.test(title)) title = title.replace(dangling, '').trim();
    title = title.replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
    if (!title) return null;

    const dayLabel = new Date(due + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
    return { title, due, time, label: dayLabel + (time ? ' ' + time : '') };
  };
})();
