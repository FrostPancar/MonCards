/*
 * Shared helpers: card lookup, kind metadata, procedural pixel art,
 * pixel icons, card rendering and deck validation.
 */
(function () {
  const MC = window.MC;

  MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));

  MC.KINDS = {
    basic:   { label: 'Basic',   long: 'Basic Monster',    frame: '#d8ccb4', deep: '#5b5140' },
    tribute: { label: 'Tribute', long: 'Tribute Monster',  frame: '#ff4d6a', deep: '#6b1530' },
    extra:   { label: 'Extra',   long: 'Extra Deck Monster', frame: '#3fe0c8', deep: '#0f4f52' },
    action:  { label: 'Action',  long: 'Action',           frame: '#ffb23f', deep: '#6a3a0c' },
    field:   { label: 'Field',   long: 'Field',            frame: '#78e05a', deep: '#1f4f22' },
    barrier: { label: 'Barrier', long: 'Barrier',          frame: '#8f9dff', deep: '#262c74' },
    boss:    { label: 'Boss',    long: 'Boss Monster',     frame: '#c27bff', deep: '#3d1466' },
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
    foot:   ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
    skull:  ['.#####.', '#######', '#..#..#', '#######', '.##.##.', '.#.#.#.', '.......'],
  };
  MC.icon = (name, cls = '') => {
    const rows = ICONS[name];
    let rects = '';
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }));
    return `<svg class="px-icon ${cls}" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  };

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

  // Body palettes chosen by tags/type.
  function palette(card) {
    const t = (card.tags || []).concat(card.type || []);
    if (t.includes('Fungus')) return ['#2a0f2e', '#7a2a6e', '#c64fa0', '#ff9bd2'];
    if (t.includes('Undead')) return ['#1f1d2b', '#5c5a73', '#a8a6c0', '#ece8ff'];
    if (t.includes('Wind'))   return ['#0c2233', '#1f6f8f', '#45c3d9', '#b6f6ff'];
    if (t.includes('Insect')) return ['#1a2410', '#4c6b1d', '#93b83a', '#e3f59a'];
    return ['#2a1a10', '#7a4a22', '#c98a3f', '#ffe0a0'];
  }
  const EYES = ['#ff3355', '#ffe14d', '#4dfff0', '#ffffff'];

  function genCreature(r, w, h, density, insect) {
    const half = Math.ceil(w / 2);
    let g = [];
    for (let y = 0; y < h; y++) {
      g[y] = [];
      for (let x = 0; x < half; x++) {
        const dx = (half - 1 - x) / half, dy = Math.abs(y - h * 0.55) / (h / 2);
        const p = density - dx * 0.55 - dy * 0.5;
        g[y][x] = r() < p ? 1 : 0;
      }
    }
    // Smooth with cellular automaton so shapes read as bodies, not noise.
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
    // Ensure a solid spine.
    for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.85); y++) g[y][half - 1] = 1;
    const full = g.map(row => row.concat(row.slice(0, w - half).reverse()));
    if (insect) {
      // antennae
      const top = full.findIndex(row => row.some(Boolean));
      const ax = half - 3;
      for (let i = 1; i <= 3 && top - i >= 0; i++) {
        full[top - i][ax - i + 1] = 2; full[top - i][w - 1 - (ax - i + 1)] = 2;
      }
      // legs
      for (let k = 0; k < 3; k++) {
        const y = Math.floor(h * (0.45 + k * 0.13));
        if (y >= h) continue;
        const row = full[y];
        const left = row.indexOf(1);
        if (left > 1) { row[left - 1] = 2; row[left - 2] = 2; row[w - left] = 2; row[w - left + 1] = 2; }
      }
    }
    return full;
  }

  function drawSprite(ctx, grid, ox, oy, pal, r) {
    const h = grid.length, w = grid[0].length;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w) ? grid[y][x] : 0;
    // outline
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (at(x, y)) continue;
      if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) {
        ctx.fillStyle = '#05040a'; ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = grid[y][x];
      if (!v) continue;
      if (v === 2) { ctx.fillStyle = pal[1]; ctx.fillRect(ox + x, oy + y, 1, 1); continue; }
      const lit = !at(x, y - 1) || !at(x - 1, y);
      const shade = !at(x, y + 1) || !at(x + 1, y);
      const band = y / h;
      ctx.fillStyle = lit ? pal[3] : shade ? pal[1] : band < 0.5 ? pal[2] : (BAYER[y % 4][x % 4] > 7 ? pal[2] : pal[1]);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    // eyes: find a filled row in the upper half that is wide enough
    const eye = EYES[Math.floor(r() * EYES.length)];
    for (let y = Math.floor(h * 0.25); y < h * 0.6; y++) {
      const row = grid[y], mid = Math.floor(w / 2);
      const ex = mid - 2 - Math.floor(r() * 2);
      if (row[ex] === 1 && row[w - 1 - ex] === 1 && row[ex - 1] && row[w - ex]) {
        ctx.fillStyle = eye;
        ctx.fillRect(ox + ex, oy + y, 1, 1); ctx.fillRect(ox + w - 1 - ex, oy + y, 1, 1);
        if (r() < 0.4) { ctx.fillStyle = '#05040a'; ctx.fillRect(ox + mid, oy + y + 2, 1, 1); ctx.fillRect(ox + w - 1 - mid, oy + y + 2, 1, 1); }
        break;
      }
    }
  }

  function ditherBg(ctx, W, H, top, bottom, accent) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (y / H) * 16;
      ctx.fillStyle = BAYER[y % 4][x % 4] < t ? bottom : top;
      ctx.fillRect(x, y, 1, 1);
    }
    if (accent) { // horizon line
      ctx.fillStyle = accent; ctx.fillRect(0, Math.floor(H * 0.78), W, 1);
    }
  }

  function genRune(r, size) {
    const half = Math.ceil(size / 2);
    const q = [];
    for (let y = 0; y < half; y++) { q[y] = []; for (let x = 0; x < half; x++) q[y][x] = r() < 0.45 ? 1 : 0; }
    q[half - 1][half - 1] = 1;
    const g = [];
    for (let y = 0; y < size; y++) {
      g[y] = [];
      for (let x = 0; x < size; x++) {
        const yy = y < half ? y : size - 1 - y, xx = x < half ? x : size - 1 - x;
        g[y][x] = q[yy][xx];
      }
    }
    return g;
  }

  const artCache = {};
  MC.art = function (card) {
    if (artCache[card.id]) return artCache[card.id];
    const W = 40, H = 30;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const r = rng(hash(card.id));
    const k = MC.KINDS[card.kind];
    const pal = palette(card);

    if (MC.isMonster(card)) {
      ditherBg(ctx, W, H, '#07060d', k.deep, null);
      // floor
      ctx.fillStyle = '#05040a'; ctx.fillRect(0, H - 6, W, 6);
      ctx.fillStyle = k.deep; for (let x = 0; x < W; x += 2) ctx.fillRect(x + ((H - 6) % 2), H - 6, 1, 1);
      const big = card.kind === 'boss' ? 26 : card.kind === 'tribute' ? 22 : 18;
      const insect = (card.tags || []).includes('Insect');
      const grid = genCreature(r, big - 4 + (big % 2), big - 2, 0.82 + r() * 0.12, insect);
      const gw = grid[0].length, gh = grid.length;
      // shadow
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.floor((W - gw) / 2) + 2, H - 5, gw - 4, 2);
      drawSprite(ctx, grid, Math.floor((W - gw) / 2), H - 4 - gh, pal, r);
      if (card.kind === 'boss') { // crown sparkles
        ctx.fillStyle = '#ffe14d';
        for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(r() * W), Math.floor(r() * (H / 2)), 1, 1);
      }
    } else if (card.kind === 'field') {
      ditherBg(ctx, W, H, '#0a0a1a', k.deep, k.frame);
      ctx.fillStyle = '#05040a'; ctx.fillRect(0, Math.floor(H * 0.78) + 1, W, H);
      for (let i = 0; i < 7; i++) { // pixel trees / spires
        const x = Math.floor(r() * W), hgt = 4 + Math.floor(r() * 10), y = Math.floor(H * 0.78);
        ctx.fillStyle = k.frame; ctx.fillRect(x, y - hgt, 1, hgt);
        ctx.fillStyle = pal[2]; ctx.fillRect(x - 1, y - hgt, 3, 2);
      }
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.floor(W * 0.75), 4, 3, 3); // moon
    } else if (card.kind === 'barrier') {
      ditherBg(ctx, W, H, '#07060d', k.deep, null);
      const shield = ['...#########...', '..###########..', '.#############.', '###############', '###############',
        '###############', '###############', '.#############.', '.#############.', '..###########..',
        '...#########...', '....#######....', '.....#####.....', '......###......', '.......#.......'];
      const sx = Math.floor((W - 15) / 2), sy = Math.floor((H - 15) / 2) - 3;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 1.3);
      shield.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== '#') return;
        const edge = !(shield[y - 1] || '')[x] || (shield[y - 1] || '')[x] !== '#' || row[x - 1] !== '#' || row[x + 1] !== '#';
        ctx.fillStyle = edge ? k.frame : (BAYER[y % 4][x % 4] > 9 ? '#3a42a0' : k.deep);
        ctx.fillRect(x, y, 1, 1);
      }));
      ctx.restore();
      const rune = genRune(r, 7);
      rune.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = '#e8ecff'; ctx.fillRect(sx + 4 + x, sy + 4 + y, 1, 1); } }));
    } else { // action
      ditherBg(ctx, W, H, '#07060d', k.deep, null);
      const rune = genRune(r, 17);
      const ox = Math.floor((W - 17) / 2), oy = Math.floor((H - 17) / 2);
      // glow
      rune.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return; ctx.fillStyle = k.deep;
        ctx.fillRect(ox + x - 1, oy + y, 3, 1); ctx.fillRect(ox + x, oy + y - 1, 1, 3);
      }));
      rune.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return; ctx.fillStyle = (x + y) % 5 === 0 ? '#fff4d0' : k.frame; ctx.fillRect(ox + x, oy + y, 1, 1);
      }));
    }
    return (artCache[card.id] = cv.toDataURL());
  };

  // ───────────────────────── Card rendering ─────────────────────────
  function subtitle(card) {
    const k = MC.KINDS[card.kind];
    if (card.kind === 'barrier') return `${k.label} · ${card.archetype}`;
    if (card.kind === 'extra') {
      const m = { fusion: 'Fusion', formation: 'Formation', trigger: 'Trigger' }[card.method] || '';
      return `${k.label}${m ? ' · ' + m : ''}${card.type ? ' · ' + card.type : ''}`;
    }
    return `${k.label}${card.type ? ' · ' + card.type : ''}`;
  }

  function topBadge(card) {
    if (card.charge != null) return `<span class="c-charge" title="Charge">${MC.icon('charge')}${card.charge}</span>`;
    return '';
  }

  function footprint(card) {
    if (!MC.isMonster(card) || card.kind === 'basic') return '';
    const n = card.footprint || 1;
    return `<span class="c-fp" title="Footprint ${n}">${'<i></i>'.repeat(n)}</span>`;
  }

  function bottomBar(card) {
    if (MC.isMonster(card)) {
      return `<div class="c-stats">
        <span title="ATK">${MC.icon('atk')}${card.atk}</span>
        <span title="DEF">${MC.icon('def')}${card.def}</span>
      </div>`;
    }
    if (card.kind === 'action') {
      return `<div class="c-stats">
        <span title="Charge Cost">COST ${card.cost}</span>
        <span title="Extra cost when set and used on the opponent's turn">SET +${card.setCost ?? 0}</span>
      </div>`;
    }
    return `<div class="c-stats c-stats-label"><span>${MC.esc(MC.KINDS[card.kind].long)}</span></div>`;
  }

  /** Full-size card. opts: { faceDown, extraClass } */
  MC.renderCard = function (card, opts = {}) {
    if (opts.faceDown) return `<div class="card card-back ${opts.extraClass || ''}"><div class="back-emblem"></div></div>`;
    const tags = (card.tags || []).map(t => `<span class="tag">${MC.esc(t)}</span>`).join('');
    const cost = card.kind === 'tribute' ? `<span class="c-cost" title="Charge Cost">COST ${card.cost}</span>` : '';
    const text = (card.text || '').split('\n').filter(Boolean).map(l => `<p>${MC.esc(l)}</p>`).join('')
      || '<p class="vanilla">No effect.</p>';
    return `<div class="card k-${card.kind} ${opts.extraClass || ''}" data-card="${card.id}">
      <div class="c-head"><span class="c-name">${MC.esc(card.name)}</span>${topBadge(card)}</div>
      <div class="c-sub"><span>${MC.esc(subtitle(card))}</span>${cost}</div>
      <div class="c-art"><img src="${MC.art(card)}" alt=""></div>
      <div class="c-tags">${tags}${footprint(card)}</div>
      <div class="c-text">${text}</div>
      ${bottomBar(card)}
      ${card.sample ? '<span class="c-sample" title="Placeholder card">SAMPLE</span>' : ''}
    </div>`;
  };

  /** Compact card for the play table. inst may carry mods / infected. */
  MC.renderMini = function (card, opts = {}) {
    if (opts.faceDown) {
      return `<div class="mini mini-back ${opts.extraClass || ''}" ${opts.attrs || ''}><div class="back-emblem"></div>${opts.label ? `<span class="mini-flag">${opts.label}</span>` : ''}</div>`;
    }
    const m = opts.mods || {};
    const stat = (base, d) => `<b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${base + (d || 0)}</b>`;
    const stats = MC.isMonster(card)
      ? `<div class="m-stats">${stat(card.atk, m.atk)}<i>/</i>${stat(card.def, m.def)}</div>`
      : card.kind === 'action' ? `<div class="m-stats"><b>◆${card.charge}</b><i>·</i><b>C${card.cost}</b></div>`
      : `<div class="m-stats m-label">${MC.KINDS[card.kind].label}</div>`;
    const charge = card.charge != null ? `<span class="m-charge">${card.charge + (m.charge || 0)}</span>` : '';
    return `<div class="mini k-${card.kind} ${opts.extraClass || ''}" ${opts.attrs || ''}>
      <div class="m-name">${MC.esc(card.name)}</div>
      <div class="m-art"><img src="${MC.art(card)}" alt=""></div>
      ${stats}${charge}
      ${opts.infected ? '<span class="m-infected" title="Infected">☣</span>' : ''}
      ${opts.label ? `<span class="mini-flag">${opts.label}</span>` : ''}
    </div>`;
  };

  // ───────────────────────── Deck helpers ─────────────────────────
  MC.expand = list => list.flatMap(([id, n]) => Array(n).fill(id));
  MC.count = list => list.reduce((s, [, n]) => s + n, 0);

  MC.validateDeck = function (deck) {
    const issues = [];
    const need = (label, got, want) => { if (got !== want) issues.push(`${label}: ${got}/${want}`); };
    need('Main Deck', MC.count(deck.main), 50);
    need('Side Deck', MC.count(deck.side), 15);
    need('Extra Deck', MC.count(deck.extra), 10);
    need('Field Deck', deck.field.length, 4);
    need('Barriers', deck.barriers.length, 4);

    const combined = {};
    deck.main.concat(deck.side).forEach(([id, n]) => { combined[id] = (combined[id] || 0) + n; });
    for (const [id, n] of Object.entries(combined)) {
      const c = MC.byId[id], lim = c.limit ?? 4;
      if (n > lim) issues.push(`${c.name}: ${n} copies (max ${lim})`);
      if (!['basic', 'tribute', 'action'].includes(c.kind)) issues.push(`${c.name} can't be in the Main/Side Deck`);
    }
    deck.extra.forEach(([id, n]) => {
      const c = MC.byId[id], lim = c.limit ?? 2;
      if (n > lim) issues.push(`${c.name}: ${n} copies in Extra (max ${lim})`);
      if (c.kind !== 'extra') issues.push(`${c.name} isn't an Extra Deck card`);
    });
    if (new Set(deck.field).size !== deck.field.length) issues.push('Field Deck has duplicates (max 1 each)');
    const protectors = deck.barriers.filter(id => MC.byId[id].archetype === 'Basic Protector').length;
    if (protectors > 1) issues.push('More than 1 Basic Protector Barrier');
    if (MC.byId[deck.boss]?.kind !== 'boss') issues.push('Boss is missing');
    return issues;
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
    // eyes: green X and purple ring
    ctx.fillStyle = '#5bd13a';
    [[4, 8], [5, 9], [6, 10], [4, 10], [6, 8], [5, 9]].forEach(([x, y]) => ctx.fillRect(x + 2, y + 2, 1, 1));
    ctx.fillStyle = '#8a5cff';
    [[15, 8], [16, 8], [17, 8], [15, 9], [17, 9], [15, 10], [16, 10], [17, 10]].forEach(([x, y]) => ctx.fillRect(x + 2, y + 2, 1, 1));
    ctx.fillStyle = '#3df0ff'; ctx.fillRect(16 + 2, 9 + 2, 1, 1);
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
    // brick seams
    ctx.fillStyle = '#271c38';
    for (let y = 0; y < S; y += 12) {
      ctx.fillRect(0, y, S, 1);
      const off = (y / 12) % 2 ? 0 : 12;
      for (let x = off; x < S; x += 24) ctx.fillRect(x, y, 1, 12);
    }
    // specks
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = r() < 0.5 ? '#6a4f8f' : '#b0476f';
      ctx.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
    }
    return cv.toDataURL();
  };
})();
