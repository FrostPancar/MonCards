/* Card Index: browse every card, filter by kind / tag / deck, check deck legality. */
(function () {
  const MC = window.MC;
  const state = { q: '', kind: 'all', deck: 'all', tag: 'all' };
  let root;

  const allTags = () => [...new Set(MC.CARDS.flatMap(c => [...(c.tags || []), ...(c.keywords || [])]))].sort();
  const refresh = () => { renderFilters(); renderGrid(); };

  // Per-viewer preference: hide monster art icons on index cards.
  let hideArt = false;
  try { hideArt = localStorage.getItem('mc-hide-art') === '1'; } catch (e) { /* storage blocked */ }
  document.body.classList.toggle('hide-art', hideArt);

  function deckSections(deck) {
    return [
      ['Boss', [[deck.boss, 1]]],
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
        .sort((a, b) => MC.KIND_ORDER.indexOf(a.kind) - MC.KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
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
    ].filter(Boolean);
    MC.modal(`<div class="detail">
      <div class="detail-card">${MC.renderCard(c, { extraClass: 'card-xl' })}</div>
      <div class="detail-info">
        <span class="eyebrow">${MC.esc(MC.KINDS[c.kind].long)}</span>
        <h2>${MC.esc(c.name)}</h2>
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v?.html ?? MC.esc(v)}</dd>`).join('')}</dl>
        ${inDecks ? `<h4>In decks</h4><ul class="in-decks">${inDecks}</ul>` : ''}
        <button class="btn" data-edit="${c.id}">${c.custom ? 'Edit in creator' : 'Copy into creator'}</button>
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
        <label>Tag <select data-sel="tag">
          <option value="all">Any tag</option>
          ${allTags().map(t => `<option ${state.tag === t ? 'selected' : ''}>${MC.esc(t)}</option>`).join('')}
        </select></label>
      </div>
      <button class="chip ${hideArt ? '' : 'on'}" data-art aria-pressed="${!hideArt}">Monster art: ${hideArt ? 'Off' : 'On'}</button>
      <button class="btn btn-hot" data-create>+ Card Creator</button>`;
  }

  MC.IndexView = {
    mount(el) {
      root = el;
      root.innerHTML = `<div class="index-wrap">
        <div class="filters box"></div>
        <div class="index-body"></div>
      </div>`;
      renderFilters(); renderGrid();
      root.addEventListener('input', e => {
        if (e.target.matches('.search')) { state.q = e.target.value; renderGrid(); }
      });
      document.getElementById('modal').addEventListener('click', e => {
        const ed = e.target.closest('[data-edit]');
        if (!ed) return;
        const card = MC.byId[ed.dataset.edit];
        MC.closeModal();
        MC.Creator.open(card.custom ? card : { ...card, name: card.name + ' Copy' }, refresh);
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
        if (e.target.closest('[data-art]')) {
          hideArt = !hideArt;
          document.body.classList.toggle('hide-art', hideArt);
          try { localStorage.setItem('mc-hide-art', hideArt ? '1' : '0'); } catch (err) { /* storage blocked */ }
          renderFilters(); return;
        }
        const o = e.target.closest('[data-open]');
        if (o) openCard(o.dataset.open);
      });
    },
  };
})();
