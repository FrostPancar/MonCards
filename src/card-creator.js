/*
 * Card Creator: design or edit a card with a live preview.
 *
 * Two kinds of saved changes live in this browser (localStorage):
 *   - new cards made in the creator (shown with a "Custom" badge), and
 *   - edits to existing cards, stored as overrides keyed by card id.
 * Both are merged into the pool on load. "Copy code" gives a snippet to paste
 * into data/cards.js to make a card permanent.
 */
(function () {
  const MC = window.MC;
  const NEW_KEY = 'mc-custom-cards', EDIT_KEY = 'mc-card-edits';

  const read = (key, empty) => { try { return JSON.parse(localStorage.getItem(key) || empty); } catch (e) { return JSON.parse(empty); } };
  const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } };

  function reindex() {
    MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));
    MC._byName = null;
  }

  // Originals of the built-in cards, so edits can be reset.
  const ORIGINAL = Object.fromEntries(MC.CARDS.map(c => [c.id, JSON.parse(JSON.stringify(c, (k, v) => v === Infinity ? 'Infinity' : v),
    (k, v) => v === 'Infinity' ? Infinity : v)]));

  // Merge saved edits and new cards into the pool before any view renders.
  const edits = read(EDIT_KEY, '{}');
  const applyEdit = (c, e) => {
    const { _cleared = [], ...fields } = e;
    const card = { ...c, ...fields, edited: true };
    _cleared.forEach(k => delete card[k]);
    return card;
  };
  MC.CARDS.forEach((c, i) => { if (edits[c.id]) MC.CARDS[i] = applyEdit(c, edits[c.id]); });
  read(NEW_KEY, '[]').forEach(c => { c.custom = true; MC.CARDS.push(c); });
  reindex();

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
  const FORM_KEYS = ['atk', 'def', 'charge', 'cost', 'setCost', 'footprint', 'method', 'archetype', 'tags', 'text'];
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
  function newId(name) {
    const base = slug(name);
    let id = base, n = 2;
    while (MC.byId[id]) id = `${base}-${n++}`;
    return id;
  }

  /** Read the form into card fields (only what the form controls). */
  function readForm(form) {
    const v = n => form.elements[n]?.value ?? '';
    const num = n => v(n) === '' ? undefined : Number(v(n));
    const kind = v('kind');
    const on = f => FIELDS[f].includes(kind);
    const tags = [...form.querySelectorAll('[name=tag]:checked')].map(x => x.value)
      .concat(v('moreTags').split(',').map(t => t.trim()).filter(Boolean));
    const card = { name: v('name').trim() || 'Untitled', kind };
    if (on('atk')) { card.atk = num('atk') ?? 0; card.def = num('def') ?? 0; }
    if (on('charge')) card.charge = num('charge') ?? 0;
    if (on('cost')) card.cost = num('cost') ?? 0;
    if (on('setCost')) card.setCost = num('setCost') ?? null;
    if (on('footprint')) card.footprint = num('footprint') ?? 1;
    if (on('method')) card.method = v('method');
    if (on('archetype')) card.archetype = v('archetype').trim() || 'On Destroy';
    if (tags.length) card.tags = [...new Set(tags)];
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
    const { custom, edited, ...c } = card;
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
              ${KNOWN_TAGS.map(t => `<label class="cc-tag"><input type="checkbox" name="tag" value="${t}" ${(b.tags || []).includes(t) ? 'checked' : ''}>${MC.tagChip(t)}<span>${t}</span></label>`).join('')}
              <input name="moreTags" placeholder="Other tags, comma separated" value="${MC.esc((b.tags || []).filter(t => !KNOWN_TAGS.includes(t)).join(', '))}">
            </fieldset>
            ${field('Effect text', `<textarea name="text" rows="5" placeholder="On Summon: draw 1.">${MC.esc(b.text || '')}</textarea>`)}
            <p class="cc-help">One effect per line. Start a line with <b>Once per turn:</b>, <b>On Summon:</b>, <b>On Destroy:</b>,
              <b>On Tribute:</b>, <b>Summon:</b>, <b>Rubble:</b>, <b>Boss Zone:</b>, <b>Blocker.</b> or <b>Unblockable.</b> for a keyword pill.
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
              ? 'Edits are saved in this browser and apply everywhere, including decks on the table. Use <b>Copy code</b> to update <code>data/cards.js</code> for good.'
              : 'Custom cards are saved in this browser. Use <b>Copy code</b> to add one to <code>data/cards.js</code> for good.'}</p>
          </div>
        </div>`, { wide: true });

      const form = box.querySelector('.cc-form');
      const preview = box.querySelector('.cc-card');
      const current = () => build(form, editing || 'preview', editing ? base : null);
      const update = () => {
        const kind = form.elements.kind.value;
        form.querySelectorAll('[data-for]').forEach(el => { el.hidden = !FIELDS[el.dataset.for].includes(kind); });
        preview.innerHTML = MC.renderCard(current(), { extraClass: 'card-xl' });
      };
      form.addEventListener('input', update);
      form.addEventListener('submit', e => e.preventDefault());
      update();

      const finish = (card, msg) => { reindex(); MC.closeModal(); MC.toast(msg); onSaved?.(card); };

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
          write(NEW_KEY, read(NEW_KEY, '[]').filter(c => c.id !== editing));
          MC.CARDS.splice(MC.CARDS.findIndex(c => c.id === editing), 1);
          finish(null, 'Card deleted');
          return;
        }
        if (act === 'reset') {
          const all = read(EDIT_KEY, '{}'); delete all[editing]; write(EDIT_KEY, all);
          MC.CARDS[MC.CARDS.findIndex(c => c.id === editing)] = ORIGINAL[editing];
          finish(ORIGINAL[editing], `${ORIGINAL[editing].name} reset`);
          return;
        }
        // save
        if (!form.elements.name.value.trim()) { MC.toast('Give the card a name first'); form.elements.name.focus(); return; }
        let ok;
        if (builtin) {
          const card = { ...build(form, editing, ORIGINAL[editing]), edited: true };
          const all = read(EDIT_KEY, '{}');
          const { id, edited, ...fields } = card;
          // store only the form-owned fields (and flags) so engine extras still come from data/cards.js
          all[editing] = Object.fromEntries(Object.entries(fields).filter(([k]) => FORM_KEYS.includes(k) || ['name', 'kind', 'flags'].includes(k)));
          all[editing]._cleared = FORM_KEYS.filter(k => !(k in fields)); // e.g. ATK after turning a monster into an Action
          ok = write(EDIT_KEY, all);
          MC.CARDS[MC.CARDS.findIndex(c => c.id === editing)] = card;
          finish(card, ok ? `${card.name} updated` : `${card.name} updated for this session (browser storage is blocked)`);
          return;
        }
        const card = { ...build(form, editing || newId(form.elements.name.value), editing ? base : null), custom: true };
        const stored = read(NEW_KEY, '[]').filter(c => c.id !== card.id);
        stored.push(card);
        ok = write(NEW_KEY, stored);
        const i = MC.CARDS.findIndex(c => c.id === card.id);
        if (i > -1) MC.CARDS[i] = card; else MC.CARDS.push(card);
        finish(card, ok ? `${card.name} saved` : `${card.name} added for this session (browser storage is blocked)`);
      });
    },
  };
})();
