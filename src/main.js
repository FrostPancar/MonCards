/* App shell: hash router, modal and toast helpers. */
(function () {
  const MC = window.MC;

  MC.modal = function (html, { wide = false, onClose } = {}) {
    const el = document.getElementById('modal');
    el.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''}">
      <button class="btn modal-close" data-close aria-label="Close">✕</button>${html}</div>`;
    el.hidden = false;
    el._onClose = onClose;
    return el.querySelector('.modal-box');
  };
  MC.closeModal = function () {
    const el = document.getElementById('modal');
    if (el.hidden) return;
    el.hidden = true; el.innerHTML = '';
    const cb = el._onClose; el._onClose = null;
    if (cb) cb();
  };
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) MC.closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') MC.closeModal(); });

  let toastTimer;
  MC.toast = function (msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  };

  const views = { index: MC.IndexView, table: MC.TableView };
  const mounted = {};
  function route() {
    const name = (location.hash || '#index').slice(1);
    const key = views[name] ? name : 'index';
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + key; });
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.view === key));
    document.body.dataset.view = key;
    if (!mounted[key]) { views[key].mount(document.getElementById('view-' + key)); mounted[key] = true; }
    views[key].show?.();
  }
  window.addEventListener('hashchange', route);

  /*
   * Mosaic "pixel" filters. Each keeps one source pixel per n×n block, then
   * smears it right and down with offset+merge so blocks tile exactly.
   */
  function pixelFilter(n) {
    let f = `<filter id="px${n}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feFlood x="0" y="0" width="1" height="1" flood-color="#fff" result="dot"/>
      <feComposite in="dot" in2="dot" operator="over" x="0" y="0" width="${n}" height="${n}" result="cell"/>
      <feTile in="cell" result="grid"/>
      <feComposite in="SourceGraphic" in2="grid" operator="in" result="s0"/>`;
    const mergeRun = (src, axis, out) => {
      let nodes = `<feMergeNode in="${src}"/>`;
      for (let i = 1; i < n; i++) {
        f += `<feOffset in="${src}" ${axis}="${i}" result="${out}o${i}"/>`;
        nodes += `<feMergeNode in="${out}o${i}"/>`;
      }
      f += `<feMerge result="${out}">${nodes}</feMerge>`;
    };
    mergeRun('s0', 'dx', 'h');
    mergeRun('h', 'dy', 'v');
    return f + '</filter>';
  }
  document.body.insertAdjacentHTML('beforeend',
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${pixelFilter(2)}${pixelFilter(3)}</defs></svg>`);

  route();
})();
