/* App shell: hash router, modal and toast helpers. */
(function () {
  const MC = window.MC;

  MC.modal = function (html, { wide = false, cls = '', onClose } = {}) {
    const el = document.getElementById('modal');
    el.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''} ${cls}">
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

  // "Hover Info" toggle: the card popout beside hovered cards (table and Deck Builder).
  const hv = document.getElementById('hover-toggle');
  const paintHover = () => { hv.textContent = `Hover Info: ${MC.hoverInfo ? 'On' : 'Off'}`; hv.setAttribute('aria-pressed', MC.hoverInfo); hv.classList.toggle('on', MC.hoverInfo); };
  hv.addEventListener('click', () => {
    MC.hoverInfo = !MC.hoverInfo;
    try { localStorage.setItem('mc-hover-info', MC.hoverInfo ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (!MC.hoverInfo) MC.hideCardPop();
    paintHover();
  });
  paintHover();

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

  route();
})();
