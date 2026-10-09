/*
 * Shared helpers: card lookup, kind metadata, procedural pixel art,
 * pixel icons, card rendering and deck validation.
 */
(function () {
  const MC = window.MC;

  MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));

  /** Monster art is hidden for now; flip to true to bring the procedural sprites back. */
  MC.SHOW_ART = false;

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
    action: ['.....###.', '....###..', '...###...', '..######.', '.######..', '....##...', '...##....', '..##.....', '.#.......'],
    foot:   ['.#.#.#...', '.#.#.#.#.', '.......#.', '..#####..', '.#######.', '.#######.', '..######.', '...####..', '....##...'],
    // tag icons (9×9)
    Insect: ['.#.....#.', '..#...#..', '...###...', '..#####..', '#.#####.#', '.#######.', '#.#####.#', '.#.###.#.', '...#.#...'],
    Ant:    ['..#...#..', '...#.#...', '...###...', '....#....', '#..###..#', '.#######.', '..#####..', '.#######.', '#..###..#'],
    Fungus: ['...###...', '.#######.', '##.###.##', '#########', '.#######.', '...###...', '...###...', '..#####..', '.........'],
    Undead: ['..#####..', '.#######.', '##..#..##', '##..#..##', '#########', '.###.###.', '..#####..', '..#.#.#..', '.........'],
    Stone:  ['.........', '...###...', '..#####..', '.##.####.', '.######..', '########.', '#####.###', '.#######.', '.........'],
    Golem:  ['.#######.', '#########', '##.###.##', '##.###.##', '#########', '#.#####.#', '#.#...#.#', '#.#####.#', '.#######.'],
    Fire:   ['....#....', '...##....', '...###.#.', '..####.#.', '.#######.', '.###.###.', '.##...##.', '..#...#..', '...###...'],
    Water:  ['....#....', '....#....', '...###...', '..#####..', '.###.###.', '.##.####.', '.##.####.', '..#####..', '...###...'],
    Arcane: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'],
    Light:  ['#...#...#', '.#..#..#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#..#..#.', '#...#...#'],
    Animal: ['.##...##.', '.##...##.', '.........', '##.....##', '##.###.##', '..#####..', '.#######.', '.#######.', '..##.##..'],
    Ice:    ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
    Steel:  ['...#.#...', '.#######.', '.##...##.', '###.#.###', '.#.###.#.', '###.#.###', '.##...##.', '.#######.', '...#.#...'],
    Parasite: ['...###...', '..#...#..', '.#..#..#.', '.#.#.#.#.', '.#.#...#.', '.#..###..', '..#......', '...#.....', '....#....'],
    Eternal:  ['#########', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '..#.###..', '.#######.', '#########'],
    Sanguine: ['#########', '#########', '.#.....#.', '.##...##.', '..#...#..', '..#...#..', '.........', '..#...#..', '.........'],
    Curse:  ['....#....', '...#.#...', '..#...#..', '.#.###.#.', '#.##.##.#', '.#.###.#.', '..#...#..', '...#.#...', '....#....'],
    Nature: ['.........', '.#.....#.', '.#..#..#.', '.##.#.##.', '..#.#.#..', '..##.##..', '...###...', '...###...', '....#....'],
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

  MC.TAG_COLORS = { Insect: '#3aa63a', Ant: '#e2582a', Fungus: '#d03aa8', Undead: '#7a6c94', Infected: '#d03aa8', Stone: '#8a7a66', Golem: '#5f6f86',
    Fire: '#e8482a', Water: '#2a82e0', Arcane: '#9a4ae0', Light: '#e2b81e', Animal: '#b07a3a', Ice: '#4ac0e4', Steel: '#7a8aa0', Nature: '#46b034',
    Parasite: '#9aa82a', Curse: '#6a2a8a', Eternal: '#b8903a', Sanguine: '#b01e3a' };
  /** Renamed tags: old name → new name (applied to every card, including shared ones). */
  MC.TAG_ALIASES = { Grass: 'Nature' };
  /** Tag chip: icon only, the name slides out on hover. */
  MC.tagChip = t =>
    `<span class="tag" title="${MC.esc(t)}" style="--tc:${MC.TAG_COLORS[t] || '#555'}">${MC.icon(t)}<span class="tag-name">${MC.esc(t)}</span></span>`;

  MC.footChip = n =>
    `<span class="tag tag-fp" title="Footprint ${n}: blocks ${n - 1} neighbouring zone${n > 2 ? 's' : ''}">${MC.icon('foot')}<b>${n}</b></span>`;

  // Keywords that open an effect line ("SUMMON:" style in the reference UI).
  const KEYWORDS = ['Once per turn', 'On Summon', 'On Destroy', 'On Tribute', 'Blocker', 'Unblockable', 'Summon', 'Rubble', 'Excavate', 'Boss Zone',
    'On Attack', 'On Flip-Up', 'Start of your turn', 'End of your turn'];
  const KW_RE = new RegExp(`^(${KEYWORDS.join('|')})([:.])\\s*`, 'i');
  const byName = () => (MC._byName ||= Object.fromEntries(MC.CARDS.map(c => [c.name.toLowerCase(), c])));
  /** Escape text, turning "Card Name" references into pills in that card's type colour. */
  /**
   * Custom keyword pills anywhere in a line:
   *   [Any words]          pill in the default colour
   *   [Any words]{red}     pill in a named or #hex colour
   *   Word{red}            a single word as a coloured pill
   */
  const PILL_COLORS = {
    red: '#e8384c', orange: '#f08a2a', yellow: '#e0b81e', green: '#2fa84a', teal: '#26b8a6',
    blue: '#2f6be0', purple: '#8a4ad8', pink: '#e04cb8', brown: '#8a6a4a', gray: '#6a6a80', grey: '#6a6a80', black: '#2a2838',
  };
  const PILL_DEFAULT = '#4a5a8a';
  const pillDither = {};
  function customPill(label, color) {
    // [On Attack] etc. without a colour use that keyword's own default colours
    const slug = label.trim().toLowerCase().replace(/\s+/g, '-');
    if (!color && KW_COLORS[slug]) return `<b class="kw kw-${slug}">${MC.esc(label)}</b>`;
    let c = PILL_COLORS[(color || '').toLowerCase()];
    if (!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color || '')) c = color.length === 4 ? '#' + [...color.slice(1)].map(x => x + x).join('') : color;
    c ||= PILL_DEFAULT;
    pillDither[c] ||= MC.dither(c, shade(c, 1.35), 40, true);
    return `<b class="kw kw-custom" style="--d-kw:${pillDither[c]};--kw2:${shade(c, 1.35)}">${MC.esc(label)}</b>`;
  }
  const PILL_RE = /\[([^\]\n]+)\](?:\{(#?\w+)\})?|([A-Za-z0-9][\w'-]*)\{(#?\w+)\}/g;
  function withPills(text) {
    let out = '', last = 0;
    for (const m of text.matchAll(PILL_RE)) {
      out += MC.esc(text.slice(last, m.index)) + customPill(m[1] ?? m[3], m[2] ?? m[4]);
      last = m.index + m[0].length;
    }
    return out + MC.esc(text.slice(last));
  }

  function withRefs(text) {
    return text.split(/"([^"]+)"/).map((part, i) => {
      if (i % 2 === 0) return withPills(part);
      const c = byName()[part.toLowerCase()];
      return c ? `<b class="ref k-${c.kind}">${MC.esc(c.name)}</b>` : MC.esc(`"${part}"`);
    }).join('');
  }
  MC.formatLine = line => {
    const m = line.match(KW_RE);
    if (!m) return withRefs(line);
    const rest = line.slice(m[0].length);
    const slug = m[1].toLowerCase().replace(/\s+/g, '-');
    return `<b class="kw kw-${slug}">${MC.esc(m[1])}</b>${rest ? ' ' + withRefs(rest) : ''}`;
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

  /**
   * Ordered-dither gradient as a tiny PNG (Bayer 4×4). Vertical by default;
   * shown at 2× with image-rendering: pixelated so the dots stay square.
   */
  MC.dither = function (c1, c2, len, horizontal) {
    const cv = document.createElement('canvas');
    cv.width = horizontal ? len : 4; cv.height = horizontal ? 4 : len;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < len; i++) for (let j = 0; j < 4; j++) {
      const x = horizontal ? i : j, y = horizontal ? j : i;
      ctx.fillStyle = BAYER[y % 4][x % 4] < (i / (len - 1)) * 16 ? c2 : c1;
      ctx.fillRect(x, y, 1, 1);
    }
    return `url(${cv.toDataURL()})`;
  };

  /** Radial ordered dither: solid in the middle, fading to c2 toward the edges. */
  MC.ditherRadial = function (c1, c2, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - (w - 1) / 2) / (w / 2), dy = (y - (h - 1) / 2) / (h / 2);
      const t = Math.min(1, Math.max(0, (Math.hypot(dx, dy) / Math.SQRT2 - 0.3) / 0.62));
      ctx.fillStyle = BAYER[y % 4][x % 4] < t * 16 ? c2 : c1;
      ctx.fillRect(x, y, 1, 1);
    }
    return `url(${cv.toDataURL()})`;
  };
  const mix = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    return '#' + [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t).toString(16).padStart(2, '0')).join('');
  };
  const lighten = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * a).toString(16).padStart(2, '0')).join('');
  };

  const KW_COLORS = {
    'once-per-turn': ['#5a7cf0', '#9a5ee6'], 'on-summon': ['#2fa84a', '#26b8a6'],
    'on-destroy': ['#e8384c', '#f08a2a'], 'on-tribute': ['#e0a81e', '#f08a2a'],
    'summon': ['#8a4ad8', '#e04cb8'], 'rubble': ['#7a6a56', '#a8987c'], 'excavate': ['#a0702e', '#d8a03a'], 'boss-zone': ['#6a3ab8', '#b06ae8'],
    'on-attack': ['#d8342e', '#f07a2e'], 'on-flip-up': ['#1f8fb0', '#46d0c4'],
    'start-of-your-turn': ['#e0842a', '#f0c83a'], 'end-of-your-turn': ['#33408f', '#6a52c4'], 'blocker': ['#2f6be0', '#26b8a6'], 'unblockable': ['#f08a2a', '#e0b81e'],
  };
  (function injectDitherCSS() {
    const css = [];
    for (const [kind, k] of Object.entries(MC.KINDS)) {
      const light = lighten(k.frame, .5);
      css.push(`.k-${kind}{--d-body:${MC.ditherRadial(k.frame, light, 100, 140)};--d-body-sm:${MC.ditherRadial(k.frame, light, 40, 56)};` +
        `--d-wide:${MC.ditherRadial(k.frame, light, 120, 64)};--d-ref:${MC.dither(k.frame, shade(k.frame, .78), 40, true)};` +
        `--d-art:${MC.dither(k.pale, shade(k.frame, 1.12), 30)};--edge:${shade(k.frame, .62)};--art-c:${lighten(k.frame, .35)}}`);
    }
    for (const [slug, [a, b]] of Object.entries(KW_COLORS)) {
      css.push(`.kw-${slug}{--d-kw:${MC.dither(a, b, 40, true)};--kw2:${b}}`);
    }
    css.push(`:root{--d-atk:${MC.dither('#ffffff', '#ffc4cc', 10)};--d-def:${MC.dither('#ffffff', '#c4d6ff', 10)};--d-set:${MC.dither('#ffffff', '#ffe0b8', 10)}}`);
    document.head.insertAdjacentHTML('beforeend', `<style id="mc-dither">${css.join('')}</style>`);
  })();

  /** The tag that best identifies a card (sub-tags like Ant / Golem win over Insect / Stone). */
  /**
   * Monster backgrounds: a radial dither from the first tag's colour in the
   * centre out to the card-type colour at the edges. One CSS class per
   * type+tag pair, generated the first time it is needed.
   */
  const tagGradients = new Set();
  let tagSheet;
  MC.bodyClass = card => {
    const tag = (MC.isMonster(card) || card.kind === 'action') && card.tags?.[0];
    const tc = tag && MC.TAG_COLORS[tag];
    if (!tc) return '';
    const cls = `tg-${card.kind}-${tag.toLowerCase()}`;
    if (!tagGradients.has(cls)) {
      tagGradients.add(cls);
      // the tag colour is blended 45% over the card colour so it reads as a soft glow
      const frame = MC.KINDS[card.kind].frame, centre = mix(frame, tc, .45);
      tagSheet ||= document.head.appendChild(document.createElement('style'));
      tagSheet.textContent += `.card.${cls},.mini.${cls},.portrait.${cls}{` +
        `--d-body:${MC.ditherRadial(centre, frame, 100, 140)};--d-body-sm:${MC.ditherRadial(centre, frame, 40, 56)};` +
        `--d-wide:${MC.ditherRadial(centre, frame, 120, 64)}}`;
    }
    return cls;
  };

  MC.mainTag = card => {
    const t = card.tags || [];
    return ['Golem', 'Ant'].find(x => t.includes(x)) || t[0];
  };
  /** Icon used as a card's art while sprites are hidden: main tag for monsters, a type icon otherwise. */
  MC.artIcon = card => {
    if (MC.isMonster(card)) return MC.mainTag(card) || 'Insect';
    return { action: 'action', field: 'field', barrier: 'barrier' }[card.kind];
  };
  /** Art content: the sprite (when enabled, monsters only) or the outlined icon art. */
  MC.artHTML = function (card) {
    if (MC.SHOW_ART && MC.isMonster(card)) return `<img src="${MC.art(card)}" alt="">`;
    return `<span class="art-ph">${MC.icon(MC.artIcon(card))}</span>`;
  };

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
    const n = card.footprint || 1;
    return MC.isMonster(card) && n > 1 ? MC.footChip(n) : '';
  }

  /**
   * ATK and DEF each get their own box. With `tally`, the box shows one icon
   * per 1000 points (0–999: 1, 1000–1999: 2, …).
   */
  MC.statBoxes = (atk, def, cls = '', tally = false) => {
    const icons = (name, v) => `<i class="stat-icons">${MC.icon(name).repeat(tally ? Math.floor(Math.max(0, v) / 1000) + 1 : 1)}</i>`;
    return `<span class="stat stat-atk ${cls}" title="ATK ${atk}">${icons('atk', atk)}<b>${atk}</b></span>` +
      `<span class="stat stat-def ${cls}" title="DEF ${def}">${icons('def', def)}<b>${def}</b></span>`;
  };
  MC.costBadge = c => c.cost != null ? `<span class="c-cost" title="Charge Cost"><small>COST</small>${c.cost}</span>` : '';

  MC.setCostLabel = c => c.setCost == null ? '?' : '+' + c.setCost;

  function bottomBar(card) {
    if (MC.isMonster(card)) return `<div class="c-stats">${MC.statBoxes(card.atk, card.def, '', true)}</div>`;
    if (card.kind === 'action') {
      return `<div class="c-stats"><span class="stat stat-set" title="Extra cost when set and used on the opponent's turn">SET <b>${MC.setCostLabel(card)}</b></span></div>`;
    }
    return `<div class="c-stats c-stats-label"><span>${MC.esc(card.archetype || MC.KINDS[card.kind].long)}</span></div>`;
  }

  /** Full-size card. opts: { faceDown, extraClass } */
  MC.renderCard = function (card, opts = {}) {
    if (opts.faceDown) return MC.renderBack(MC.backOf(card), 'card ' + (opts.extraClass || ''));
    return `<div class="card k-${card.kind} ${MC.bodyClass(card)} ${opts.extraClass || ''}" data-card="${card.id}">
      <div class="c-head"><span class="c-name">${MC.esc(card.name)}</span>${card.charge != null ? MC.chargePips(card.charge, 'c-charge') : ''}${MC.costBadge(card)}</div>
      <div class="c-art ${MC.SHOW_ART && MC.isMonster(card) ? 'has-art' : ''}">${MC.artHTML(card)}</div>
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
    const cls = d => d > 0 ? 'up' : d < 0 ? 'down' : '';
    const stats = MC.isMonster(card)
      ? `<div class="m-stats">${MC.statBoxes(card.atk + (m.atk || 0), card.def + (m.def || 0))
          .replace('stat-atk ', `stat-atk ${cls(m.atk)} `).replace('stat-def ', `stat-def ${cls(m.def)} `)}</div>`
      : card.kind === 'action' ? `<div class="m-stats"><span class="stat stat-set">COST <b>${card.cost}</b></span></div>`
      : `<div class="m-stats m-label">${MC.KINDS[card.kind].label}</div>`;
    const ch = opts.charge ?? card.charge;
    const boosted = opts.charge != null && opts.charge !== card.charge;
    const charge = ch != null ? MC.chargePips(ch, `m-charge ${boosted ? 'up' : ''}`) : '';
    const tag = MC.mainTag(card);
    return `<div class="mini k-${card.kind} ${MC.bodyClass(card)} ${opts.extraClass || ''}" ${opts.attrs || ''}>
      <div class="m-name">${MC.esc(card.name)}</div>
      <div class="m-art ${MC.SHOW_ART && MC.isMonster(card) ? '' : 'no-art'}">${MC.artHTML(card)}${charge}
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
    if (MC.count(deck.extra) > 10) errors.push(`Extra Deck: ${MC.count(deck.extra)}/10`);   // an Extra Deck is optional
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
