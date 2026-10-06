/*
 * Shared helpers: card lookup, kind metadata, procedural pixel art,
 * pixel icons, card rendering and deck validation.
 */
(function () {
  const MC = window.MC;

  MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));

  // GBC-style palette: bright card bodies, pale art backdrops.
  MC.KINDS = {
    basic:   { label: 'Basic',   long: 'Basic Monster',      frame: '#f2c84b', pale: '#fff4cf', back: 'main' },
    tribute: { label: 'Tribute', long: 'Tribute Monster',    frame: '#ee4458', pale: '#ffe0e3', back: 'main' },
    extra:   { label: 'Extra',   long: 'Extra Deck Monster', frame: '#2fc7b4', pale: '#d8fbf5', back: 'extra' },
    action:  { label: 'Action',  long: 'Action',             frame: '#f5922e', pale: '#ffe8d2', back: 'main' },
    field:   { label: 'Field',   long: 'Field',              frame: '#3dbb4f', pale: '#dcf8d9', back: 'field' },
    barrier: { label: 'Barrier', long: 'Barrier',            frame: '#3a7ced', pale: '#dde8ff', back: 'barrier' },
    boss:    { label: 'Boss',    long: 'Boss Monster',       frame: '#9152e0', pale: '#efe2ff', back: 'boss' },
  };
  MC.KIND_ORDER = ['boss', 'basic', 'tribute', 'extra', 'action', 'field', 'barrier'];
  MC.isMonster = c => ['basic', 'tribute', 'extra', 'boss'].includes(c.kind);

  MC.esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ───────────────────────── Pixel icons ─────────────────────────
  const ICONS = {
    atk:    ['.....##', '....###', '...###.', '#.###..', '.###...', '..#....', '#.#....'],
    def:    ['#######', '#.....#', '#.###.#', '#.###.#', '.#.#.#.', '..#.#..', '...#...'],
    charge: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    chargeEmpty: ['...#...', '..#.#..', '.#...#.', '#.....#', '.#...#.', '..#.#..', '...#...'],
    heart:  ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    // tag icons (9×9)
    Insect: ['.#.....#.', '..#...#..', '...###...', '..#####..', '#.#####.#', '.#######.', '#.#####.#', '.#.###.#.', '...#.#...'],
    Ant:    ['..#...#..', '...#.#...', '...###...', '....#....', '#..###..#', '.#######.', '..#####..', '.#######.', '#..###..#'],
    Fungus: ['...###...', '.#######.', '##.###.##', '#########', '.#######.', '...###...', '...###...', '..#####..', '.........'],
    Undead: ['..#####..', '.#######.', '##..#..##', '##..#..##', '#########', '.###.###.', '..#####..', '..#.#.#..', '.........'],
    Infected: ['....#....', '.#..#..#.', '..#####..', '..##.##..', '###...###', '..##.##..', '..#####..', '.#..#..#.', '....#....'],
    // card-back emblems (9×9)
    main:    ['....#....', '...###...', '..##.##..', '.##...##.', '##..#..##', '.##...##.', '..##.##..', '...###...', '....#....'],
    extra:   ['....#....', '....#....', '..#####..', '.##...##.', '###.#.###', '.##...##.', '..#####..', '....#....', '....#....'],
    boss:    ['#...#...#', '##.###.##', '#########', '#########', '##.....##', '#########', '.........', '#########', '#########'],
    field:   ['.......#.', '......###', '...#...#.', '..###....', '.#####.#.', '#######.#', '#########', '#########', '.........'],
    barrier: ['#########', '#########', '##.....##', '##.###.##', '##.###.##', '.##...##.', '..##.##..', '...###...', '....#....'],
  };
  MC.icon = (name, cls = '') => {
    const rows = ICONS[name];
    if (!rows) return '';
    const w = rows[0].length, h = rows.length;
    let d = '';
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') d += `M${x} ${y}h1v1h-1z`; }));
    return `<svg class="px-icon ${cls}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}"/></svg>`;
  };

  /** Charge as a row of icons, no number. Zero Charge shows one hollow icon. */
  MC.chargePips = (n, cls = '') => {
    const v = Math.max(0, n | 0);
    const icons = v ? MC.icon('charge').repeat(v) : MC.icon('chargeEmpty');
    return `<span class="pips ${v ? '' : 'pips-zero'} ${cls}" title="Charge ${v}" aria-label="Charge ${v}">${icons}</span>`;
  };

  MC.TAG_COLORS = { Insect: '#3aa63a', Ant: '#e2582a', Fungus: '#d03aa8', Undead: '#7a6c94', Infected: '#d03aa8' };
  MC.tagChip = t =>
    `<span class="tag" style="--tc:${MC.TAG_COLORS[t] || '#555'}">${MC.icon(t)}${MC.esc(t)}</span>`;

  // Keywords that open an effect line ("SUMMON:" style in the reference UI).
  const KEYWORDS = ['Once per turn', 'On Summon', 'On Destroy', 'On Tribute', 'Blocker', 'Unblockable', 'Summon'];
  const KW_RE = new RegExp(`^(${KEYWORDS.join('|')})([:.])\\s*`, 'i');
  MC.formatLine = line => {
    const m = line.match(KW_RE);
    if (!m) return MC.esc(line);
    const rest = line.slice(m[0].length);
    return `<b class="kw">${MC.esc(m[1])}${m[2] === ':' ? ':' : ''}</b>${rest ? ' ' + MC.esc(rest) : ''}`;
  };
  MC.formatText = text =>
    (text || '').split('\n').filter(Boolean).map(l => `<p>${MC.formatLine(l)}</p>`).join('')
    || '<p class="vanilla">No effect.</p>';

  // ───────────────────────── Procedural pixel art ─────────────────────────
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  // Flat sprite colours per tag family.
  const FAMILY = {
    Fungus: ['#e04cb8', '#a85ce8', '#f0709c'],
    Undead: ['#b8b0d0', '#9a92b8'],
    Ant:    ['#f07a32', '#e8483a', '#f0a030', '#d8602a'],
    Insect: ['#5cc840', '#2fb890', '#3aa8e0', '#d8c030', '#48c8a0'],
  };
  MC.artColor = function (card) {
    if (card.id === 'hive-queen') return '#f0c020';
    if (!MC.isMonster(card)) return MC.KINDS[card.kind].frame;
    const t = card.tags || [];
    const fam = t.includes('Fungus') ? 'Fungus' : t.includes('Ant') ? 'Ant' : t.includes('Undead') ? 'Undead' : 'Insect';
    const list = FAMILY[fam];
    return list[hash(card.id + 'c') % list.length];
  };

  function genCreature(r, w, h, density, insect) {
    const half = Math.ceil(w / 2);
    let g = [];
    for (let y = 0; y < h; y++) {
      g[y] = [];
      for (let x = 0; x < half; x++) {
        const dx = (half - 1 - x) / half, dy = Math.abs(y - h * 0.55) / (h / 2);
        g[y][x] = r() < density - dx * 0.55 - dy * 0.5 ? 1 : 0;
      }
    }
    // Smooth with a cellular automaton so shapes read as bodies, not noise.
    for (let pass = 0; pass < 2; pass++) {
      const n = g.map(row => row.slice());
      for (let y = 0; y < h; y++) for (let x = 0; x < half; x++) {
        let c = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const yy = y + oy; let xx = x + ox;
          if (xx >= half) xx = half - 1 - (xx - half) - (w % 2); // mirror across centre
          if (yy >= 0 && yy < h && xx >= 0 && g[yy][xx]) c++;
        }
        n[y][x] = c >= 5 ? 1 : c <= 2 ? 0 : g[y][x];
      }
      g = n;
    }
    for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.85); y++) g[y][half - 1] = 1; // spine
    const full = g.map(row => row.concat(row.slice(0, w - half).reverse()));
    if (insect) {
      const top = full.findIndex(row => row.some(Boolean));
      const ax = half - 3;
      for (let i = 1; i <= 3 && top - i >= 0; i++) { full[top - i][ax - i + 1] = 1; full[top - i][w - 1 - (ax - i + 1)] = 1; }
      for (let k = 0; k < 3; k++) {
        const y = Math.floor(h * (0.45 + k * 0.13));
        if (y >= h) continue;
        const row = full[y], left = row.indexOf(1);
        if (left > 1) { row[left - 1] = 1; row[left - 2] = 1; row[w - left] = 1; row[w - left + 1] = 1; }
      }
    }
    return full;
  }

  /** Flat sprite with a black outline, a highlight edge and black eyes. */
  function drawSprite(ctx, grid, ox, oy, color, r) {
    const h = grid.length, w = grid[0].length;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w) ? grid[y][x] : 0;
    ctx.fillStyle = '#101018';
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (!at(x, y) && (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))) ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    const light = shade(color, 1.35), dark = shade(color, .7);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!grid[y][x]) continue;
      ctx.fillStyle = !at(x, y - 1) ? light : !at(x, y + 1) ? dark : color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    const mid = Math.floor(w / 2);
    for (let y = Math.floor(h * 0.2); y < h * 0.6; y++) {
      const ex = mid - 2 - Math.floor(r() * 2), row = grid[y];
      if (row[ex] && row[w - 1 - ex] && row[ex - 1] && row[w - ex] && (grid[y + 1] || [])[ex]) {
        ctx.fillStyle = '#101018';
        ctx.fillRect(ox + ex, oy + y, 1, 2); ctx.fillRect(ox + w - 1 - ex, oy + y, 1, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + ex, oy + y, 1, 1); ctx.fillRect(ox + w - 1 - ex, oy + y, 1, 1);
        break;
      }
    }
  }

  function genRune(r, size) {
    const half = Math.ceil(size / 2), q = [];
    for (let y = 0; y < half; y++) { q[y] = []; for (let x = 0; x < half; x++) q[y][x] = r() < 0.45 ? 1 : 0; }
    q[half - 1][half - 1] = 1;
    const g = [];
    for (let y = 0; y < size; y++) {
      g[y] = [];
      for (let x = 0; x < size; x++) g[y][x] = q[y < half ? y : size - 1 - y][x < half ? x : size - 1 - x];
    }
    return g;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /** Pale backdrop with a dithered floor band in the card's colour. */
  function backdrop(ctx, W, H, k) {
    ctx.fillStyle = k.pale; ctx.fillRect(0, 0, W, H);
    const hz = Math.floor(H * 0.7);
    for (let y = hz; y < H; y++) for (let x = 0; x < W; x++) {
      if (BAYER[y % 4][x % 4] < (y - hz) * 1.8 + 3) { ctx.fillStyle = shade(k.frame, 1.15); ctx.fillRect(x, y, 1, 1); }
    }
  }

  const artCache = {};
  MC.art = function (card) {
    if (artCache[card.id]) return artCache[card.id];
    const W = 40, H = 30;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const r = rng(hash(card.id));
    const k = MC.KINDS[card.kind];
    const col = MC.artColor(card);
    backdrop(ctx, W, H, k);

    if (MC.isMonster(card)) {
      const big = card.kind === 'boss' ? 24 : card.kind === 'tribute' ? 21 : 19;
      const insect = (card.tags || []).includes('Insect');
      const grid = genCreature(r, big - 4 + (big % 2), big - 2, 0.82 + r() * 0.12, insect);
      const gw = grid[0].length, gh = grid.length;
      drawSprite(ctx, grid, Math.floor((W - gw) / 2), H - 3 - gh, col, r);
      if (card.kind === 'boss') {
        ctx.fillStyle = '#f0c020';
        for (let i = 0; i < 7; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * (H / 2.5)), 1, 1);
      }
    } else if (card.kind === 'field') {
      const hz = Math.floor(H * 0.7);
      for (let i = 0; i < 6; i++) {
        const x = 2 + Math.floor(r() * (W - 4)), hgt = 3 + Math.floor(r() * 9);
        ctx.fillStyle = '#101018'; ctx.fillRect(x - 2, hz - hgt - 1, 5, 4); ctx.fillRect(x - 1, hz - hgt, 3, hgt + 1);
        ctx.fillStyle = shade(col, .8); ctx.fillRect(x, hz - hgt + 1, 1, hgt - 1);
        ctx.fillStyle = col; ctx.fillRect(x - 1, hz - hgt, 3, 2);
      }
      ctx.fillStyle = '#101018'; ctx.fillRect(0, hz, W, 1);
      const sx = Math.floor(W * 0.18 + r() * W * 0.6);
      ctx.fillStyle = '#f0c020'; ctx.fillRect(sx, 4, 4, 4);
      ctx.fillStyle = '#fff8c0'; ctx.fillRect(sx, 4, 2, 2);
    } else if (card.kind === 'barrier') {
      const sh = ICONS.barrier, s = 2, sx = Math.floor((W - 9 * s) / 2), sy = Math.floor((H - 9 * s) / 2);
      ctx.fillStyle = '#101018';
      sh.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(sx + x * s - 1, sy + y * s - 1, s + 2, s + 2); }));
      sh.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '#') { ctx.fillStyle = y < 2 ? shade(col, 1.3) : col; ctx.fillRect(sx + x * s, sy + y * s, s, s); }
      }));
      const rune = genRune(r, 5);
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + 6 + x, sy + 5 + y, 1, 1); } }));
    } else { // action
      const rune = genRune(r, 17), ox = Math.floor((W - 17) / 2), oy = Math.floor((H - 17) / 2);
      ctx.fillStyle = '#101018';
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) ctx.fillRect(ox + x - 1, oy + y - 1, 3, 3); }));
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = (x + y) % 6 === 0 ? '#ffffff' : col; ctx.fillRect(ox + x, oy + y, 1, 1); } }));
    }
    return (artCache[card.id] = cv.toDataURL());
  };

  // ───────────────────────── Card rendering ─────────────────────────
  MC.backOf = card => MC.KINDS[card.kind].back;

  MC.renderBack = (back = 'main', cls = '', attrs = '') =>
    `<div class="card-back back-${back} ${cls}" ${attrs}><span class="back-emblem">${MC.icon(back)}</span></div>`;

  function footprint(card) {
    if (!MC.isMonster(card) || card.kind === 'basic') return '';
    const n = card.footprint || 1;
    return `<span class="c-fp" title="Footprint ${n}">${'<i></i>'.repeat(n)}</span>`;
  }

  MC.setCostLabel = c => c.setCost == null ? '?' : '+' + c.setCost;

  function bottomBar(card) {
    if (MC.isMonster(card)) {
      return `<div class="c-stats">
        <span class="s-atk" title="ATK">${MC.icon('atk')}${card.atk}</span>
        <span class="s-def" title="DEF">${MC.icon('def')}${card.def}</span>
      </div>`;
    }
    if (card.kind === 'action') {
      return `<div class="c-stats">
        <span title="Charge Cost">COST ${card.cost}</span>
        <span title="Extra cost when set and used on the opponent's turn">SET ${MC.setCostLabel(card)}</span>
      </div>`;
    }
    return `<div class="c-stats c-stats-label"><span>${MC.esc(card.archetype || MC.KINDS[card.kind].long)}</span></div>`;
  }

  /** Full-size card. opts: { faceDown, extraClass } */
  MC.renderCard = function (card, opts = {}) {
    if (opts.faceDown) return MC.renderBack(MC.backOf(card), 'card ' + (opts.extraClass || ''));
    const k = MC.KINDS[card.kind];
    const cost = card.cost != null && card.kind === 'tribute' ? `<span class="c-cost" title="Charge Cost">COST ${card.cost}</span>` : '';
    return `<div class="card k-${card.kind} ${opts.extraClass || ''}" data-card="${card.id}">
      <div class="c-head"><span class="c-name">${MC.esc(card.name)}</span></div>
      <div class="c-sub"><span>${k.label}</span>${cost}</div>
      <div class="c-art"><img src="${MC.art(card)}" alt="">${card.charge != null ? MC.chargePips(card.charge, 'c-charge') : ''}</div>
      <div class="c-tags">${(card.tags || []).map(MC.tagChip).join('')}${footprint(card)}</div>
      <div class="c-text">${MC.formatText(card.text)}</div>
      ${bottomBar(card)}
    </div>`;
  };

  /** Compact card for the play table. */
  MC.renderMini = function (card, opts = {}) {
    if (opts.faceDown) {
      const back = opts.back || MC.backOf(card);
      return `<div class="mini mini-back back-${back} ${opts.extraClass || ''}" ${opts.attrs || ''}>
        <span class="back-emblem">${MC.icon(back)}</span>${opts.label ? `<span class="mini-flag">${opts.label}</span>` : ''}</div>`;
    }
    const m = opts.mods || {};
    const stat = (base, d) => `<b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${base + (d || 0)}</b>`;
    const stats = MC.isMonster(card)
      ? `<div class="m-stats">${stat(card.atk, m.atk)}<i>/</i>${stat(card.def, m.def)}</div>`
      : card.kind === 'action' ? `<div class="m-stats"><b>C${card.cost}</b></div>`
      : `<div class="m-stats m-label">${MC.KINDS[card.kind].label}</div>`;
    const ch = opts.charge ?? card.charge;
    const boosted = opts.charge != null && opts.charge !== card.charge;
    const charge = ch != null ? MC.chargePips(ch, `m-charge ${boosted ? 'up' : ''}`) : '';
    const tag = (card.tags || [])[card.tags?.includes('Ant') ? card.tags.indexOf('Ant') : 0];
    return `<div class="mini k-${card.kind} ${opts.extraClass || ''}" ${opts.attrs || ''}>
      <div class="m-name">${MC.esc(card.name)}</div>
      <div class="m-art"><img src="${MC.art(card)}" alt="">${charge}
        ${tag ? `<span class="m-tag" style="--tc:${MC.TAG_COLORS[tag]}">${MC.icon(tag)}</span>` : ''}
        ${opts.infected ? `<span class="m-infected" title="Infected">${MC.icon('Infected')}</span>` : ''}</div>
      ${stats}
      ${opts.label ? `<span class="mini-flag">${opts.label}</span>` : ''}
    </div>`;
  };

  // ───────────────────────── Deck helpers ─────────────────────────
  MC.expand = list => list.flatMap(([id, n]) => Array(n).fill(id));
  MC.count = list => list.reduce((s, [, n]) => s + n, 0);

  /** Returns { errors, warnings }. An empty side deck is a warning while decks are in progress. */
  MC.validateDeck = function (deck) {
    const errors = [], warnings = [];
    const need = (label, got, want, soft) => { if (got !== want) (soft ? warnings : errors).push(`${label}: ${got}/${want}`); };
    need('Main Deck', MC.count(deck.main), 50);
    need('Side Deck', MC.count(deck.side), 15, MC.count(deck.side) === 0);
    need('Extra Deck', MC.count(deck.extra), 10);
    need('Field Deck', deck.field.length, 4);
    need('Barriers', deck.barriers.length, 4);

    const combined = {};
    deck.main.concat(deck.side).forEach(([id, n]) => { combined[id] = (combined[id] || 0) + n; });
    for (const [id, n] of Object.entries(combined)) {
      const c = MC.byId[id], lim = c.limit ?? 4;
      if (n > lim) errors.push(`${c.name}: ${n} copies (max ${lim})`);
      if (!['basic', 'tribute', 'action'].includes(c.kind)) errors.push(`${c.name} can't be in the Main/Side Deck`);
    }
    deck.extra.forEach(([id, n]) => {
      const c = MC.byId[id], lim = c.limit ?? 2;
      if (n > lim) errors.push(`${c.name}: ${n} copies in Extra (max ${lim})`);
      if (c.kind !== 'extra') errors.push(`${c.name} isn't an Extra Deck card`);
    });
    if (new Set(deck.field).size !== deck.field.length) errors.push('Field Deck has duplicates (max 1 each)');
    const protectors = deck.barriers.filter(id => MC.byId[id].archetype === 'Basic Protector').length;
    if (protectors > 1) errors.push('More than 1 Basic Protector Barrier');
    if (MC.byId[deck.boss]?.kind !== 'boss') errors.push('Boss is missing');
    return { errors, warnings };
  };
})();
