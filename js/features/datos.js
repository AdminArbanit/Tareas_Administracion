// Exportar / importar respaldo JSON.
(function () {
  const { el } = App;

  function exportar() {
    const blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `tareas-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importar(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.tasks) || !Array.isArray(data.log)) throw new Error('formato');
        if (confirm('Esto reemplaza todas las tareas actuales. ¿Continuar?')) Store.replaceAll(data);
      } catch { alert('Archivo inválido.'); }
    };
    r.readAsText(file);
  }

  App.registerFeature({
    id: 'datos',
    render() {
      const input = el('input', { type: 'file', accept: '.json', hidden: true, onchange: e => e.target.files[0] && importar(e.target.files[0]) });
      return el('div', {},
        el('button', { class: 'btn', onclick: exportar }, 'Exportar respaldo'),
        ' ',
        el('button', { class: 'btn', onclick: () => input.click() }, 'Importar'),
        input);
    },
  });
})();
