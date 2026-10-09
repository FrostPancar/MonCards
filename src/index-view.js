/* Card Index: browse every card, filter by kind / tag / deck, check deck legality. */
(function () {
  const MC = window.MC;
  const state = { q: '', kind: 'all', deck: 'all', tag: 'all', sort: 'type' };

  /** Sort orders. Cards without a date (untouched built-ins) go last, in type order. */
  const byType = (a, b) => MC.KIND_ORDER.indexOf(a.kind) - MC.KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name);
  const newest = field => (a, b) => (b[field] || 0) - (a[field] || 0) || byType(a, b);
  const SORTS = {
    type: ['Type', byType],
    name: ['Name', (a, b) => a.name.localeCompare(b.name)],
    edited: ['Latest edits', newest('updatedAt')],
    added: ['Latest adds', newest('createdAt')],
  };

  /** "12 Oct 2026, 14:05 (3 days ago)" */
  function when(ms) {
    if (!ms) return null;
    const d = new Date(ms);
    const abs = d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const s = Math.round((Date.now() - ms) / 1000);
    const rel = s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago`
      : `${Math.floor(s / 86400)} day${s < 172800 ? '' : 's'} ago`;
    return `${abs} (${rel})`;
  }
  let root;

  const allTags = () => [...new Set(MC.CARDS.flatMap(c => [...(c.tags || []), ...(c.keywords || [])]))].sort();
  const refresh = () => { renderFilters(); renderGrid(); };

  // Per-viewer display options for index cards (remembered in this browser):
  //   hide-art  — hide the art icon, keep the card layout
  //   full-text — drop the art area so the effect text gets the room
  const OPTS = { 'hide-art': 'mc-hide-art', 'full-text': 'mc-full-text', dark: 'mc-dark' };
  const opt = {};
  for (const [cls, key] of Object.entries(OPTS)) {
    try { opt[cls] = localStorage.getItem(key) === '1'; } catch (e) { opt[cls] = false; }
    document.body.classList.toggle(cls, opt[cls]);
  }
  function toggleOpt(cls) {
    opt[cls] = !opt[cls];
    document.body.classList.toggle(cls, opt[cls]);
    try { localStorage.setItem(OPTS[cls], opt[cls] ? '1' : '0'); } catch (e) { /* storage blocked */ }
  }

  function deckSections(deck) {
    return [
      ['Boss', deck.boss ? [[deck.boss, 1]] : []],
      ['Barriers', Object.entries(deck.barriers.reduce((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {}))],
      ['Field Deck', deck.field.map(id => [id, 1])],
      ['Main Deck', deck.main],
      ['Extra Deck', deck.extra],
      ['Side Deck', deck.side],
    ];
  }

  function matches(card) {
    if (state.kind !== 'all' && card.kind !== state.kind) return false;
    if (state.tag !== 'all' && ![...(card.tags || []), ...(card.keywords || [])].includes(state.tag)) return false;
    if (state.q) {
      const hay = [card.name, card.text, card.archetype, ...(card.tags || []), ...(card.keywords || [])].join(' ').toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  function cell(card, count) {
    return `<button class="card-cell" data-open="${card.id}">
      ${MC.renderCard(card)}
      ${count ? `<span class="count-badge">×${count}</span>` : ''}
      ${card.custom ? '<span class="custom-badge">Custom</span>' : ''}
    </button>`;
  }

  function renderGrid() {
    const out = root.querySelector('.index-body');
    if (state.deck === 'all') {
      const cards = MC.CARDS.filter(matches)
        .sort(SORTS[state.sort][1]);
      out.innerHTML = `<p class="result-count">${cards.length} card${cards.length === 1 ? '' : 's'}</p>
        <div class="card-grid">${cards.map(c => cell(c)).join('') || '<p class="empty">No cards match.</p>'}</div>
        <h3 class="sec-title">Card backs</h3>
        <div class="backs-row">${[['main', 'Main Deck'], ['extra', 'Extra Deck'], ['boss', 'Boss'], ['field', 'Field'], ['barrier', 'Barrier']]
          .map(([b, l]) => `<figure>${MC.renderBack(b, 'card')}<figcaption>${l}</figcaption></figure>`).join('')}</div>`;
      return;
    }
    const deck = MC.DECKS[state.deck];
    const { errors, warnings } = MC.validateDeck(deck);
    const sections = deckSections(deck).map(([title, list]) => {
      const shown = list.filter(([id]) => matches(MC.byId[id]));
      if (state.sort !== 'type') shown.sort(([a], [b]) => SORTS[state.sort][1](MC.byId[a], MC.byId[b]));
      if (!shown.length) return '';
      return `<h3 class="sec-title">${title} <small>${MC.count(list)}</small></h3>
        <div class="card-grid">${shown.map(([id, n]) => cell(MC.byId[id], n)).join('')}</div>`;
    }).join('');
    out.innerHTML = `<div class="deck-summary box">
        <div><span class="eyebrow">Deck</span><h2>${MC.esc(deck.name)}</h2></div>
        <ul class="deck-stats">
          <li><b>${MC.count(deck.main)}</b>Main</li><li><b>${MC.count(deck.side)}</b>Side</li>
          <li><b>${MC.count(deck.extra)}</b>Extra</li><li><b>${deck.field.length}</b>Field</li>
          <li><b>${deck.barriers.length}</b>Barrier</li><li><b>1</b>Boss</li>
        </ul>
        <div class="legal ${errors.length ? 'bad' : warnings.length ? 'warn' : 'ok'}">${errors.length
          ? '✕ ' + errors.map(MC.esc).join('<br>✕ ')
          : '✓ Deck is legal'}${warnings.map(w => `<br>! ${MC.esc(w)} — not filled yet`).join('')}</div>
      </div>${sections || '<p class="empty">No cards match.</p>'}`;
  }

  function openCard(id) {
    const c = MC.byId[id];
    const inDecks = Object.entries(MC.DECKS).map(([, d]) => {
      const n = deckSections(d).reduce((s, [title, list]) => {
        const hit = list.find(([cid]) => cid === id);
        return hit ? s.concat(`${hit[1]}× ${title}`) : s;
      }, []);
      return n.length ? `<li><b>${MC.esc(d.name)}</b> — ${n.join(', ')}</li>` : '';
    }).join('');
    const rows = [
      ['Kind', MC.KINDS[c.kind].long],
      c.tags?.length ? ['Tags', c.tags.join(', ')] : null,
      c.keywords?.length ? ['Keywords', c.keywords.join(', ')] : null,
      MC.isMonster(c) ? ['ATK / DEF', `${c.atk} / ${c.def}`] : null,
      c.charge != null ? ['Charge', { html: MC.chargePips(c.charge) }] : null,
      c.cost != null ? ['Charge Cost', c.cost] : null,
      c.kind === 'action' ? ['Set cost (opp. turn)', c.setCost == null ? 'not decided' : '+' + c.setCost] : null,
      MC.isMonster(c) && c.kind !== 'basic' ? ['Footprint', c.footprint || 1] : null,
      c.archetype ? ['Archetype', c.archetype] : null,
      c.limit === Infinity ? ['Copy limit', 'Unlimited'] : null,
      c.custom ? ['Added', when(c.createdAt) || 'Unknown'] : null,
      ['Last edited', when(c.updatedAt) || (c.custom || c.edited ? 'Unknown' : 'Never — original card')],
    ].filter(Boolean);
    MC.modal(`<div class="detail">
      <div class="detail-card">${MC.renderCard(c, { extraClass: 'card-xl' })}</div>
      <div class="detail-info">
        <span class="eyebrow">${MC.esc(MC.KINDS[c.kind].long)}</span>
        <h2>${MC.esc(c.name)}</h2>
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v?.html ?? MC.esc(v)}</dd>`).join('')}</dl>
        ${inDecks ? `<h4>In decks</h4><ul class="in-decks">${inDecks}</ul>` : ''}
        <div class="detail-btns">
          <button class="btn btn-hot" data-edit="${c.id}">Edit</button>
          <button class="btn" data-dup="${c.id}">Duplicate</button>
        </div>
      </div></div>`, { wide: true });
  }

  function chip(group, value, label, active) {
    return `<button class="chip ${active ? 'on' : ''}" data-${group}="${value}">${label}</button>`;
  }

  function renderFilters() {
    const f = root.querySelector('.filters');
    f.innerHTML = `
      <input class="search" type="search" placeholder="Search name, text, tag…" value="${MC.esc(state.q)}" aria-label="Search cards">
      <div class="chips">${chip('kind', 'all', 'All', state.kind === 'all')}${MC.KIND_ORDER.map(k =>
        `<button class="chip k-${k} ${state.kind === k ? 'on' : ''}" data-kind="${k}"><i class="swatch"></i>${MC.KINDS[k].label}</button>`).join('')}</div>
      <div class="selects">
        <label>Deck <select data-sel="deck">
          <option value="all">All cards</option>
          ${Object.entries(MC.DECKS).map(([k, d]) => `<option value="${k}" ${state.deck === k ? 'selected' : ''}>${MC.esc(d.name)}</option>`).join('')}
        </select></label>
        <label>Sort <select data-sel="sort">
          ${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <label>Tag <select data-sel="tag">
          <option value="all">Any tag</option>
          ${allTags().map(t => `<option ${state.tag === t ? 'selected' : ''}>${MC.esc(t)}</option>`).join('')}
        </select></label>
      </div>
      <button class="chip ${opt['hide-art'] ? '' : 'on'}" data-opt="hide-art" aria-pressed="${!opt['hide-art']}">Art icons: ${opt['hide-art'] ? 'Off' : 'On'}</button>
      <button class="chip ${opt['full-text'] ? 'on' : ''}" data-opt="full-text" aria-pressed="${opt['full-text']}">Full text: ${opt['full-text'] ? 'On' : 'Off'}</button>
      <button class="chip ${opt.dark ? 'on' : ''}" data-opt="dark" aria-pressed="${opt.dark}">${opt.dark ? '☾ Dark' : '☀ Light'}</button>
      <button class="btn btn-hot" data-create>+ Card Creator</button>
      <button class="btn btn-hot" data-builder>⚒ Deck Builder</button>`;
  }

  MC.IndexView = {
    /** Re-draw after decks changed (the Deck Builder saves and deletes them). */
    refresh() {
      if (!root) return;
      if (state.deck !== 'all' && !MC.DECKS[state.deck]) state.deck = 'all';
      refresh();
    },
    mount(el) {
      root = el;
      // Someone else's new or edited card arrived from the shared store.
      MC.onCardsChanged(() => renderGrid());
      root.innerHTML = `<div class="index-wrap">
        <div class="filters box"></div>
        <div class="index-body"></div>
      </div>`;
      renderFilters(); renderGrid();
      root.addEventListener('input', e => {
        if (e.target.matches('.search')) { state.q = e.target.value; renderGrid(); }
      });
      document.getElementById('modal').addEventListener('click', e => {
        const ed = e.target.closest('[data-edit], [data-dup]');
        if (!ed) return;
        const card = MC.byId[ed.dataset.edit || ed.dataset.dup];
        MC.closeModal();
        MC.Creator.open(card, refresh, ed.dataset.edit ? 'edit' : 'copy');
      });
      root.addEventListener('change', e => {
        const s = e.target.dataset.sel;
        if (s) { state[s] = e.target.value; renderGrid(); }
      });
      // 3D tilt that follows the cursor while hovering a card.
      root.addEventListener('pointermove', e => {
        const cell = e.target.closest('.card-cell');
        if (!cell || e.pointerType === 'touch') return;
        const r = cell.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cell.style.transform = `perspective(700px) rotateX(${(-y * 16).toFixed(2)}deg) rotateY(${(x * 18).toFixed(2)}deg) translateY(-6px) scale(1.03)`;
      });
      root.addEventListener('pointerout', e => {
        const cell = e.target.closest('.card-cell');
        if (cell && !cell.contains(e.relatedTarget)) cell.style.transform = '';
      });
      root.addEventListener('click', e => {
        const k = e.target.closest('[data-kind]');
        if (k) { state.kind = k.dataset.kind; renderFilters(); renderGrid(); return; }
        if (e.target.closest('[data-create]')) { MC.Creator.open(null, refresh); return; }
        if (e.target.closest('[data-builder]')) { MC.DeckBuilder.open(); return; }
        const t = e.target.closest('[data-opt]');
        if (t) { toggleOpt(t.dataset.opt); renderFilters(); return; }
        const o = e.target.closest('[data-open]');
        if (o) openCard(o.dataset.open);
      });
    },
  };
})();
