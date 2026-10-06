/*
 * Shared helpers: card lookup, kind metadata, procedural pixel art,
 * pixel icons, card rendering and deck validation.
 */
(function () {
  const MC = window.MC;

  MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));

  MC.KINDS = {
    basic:   { label: 'Basic',   long: 'Basic Monster',      frame: '#e6dcc4', deep: '#5b5140', back: 'main' },
    tribute: { label: 'Tribute', long: 'Tribute Monster',    frame: '#ff4d6a', deep: '#6b1530', back: 'main' },
    extra:   { label: 'Extra',   long: 'Extra Deck Monster', frame: '#3fe0c8', deep: '#0f4f52', back: 'extra' },
    action:  { label: 'Action',  long: 'Action',             frame: '#ffb23f', deep: '#6a3a0c', back: 'main' },
    field:   { label: 'Field',   long: 'Field',              frame: '#78e05a', deep: '#1f4f22', back: 'field' },
    barrier: { label: 'Barrier', long: 'Barrier',            frame: '#6f8bff', deep: '#262c74', back: 'barrier' },
    boss:    { label: 'Boss',    long: 'Boss Monster',       frame: '#c27bff', deep: '#3d1466', back: 'boss' },
  };
  MC.KIND_ORDER = ['boss', 'basic', 'tribute', 'extra', 'action', 'field', 'barrier'];
  MC.isMonster = c => ['basic', 'tribute', 'extra', 'boss'].includes(c.kind);

  MC.esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ───────────────────────── Pixel icons ─────────────────────────
  const ICONS = {
    atk:    ['.....##', '....###', '...###.', '#.###..', '.###...', '..#....', '#.#....'],
    def:    ['#######', '#.....#', '#.###.#', '#.###.#', '.#.#.#.', '..#.#..', '...#...'],
    charge: ['...#...', '..###..', '.##.##.', '##...##', '.##.##.', '..###..', '...#...'],
    heart:  ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    // tag icons (9×9), drawn as flat silhouettes
    Insect: ['.#.....#.', '..#...#..', '...###...', '..#####..', '#.#####.#', '.#######.', '#.#####.#', '.#.###.#.', '...#.#...'],
    Ant:    ['..#...#..', '...#.#...', '...###...', '....#....', '#..###..#', '.#######.', '..#####..', '.#######.', '#..###..#'],
    Fungus: ['...###...', '.#######.', '##.###.##', '#########', '.#######.', '...###...', '...###...', '..#####..', '.........'],
    Undead: ['..#####..', '.#######.', '##..#..##', '##..#..##', '#########', '.###.###.', '..#####..', '..#.#.#..', '.........'],
    Infected: ['....#....', '.#..#..#.', '..#####..', '..##.##..', '###...###', '..##.##..', '..#####..', '.#..#..#.', '....#....'],
    Blocker: ['#########', '#.......#', '#.#####.#', '#.#####.#', '#.#####.#', '.#.###.#.', '..#.#.#..', '...#.#...', '....#....'],
    Unblockable: ['.........', '##.....##', '###...###', '.###.###.', '..#####..', '...###...', '..#.#.#..', '.#.....#.', '.........'],
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

  MC.TAG_COLORS = {
    Insect: '#8ef05a', Ant: '#ff8a3d', Fungus: '#ff5ad8', Undead: '#efe6d2',
    Infected: '#ff6ad5', Blocker: '#5ab4ff', Unblockable: '#ffe14d',
  };
  MC.tagChip = (t, keyword) =>
    `<span class="tag ${keyword ? 'tag-kw' : ''}" style="--tc:${MC.TAG_COLORS[t] || '#c8c2ee'}">${MC.icon(t)}${MC.esc(t)}</span>`;

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

  // Bright flat silhouette colours, like phosphor sprites on a black CRT.
  const FAMILY = {
    Fungus: ['#ff5ad8', '#d06bff', '#ff7ab0'],
    Undead: ['#efe6d2', '#c8c2ee'],
    Ant:    ['#ff8a3d', '#ff5a4a', '#ffb03d', '#f06a3a'],
    Insect: ['#8ef05a', '#4fe0a0', '#5ad1f0', '#f0e05a', '#6cf0c8'],
  };
  MC.artColor = function (card) {
    if (card.id === 'hive-queen') return '#ffd84d';
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

  /** Flat one-colour silhouette with black eye holes. */
  function drawSilhouette(ctx, grid, ox, oy, color, r) {
    const h = grid.length, w = grid[0].length;
    ctx.fillStyle = color;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y][x]) ctx.fillRect(ox + x, oy + y, 1, 1);
    const mid = Math.floor(w / 2);
    for (let y = Math.floor(h * 0.2); y < h * 0.6; y++) {
      const ex = mid - 2 - Math.floor(r() * 2), row = grid[y];
      if (row[ex] && row[w - 1 - ex] && row[ex - 1] && row[w - ex] && (grid[y + 1] || [])[ex]) {
        ctx.fillStyle = '#000';
        ctx.fillRect(ox + ex, oy + y, 1, 2); ctx.fillRect(ox + w - 1 - ex, oy + y, 1, 2);
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
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * f));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
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
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    if (MC.isMonster(card)) {
      // faint floor dither
      for (let y = H - 5; y < H; y++) for (let x = 0; x < W; x++) {
        if (BAYER[y % 4][x % 4] < (y - (H - 5)) * 2) { ctx.fillStyle = shade(k.frame, .22); ctx.fillRect(x, y, 1, 1); }
      }
      const big = card.kind === 'boss' ? 24 : card.kind === 'tribute' ? 21 : 18;
      const insect = (card.tags || []).includes('Insect');
      const grid = genCreature(r, big - 4 + (big % 2), big - 2, 0.82 + r() * 0.12, insect);
      const gw = grid[0].length, gh = grid.length;
      const bx = card.kind === 'boss' ? Math.floor((W - gw) / 2) : Math.floor((W - gw) / 2) + 5;
      drawSilhouette(ctx, grid, bx, H - 3 - gh, col, r);
      if (card.kind !== 'boss') { // small companion sprite, like the reference sheet
        const small = genCreature(rng(hash(card.id + 's')), 9, 9, 0.9, insect);
        drawSilhouette(ctx, small, bx - 11, H - 3 - small.length, shade(col, .55), r);
      } else {
        ctx.fillStyle = '#fff6c8';
        for (let i = 0; i < 7; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * (H / 2.5)), 1, 1);
      }
    } else if (card.kind === 'field') {
      const hz = Math.floor(H * 0.72);
      for (let y = hz; y < H; y++) for (let x = 0; x < W; x++) {
        if (BAYER[y % 4][x % 4] < (y - hz) * 1.6) { ctx.fillStyle = shade(col, .35); ctx.fillRect(x, y, 1, 1); }
      }
      ctx.fillStyle = col; ctx.fillRect(0, hz, W, 1);
      for (let i = 0; i < 6; i++) {
        const x = 2 + Math.floor(r() * (W - 4)), hgt = 3 + Math.floor(r() * 9);
        ctx.fillStyle = col; ctx.fillRect(x, hz - hgt, 1, hgt); ctx.fillRect(x - 1, hz - hgt, 3, 2);
      }
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.floor(W * 0.18 + r() * W * 0.6), 4, 3, 3);
    } else if (card.kind === 'barrier') {
      const sh = ICONS.barrier, s = 2, sx = Math.floor((W - 9 * s) / 2), sy = Math.floor((H - 9 * s) / 2);
      sh.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '#') { ctx.fillStyle = col; ctx.fillRect(sx + x * s, sy + y * s, s, s); }
      }));
      const rune = genRune(r, 5);
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = '#000'; ctx.fillRect(sx + 6 + x, sy + 5 + y, 1, 1); } }));
    } else { // action
      const rune = genRune(r, 17), ox = Math.floor((W - 17) / 2), oy = Math.floor((H - 17) / 2);
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); } }));
    }
    return (artCache[card.id] = cv.toDataURL());
  };

  // ───────────────────────── Card rendering ─────────────────────────
  MC.backOf = card => MC.KINDS[card.kind].back;

  MC.renderBack = (back = 'main', cls = '', attrs = '') =>
    `<div class="card-back back-${back} ${cls}" ${attrs}><span class="back-emblem">${MC.icon(back)}</span></div>`;

  function chipsHTML(card) {
    return (card.tags || []).map(t => MC.tagChip(t)).join('') + (card.keywords || []).map(t => MC.tagChip(t, true)).join('');
  }

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
    const charge = card.charge != null ? `<span class="c-charge" title="Charge">${MC.icon('charge')}${card.charge}</span>` : '';
    const cost = card.cost != null && card.kind === 'tribute' ? `<span class="c-cost" title="Charge Cost">COST ${card.cost}</span>` : '';
    const text = (card.text || '').split('\n').filter(Boolean).map(l => `<p>${MC.esc(l)}</p>`).join('')
      || '<p class="vanilla">No effect.</p>';
    return `<div class="card k-${card.kind} ${opts.extraClass || ''}" data-card="${card.id}">
      <div class="c-head"><span class="c-name">${MC.esc(card.name)}</span>${charge}</div>
      <div class="c-sub"><span>${k.label}</span>${cost}</div>
      <div class="c-art"><img src="${MC.art(card)}" alt="" style="--glow:${MC.artColor(card)}"></div>
      <div class="c-tags">${chipsHTML(card)}${footprint(card)}</div>
      <div class="c-text">${text}</div>
      ${bottomBar(card)}
    </div>`;
  };

  /** Compact card for the play table. */
  MC.renderMini = function (card, opts = {}) {
    if (opts.faceDown) {
      return `<div class="mini mini-back back-${opts.back || MC.backOf(card)} ${opts.extraClass || ''}" ${opts.attrs || ''}>
        <span class="back-emblem">${MC.icon(opts.back || MC.backOf(card))}</span>${opts.label ? `<span class="mini-flag">${opts.label}</span>` : ''}</div>`;
    }
    const m = opts.mods || {};
    const stat = (base, d) => `<b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${base + (d || 0)}</b>`;
    const stats = MC.isMonster(card)
      ? `<div class="m-stats">${stat(card.atk, m.atk)}<i>/</i>${stat(card.def, m.def)}</div>`
      : card.kind === 'action' ? `<div class="m-stats"><b>C${card.cost}</b></div>`
      : `<div class="m-stats m-label">${MC.KINDS[card.kind].label}</div>`;
    const ch = opts.charge ?? card.charge;
    const charge = ch != null ? `<span class="m-charge ${opts.charge != null && opts.charge !== card.charge ? 'up' : ''}">${ch}</span>` : '';
    const tag = (card.tags || [])[card.tags?.includes('Ant') ? card.tags.indexOf('Ant') : 0];
    return `<div class="mini k-${card.kind} ${opts.extraClass || ''}" ${opts.attrs || ''}>
      <div class="m-name">${MC.esc(card.name)}</div>
      <div class="m-art"><img src="${MC.art(card)}" alt="" style="--glow:${MC.artColor(card)}"></div>
      ${stats}${charge}
      ${tag ? `<span class="m-tag" style="--tc:${MC.TAG_COLORS[tag]}">${MC.icon(tag)}</span>` : ''}
      ${opts.infected ? `<span class="m-infected" title="Infected">${MC.icon('Infected')}</span>` : ''}
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

  // Pixel background skull (homage to the reference art), drawn once.
  MC.skullBackdrop = function () {
    const half = [
      '......#####', '...########', '..#########', '.##########', '.##########', '###########',
      '###########', '###...#####', '##.....####', '##.....####', '##.....####', '###...#####',
      '.#########.', '..#######..', '...#####...', '...##.##.##', '...########', '....#######',
    ];
    const rows = half.map(h => h + h.slice(0, -1).split('').reverse().join(''));
    const W = rows[0].length, H = rows.length;
    const cv = document.createElement('canvas'); cv.width = W + 4; cv.height = H + 4;
    const ctx = cv.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      ctx.fillStyle = BAYER[y % 4][x % 4] > 10 ? '#16323a' : '#10252c';
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }));
    ctx.fillStyle = '#5bd13a';
    [[4, 8], [5, 9], [6, 10], [4, 10], [6, 8]].forEach(([x, y]) => ctx.fillRect(x + 2, y + 2, 1, 1));
    ctx.fillStyle = '#8a5cff';
    [[15, 8], [16, 8], [17, 8], [15, 9], [17, 9], [15, 10], [16, 10], [17, 10]].forEach(([x, y]) => ctx.fillRect(x + 2, y + 2, 1, 1));
    ctx.fillStyle = '#3df0ff'; ctx.fillRect(18, 11, 1, 1);
    return cv.toDataURL();
  };

  MC.stoneTexture = function () {
    const S = 48;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const r = rng(1234567);
    const cols = ['#3c2d55', '#45345f', '#4e3b6b', '#382a4f'];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      ctx.fillStyle = cols[(BAYER[y % 4][x % 4] + Math.floor(r() * 6)) % cols.length];
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#271c38';
    for (let y = 0; y < S; y += 12) {
      ctx.fillRect(0, y, S, 1);
      const off = (y / 12) % 2 ? 0 : 12;
      for (let x = off; x < S; x += 24) ctx.fillRect(x, y, 1, 12);
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = r() < 0.5 ? '#6a4f8f' : '#b0476f';
      ctx.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
    }
    return cv.toDataURL();
  };
})();
