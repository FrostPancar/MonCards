/*
 * Card Creator: design a card with a live preview.
 * Custom cards are kept in this browser (localStorage) and merged into the pool
 * on load; "Copy code" gives a snippet to paste into data/cards.js to make it permanent.
 */
(function () {
  const MC = window.MC;
  const STORE = 'mc-custom-cards';

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; } };
  const save = list => { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch (e) { return false; } };

  function reindex() {
    MC.byId = Object.fromEntries(MC.CARDS.map(c => [c.id, c]));
    MC._byName = null;
  }

  // Merge saved custom cards into the pool before any view renders.
  load().forEach(c => { c.custom = true; MC.CARDS.push(c); });
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
  const KNOWN_TAGS = Object.keys(MC.TAG_COLORS).filter(t => t !== 'Infected');

  /** Engine flags follow from the text, so keyword lines just work on the table. */
  function deriveFlags(text) {
    const lines = (text || '').split('\n').map(l => l.trim().toLowerCase());
    const flags = {};
    if (lines.some(l => l.startsWith('blocker'))) flags.blocker = true;
    if (lines.some(l => l.startsWith('unblockable'))) flags.unblockable = true;
    if (lines.some(l => l.startsWith('rubble:'))) flags.rubble = true;
    return Object.keys(flags).length ? flags : undefined;
  }

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card';
  function uniqueId(name, keep) {
    const base = slug(name);
    if (keep && (!MC.byId[keep] || MC.byId[keep].custom)) return keep;
    let id = base, n = 2;
    while (MC.byId[id]) id = `${base}-${n++}`;
    return id;
  }

  /** Read the form into a card object. */
  function readForm(form, id) {
    const v = n => form.elements[n]?.value ?? '';
    const num = n => v(n) === '' ? undefined : Number(v(n));
    const kind = v('kind');
    const on = f => FIELDS[f].includes(kind);
    const tags = [...form.querySelectorAll('[name=tag]:checked')].map(x => x.value)
      .concat(v('moreTags').split(',').map(t => t.trim()).filter(Boolean));
    const text = v('text').trim();
    const card = { id, name: v('name').trim() || 'Untitled', kind };
    if (on('atk')) { card.atk = num('atk') ?? 0; card.def = num('def') ?? 0; }
    if (on('charge')) card.charge = num('charge') ?? 0;
    if (on('cost')) card.cost = num('cost') ?? 0;
    if (on('setCost')) card.setCost = num('setCost') ?? null;
    if (on('footprint')) card.footprint = num('footprint') ?? 1;
    if (on('method')) card.method = v('method');
    if (on('archetype')) card.archetype = v('archetype').trim() || 'On Destroy';
    if (tags.length) card.tags = [...new Set(tags)];
    card.text = text;
    const flags = deriveFlags(text);
    if (flags) card.flags = flags;
    return card;
  }

  /** The card as a JS literal for data/cards.js. */
  function toCode(card) {
    const { custom, ...c } = card;
    return '  ' + JSON.stringify(c, null, 0)
      .replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/,(?=[a-z]+: )/g, ', ') + ',';
  }

  function field(label, html, f) {
    return `<label class="cc-field" ${f ? `data-for="${f}"` : ''}><span>${label}</span>${html}</label>`;
  }

  MC.Creator = {
    /** Open the creator. `base` pre-fills it (editing a custom card, or copying any card). */
    open(base, onSaved) {
      const editing = base?.custom ? base.id : null;
      const b = base || { kind: 'basic', name: '', atk: 1000, def: 1000, charge: 1, text: '' };
      const opt = (val, cur, label = val) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${label}</option>`;
      const box = MC.modal(`
        <span class="eyebrow">${editing ? 'Edit custom card' : base ? 'New card from a copy' : 'New card'}</span>
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
              ${field('Footprint', `<select name="footprint">${[1, 2, 3].map(n => opt(String(n), String(b.footprint ?? 1))).join('')}</select>`, 'footprint')}
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
              Put card names in "quotes" to turn them into pills.</p>
          </form>
          <div class="cc-preview">
            <div class="cc-card"></div>
            <div class="cc-actions">
              <button class="btn btn-hot" data-cc="save">${editing ? 'Save changes' : 'Add to card pool'}</button>
              <button class="btn" data-cc="copy">Copy code</button>
              ${editing ? '<button class="btn" data-cc="delete">Delete</button>' : ''}
            </div>
            <textarea class="cc-code" readonly rows="4" hidden></textarea>
            <p class="cc-note">Custom cards are saved in this browser. Use <b>Copy code</b> to add one to <code>data/cards.js</code> for good.</p>
          </div>
        </div>`, { wide: true });

      const form = box.querySelector('.cc-form');
      const preview = box.querySelector('.cc-card');
      const update = () => {
        const kind = form.elements.kind.value;
        form.querySelectorAll('[data-for]').forEach(el => { el.hidden = !FIELDS[el.dataset.for].includes(kind); });
        preview.innerHTML = MC.renderCard(readForm(form, editing || 'preview'), { extraClass: 'card-xl' });
      };
      form.addEventListener('input', update);
      form.addEventListener('submit', e => e.preventDefault());
      update();

      box.addEventListener('click', e => {
        const act = e.target.closest('[data-cc]')?.dataset.cc;
        if (!act) return;
        if (act === 'copy') {
          const code = toCode(readForm(form, uniqueId(form.elements.name.value, editing)));
          const ta = box.querySelector('.cc-code');
          ta.hidden = false; ta.value = code; ta.select();
          (navigator.clipboard?.writeText(code) || Promise.reject()).then(() => MC.toast('Card code copied'), () => MC.toast('Code shown below — copy it from there'));
          return;
        }
        const list = load();
        if (act === 'delete') {
          save(list.filter(c => c.id !== editing));
          MC.CARDS.splice(MC.CARDS.findIndex(c => c.id === editing), 1);
          reindex();
          MC.closeModal(); MC.toast('Card deleted'); onSaved?.();
          return;
        }
        if (!form.elements.name.value.trim()) { MC.toast('Give the card a name first'); form.elements.name.focus(); return; }
        const card = readForm(form, uniqueId(form.elements.name.value, editing));
        card.custom = true;
        const i = MC.CARDS.findIndex(c => c.id === editing);
        if (i > -1) MC.CARDS[i] = card; else MC.CARDS.push(card);
        const stored = list.filter(c => c.id !== editing && c.id !== card.id);
        stored.push(card);
        const ok = save(stored);
        reindex();
        MC.closeModal();
        MC.toast(ok ? `${card.name} saved` : `${card.name} added for this session (browser storage is blocked)`);
        onSaved?.(card);
      });
    },
  };
})();
