/*
 * Deck Builder: a mini panel to pick cards (left) with live deck stats (right):
 * a Charge curve, a stat triangle per card type and a tag counter, each compared
 * with the average of every other deck. Saved decks are kept in this browser and
 * show up in the deck lists (Card Index, Play Table).
 */
(function () {
  const MC = window.MC;
  const STORE = 'mc-custom-decks';
  const MAIN_KINDS = ['basic', 'tribute', 'action'];
  const CAPS = { main: 50, extra: 10, field: 4, barrier: 4 };

  // ───────────────────────── Saved decks ─────────────────────────
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } };
  const write = obj => { try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { MC.toast?.('Could not save: browser storage is blocked'); } };
  const known = id => !!MC.byId[id];

  /** Drop card ids that no longer exist (e.g. a deleted custom card). */
  function clean(d) {
    return { ...d,
      main: d.main.filter(([id]) => known(id)), extra: d.extra.filter(([id]) => known(id)), side: [],
      field: d.field.filter(known), barriers: d.barriers.filter(known), boss: known(d.boss) ? d.boss : null, custom: true };
  }
  for (const [k, d] of Object.entries(read())) MC.DECKS[k] = clean(d);

  /** True when the deck can be loaded into a duel. */
  MC.deckPlayable = d => { try { return !MC.validateDeck(d).errors.length; } catch (e) { return false; } };

  // ───────────────────────── Stats ─────────────────────────
  const mainCards = deck => deck.main.filter(([id]) => known(id) && MAIN_KINDS.includes(MC.byId[id].kind));
  const chargeMax = Math.max(5, ...MC.CARDS.filter(c => MAIN_KINDS.includes(c.kind)).map(c => c.charge || 0));

  // The three stats shown on each type's triangle.
  const AXES = {
    basic:   [['ATK', c => c.atk], ['DEF', c => c.def], ['CHG', c => c.charge]],
    tribute: [['ATK', c => c.atk], ['DEF', c => c.def], ['COST', c => c.cost]],
    action:  [['CHG', c => c.charge], ['COST', c => c.cost], ['SET', c => c.setCost]],
  };
  const GRADES = ['E', 'D', 'C', 'B', 'A'];
  /** Highest value of each axis over every card of that type: the "A" ceiling. */
  const ceiling = {};
  for (const k of MAIN_KINDS) {
    ceiling[k] = AXES[k].map(([, f]) => Math.max(1, ...MC.CARDS.filter(c => c.kind === k).map(c => f(c) || 0)));
  }
  const grade = r => GRADES[Math.min(4, Math.max(0, Math.ceil(r * 5 - 1e-9) - 1))];

  /** Everything the right panel shows, for a list of [id, copies]. */
  function statsOf(list) {
    const s = { n: 0, kinds: { basic: 0, tribute: 0, action: 0 }, charge: {}, tags: {}, axes: {} };
    for (let i = 0; i <= chargeMax; i++) s.charge[i] = { basic: 0, tribute: 0, action: 0 };
    const sums = {}, counts = {};
    for (const [id, n] of list) {
      const c = MC.byId[id];
      s.n += n; s.kinds[c.kind] += n;
      s.charge[Math.min(chargeMax, c.charge || 0)][c.kind] += n;
      (c.tags || []).forEach(t => { s.tags[t] = (s.tags[t] || 0) + n; });
      AXES[c.kind].forEach(([, f], i) => {
        const v = f(c);
        if (v == null) return;
        (sums[c.kind] ||= [0, 0, 0])[i] += v * n; (counts[c.kind] ||= [0, 0, 0])[i] += n;
      });
    }
    for (const k of MAIN_KINDS) {
      s.axes[k] = AXES[k].map((_, i) => (counts[k]?.[i] ? sums[k][i] / counts[k][i] : 0));
    }
    return s;
  }
  const total = (row) => row.basic + row.tribute + row.action;

  /** Average of every other deck, scaled to `n` cards so a half-built deck compares fairly. */
  function averageOf(exceptKey, n) {
    const all = Object.entries(MC.DECKS).filter(([k, d]) => k !== exceptKey && d.main?.length)
      .map(([, d]) => statsOf(mainCards(d))).filter(s => s.n);
    if (!all.length) return null;
    const avg = { n: 0, charge: {}, tags: {}, axes: {}, decks: all.length };
    avg.n = all.reduce((a, s) => a + s.n, 0) / all.length;
    const f = n ? n / avg.n : 1;
    for (let i = 0; i <= chargeMax; i++) avg.charge[i] = all.reduce((a, s) => a + total(s.charge[i]), 0) / all.length * f;
    for (const s of all) for (const t of Object.keys(s.tags)) avg.tags[t] = 0;
    for (const t of Object.keys(avg.tags)) avg.tags[t] = all.reduce((a, s) => a + (s.tags[t] || 0), 0) / all.length * f;
    for (const k of MAIN_KINDS) {
      const have = all.filter(s => s.kinds[k]);
      avg.axes[k] = have.length ? AXES[k].map((_, i) => have.reduce((a, s) => a + s.axes[k][i], 0) / have.length) : [0, 0, 0];
    }
    return avg;
  }

  // ───────────────────────── Sorting ─────────────────────────
  const byType = (a, b) => MC.KIND_ORDER.indexOf(a.kind) - MC.KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name);
  const num = f => (a, b) => (f(a) ?? -1) - (f(b) ?? -1) || byType(a, b);
  const SORTS = {
    type: ['Type', byType],
    name: ['Name', (a, b) => a.name.localeCompare(b.name)],
    charge: ['Charge', num(c => c.charge)],
    cost: ['Charge cost', num(c => c.cost)],
    atk: ['ATK', num(c => c.atk)],
    def: ['DEF', num(c => c.def)],
    picked: ['In deck', null],
  };

  // ───────────────────────── Builder state ─────────────────────────
  let st, box;
  const fresh = () => ({ picks: {}, key: null, avgKey: null, name: 'My Deck', tab: 'index', q: '', kind: 'all', tag: 'all', sort: 'type', dir: 1, openSort: false });

  const limitOf = c => c.kind === 'boss' ? 1 : c.kind === 'field' ? 1 : c.kind === 'barrier' ? 4 : c.kind === 'extra' ? (c.limit ?? 2) : (c.limit ?? 4);
  const poolOf = c => MAIN_KINDS.includes(c.kind) ? 'main' : c.kind;
  const countPool = pool => Object.entries(st.picks).reduce((a, [id, n]) => a + (known(id) && poolOf(MC.byId[id]) === pool ? n : 0), 0);

  const POOL_NAMES = { main: 'Main Deck', extra: 'Extra Deck', field: 'Field Deck', barrier: 'Barriers' };
  function add(id) {
    const c = MC.byId[id], n = st.picks[id] || 0, pool = poolOf(c);
    if (c.kind === 'boss') { for (const o of Object.keys(st.picks)) if (MC.byId[o]?.kind === 'boss') delete st.picks[o]; st.picks[id] = 1; return; }
    if (n >= limitOf(c)) { MC.toast(`${c.name}: max ${limitOf(c)} cop${limitOf(c) === 1 ? 'y' : 'ies'}`); return; }
    if (CAPS[pool] && countPool(pool) >= CAPS[pool]) { MC.toast(`${POOL_NAMES[pool]} is full (${CAPS[pool]})`); return; }
    st.picks[id] = n + 1;
  }
  function sub(id) { if (!st.picks[id]) return; if (--st.picks[id] <= 0) delete st.picks[id]; }

  function toDeck() {
    const ids = Object.keys(st.picks).filter(known), of = k => ids.filter(id => MC.byId[id].kind === k);
    const expand = k => of(k).flatMap(id => Array(st.picks[id]).fill(id));
    return {
      name: st.name.trim() || 'My Deck', custom: true,
      boss: of('boss')[0] || null,
      barriers: expand('barrier'), field: expand('field'),
      main: ids.filter(id => MAIN_KINDS.includes(MC.byId[id].kind)).map(id => [id, st.picks[id]]),
      extra: of('extra').map(id => [id, st.picks[id]]), side: [],
    };
  }
  function loadDeck(d, key) {
    st.picks = {}; st.key = d.custom ? key : null; st.avgKey = key; st.name = d.name;
    [...d.main, ...d.extra].forEach(([id, n]) => { if (known(id)) st.picks[id] = n; });
    [...d.field, ...d.barriers].forEach(id => { if (known(id)) st.picks[id] = (st.picks[id] || 0) + 1; });
    if (known(d.boss)) st.picks[d.boss] = 1;
  }

  // ───────────────────────── Charts (SVG strings) ─────────────────────────
  const fmt = v => Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  const delta = d => { const r = Math.round(d * 10) / 10; return r === 0 ? '±0' : (r > 0 ? '+' : '−') + Math.abs(r); };
  const dClass = d => Math.abs(d) < 0.05 ? 'same' : d > 0 ? 'up' : 'down';

  function chargeChart(s, avg) {
    const lv = Array.from({ length: chargeMax + 1 }, (_, i) => i);
    const W = 360, H = 150, L = 22, R = 8, T = 14, B = 22, bw = (W - L - R) / lv.length;
    const maxV = Math.max(4, ...lv.map(i => total(s.charge[i])), ...(avg ? lv.map(i => avg.charge[i]) : [0]));
    const top = Math.ceil(maxV / 4) * 4;
    const y = v => T + (H - T - B) * (1 - v / top);
    let g = '';
    for (let t = 0; t <= top; t += top / 4) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 4}" y="${y(t) + 3}" text-anchor="end">${fmt(t)}</text>`;
    lv.forEach((i, k) => {
      let acc = 0;
      for (const kind of MAIN_KINDS) {
        const v = s.charge[i][kind];
        if (!v) continue;
        g += `<rect class="bar" x="${L + k * bw + bw * 0.16}" width="${bw * 0.68}" y="${y(acc + v)}" height="${y(acc) - y(acc + v)}" fill="${MC.KINDS[kind].frame}"><title>Charge ${i}: ${v} ${MC.KINDS[kind].label}</title></rect>`;
        acc += v;
      }
      if (acc) g += `<text class="val" x="${L + k * bw + bw / 2}" y="${y(acc) - 3}" text-anchor="middle">${acc}</text>`;
      g += `<text class="ax" x="${L + k * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${i}${i === chargeMax ? '+' : ''}</text>`;
    });
    if (avg) {
      const pts = lv.map((i, k) => `${L + k * bw + bw / 2},${y(avg.charge[i])}`);
      g += `<polyline class="avg-line" points="${pts.join(' ')}"/>` + pts.map(p => { const [x, yy] = p.split(','); return `<circle class="avg-dot" cx="${x}" cy="${yy}" r="3"/>`; }).join('');
    }
    const diffs = lv.map(i => avg ? total(s.charge[i]) - avg.charge[i] : 0);
    return `<svg class="db-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Charge curve">${g}</svg>
      <div class="db-diffs" style="padding-left:${L / W * 100}%;padding-right:${R / W * 100}%">${lv.map((i, k) =>
        `<span class="dd ${avg ? dClass(diffs[k]) : 'same'}" title="Charge ${i}: ${total(s.charge[i])} vs avg ${avg ? fmt(avg.charge[i]) : '–'}">${avg ? delta(diffs[k]) : ''}</span>`).join('')}</div>`;
  }

  /** Stat triangle for one card type: three axes graded E–A, your deck over the average of all decks. */
  function triangle(kind, s, avg) {
    const cx = 115, cy = 124, r = 70, k = MC.KINDS[kind];
    const ang = [-90, 30, 150].map(a => a * Math.PI / 180);
    const pt = (i, ratio) => [cx + Math.cos(ang[i]) * r * ratio, cy + Math.sin(ang[i]) * r * ratio];
    const poly = ratios => ratios.map((q, i) => pt(i, Math.max(0.04, Math.min(1, q))).map(v => v.toFixed(1)).join(',')).join(' ');
    const ratios = a => a.map((v, i) => v / ceiling[kind][i]);
    const mine = ratios(s.axes[kind]), theirs = avg ? ratios(avg.axes[kind]) : null;
    const has = s.kinds[kind] > 0;
    let g = '';
    for (let q = 1; q <= 5; q++) g += `<polygon class="ring" points="${poly([q / 5, q / 5, q / 5])}"/>`;
    ang.forEach((_, i) => {
      const [x, y] = pt(i, 1);
      g += `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      for (let q = 1; q <= 5; q++) { const [px, py] = pt(i, q / 5); g += `<circle class="pip" cx="${px}" cy="${py}" r="1.6"/>`; }
    });
    GRADES.forEach((gr, q) => { const [x, y] = pt(0, (q + 1) / 5); g += `<text class="gr" x="${x + 5}" y="${y + 3}">${gr}</text>`; });
    if (theirs) g += `<polygon class="tri-avg" points="${poly(theirs)}"/>`;
    if (has) g += `<polygon class="tri-me" points="${poly(mine)}" style="--kc:${k.frame}"/>`;
    const lab = AXES[kind].map(([name], i) => {
      const [vx, vy] = pt(i, 1);
      const x = i === 0 ? cx : vx + (i === 1 ? 12 : -12), y0 = i === 0 ? 14 : vy + 18;
      const val = has ? s.axes[kind][i] : null;
      const d = has && avg ? s.axes[kind][i] - avg.axes[kind][i] : null;
      return `<text class="vn" x="${x}" y="${y0}" text-anchor="middle">${name}</text>` +
        `<text class="vg" x="${x}" y="${y0 + 19}" text-anchor="middle">${has ? grade(mine[i]) : '–'}</text>` +
        (val != null ? `<text class="vv ${d == null ? '' : dClass(d)}" x="${x}" y="${y0 + 31}" text-anchor="middle">${fmt(val)}</text>` : '');
    }).join('');
    return `<figure class="db-tri k-${kind}"><svg viewBox="0 0 230 212" role="img" aria-label="${k.label} stats">${g}${lab}</svg>
      <figcaption><i class="swatch"></i>${k.label} <b>${s.kinds[kind]}</b></figcaption></figure>`;
  }

  function tagBars(s, avg) {
    const names = [...new Set([...Object.keys(s.tags), ...Object.entries(avg?.tags || {}).filter(([, v]) => v >= 0.5).map(([t]) => t)])];
    if (!names.length) return '<p class="db-empty">Add cards with tags to see the counter.</p>';
    names.sort((a, b) => (s.tags[b] || 0) - (s.tags[a] || 0) || (avg?.tags[b] || 0) - (avg?.tags[a] || 0));
    const max = Math.max(4, ...names.map(t => Math.max(s.tags[t] || 0, avg?.tags[t] || 0)));
    return names.map(t => {
      const v = s.tags[t] || 0, a = avg ? (avg.tags[t] || 0) : null, d = a == null ? 0 : v - a, col = MC.TAG_COLORS[t] || '#555';
      return `<div class="tg-row" style="--tc:${col}"><span class="tg-name">${MC.icon(t)}${MC.esc(t)}</span>
        <span class="tg-bar"><i style="width:${v / max * 100}%"></i>${a != null ? `<u style="left:${Math.min(100, a / max * 100)}%" title="Average ${fmt(a)}"></u>` : ''}</span>
        <b class="tg-n">${v}</b><span class="dd ${a == null ? 'same' : dClass(d)}">${a == null ? '' : delta(d)}</span></div>`;
    }).join('');
  }

  // ───────────────────────── Rendering ─────────────────────────
  function pickList() {
    const q = st.q.trim().toLowerCase();
    const list = MC.CARDS.filter(c => (st.kind === 'all' || c.kind === st.kind)
      && (st.tag === 'all' || (c.tags || []).includes(st.tag))
      && (!q || [c.name, c.text, c.archetype, ...(c.tags || [])].join(' ').toLowerCase().includes(q)));
    const cmp = st.sort === 'picked'
      ? (a, b) => (st.picks[b.id] || 0) - (st.picks[a.id] || 0) || byType(a, b)
      : SORTS[st.sort][1];
    return list.sort((a, b) => cmp(a, b) * st.dir);
  }

  function cellHTML(c) {
    const n = st.picks[c.id] || 0;
    const tip = `${c.name}${c.charge != null ? ` · Charge ${c.charge}` : ''}${c.cost != null ? ` · Cost ${c.cost}` : ''}`;
    return `<div class="db-cell ${n ? 'in' : ''}" title="${MC.esc(tip)}" data-id="${c.id}">
      <div class="db-mini" data-add="${c.id}">${MC.renderMini(c, { extraClass: 'db-card' })}</div>
      ${n ? `<span class="db-n">×${n}</span><button class="db-minus" data-sub="${c.id}" aria-label="Remove one ${MC.esc(c.name)}">−</button>` : ''}</div>`;
  }

  function leftHTML() {
    const tags = [...new Set(MC.CARDS.flatMap(c => c.tags || []))].sort();
    const mainN = countPool('main');
    const tabs = `<div class="db-tabs">
      <button class="chip ${st.tab === 'index' ? 'on' : ''}" data-tab="index">Card index</button>
      <button class="chip ${st.tab === 'deck' ? 'on' : ''}" data-tab="deck">Your deck <b>${Object.values(st.picks).reduce((a, n) => a + n, 0)}</b></button></div>`;
    if (st.tab === 'deck') {
      const rows = MC.KIND_ORDER.map(kind => {
        const ids = Object.keys(st.picks).filter(id => known(id) && MC.byId[id].kind === kind).sort((a, b) => MC.byId[a].name.localeCompare(MC.byId[b].name));
        return ids.length ? `<h4 class="db-h k-${kind}"><i class="swatch"></i>${MC.KINDS[kind].long}s <small>${ids.reduce((a, id) => a + st.picks[id], 0)}</small></h4>` +
          ids.map(id => `<div class="db-row k-${kind}"><span class="db-rn">${MC.esc(MC.byId[id].name)}</span>${MC.byId[id].charge != null ? MC.chargePips(MC.byId[id].charge) : ''}
            <button class="btn btn-sm" data-sub="${id}">−</button><b>${st.picks[id]}</b><button class="btn btn-sm" data-add="${id}">+</button></div>`).join('') : '';
      }).join('');
      return tabs + `<div class="db-scroll">${rows || '<p class="db-empty">No cards yet. Pick some from the Card index.</p>'}</div>`;
    }
    const cards = pickList();
    return tabs + `
      <input class="search db-search" type="search" placeholder="Search name, text, tag…" value="${MC.esc(st.q)}" aria-label="Search cards">
      <details class="db-sort" ${st.openSort ? 'open' : ''}><summary>Sort &amp; filter <small>${SORTS[st.sort][0]} ${st.dir > 0 ? '↑' : '↓'}${st.kind !== 'all' ? ' · ' + MC.KINDS[st.kind].label : ''}${st.tag !== 'all' ? ' · ' + MC.esc(st.tag) : ''}</small></summary>
        <div class="db-sort-body">
          <div class="chips">${['all', ...MC.KIND_ORDER].map(k => k === 'all'
            ? `<button class="chip ${st.kind === 'all' ? 'on' : ''}" data-kind="all">All</button>`
            : `<button class="chip k-${k} ${st.kind === k ? 'on' : ''}" data-kind="${k}"><i class="swatch"></i>${MC.KINDS[k].label}</button>`).join('')}</div>
          <div class="selects">
            <label>Sort <select data-sel="sort">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <button class="chip" data-dir>${st.dir > 0 ? 'Low → High' : 'High → Low'}</button>
            <label>Tag <select data-sel="tag"><option value="all">Any</option>${tags.map(t => `<option ${st.tag === t ? 'selected' : ''}>${MC.esc(t)}</option>`).join('')}</select></label>
          </div></div></details>
      <p class="db-hint">Click a card to add it · <b>−</b> or right-click removes one · Main ${mainN}/${CAPS.main}</p>
      <div class="db-scroll"><div class="db-grid">${cards.map(cellHTML).join('') || '<p class="db-empty">No cards match.</p>'}</div></div>`;
  }

  function rightHTML() {
    const deck = toDeck(), s = statsOf(mainCards(deck)), avg = averageOf(st.avgKey, s.n);
    let problems = [];
    try { const v = MC.validateDeck({ ...deck, boss: deck.boss }); problems = v.errors; } catch (e) { problems = ['Incomplete deck']; }
    const pool = k => countPool(k);
    const bar = (label, n, cap) => `<div class="db-meter"><span>${label}</span><span class="db-m"><i class="${n === cap ? 'full' : n > cap ? 'over' : ''}" style="width:${Math.min(100, n / cap * 100)}%"></i></span><b>${n}/${cap}</b></div>`;
    return `
      <div class="db-meters">${bar('Main', pool('main'), CAPS.main)}${bar('Extra', pool('extra'), CAPS.extra)}${bar('Field', pool('field'), CAPS.field)}${bar('Barrier', pool('barrier'), CAPS.barrier)}
        <div class="db-meter"><span>Boss</span><span class="db-m"><i class="${deck.boss ? 'full' : ''}" style="width:${deck.boss ? 100 : 0}%"></i></span><b>${deck.boss ? MC.esc(MC.byId[deck.boss].name) : '0/1'}</b></div></div>
      <div class="legal ${problems.length ? 'warn' : 'ok'} db-legal">${problems.length ? '! ' + problems.map(MC.esc).join('<br>! ') : '✓ Deck is legal'}</div>
      <section class="db-sec"><h3>Charge curve <small>${avg ? `bars: your deck · line: average of ${avg.decks} deck${avg.decks > 1 ? 's' : ''}${s.n ? ' (scaled to your ' + s.n + ' cards)' : ''}` : 'bars: your deck'}</small></h3>
        <div class="db-legend">${MAIN_KINDS.map(k => `<span class="k-${k}"><i class="swatch"></i>${MC.KINDS[k].label}</span>`).join('')}${avg ? '<span><i class="lg-line"></i>Average</span>' : ''}</div>
        ${chargeChart(s, avg)}
        <p class="db-note">Under each level: <b class="up">+</b> more / <b class="down">−</b> fewer than the average.</p></section>
      <section class="db-sec"><h3>Stat triangles <small>graded E–A against the strongest card of each type · outline: average</small></h3>
        <div class="db-tris">${MAIN_KINDS.map(k => triangle(k, s, avg)).join('')}</div></section>
      <section class="db-sec"><h3>Tags <small>copies in your Main Deck · tick: average</small></h3>${tagBars(s, avg)}</section>`;
  }

  function headHTML() {
    const mine = Object.entries(MC.DECKS).filter(([, d]) => d.custom);
    const base = Object.entries(MC.DECKS).filter(([, d]) => !d.custom);
    return `<div class="db-head">
      <span class="eyebrow">Deck Builder</span>
      <input class="db-name" value="${MC.esc(st.name)}" maxlength="40" aria-label="Deck name">
      <label class="db-load">Load <select data-load><option value="">…</option>
        <optgroup label="Sample decks">${base.map(([k, d]) => `<option value="${k}">${MC.esc(d.name)}</option>`).join('')}</optgroup>
        ${mine.length ? `<optgroup label="Your decks">${mine.map(([k, d]) => `<option value="${k}">${MC.esc(d.name)}</option>`).join('')}</optgroup>` : ''}</select></label>
      <button class="btn btn-sm" data-clear>Clear</button>
      ${st.key && MC.DECKS[st.key]?.custom ? '<button class="btn btn-sm" data-delete>Delete</button>' : ''}
      <button class="btn btn-hot btn-sm" data-save>Save deck</button></div>`;
  }

  const paint = () => {
    // Keep scroll positions and the search caret across re-renders.
    const keep = ['.db-left .db-scroll', '.db-right'].map(s => [s, box.querySelector(s)?.scrollTop || 0]);
    const focus = document.activeElement?.matches?.('.db-search') ? document.activeElement.selectionStart : null;
    box.querySelector('.db-headwrap').innerHTML = headHTML();
    box.querySelector('.db-left').innerHTML = leftHTML();
    box.querySelector('.db-right').innerHTML = rightHTML();
    keep.forEach(([s, t]) => { const el = box.querySelector(s); if (el) el.scrollTop = t; });
    if (focus != null) { const i = box.querySelector('.db-search'); i.focus(); i.setSelectionRange(focus, focus); }
  };
  /** Cheaper update while typing in the search box: only the card grid. */
  const paintGrid = () => { const g = box.querySelector('.db-grid'); if (g) g.innerHTML = pickList().map(cellHTML).join('') || '<p class="db-empty">No cards match.</p>'; };
  const paintRight = () => { box.querySelector('.db-right').innerHTML = rightHTML(); };

  function save() {
    const deck = toDeck(), key = st.key && MC.DECKS[st.key]?.custom ? st.key : 'my-' + Date.now().toString(36);
    if (!deck.main.length && !deck.extra.length) { MC.toast('Add some cards first'); return; }
    MC.DECKS[key] = { ...deck, boss: deck.boss };
    st.key = key; st.avgKey = key;
    const all = read(); all[key] = MC.DECKS[key]; write(all);
    MC.toast(MC.deckPlayable(MC.DECKS[key]) ? `Saved "${deck.name}"` : `Saved "${deck.name}" as a draft (not legal yet, so it can't be played)`);
    MC.IndexView?.refresh?.();
    paint();
  }

  function open() {
    st = fresh();
    box = MC.modal(`<div class="db-wrap"><div class="db-headwrap"></div>
      <div class="db-cols"><div class="db-left box"></div><div class="db-right box"></div></div></div>`, { cls: 'builder', wide: true, onClose: () => MC.IndexView?.refresh?.() });
    paint();

    box.addEventListener('click', e => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-sub]'))) { sub(el.dataset.sub); paint(); return; }
      if ((el = t.closest('[data-add]'))) { add(el.dataset.add); paint(); return; }
      if ((el = t.closest('[data-tab]'))) { st.tab = el.dataset.tab; paint(); return; }
      if ((el = t.closest('[data-kind]'))) { st.kind = el.dataset.kind; st.openSort = true; paint(); return; }
      if (t.closest('[data-dir]')) { st.dir *= -1; st.openSort = true; paint(); return; }
      if (t.closest('[data-save]')) { save(); return; }
      if (t.closest('[data-clear]')) { st = { ...fresh(), name: st.name }; paint(); return; }
      if (t.closest('[data-delete]')) {
        const all = read(); delete all[st.key]; write(all); delete MC.DECKS[st.key];
        MC.toast(`Deleted "${st.name}"`); st = fresh(); paint();
      }
    });
    box.addEventListener('toggle', e => { if (e.target.matches('.db-sort')) st.openSort = e.target.open; }, true);
    box.addEventListener('contextmenu', e => {
      const el = e.target.closest('[data-add]');
      if (!el) return;
      e.preventDefault(); sub(el.dataset.add); paint();
    });
    box.addEventListener('input', e => {
      if (e.target.matches('.db-search')) { st.q = e.target.value; paintGrid(); }
      else if (e.target.matches('.db-name')) st.name = e.target.value;
    });
    box.addEventListener('change', e => {
      const sel = e.target.dataset.sel;
      if (sel) { st[sel] = e.target.value; st.openSort = true; paint(); return; }
      if (e.target.matches('[data-load]') && e.target.value) { loadDeck(MC.DECKS[e.target.value], e.target.value); paint(); }
    });
  }

  MC.DeckBuilder = { open };
})();
