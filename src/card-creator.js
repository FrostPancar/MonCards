/*
 * Card Creator: design or edit a card with a live preview.
 *
 * Custom cards and edits to existing cards are shared by everyone who uses the
 * site: they live in a shared card store (/api/cards, a Netlify Function backed
 * by Netlify Blobs). This browser keeps a cached copy so the pool shows up
 * instantly and works offline; changes that can't reach the store wait in a
 * queue and are sent on the next sync. "Copy code" gives a snippet to paste
 * into data/cards.js to make a card permanent.
 */
(function () {
  const MC = window.MC;
  const API = '/api/cards';
  const CACHE_KEY = 'mc-shared-cards', QUEUE_KEY = 'mc-pending-card-ops';
  const LEGACY_NEW = 'mc-custom-cards', LEGACY_EDIT = 'mc-card-edits'; // pre-sharing, this-browser-only saves

  const read = (key, empty) => { try { return JSON.parse(localStorage.getItem(key) || empty); } catch (e) { return JSON.parse(empty); } };
  const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } };
  const drop = key => { try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ } };

  function reindex() {
    MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));
    MC._byName = null;
  }

  // Originals of the built-in cards, so edits can be reset and the pool rebuilt.
  const BASE = MC.CARDS.map(c => JSON.parse(JSON.stringify(c, (k, v) => v === Infinity ? 'Infinity' : v),
    (k, v) => v === 'Infinity' ? Infinity : v));
  const ORIGINAL = Object.fromEntries(BASE.map(c => [c.id, c]));

  const applyEdit = (c, e) => {
    const { _cleared = [], ...fields } = e;
    const card = { ...c, ...fields, edited: true };
    _cleared.forEach(k => delete card[k]);
    return card;
  };

  // ───────── shared state: { custom: Card[], edits: { [id]: Edit } } ─────────
  let shared = read(CACHE_KEY, '{"custom":[],"edits":{}}');
  let queue = read(QUEUE_KEY, '[]'); // [{ op: 'put' | 'delete', kind: 'custom' | 'edit', id, data? }]

  // One-time migration: cards saved before sharing existed get queued for upload.
  const legacyNew = read(LEGACY_NEW, '[]'), legacyEdit = read(LEGACY_EDIT, '{}');
  if (legacyNew.length || Object.keys(legacyEdit).length) {
    legacyNew.forEach(({ custom, ...c }) => queue.push({ op: 'put', kind: 'custom', id: c.id, data: c }));
    Object.entries(legacyEdit).forEach(([id, e]) => queue.push({ op: 'put', kind: 'edit', id, data: e }));
    write(QUEUE_KEY, queue); drop(LEGACY_NEW); drop(LEGACY_EDIT);
  }

  /** Apply a change to the local copy of the shared state. */
  function applyOp(state, { op, kind, id, data }) {
    if (kind === 'custom') {
      state.custom = state.custom.filter(c => c.id !== id);
      if (op === 'put') state.custom.push(data);
    } else if (op === 'put') state.edits[id] = data;
    else delete state.edits[id];
  }

  const listeners = [];
  /** Views register here to re-render when the shared pool changes (e.g. someone else's card arrives). */
  MC.onCardsChanged = fn => listeners.push(fn);

  /** Rebuild MC.CARDS in place: built-ins (with edits) followed by custom cards. */
  function rebuild() {
    const view = JSON.parse(JSON.stringify(shared));
    queue.forEach(o => applyOp(view, o)); // show not-yet-sent changes too
    // renamed tags (e.g. Grass → Nature) are mapped on every card, including ones already shared
    const norm = c => c.tags?.some(t => MC.TAG_ALIASES[t])
      ? { ...c, tags: [...new Set(c.tags.map(t => MC.TAG_ALIASES[t] || t))] } : c;
    MC.CARDS.splice(0, MC.CARDS.length,
      ...BASE.map(c => norm(view.edits[c.id] ? applyEdit(c, view.edits[c.id]) : c)),
      ...view.custom.filter(c => !ORIGINAL[c.id]).map(c => norm({ ...c, custom: true })));
    reindex();
  }
  rebuild();

  const online = () => /^https?:$/.test(location.protocol);
  async function send({ op, kind, id, data }) {
    const res = op === 'put'
      ? await fetch(API, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, id, data }) })
      : await fetch(`${API}?kind=${kind}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      err.rejected = res.status === 400; // the store refused it; retrying won't help
      throw err;
    }
  }

  /** Send queued changes, then pull the latest shared pool. Returns true when the store was reached. */
  let syncing = null;
  MC.syncCards = function () {
    if (!online()) return Promise.resolve(false);
    return (syncing ||= (async () => {
      try {
        while (queue.length) {
          try { await send(queue[0]); } catch (e) { if (!e.rejected) throw e; console.warn('Card change rejected:', e.message); }
          queue.shift(); write(QUEUE_KEY, queue);
        }
        const res = await fetch(API, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = await res.json();
        const changed = JSON.stringify(next) !== JSON.stringify(shared);
        shared = next; write(CACHE_KEY, shared);
        if (changed) { rebuild(); listeners.forEach(fn => fn()); }
        return true;
      } catch (e) {
        console.warn('Card store unreachable, working from this device:', e.message);
        return false;
      } finally { syncing = null; }
    })());
  };

  /** Record a change locally, then try to share it. Resolves true once it has reached the shared store. */
  async function commit(op) {
    queue.push(op); write(QUEUE_KEY, queue);
    rebuild();
    return MC.syncCards();
  }

  // Pull everyone's cards on load and whenever the tab comes back into view.
  MC.syncCards();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) MC.syncCards(); });

  const MONSTER = ['basic', 'tribute', 'extra', 'boss'];
  const FIELDS = {
    atk: MONSTER, def: MONSTER,
    charge: ['basic', 'tribute', 'action'],
    cost: ['tribute', 'action'],
    setCost: ['action'],
    footprint: ['tribute', 'extra', 'boss'],
    method: ['extra'],
    archetype: ['barrier'],
  };
  // Stats the form owns: cleared from an edited card when its new type doesn't use them.
  const FORM_KEYS = ['atk', 'def', 'charge', 'cost', 'setCost', 'footprint', 'method', 'archetype', 'tags', 'roles', 'text'];
  const KNOWN_TAGS = Object.keys(MC.TAG_COLORS).filter(t => t !== 'Infected');
  const TEXT_FLAGS = ['blocker', 'unblockable', 'rubble'];

  /** Engine flags that follow from the text, so keyword lines just work on the table. */
  function deriveFlags(text, base = {}) {
    const lines = (text || '').split('\n').map(l => l.trim().toLowerCase());
    const flags = Object.fromEntries(Object.entries(base).filter(([k]) => !TEXT_FLAGS.includes(k)));
    if (lines.some(l => l.startsWith('blocker'))) flags.blocker = true;
    if (lines.some(l => l.startsWith('unblockable'))) flags.unblockable = true;
    if (lines.some(l => l.startsWith('rubble:'))) flags.rubble = true;
    return Object.keys(flags).length ? flags : undefined;
  }

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card';
  /** New cards get a short random suffix so two people naming a card the same way don't collide. */
  function newId(name) {
    const base = slug(name).slice(0, 60);
    let id;
    do id = `${base}-${Math.random().toString(36).slice(2, 6)}`; while (MC.byId[id]);
    return id;
  }

  /** Tags ticked or typed in the form, in the order the user arranged them (first tag drives art and colour). */
  function selectedTags(form) {
    return [...new Set([...form.querySelectorAll('[name=tag]:checked')].map(x => x.value)
      .concat((form.elements.moreTags?.value || '').split(',').map(t => t.trim()).filter(Boolean)))];
  }
  function orderedTags(form) {
    const sel = selectedTags(form);
    let order = [];
    try { order = JSON.parse(form.elements.tagOrder?.value || '[]'); } catch (e) { /* malformed: fall back to selection order */ }
    return order.filter(t => sel.includes(t)).concat(sel.filter(t => !order.includes(t)));
  }

  /** Read the form into card fields (only what the form controls). */
  function readForm(form) {
    const v = n => form.elements[n]?.value ?? '';
    const num = n => v(n) === '' ? undefined : Number(v(n));
    const kind = v('kind');
    const on = f => FIELDS[f].includes(kind);
    const tags = orderedTags(form);
    const card = { name: v('name').trim() || 'Untitled', kind };
    if (on('atk')) { card.atk = num('atk') ?? 0; card.def = num('def') ?? 0; }
    if (on('charge')) card.charge = num('charge') ?? 0;
    if (on('cost')) card.cost = num('cost') ?? 0;
    if (on('setCost')) card.setCost = num('setCost') ?? null;
    if (on('footprint')) card.footprint = num('footprint') ?? 1;
    if (on('method')) card.method = v('method');
    if (on('archetype')) card.archetype = v('archetype').trim() || 'On Destroy';
    if (tags.length) card.tags = [...new Set(tags)];
    const roles = Object.keys(MC.ROLES).filter(r => form.querySelector(`[name=role][value="${r}"]`)?.checked);
    if (roles.length) card.roles = roles;
    card.text = v('text').trim();
    return card;
  }

  /** Combine form fields with the card being edited, keeping engine extras (charge bonuses, auras…). */
  function build(form, id, base) {
    const f = readForm(form);
    const kept = base ? Object.fromEntries(Object.entries(base).filter(([k]) => !FORM_KEYS.includes(k) && !['edited', 'custom'].includes(k))) : {};
    const card = { ...kept, ...f, id };
    const flags = deriveFlags(f.text, base?.flags);
    if (flags) card.flags = flags; else delete card.flags;
    return card;
  }

  /** The card as a JS literal for data/cards.js. */
  function toCode(card) {
    const { custom, edited, createdAt, updatedAt, ...c } = card;
    return '  ' + JSON.stringify(c, (k, v) => v === Infinity ? '__INF__' : v)
      .replace(/"__INF__"/g, 'Infinity')
      .replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/,(?=[a-z]+: )/g, ', ') + ',';
  }

  function field(label, html, f) {
    return `<label class="cc-field" ${f ? `data-for="${f}"` : ''}><span>${label}</span>${html}</label>`;
  }

  MC.Creator = {
    /**
     * Open the creator.
     *   open()                  — a brand-new card
     *   open(card, cb, 'edit')  — edit that card in place (any card)
     *   open(card, cb, 'copy')  — a new card pre-filled from that card
     */
    open(base, onSaved, mode = base ? 'edit' : 'new') {
      const editing = mode === 'edit' ? base.id : null;
      const builtin = editing && !base.custom;
      const b = base ? { ...base, name: mode === 'copy' ? base.name + ' Copy' : base.name }
        : { kind: 'basic', name: '', atk: 1000, def: 1000, charge: 1, text: '' };
      const opt = (val, cur, label = val) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${label}</option>`;
      const canReset = builtin && base.edited;
      const box = MC.modal(`
        <span class="eyebrow">${editing ? (builtin ? 'Edit card' : 'Edit custom card') : mode === 'copy' ? 'New card from a copy' : 'New card'}</span>
        <h2>Card Creator</h2>
        <div class="creator">
          <form class="cc-form" autocomplete="off">
            ${field('Name', `<input name="name" value="${MC.esc(b.name)}" maxlength="32" placeholder="Card name">`)}
            ${field('Type', `<select name="kind">${MC.KIND_ORDER.map(k => opt(k, b.kind, MC.KINDS[k].long)).join('')}</select>`)}
            <div class="cc-row">
              ${field('ATK', `<input name="atk" type="number" step="100" min="0" value="${b.atk ?? 1000}">`, 'atk')}
              ${field('DEF', `<input name="def" type="number" step="100" min="0" value="${b.def ?? 1000}">`, 'def')}
            </div>
            <div class="cc-row">
              ${field('Charge', `<input name="charge" type="number" min="0" max="12" value="${b.charge ?? 1}">`, 'charge')}
              ${field('Charge Cost', `<input name="cost" type="number" min="0" max="30" value="${b.cost ?? 5}">`, 'cost')}
              ${field('Set cost +', `<input name="setCost" type="number" min="0" value="${b.setCost ?? ''}" placeholder="?">`, 'setCost')}
              ${field('Footprint', `<select name="footprint">${[1, 2, 3, 4, 5, 6].map(n => opt(String(n), String(b.footprint ?? 1))).join('')}</select>`, 'footprint')}
            </div>
            ${field('Summon style', `<select name="method">${['fusion', 'formation', 'charge', 'special', 'trigger'].map(m => opt(m, b.method ?? 'formation')).join('')}</select>`, 'method')}
            ${field('Archetype', `<input name="archetype" value="${MC.esc(b.archetype ?? '')}" placeholder="On Destroy, Blocker, Tag Bonus…">`, 'archetype')}
            <fieldset class="cc-tags"><legend>Tags</legend>
              <input type="hidden" name="tagOrder" value="${MC.esc(JSON.stringify(b.tags || []))}">
              <div class="cc-order" aria-label="Tag order"></div>
              ${KNOWN_TAGS.map(t => `<label class="cc-tag"><input type="checkbox" name="tag" value="${t}" ${(b.tags || []).includes(t) ? 'checked' : ''}>${MC.tagChip(t)}<span>${t}</span></label>`).join('')}
              <input name="moreTags" placeholder="Other tags, comma separated" value="${MC.esc((b.tags || []).filter(t => !KNOWN_TAGS.includes(t)).join(', '))}">
            </fieldset>
            <fieldset class="cc-tags cc-roles"><legend>Roles <small>(playstyle, for the Deck Builder's flavor chart)</small></legend>
              ${Object.entries(MC.ROLES).map(([r, d]) => `<label class="cc-tag" title="${MC.esc(d)}"><input type="checkbox" name="role" value="${r}" ${(b.roles || []).includes(r) ? 'checked' : ''}><span>${r}</span></label>`).join('')}
            </fieldset>
            ${field('Effect text', `<textarea name="text" rows="5" placeholder="On Summon: draw 1.">${MC.esc(b.text || '')}</textarea>`)}
            <p class="cc-help">One effect per line. Start a line with <b>Once per turn:</b>, <b>On Summon:</b>, <b>On Destroy:</b>,
              <b>On Tribute:</b>, <b>On Attack:</b>, <b>On Flip-Up:</b>, <b>Start of your turn:</b>, <b>End of your turn:</b>, <b>Summon:</b>, <b>Rubble:</b>, <b>Boss Zone:</b>, <b>Blocker.</b> or <b>Unblockable.</b> for a keyword pill.
              Put card names in "quotes" to turn them into pills.
              Make any word a keyword with <b>[Brackets]</b>, add a colour with <b>[Two Words]{red}</b>, or put a colour after a single word: <b>Frenzy{purple}</b>.
              Colours: red, orange, yellow, green, teal, blue, purple, pink, brown, gray, black or a #hex code.</p>
          </form>
          <div class="cc-preview">
            <div class="cc-card"></div>
            <div class="cc-actions">
              <button class="btn btn-hot" data-cc="save">${editing ? 'Save changes' : 'Add to card pool'}</button>
              <button class="btn" data-cc="copy">Copy code</button>
              ${editing && !builtin ? '<button class="btn" data-cc="delete">Delete</button>' : ''}
              ${canReset ? '<button class="btn" data-cc="reset">Reset to original</button>' : ''}
            </div>
            <textarea class="cc-code" readonly rows="4" hidden></textarea>
            <p class="cc-note">${builtin
              ? 'Edits are shared with everyone using the site and apply to decks on the table too. Use <b>Copy code</b> to update <code>data/cards.js</code> for good.'
              : 'Custom cards are shared with everyone using the site. Use <b>Copy code</b> to add one to <code>data/cards.js</code> for good.'}</p>
          </div>
        </div>`, { wide: true });

      const form = box.querySelector('.cc-form');
      const preview = box.querySelector('.cc-card');
      const current = () => build(form, editing || 'preview', editing ? base : null);
      // Tag order row: drag a tag icon to choose which tag comes first (pointer events, so touch works too).
      const orderBox = form.querySelector('.cc-order');
      const setOrder = tags => { form.elements.tagOrder.value = JSON.stringify(tags); };
      const renderOrder = () => {
        const tags = orderedTags(form);
        setOrder(tags);
        orderBox.innerHTML = tags.length
          ? `<span class="cc-order-label">Order</span>` + tags.map(t => `<span class="cc-ord" data-tag="${MC.esc(t)}">${MC.tagChip(t)}</span>`).join('')
          : '<span class="cc-order-label">Pick tags below — drag to reorder; the first sets the card art and colour.</span>';
      };
      let held = null; // { el, ghost, dx, dy }
      orderBox.addEventListener('pointerdown', e => {
        const el = e.target.closest('.cc-ord');
        if (!el || e.button !== 0) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.classList.add('cc-ord-ghost');
        Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' });
        document.body.appendChild(ghost);
        el.classList.add('cc-ord-held');
        held = { el, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top };
        orderBox.classList.add('dragging');
        orderBox.setPointerCapture(e.pointerId);
      });
      orderBox.addEventListener('pointermove', e => {
        if (!held) return;
        held.ghost.style.left = (e.clientX - held.dx) + 'px';
        held.ghost.style.top = (e.clientY - held.dy) + 'px';
        // live preview: move the held tag in the row to where it would land
        const others = [...orderBox.querySelectorAll('.cc-ord')].filter(x => x !== held.el);
        const next = others.find(x => { const r = x.getBoundingClientRect(); return e.clientY < r.bottom && e.clientX < r.left + r.width / 2 || e.clientY < r.top; });
        const before = held.el.nextElementSibling;
        if (next) { if (before !== next) orderBox.insertBefore(held.el, next); }
        else if (orderBox.lastElementChild !== held.el) orderBox.appendChild(held.el);
        if (held.el.nextElementSibling !== before) { // order changed: preview the card with it too
          setOrder([...orderBox.querySelectorAll('.cc-ord')].map(x => x.dataset.tag));
          update();
        }
      });
      const drop = () => {
        if (!held) return;
        held.ghost.remove();
        orderBox.classList.remove('dragging');
        held.el.classList.remove('cc-ord-held');
        held = null;
        setOrder([...orderBox.querySelectorAll('.cc-ord')].map(x => x.dataset.tag));
        update();
      };
      orderBox.addEventListener('pointerup', drop);
      orderBox.addEventListener('pointercancel', drop);

      const update = () => {
        const kind = form.elements.kind.value;
        form.querySelectorAll('[data-for]').forEach(el => { el.hidden = !FIELDS[el.dataset.for].includes(kind); });
        preview.innerHTML = MC.renderCard(current(), { extraClass: 'card-xl' });
      };
      form.addEventListener('input', e => { if (e.target.matches('[name=tag], [name=moreTags]')) renderOrder(); update(); });
      renderOrder();
      form.addEventListener('submit', e => e.preventDefault());
      update();

      /** Close the creator now; tell the user whether the change reached everyone. */
      const finish = (card, label, pending) => {
        MC.closeModal(); onSaved?.(card);
        pending.then(shared => MC.toast(shared ? `${label} — shared with everyone`
          : `${label} on this device — it will be shared when the card server is reachable`));
      };

      box.addEventListener('click', e => {
        const act = e.target.closest('[data-cc]')?.dataset.cc;
        if (!act) return;
        if (act === 'copy') {
          const code = toCode(build(form, editing || newId(form.elements.name.value), editing ? base : null));
          const ta = box.querySelector('.cc-code');
          ta.hidden = false; ta.value = code; ta.select();
          (navigator.clipboard?.writeText(code) || Promise.reject()).then(() => MC.toast('Card code copied'), () => MC.toast('Code shown below — copy it from there'));
          return;
        }
        if (act === 'delete') {
          finish(null, `${base.name} deleted`, commit({ op: 'delete', kind: 'custom', id: editing }));
          return;
        }
        if (act === 'reset') {
          finish(ORIGINAL[editing], `${ORIGINAL[editing].name} reset`, commit({ op: 'delete', kind: 'edit', id: editing }));
          return;
        }
        // save
        if (!form.elements.name.value.trim()) { MC.toast('Give the card a name first'); form.elements.name.focus(); return; }
        if (builtin) {
          const card = { ...build(form, editing, ORIGINAL[editing]), edited: true };
          const { id, edited, ...fields } = card;
          // store only the form-owned fields (and flags) so engine extras still come from data/cards.js
          const edit = Object.fromEntries(Object.entries(fields).filter(([k]) => FORM_KEYS.includes(k) || ['name', 'kind', 'flags'].includes(k)));
          edit._cleared = FORM_KEYS.filter(k => !(k in fields)); // e.g. ATK after turning a monster into an Action
          edit.updatedAt = Date.now(); // the store re-stamps this with server time
          finish(card, `${card.name} updated`, commit({ op: 'put', kind: 'edit', id: editing, data: edit }));
          return;
        }
        const { custom, ...card } = build(form, editing || newId(form.elements.name.value), editing ? base : null);
        card.updatedAt = Date.now(); // the store re-stamps these with server time
        if (!editing) card.createdAt = card.updatedAt;
        finish(card, `${card.name} saved`, commit({ op: 'put', kind: 'custom', id: card.id, data: card }));
      });
    },
  };
})();
