// Registro de vistas y funciones. Agregar una pestaña = App.registerView({...}) en un archivo nuevo.
(function (global) {
  const views = [];
  const features = [];
  let currentId = null;

  const fmtDate = iso => new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = iso => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const fmtDateTime = iso => `${fmtDate(iso)} ${fmtTime(iso)}`;
  const dayKey = iso => iso.slice(0, 10) && new Date(iso).toLocaleDateString('en-CA');

  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    children.flat(Infinity).forEach(c => n.append(c));
    return n;
  }

  // Avisos en pantalla. action = { label, fn } agrega un botón (p. ej. Deshacer).
  function toast(msg, ms = 6000, action) {
    let box = document.querySelector('.toasts');
    if (!box) { box = el('div', { class: 'toasts' }); document.body.append(box); }
    const n = el('div', { class: 'toast', onclick: () => n.remove() }, el('span', {}, msg));
    if (action) n.append(el('button', { onclick: e => { e.stopPropagation(); action.fn(); n.remove(); } }, action.label));
    box.append(n);
    setTimeout(() => n.remove(), ms);
  }

  // Ejecuta una acción de Store que devuelve un id de deshacer y avisa con botón "Deshacer".
  function act(msg, fn) {
    const undoId = fn();
    toast(msg, 8000, undoId ? { label: 'Deshacer', fn: () => Store.undo(undoId) } : undefined);
  }

  // Las vistas no ven las tareas de la papelera; las reciben aparte en state.trash.
  const derive = s => ({ ...s, tasks: s.tasks.filter(t => !t.deletedAt), trash: s.tasks.filter(t => t.deletedAt) });

  function render() {
    const state = derive(Store.get());
    // Si la pestaña actual no existe (o nunca se eligió), cae en la primera.
    const view = views.find(v => v.id === currentId) || views[0];
    currentId = view.id;
    const tabs = document.getElementById('tabs');
    tabs.replaceChildren(...views.map(v => {
      const count = v.badge ? v.badge(state) : null;
      return el('button', { class: v.id === currentId ? 'active' : '', onclick: () => App.go(v.id) },
        v.label, count ? el('span', { class: 'badge' }, String(count)) : '');
    }));
    const root = document.getElementById('view');
    root.replaceChildren(view.render(state));
    const bySlot = s => features.filter(f => (f.slot || 'footer') === s);
    document.getElementById('toolbar').replaceChildren(...bySlot('header').map(f => f.render(state)));
    document.getElementById('footer').replaceChildren(...bySlot('footer').map(f => f.render(state)));
    // El panel lateral se crea una sola vez: así no se pierde lo que se está escribiendo al redibujar.
    const side = document.getElementById('sidebar');
    bySlot('sidebar').forEach(f => { if (!f.node) { f.node = f.render(state); side.append(f.node); } });
  }

  global.App = {
    el, fmtDate, fmtTime, fmtDateTime, dayKey, toast, act,
    // view: { id, label, render(state) -> Node, badge?(state) -> number }
    registerView(v) { views.push(v); },
    // feature: { id, slot?: 'header' | 'sidebar' | 'footer' (por defecto), render(state) -> Node }
    // 'sidebar' se renderiza una sola vez (no depende del estado); 'header' y 'footer' se redibujan en cada cambio.
    registerFeature(f) { features.push(f); },
    go(id) { if (id) currentId = id; render(); },
    refresh() { render(); },
    start() {
      currentId = currentId || views[0].id;
      Store.subscribe(render);
      render();
    },
  };
})(window);
