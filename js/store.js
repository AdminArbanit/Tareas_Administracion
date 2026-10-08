// Estado + persistencia. Única fuente de verdad; las vistas solo leen y llaman acciones.
// Para cambiar el modelo de datos: subir SCHEMA_VERSION y agregar una migración.
// Campos opcionales de tarea (no requieren migración): notes, subtasks[{id,title,done}], every, snoozed, deletedAt.
(function (global) {
  const KEY = 'tareas.data';
  const SCHEMA_VERSION = 2;
  const TRASH_DAYS = 30;

  // migrations[n] convierte de la versión n a n+1
  const migrations = {
    // v2: cada tarea lleva updatedAt y se registran las eliminadas (para fusionar entre computadoras)
    1: data => {
      data.tasks.forEach(t => { t.updatedAt = t.completedAt || t.createdAt; });
      data.deleted = data.deleted || [];
      return data;
    },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const ymd = d => d.toLocaleDateString('en-CA');
  const clone = o => JSON.parse(JSON.stringify(o));

  // Próxima fecha límite de una tarea recurrente, nunca en el pasado.
  // repeat: 'daily' | 'weekly' | 'monthly' (con `every` = cada N) | 'weekdays' (lunes a viernes)
  function nextDue(t) {
    const today = ymd(new Date());
    const every = Math.max(1, parseInt(t.every, 10) || 1);
    const d = new Date((t.due || today) + 'T12:00');
    const step = () => {
      if (t.repeat === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
      else if (t.repeat === 'daily') d.setDate(d.getDate() + every);
      else if (t.repeat === 'weekly') d.setDate(d.getDate() + 7 * every);
      else { // mensual: si el día no existe en el mes destino (31 -> febrero) usa el último día
        const day = d.getDate();
        d.setDate(1); d.setMonth(d.getMonth() + every);
        d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
    };
    do { step(); } while (ymd(d) < today);
    return ymd(d);
  }

  function snoozeDate(mode) {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    if (mode === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (mode === 'monday') { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1); }
    else d.setDate(d.getDate() + 7);
    return ymd(d);
  }

  function empty() { return { version: SCHEMA_VERSION, tasks: [], log: [], deleted: [], logClearedAt: null }; }

  function migrate(data) {
    while (data.version < SCHEMA_VERSION) {
      const fn = migrations[data.version];
      if (fn) data = fn(data);
      data.version++;
    }
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : empty();
    } catch (e) {
      console.error('No se pudo leer el almacenamiento', e);
      return empty();
    }
  }

  let state = load();
  const listeners = new Set();

  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('No se pudo guardar', e); }
    listeners.forEach(fn => fn(state));
  }

  function log(type, task) {
    state.log.push({ id: uid(), type, taskId: task.id, title: task.title, at: now() });
  }

  const find = id => state.tasks.find(t => t.id === id);

  // Eliminación definitiva: queda una lápida para que ninguna otra computadora la reintroduzca al fusionar.
  function purge(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    state.deleted.push({ id, at: now() });
  }
  function purgeOld() {
    const cutoff = Date.now() - TRASH_DAYS * 864e5;
    const old = state.tasks.filter(t => t.deletedAt && new Date(t.deletedAt).getTime() < cutoff);
    old.forEach(t => purge(t.id));
    return old.length;
  }
  if (purgeOld()) commit();

  // Deshacer de un nivel: guarda cómo estaban las tareas tocadas y cuáles se crearon.
  // Al restaurar se les pone un updatedAt nuevo para que la restauración también gane al sincronizar.
  let undoRec = null;
  function tracked(ids, fn, type) {
    const before = ids.map(find).filter(Boolean).map(clone);
    const known = new Set(state.tasks.map(t => t.id));
    fn();
    const created = state.tasks.filter(t => !known.has(t.id)).map(t => t.id);
    undoRec = { id: uid(), before, created };
    commit();
    return undoRec.id;
  }

  const actions = {
    add(title, extra = {}) {
      title = (title || '').trim();
      if (!title) return null;
      // Campos nuevos (prioridad, etiquetas, etc.) van en `extra` sin tocar esta función.
      const t = { id: uid(), title, createdAt: now(), completedAt: null, due: null, ...extra, updatedAt: now() };
      state.tasks.push(t);
      log('created', t);
      commit();
      return t;
    },
    // Cambios internos locales: sin historial ni updatedAt, no se sincronizan (p. ej. recordatorio ya avisado)
    patch(id, p) { const t = find(id); if (t) { Object.assign(t, p); commit(); } },
    // Cambio sin deshacer (p. ej. tildar un paso). logType null = sin entrada de historial.
    edit(id, fn, logType = null) {
      const t = find(id); if (!t) return;
      fn(t);
      t.updatedAt = now();
      if (logType) log(logType, t);
      commit();
    },
    toggle(id) {
      return tracked([id], () => {
        const t = find(id); if (!t) return;
        t.completedAt = t.completedAt ? null : now();
        t.updatedAt = now();
        log(t.completedAt ? 'completed' : 'reopened', t);
        // Tarea recurrente: al completarla se crea la siguiente ocurrencia.
        if (t.completedAt && t.repeat && !t.nextCreated) {
          t.nextCreated = true;
          const n = { ...clone(t), id: uid(), createdAt: now(), completedAt: null, nextCreated: false, reminded: false, snoozed: 0, due: nextDue(t), updatedAt: now() };
          n.subtasks = (n.subtasks || []).map(s => ({ ...s, done: false }));
          state.tasks.push(n);
          log('created', n);
        }
      });
    },
    update(id, patch) {
      return tracked([id], () => {
        const t = find(id); if (!t) return;
        if ('due' in patch || 'time' in patch) patch.reminded = false;
        Object.assign(t, patch, { updatedAt: now() });
        log('edited', t);
      });
    },
    // Pospone la fecha límite: mode = 'tomorrow' | 'monday' | 'week'
    snooze(id, mode) {
      return tracked([id], () => {
        const t = find(id); if (!t) return;
        t.due = snoozeDate(mode); t.reminded = false; t.snoozed = (t.snoozed || 0) + 1; t.updatedAt = now();
        log('snoozed', t);
      });
    },
    // Salta la ocurrencia actual de una tarea recurrente sin completarla
    skip(id) {
      return tracked([id], () => {
        const t = find(id); if (!t || !t.repeat) return;
        t.due = nextDue(t); t.reminded = false; t.updatedAt = now();
        log('skipped', t);
      });
    },
    // Va a la papelera (se conserva TRASH_DAYS días)
    remove(id) {
      return tracked([id], () => {
        const t = find(id); if (!t) return;
        t.deletedAt = now(); t.updatedAt = now();
        log('deleted', t);
      });
    },
    restore(id) {
      const t = find(id); if (!t) return;
      delete t.deletedAt; t.updatedAt = now();
      log('restored', t);
      commit();
    },
    purge(id) { purge(id); commit(); },
    emptyTrash() { state.tasks.filter(t => t.deletedAt).forEach(t => purge(t.id)); commit(); },
    undo(undoId) {
      if (!undoRec || undoRec.id !== undoId) return false;
      const r = undoRec; undoRec = null;
      r.created.forEach(id => { if (find(id)) purge(id); });
      r.before.forEach(s => {
        state.tasks = state.tasks.filter(x => x.id !== s.id);
        state.deleted = state.deleted.filter(d => d.id !== s.id);
        state.tasks.push({ ...s, updatedAt: now() });
      });
      if (r.before[0]) log('undone', r.before[0]);
      commit();
      return true;
    },
    replaceAll(data) { state = migrate(data); commit(); },
    // Borra el historial. logClearedAt viaja con la sincronización para que no vuelva desde otra computadora.
    clearLog() { state.log = []; state.logClearedAt = now(); commit(); },
    // Fusiona datos de otra computadora: por tarea gana la modificación más reciente;
    // una eliminación definitiva posterior a la última modificación gana sobre la tarea.
    merge(remote) {
      const before = signature(state);
      state = mergeData(state, migrate(clone(remote)));
      purgeOld();
      if (signature(state) !== before) commit();
    },
    signature: d => signature(migrate(clone(d))),
  };

  function mergeData(a, b) {
    const tomb = new Map();
    [...a.deleted, ...b.deleted].forEach(d => { if (!tomb.has(d.id) || tomb.get(d.id) < d.at) tomb.set(d.id, d.at); });

    const tasks = new Map();
    [...a.tasks, ...b.tasks].forEach(t => {
      const cur = tasks.get(t.id);
      if (!cur || (t.updatedAt || '') > (cur.updatedAt || '')) tasks.set(t.id, t); // empate: se queda la local (a va primero)
    });
    for (const [id, t] of tasks) if (tomb.has(id) && tomb.get(id) >= (t.updatedAt || '')) tasks.delete(id);

    // Entradas anteriores al último borrado de historial (de cualquiera de los dos lados) se descartan
    const cleared = [a.logClearedAt || '', b.logClearedAt || ''].sort().pop();
    const logs = new Map();
    [...a.log, ...b.log].filter(l => l.at > cleared).forEach(l => logs.set(l.id, l));

    return {
      version: SCHEMA_VERSION,
      tasks: [...tasks.values()],
      log: [...logs.values()].sort((x, y) => x.at.localeCompare(y.at)),
      deleted: [...tomb].map(([id, at]) => ({ id, at })),
      logClearedAt: cleared || null,
    };
  }

  // Resumen comparable del contenido sincronizable (los campos locales como `reminded` no cuentan)
  function signature(d) {
    return [d.tasks.map(t => t.id + '@' + t.updatedAt).sort().join(','),
      d.deleted.map(x => x.id + '@' + x.at).sort().join(','),
      d.log.length, d.logClearedAt || ''].join('|');
  }

  global.Store = {
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    TRASH_DAYS,
    ...actions,
  };
})(window);
