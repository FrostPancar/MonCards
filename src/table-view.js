/*
 * Play Table: a hot-seat mockup of a duel on a 3D pixel table.
 * Enforces the basics (zones, footprint, charge costs, battle damage, turn-1
 * restrictions); card effects are applied by hand using the inspector controls.
 */
(function () {
  const MC = window.MC;
  const PHASES = ['Draw', 'Standby', 'Main', 'Battle', 'End'];
  const MON_ZONES = 6, ACT_ZONES = 3;

  let uidSeq = 1;
  const mk = id => ({ uid: uidSeq++, id, card: MC.byId[id], mods: { atk: 0, def: 0, charge: 0 }, infected: false });
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let S, root;

  // ───────────────────────── State ─────────────────────────
  function newPlayer(deckKey, name) {
    const d = MC.DECKS[deckKey];
    return {
      name, deckKey, lp: 6000,
      deck: shuffle(MC.expand(d.main).map(mk)),
      hand: [], gy: [],
      extra: MC.expand(d.extra).map(mk),
      fieldDeck: d.field.map(mk),
      monsters: [],                       // { inst, at } — `at` is the leftmost zone covered
      actions: Array(ACT_ZONES).fill(null), // { inst, faceDown }
      field: null,                        // { inst, faceDown }
      barriers: d.barriers.map(id => ({ inst: mk(id), faceDown: false })),
      boss: mk(d.boss),                   // in the Boss Zone; null while on the field
      attacked: new Set(),
    };
  }

  function newDuel(deckA, deckB) {
    S = {
      turn: 1, active: 0, phase: 0,
      players: [newPlayer(deckA, 'Player 1'), newPlayer(deckB, 'Player 2')],
      sel: null, hover: null, mode: null, prompt: null, peek: [false, false], log: [], over: false,
    };
    S.players.forEach(p => { for (let i = 0; i < 7; i++) draw(p, true); });
    log('Duel start. All cards revealed. Barriers and Bosses placed face-up.');
  }

  const P = i => S.players[i];
  const opp = i => 1 - i;
  const log = msg => { S.log.unshift(msg); S.log.length = Math.min(S.log.length, 80); };
  const charge = inst => (inst.card.charge || 0) + inst.mods.charge;
  const atk = inst => inst.card.atk + inst.mods.atk;
  const def = inst => inst.card.def + inst.mods.def;
  const fp = card => card.footprint || 1;

  function draw(p, silent) {
    if (!p.deck.length) { MC.toast(`${p.name}'s deck is empty`); return; }
    p.hand.push(p.deck.pop());
    if (!silent) log(`${p.name} draws a card.`);
  }

  function occupancy(p) {
    const occ = Array(MON_ZONES).fill(-1);
    p.monsters.forEach((m, idx) => { for (let k = 0; k < fp(m.inst.card); k++) occ[m.at + k] = idx; });
    return occ;
  }
  function freeStarts(p, n) {
    const occ = occupancy(p), out = [];
    for (let at = 0; at + n <= MON_ZONES; at++) if (occ.slice(at, at + n).every(v => v === -1)) out.push(at);
    return out;
  }

  /** Find an instance anywhere on the table. */
  function locate(uid) {
    for (let pi = 0; pi < 2; pi++) {
      const p = P(pi);
      let i;
      if ((i = p.hand.findIndex(x => x.uid === uid)) > -1) return { pi, where: 'hand', i, inst: p.hand[i] };
      if ((i = p.monsters.findIndex(m => m.inst.uid === uid)) > -1) return { pi, where: 'mon', i, inst: p.monsters[i].inst };
      if ((i = p.actions.findIndex(a => a && a.inst.uid === uid)) > -1) return { pi, where: 'act', i, inst: p.actions[i].inst, slot: p.actions[i] };
      if ((i = p.barriers.findIndex(b => b.inst.uid === uid)) > -1) return { pi, where: 'bar', i, inst: p.barriers[i].inst, slot: p.barriers[i] };
      if (p.field && p.field.inst.uid === uid) return { pi, where: 'field', inst: p.field.inst, slot: p.field };
      if (p.boss && p.boss.uid === uid) return { pi, where: 'boss', inst: p.boss };
      if ((i = p.gy.findIndex(x => x.uid === uid)) > -1) return { pi, where: 'gy', i, inst: p.gy[i] };
      if ((i = p.extra.findIndex(x => x.uid === uid)) > -1) return { pi, where: 'extra', i, inst: p.extra[i] };
      if ((i = p.fieldDeck.findIndex(x => x.uid === uid)) > -1) return { pi, where: 'fdeck', i, inst: p.fieldDeck[i] };
      if ((i = p.deck.findIndex(x => x.uid === uid)) > -1) return { pi, where: 'deck', i, inst: p.deck[i] };
    }
    return null;
  }

  function reset(inst) { inst.mods = { atk: 0, def: 0, charge: 0 }; inst.infected = false; return inst; }

  /** Remove a monster from the field. Bosses go home, everything else to the GY. */
  function removeMonster(pi, uid, verb) {
    const p = P(pi), idx = p.monsters.findIndex(m => m.inst.uid === uid);
    if (idx < 0) return null;
    const [{ inst }] = p.monsters.splice(idx, 1);
    reset(inst);
    if (inst.card.kind === 'boss') { p.boss = inst; log(`${inst.card.name} ${verb} — returns to the Boss Zone.`); }
    else { p.gy.push(inst); log(`${inst.card.name} ${verb} — sent to the GY.`); }
    if (S.sel === uid) S.sel = null;
    maybeRemainsPrompt(pi, inst);
    return inst;
  }

  function maybeRemainsPrompt(pi, inst) {
    const p = P(pi);
    const insect = (inst.card.tags || []).includes('Insect') && inst.id !== 'insect-remains';
    const remains = p.extra.find(x => x.id === 'insect-remains');
    if (!insect || !remains) return;
    S.prompt = {
      text: `${p.name}: ${inst.card.name} left the field. Summon 1 Insect Remains?`,
      buttons: [
        { label: 'Summon', run: () => startPlace(pi, remains, 'mon', { from: 'extra', note: 'Insect Remains crawls out.' }) },
        { label: 'Skip', run: () => {} },
      ],
    };
  }

  function lpLossFor(inst) {
    if (inst.card.flags?.noBattleLpLoss) return 0;
    return ['tribute', 'boss'].includes(inst.card.kind) ? 1000 : 500;
  }
  function loseLp(pi, n, why) {
    if (!n) return;
    P(pi).lp = Math.max(0, P(pi).lp - n);
    log(`${P(pi).name} loses ${n} LP (${why}).`);
    if (P(pi).lp === 0 && !S.over) {
      S.over = true;
      setTimeout(() => MC.modal(`<div class="win"><span class="eyebrow">Duel over</span>
        <h2>${MC.esc(P(opp(pi)).name)} wins!</h2>
        <button class="btn btn-hot" data-close>Close</button></div>`), 50);
    }
  }

  // ───────────────────────── Modes ─────────────────────────
  function startPlace(pi, inst, zone, opts = {}) {
    const p = P(pi);
    if (zone === 'mon') {
      const n = fp(inst.card);
      if (!freeStarts(p, n).length) { MC.toast(`No room: needs ${n} adjacent free Monster Zone${n > 1 ? 's' : ''}`); return; }
      S.mode = { type: 'place', pi, uid: inst.uid, zone, n, ...opts };
    } else {
      if (!p.actions.includes(null)) { MC.toast('No free Action Zone'); return; }
      S.mode = { type: 'place', pi, uid: inst.uid, zone, ...opts };
    }
  }

  function finishPlace(slot) {
    const m = S.mode, p = P(m.pi), loc = locate(m.uid);
    const inst = loc.inst;
    // detach from where it came from
    if (loc.where === 'hand') p.hand.splice(loc.i, 1);
    else if (loc.where === 'extra') p.extra.splice(loc.i, 1);
    else if (loc.where === 'gy') p.gy.splice(loc.i, 1);
    else if (loc.where === 'boss') p.boss = null;
    if (m.zone === 'mon') {
      p.monsters.push({ inst, at: slot });
      log(m.note || `${p.name} summons ${inst.card.name}${fp(inst.card) > 1 ? ` (Footprint ${fp(inst.card)})` : ''}.`);
    } else {
      p.actions[slot] = { inst, faceDown: !!m.faceDown };
      log(m.faceDown ? `${p.name} sets an Action card.` : `${p.name} activates ${inst.card.name}.`);
    }
    S.mode = null; S.sel = inst.uid;
  }

  /**
   * Pay a Charge Cost. Tribute Summons may only tribute Basic monsters;
   * Action cards may also discard from hand.
   */
  function startPay(pi, cost, opts, then) {
    if (cost <= 0) { then(); return; }
    S.mode = { type: 'pay', pi, cost, picks: new Set(), ...opts, then };
  }
  function payEligible(uid) {
    const m = S.mode, loc = locate(uid);
    if (!loc || loc.pi !== m.pi || uid === m.exclude) return false;
    if (loc.where === 'mon') return !m.basicOnly || loc.inst.card.kind === 'basic';
    if (loc.where === 'hand') return !!m.allowHand;
    return false;
  }
  const paidSoFar = () => [...S.mode.picks].reduce((s, uid) => s + charge(locate(uid).inst), 0);
  function confirmPay() {
    const m = S.mode, p = P(m.pi);
    const total = paidSoFar();
    if (total < m.cost) { MC.toast(`Need ${m.cost} Charge, have ${total}`); return; }
    const names = [];
    let lastInsect = null;
    [...m.picks].forEach(uid => {
      const loc = locate(uid);
      names.push(loc.inst.card.name);
      if (loc.where === 'mon') {
        const i = p.monsters.findIndex(x => x.inst.uid === uid);
        const [{ inst }] = p.monsters.splice(i, 1);
        if (inst.card.kind === 'boss') p.boss = reset(inst); else p.gy.push(reset(inst));
        if ((inst.card.tags || []).includes('Insect') && inst.id !== 'insect-remains') lastInsect = inst;
      } else {
        p.gy.push(p.hand.splice(loc.i, 1)[0]);
      }
    });
    log(`${p.name} pays ${total}/${m.cost} Charge: ${names.join(', ')}.`);
    S.mode = null;
    m.then();
    if (lastInsect) maybeRemainsPrompt(m.pi, lastInsect);
  }

  function canAttack(pi, inst) {
    if (S.phase !== 3) return 'Attacks happen in the Battle Phase';
    if (pi !== S.active) return 'Only the turn player attacks';
    if (S.turn === 1) return 'Player 1 cannot attack on turn 1';
    if (inst.card.flags?.noAttack) return `${inst.card.name} cannot attack`;
    if (P(pi).attacked.has(inst.uid)) return 'Already attacked this turn';
    return '';
  }

  function resolveAttack(target) {
    const m = S.mode, ap = m.pi, dp = opp(ap);
    const attacker = locate(m.uid).inst, a = atk(attacker);
    P(ap).attacked.add(attacker.uid);
    S.mode = null;
    if (target.kind === 'barrier') {
      const b = P(dp).barriers[target.i];
      b.faceDown = true;
      log(`${attacker.card.name} smashes ${b.inst.card.name} (Barrier destroyed).`);
      if (b.inst.card.archetype === 'On Destroy') log(`↳ On-destroy: ${b.inst.card.text}`);
      return;
    }
    if (target.kind === 'direct') {
      log(`${attacker.card.name} attacks ${P(dp).name} directly!`);
      loseLp(dp, a, 'direct attack');
      return;
    }
    const tLoc = locate(target.uid), t = tLoc.inst, d = def(t);
    log(`${attacker.card.name} (ATK ${a}) attacks ${t.card.name} (DEF ${d}).`);
    if (a > d) {
      const loss = lpLossFor(t);
      removeMonster(dp, t.uid, 'is destroyed in battle');
      loseLp(dp, loss, `${t.card.name} destroyed`);
    } else if (a === d) {
      const l1 = lpLossFor(t), l2 = lpLossFor(attacker);
      removeMonster(dp, t.uid, 'is destroyed in battle');
      removeMonster(ap, attacker.uid, 'is destroyed in battle');
      loseLp(dp, l1, `${t.card.name} destroyed`);
      loseLp(ap, l2, `${attacker.card.name} destroyed`);
    } else {
      log('The attack bounces off — nothing is destroyed.');
    }
  }

  // ───────────────────────── Phases ─────────────────────────
  function enterPhase() {
    const p = P(S.active);
    log(`— ${p.name}: ${PHASES[S.phase]} Phase —`);
    if (S.phase === 0) {
      if (S.turn === 1) log(`${p.name} does not draw on the first turn.`);
      else draw(p);
    }
  }
  function nextPhase() {
    S.mode = null;
    if (S.phase < PHASES.length - 1) { S.phase++; enterPhase(); return; }
    P(S.active).attacked.clear();
    S.active = opp(S.active); S.turn++; S.phase = 0;
    log(`Turn ${S.turn}.`);
    enterPhase();
  }

  // ───────────────────────── Demo board ─────────────────────────
  function take(p, id) {
    const i = p.deck.findIndex(x => x.id === id);
    return i > -1 ? p.deck.splice(i, 1)[0] : mk(id);
  }
  function demoBoard() {
    newDuel('hive', 'fungus');
    const [a, b] = S.players;
    a.field = { inst: a.fieldDeck.splice(0, 1)[0], faceDown: false };
    b.field = { inst: b.fieldDeck.splice(0, 1)[0], faceDown: false };
    a.monsters.push({ inst: take(a, 'soldier-beetle'), at: 0 });
    a.monsters.push({ inst: take(a, 'hive-warden'), at: 2 });
    a.monsters.push({ inst: take(a, 'larva-sac'), at: 1 });
    a.monsters.push({ inst: take(a, 'brood-mother'), at: 5 });
    if (!a.hand.some(x => x.id === 'carapace-knight')) a.deck.push(a.hand.shift()), a.hand.push(take(a, 'carapace-knight'));
    const remains = b.extra.pop();
    b.monsters.push({ inst: remains, at: 0 });
    a.actions[0] = { inst: take(a, 'sudden-swarm'), faceDown: true };
    a.gy.push(take(a, 'larva-sac'), take(a, 'worker-ant'));
    const sc = take(b, 'spore-carrier'); sc.infected = true;
    b.monsters.push({ inst: sc, at: 1 });
    b.monsters.push({ inst: take(b, 'mycelial-colossus'), at: 3 });
    const hh = take(b, 'hollow-husk'); hh.infected = true;
    b.monsters.push({ inst: hh, at: 5 });
    b.actions[1] = { inst: take(b, 'spore-burst'), faceDown: false };
    b.gy.push(take(b, 'larva-sac'), take(b, 'cordyceps-drifter'));
    a.barriers[3].faceDown = true;
    b.barriers[0].faceDown = true; b.barriers[2].faceDown = true;
    a.lp = 5000; b.lp = 4500;
    S.turn = 5; S.active = 0; S.phase = 2;
    S.log = [];
    log('Demo board loaded — turn 5, Player 1 Main Phase.');
  }

  // ───────────────────────── New duel flow ─────────────────────────
  function newDuelDialog() {
    const opts = sel => Object.entries(MC.DECKS).map(([k, d]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${MC.esc(d.name)}</option>`).join('');
    const box = MC.modal(`<div class="newduel">
      <span class="eyebrow">Setup</span><h2>New Duel</h2>
      <label>Player 1 deck <select name="a">${opts('hive')}</select></label>
      <label>Player 2 deck <select name="b">${opts('fungus')}</select></label>
      <p class="note">Each player picks a Field card after seeing the opponent's deck. Then decks are shuffled and both players draw 7.</p>
      <button class="btn btn-hot" data-go>Start duel</button></div>`);
    box.querySelector('[data-go]').onclick = () => {
      const a = box.querySelector('[name=a]').value, b = box.querySelector('[name=b]').value;
      MC.closeModal();
      newDuel(a, b);
      chooseField(0, () => chooseField(1, () => {
        S.players.forEach(p => { p.field.faceDown = false; });
        log('Both Field cards flip face-up.');
        enterPhase();
        render();
      }));
      render();
    };
  }
  function chooseField(pi, done) {
    const p = P(pi), o = P(opp(pi));
    const box = MC.modal(`<span class="eyebrow">${MC.esc(p.name)} · Field selection</span>
      <h2>Choose your Field card</h2>
      <p class="note">Opponent is playing <b>${MC.esc(MC.DECKS[o.deckKey].name)}</b>. Your choice is placed face-down.</p>
      <div class="pick-grid">${p.fieldDeck.map(f => `<button class="card-cell" data-pick="${f.uid}">${MC.renderCard(f.card)}</button>`).join('')}</div>`, { wide: true });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const i = p.fieldDeck.findIndex(f => f.uid === +b.dataset.pick);
      p.field = { inst: p.fieldDeck.splice(i, 1)[0], faceDown: true };
      log(`${p.name} places a Field card face-down.`);
      MC.closeModal(); done();
    });
  }

  function pileDialog(pi, which) {
    const p = P(pi);
    const list = { gy: p.gy, extra: p.extra, deck: p.deck, fdeck: p.fieldDeck }[which];
    const title = { gy: 'Graveyard', extra: 'Extra Deck', deck: 'Deck', fdeck: 'Field Deck' }[which];
    const btns = inst => {
      if (which === 'gy') return `<button class="btn" data-pile="hand" data-uid="${inst.uid}">To hand</button>`;
      if (which === 'extra') return `<button class="btn btn-hot" data-pile="summon" data-uid="${inst.uid}">Summon</button>`;
      if (which === 'deck') return `<button class="btn" data-pile="hand" data-uid="${inst.uid}">Add to hand</button>`;
      if (which === 'fdeck') return `<button class="btn" data-pile="swap" data-uid="${inst.uid}">Swap in</button>`;
      return '';
    };
    // Group identical cards so piles stay readable.
    const groups = new Map();
    list.forEach(inst => { if (!groups.has(inst.id)) groups.set(inst.id, []); groups.get(inst.id).push(inst); });
    const box = MC.modal(`<span class="eyebrow">${MC.esc(p.name)}</span><h2>${title} <small>${list.length}</small></h2>
      ${which === 'deck' ? '<p class="note">Searching your deck — cards are grouped by name and the deck is reshuffled afterwards.</p>' : ''}
      <div class="pile-grid">${[...groups.values()].map(g => `<div class="pile-item">
        ${MC.renderCard(g[0].card)}${g.length > 1 ? `<span class="count-badge">×${g.length}</span>` : ''}
        ${btns(g[g.length - 1])}</div>`).join('') || '<p class="empty">Empty.</p>'}</div>`, { wide: true });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-pile]');
      if (!b) return;
      const loc = locate(+b.dataset.uid);
      const act = b.dataset.pile;
      if (act === 'hand') {
        const src = which === 'gy' ? p.gy : p.deck;
        p.hand.push(src.splice(loc.i, 1)[0]);
        log(`${p.name} adds ${loc.inst.card.name} to hand from the ${title}.`);
        if (which === 'deck') shuffle(p.deck);
      } else if (act === 'summon') {
        if (S.turn === 1) { MC.toast('No Extra Deck summons on turn 1'); return; }
        MC.closeModal();
        const how = { fusion: 'Fusion — send the materials via its Action card', formation: `Formation — flip down ${fp(loc.inst.card)} matching monster(s)` }[loc.inst.card.method];
        if (how) MC.toast(how);
        startPlace(pi, loc.inst, 'mon');
        render(); return;
      } else if (act === 'swap') {
        const old = p.field;
        p.field = { inst: p.fieldDeck.splice(loc.i, 1)[0], faceDown: false };
        if (old) p.fieldDeck.push(old.inst);
        log(`${p.name} swaps their Field card to ${p.field.inst.card.name}.`);
      }
      MC.closeModal(); render();
    });
  }

  // ───────────────────────── Rendering ─────────────────────────
  const isTarget = (pi, kind, ref) => {
    const m = S.mode;
    if (!m || m.type !== 'attack' || pi === m.pi) return false;
    const o = P(pi);
    if (kind === 'mon') return true;
    if (kind === 'bar') return !o.barriers[ref].faceDown;
    if (kind === 'direct') return o.barriers.every(b => b.faceDown);
    return false;
  };

  function miniFor(pi, inst, { faceDown = false, where = '', extra = '' } = {}) {
    const cls = [extra];
    if (S.sel === inst.uid) cls.push('selected');
    if (S.mode?.type === 'pay') {
      if (S.mode.picks.has(inst.uid)) cls.push('picked');
      else if (payEligible(inst.uid)) cls.push('eligible');
    }
    if (where === 'mon' && isTarget(pi, 'mon')) cls.push('target');
    if (S.mode?.uid === inst.uid) cls.push('acting');
    if (where === 'mon' && P(pi).attacked.has(inst.uid)) cls.push('spent');
    return MC.renderMini(inst.card, {
      faceDown, mods: inst.mods, infected: inst.infected,
      extraClass: cls.join(' '),
      attrs: `data-uid="${inst.uid}"`,
      label: faceDown && where === 'act' ? 'SET' : '',
    });
  }

  function zone(cls, attrs, inner, label) {
    return `<div class="zone ${cls}" ${attrs}>${inner || ''}${label ? `<span class="z-label">${label}</span>` : ''}</div>`;
  }

  function pile(pi, which, list, label, faceUpTop) {
    const top = list[list.length - 1];
    const inner = !list.length ? '' : faceUpTop
      ? MC.renderMini(top.card, { extraClass: 'pile-top' })
      : `<div class="mini mini-back ${which === 'extra' ? 'back-extra' : ''}"><div class="back-emblem"></div></div>`;
    return zone(`z-pile ${list.length > 1 ? 'stacked' : ''}`, `data-pilezone="${which}" data-pi="${pi}"`,
      inner + `<span class="pile-count">${list.length}</span>`, label);
  }

  function sideHTML(pi) {
    const p = P(pi), mirror = pi === 1;
    const m = S.mode;
    const placing = m?.type === 'place' && m.pi === pi;
    const starts = placing && m.zone === 'mon' ? new Set(freeStarts(p, m.n)) : new Set();

    // Monster row: 6 zones + monsters spanning their footprint.
    const col = (at, n) => mirror ? MON_ZONES - (at + n) + 1 : at + 1;
    let mrow = '';
    for (let i = 0; i < MON_ZONES; i++) {
      mrow += `<div class="zone z-mon ${starts.has(i) ? 'valid' : ''}" style="grid-column:${col(i, 1)}" data-mon="${i}" data-pi="${pi}"><span class="z-label">M${i + 1}</span></div>`;
    }
    p.monsters.forEach(({ inst, at }) => {
      const n = fp(inst.card);
      mrow += `<div class="placed fp-${n}" style="grid-column:${col(at, n)} / span ${n}">${miniFor(pi, inst, { where: 'mon' })}</div>`;
    });

    const fieldCell = zone('z-field', `data-fieldzone data-pi="${pi}"`,
      p.field ? miniFor(pi, p.field.inst, { faceDown: p.field.faceDown, where: 'field' }) : '', 'Field');
    const bossCell = zone('z-boss', `data-bosszone data-pi="${pi}"`,
      p.boss ? miniFor(pi, p.boss, { where: 'boss' }) : '', 'Boss');
    const bar = i => zone(`z-bar ${isTarget(pi, 'bar', i) ? 'target' : ''}`, `data-bar="${i}" data-pi="${pi}"`,
      miniFor(pi, p.barriers[i].inst, { faceDown: p.barriers[i].faceDown, where: 'bar', extra: p.barriers[i].faceDown ? 'broken' : '' }), 'Barrier');
    const act = i => {
      const valid = placing && m.zone === 'act' && !p.actions[i];
      return zone(`z-act ${valid ? 'valid' : ''}`, `data-act="${i}" data-pi="${pi}"`,
        p.actions[i] ? miniFor(pi, p.actions[i].inst, { faceDown: p.actions[i].faceDown, where: 'act' }) : '', 'Action');
    };

    let front = [fieldCell, `<div class="mrow">${mrow}</div>`, pile(pi, 'gy', p.gy, 'GY', true), pile(pi, 'extra', p.extra, 'Extra')];
    let back = [bossCell, bar(0), bar(1), act(0), act(1), act(2), bar(2), bar(3), pile(pi, 'deck', p.deck, 'Deck')];
    if (mirror) { front = front.reverse(); back = back.reverse(); }
    const rows = [`<div class="row">${front.join('')}</div>`, `<div class="row">${back.join('')}</div>`];
    if (mirror) rows.reverse();
    return `<div class="side side-${pi} ${S.active === pi ? 'is-active' : ''}">${rows.join('')}</div>`;
  }

  function plateHTML(pi) {
    const p = P(pi);
    const direct = isTarget(pi, 'direct');
    const up = p.barriers.filter(b => !b.faceDown).length;
    return `<div class="plate panel ${S.active === pi ? 'is-active' : ''} ${direct ? 'target' : ''}" data-plate="${pi}">
      <div class="plate-top"><span class="plate-name">${MC.esc(p.name)}</span>
        <span class="plate-deck">${MC.esc(MC.DECKS[p.deckKey].name)}</span></div>
      <div class="lp">${MC.icon('heart')}<b>${p.lp}</b><span>LP</span></div>
      <div class="lp-bar"><i style="width:${p.lp / 60}%"></i></div>
      <ul class="plate-counts">
        <li>Hand <b>${p.hand.length}</b></li><li>Deck <b>${p.deck.length}</b></li>
        <li>GY <b>${p.gy.length}</b></li><li>Barriers <b>${up}/4</b></li>
      </ul>
      <div class="plate-btns">
        <button class="btn btn-sm" data-lp="${pi}:-500">−500</button>
        <button class="btn btn-sm" data-lp="${pi}:500">+500</button>
        <button class="btn btn-sm" data-fdeck="${pi}">Field Deck</button>
      </div>
      ${direct ? '<div class="direct-hint">▶ Click to attack directly</div>' : ''}
    </div>`;
  }

  function handHTML(pi) {
    const p = P(pi);
    const shown = S.active === pi || S.peek[pi];
    const cards = p.hand.map(inst => miniFor(pi, inst, { faceDown: !shown, where: 'hand', extra: 'mini-hand' })).join('');
    return `<div class="hand hand-${pi}">
      <div class="hand-label">${MC.esc(p.name)} · Hand ${p.hand.length}
        ${S.active !== pi ? `<button class="btn btn-sm" data-peek="${pi}">${S.peek[pi] ? 'Hide' : 'Peek'}</button>` : ''}</div>
      <div class="hand-cards">${cards || '<span class="empty">Empty hand</span>'}</div></div>`;
  }

  function bannerHTML() {
    const m = S.mode;
    if (m?.type === 'pay') {
      const total = paidSoFar();
      return `<div class="banner"><span>${MC.esc(m.label)} — pay <b>${m.cost}</b> Charge:
        selected <b class="${total >= m.cost ? 'ok' : ''}">${total}</b>
        <small>(${m.basicOnly ? 'tribute Basic monsters' : 'tribute monsters or discard from hand'})</small></span>
        <button class="btn btn-hot btn-sm" data-pay-ok ${total >= m.cost ? '' : 'disabled'}>Confirm</button>
        <button class="btn btn-sm" data-cancel>Cancel</button></div>`;
    }
    if (m?.type === 'place') {
      return `<div class="banner"><span>Choose ${m.zone === 'mon' ? `a Monster Zone${m.n > 1 ? ` (covers ${m.n})` : ''}` : 'an Action Zone'}
        for <b>${MC.esc(locate(m.uid).inst.card.name)}</b></span><button class="btn btn-sm" data-cancel>Cancel</button></div>`;
    }
    if (m?.type === 'attack') {
      return `<div class="banner banner-hot"><span>Choose an attack target for <b>${MC.esc(locate(m.uid).inst.card.name)}</b></span>
        <button class="btn btn-sm" data-cancel>Cancel</button></div>`;
    }
    if (S.prompt) {
      return `<div class="banner"><span>${MC.esc(S.prompt.text)}</span>
        ${S.prompt.buttons.map((b, i) => `<button class="btn btn-sm ${i === 0 ? 'btn-hot' : ''}" data-prompt="${i}">${b.label}</button>`).join('')}</div>`;
    }
    return '';
  }

  function controlsHTML() {
    if (!S.sel) return '<p class="hint">Click a card to select it. Click piles to browse them.</p>';
    const loc = locate(S.sel);
    if (!loc) return '';
    const c = loc.inst.card, b = (act, label, hot) => `<button class="btn ${hot ? 'btn-hot' : ''}" data-do="${act}">${label}</button>`;
    const out = [];
    if (loc.where === 'hand') {
      if (c.kind === 'basic') out.push(b('summon', 'Summon', 1));
      if (c.kind === 'tribute') out.push(b('tribute-summon', `Tribute Summon (cost ${c.cost})`, 1));
      if (c.kind === 'action') out.push(b('activate', `Activate (cost ${c.cost})`, 1), b('set', 'Set'));
      out.push(b('discard', 'Discard'));
    } else if (loc.where === 'mon') {
      const why = canAttack(loc.pi, loc.inst);
      out.push(`<button class="btn btn-hot" data-do="attack" ${why ? `disabled title="${MC.esc(why)}"` : ''}>Attack</button>`);
      out.push(b('destroy', 'Destroy'), b('tribute', 'Tribute'));
      if (c.kind === 'basic' || c.kind === 'tribute') out.push(b('to-hand', 'Return to hand'));
      out.push(b('infect', loc.inst.infected ? 'Cure' : 'Infect'));
      out.push(`<div class="mods">
        <span>ATK</span>${b('atk:-100', '−')}${b('atk:100', '+')}
        <span>DEF</span>${b('def:-100', '−')}${b('def:100', '+')}
        <span>CHG</span>${b('charge:-1', '−')}${b('charge:1', '+')}</div>`);
      if (why) out.push(`<p class="hint">${MC.esc(why)}.</p>`);
    } else if (loc.where === 'act') {
      if (loc.slot.faceDown) out.push(b('flip-act', `Activate set card (cost ${c.cost} + ${c.setCost ?? 0})`, 1));
      out.push(b('resolve', 'Resolve → GY'));
    } else if (loc.where === 'bar') {
      out.push(b('flip', loc.slot.faceDown ? 'Flip face-up' : 'Destroy (flip down)'));
    } else if (loc.where === 'field') {
      out.push(b('flip', loc.slot.faceDown ? 'Flip face-up' : 'Flip face-down'));
      out.push(`<button class="btn" data-fdeck="${loc.pi}">Swap from Field Deck</button>`);
    } else if (loc.where === 'boss') {
      out.push(b('boss-summon', 'Summon Boss to field', 1));
    }
    return `<div class="controls">${out.join('')}</div>`;
  }

  function inspectorCard() {
    const uid = S.hover ?? S.sel;
    const loc = uid != null && locate(uid);
    if (!loc) return '<div class="insp-empty">Hover a card to inspect it</div>';
    const hidden = (loc.where === 'hand' && S.active !== loc.pi && !S.peek[loc.pi]);
    if (hidden) return MC.renderCard(loc.inst.card, { faceDown: true });
    const st = loc.where === 'mon' ? `<div class="live-stats">Live: ATK <b>${atk(loc.inst)}</b> · DEF <b>${def(loc.inst)}</b> · Charge <b>${charge(loc.inst)}</b>${loc.inst.infected ? ' · <b class="inf">Infected</b>' : ''}</div>` : '';
    return MC.renderCard(loc.inst.card) + st;
  }

  function render() {
    if (!S) return;
    root.innerHTML = `
      <div class="table-layout">
        <aside class="hud">
          ${plateHTML(1)}
          <div class="turn panel">
            <div class="turn-top"><span class="eyebrow">Turn ${S.turn}</span><b>${MC.esc(P(S.active).name)}</b></div>
            <ol class="phases">${PHASES.map((ph, i) => `<li class="${i === S.phase ? 'on' : i < S.phase ? 'done' : ''}">${ph}</li>`).join('')}</ol>
            <button class="btn btn-hot btn-wide" data-next>${S.phase === 4 ? 'End turn ▶' : 'Next phase ▶'}</button>
            <div class="turn-btns">
              <button class="btn btn-sm" data-draw>Draw</button>
              <button class="btn btn-sm" data-newduel>New duel</button>
              <button class="btn btn-sm" data-demo>Demo board</button>
            </div>
          </div>
          ${plateHTML(0)}
        </aside>
        <div class="arena">
          ${handHTML(1)}
          <div class="banner-slot">${bannerHTML()}</div>
          <div class="stage"><div class="fit"><div class="persp">
            <div class="table3d">
              <div class="glow-corner"></div>
              ${sideHTML(1)}
              <div class="midline"><span class="mid-phase">${PHASES[S.phase]} Phase</span><span class="mid-vs">VS</span><span class="mid-turn">T${S.turn}</span></div>
              ${sideHTML(0)}
            </div>
          </div></div></div>
          ${handHTML(0)}
        </div>
        <aside class="inspector">
          <div class="insp-card">${inspectorCard()}</div>
          ${controlsHTML()}
          <div class="log panel"><span class="eyebrow">Duel log</span>
            <ol>${S.log.map(l => `<li>${MC.esc(l)}</li>`).join('')}</ol></div>
        </aside>
      </div>`;
    fit();
  }

  function fit() {
    const stage = root.querySelector('.stage'), f = root.querySelector('.fit'), t = root.querySelector('.table3d');
    if (!stage || !t) return;
    f.style.transform = 'none';
    const natural = t.offsetWidth + 40;
    const s = Math.min(1.25, stage.clientWidth / natural);
    f.style.transform = `translateX(-50%) scale(${s})`;
    const sr = stage.getBoundingClientRect(), tr = t.getBoundingClientRect();
    // Pull the projected table flush with the stage top, then leave room for its front face.
    f.style.top = (sr.top - tr.top + 8) + 'px';
    stage.style.height = (tr.height + 8 + 60 * s) + 'px';
  }

  function updateInspector() {
    const el = root.querySelector('.insp-card');
    if (el) el.innerHTML = inspectorCard();
  }

  // ───────────────────────── Input ─────────────────────────
  function doAction(act) {
    const loc = locate(S.sel), p = P(loc.pi), inst = loc.inst, c = inst.card;
    const [k, v] = act.split(':');
    if (v) { inst.mods[k] += +v; render(); return; }
    switch (act) {
      case 'summon':
        startPlace(loc.pi, inst, 'mon'); break;
      case 'tribute-summon':
        if (S.turn === 1) { MC.toast('No Tribute summons on turn 1'); break; }
        startPay(loc.pi, c.cost, { basicOnly: true, label: `Tribute Summon ${c.name}`, exclude: inst.uid },
          () => startPlace(loc.pi, inst, 'mon', { note: `${p.name} Tribute Summons ${c.name}!` }));
        break;
      case 'activate':
        if (!p.actions.includes(null)) { MC.toast('No free Action Zone'); break; }
        startPay(loc.pi, c.cost, { allowHand: true, label: `Activate ${c.name}`, exclude: inst.uid },
          () => startPlace(loc.pi, inst, 'act'));
        break;
      case 'set':
        startPlace(loc.pi, inst, 'act', { faceDown: true }); break;
      case 'discard':
        p.gy.push(p.hand.splice(loc.i, 1)[0]); log(`${p.name} discards ${c.name}.`); S.sel = null; break;
      case 'attack':
        S.mode = { type: 'attack', pi: loc.pi, uid: inst.uid }; break;
      case 'destroy':
        removeMonster(loc.pi, inst.uid, 'is destroyed'); break;
      case 'tribute':
        removeMonster(loc.pi, inst.uid, 'is tributed'); break;
      case 'to-hand':
        p.monsters.splice(loc.i, 1); p.hand.push(reset(inst)); log(`${c.name} returns to ${p.name}'s hand.`); break;
      case 'infect':
        inst.infected = !inst.infected; log(`${c.name} is ${inst.infected ? 'Infected' : 'cured'}.`); break;
      case 'flip-act':
        startPay(loc.pi, c.cost + (c.setCost || 0), { allowHand: true, label: `Activate set ${c.name}`, exclude: inst.uid },
          () => { loc.slot.faceDown = false; log(`${p.name} flips ${c.name} on the opponent's turn.`); });
        break;
      case 'resolve':
        p.actions[loc.i] = null; p.gy.push(inst); log(`${c.name} resolves and goes to the GY.`); S.sel = null; break;
      case 'flip':
        loc.slot.faceDown = !loc.slot.faceDown;
        log(`${p.name}'s ${c.name} flips ${loc.slot.faceDown ? 'face-down' : 'face-up'}.`); break;
      case 'boss-summon':
        if (S.turn === 1) { MC.toast('Check the Boss requirements — Tribute/Extra summons are off on turn 1'); }
        startPlace(loc.pi, inst, 'mon', { note: `${p.name} summons their Boss, ${c.name}!` }); break;
    }
    render();
  }

  function onClick(e) {
    const t = e.target;
    const btn = sel => t.closest(sel);
    let el;

    if ((el = btn('[data-next]'))) { nextPhase(); render(); return; }
    if ((el = btn('[data-draw]'))) { draw(P(S.active)); render(); return; }
    if ((el = btn('[data-newduel]'))) { newDuelDialog(); return; }
    if ((el = btn('[data-demo]'))) { demoBoard(); render(); return; }
    if ((el = btn('[data-cancel]'))) { S.mode = null; render(); return; }
    if ((el = btn('[data-pay-ok]'))) { confirmPay(); render(); return; }
    if ((el = btn('[data-prompt]'))) { const p = S.prompt; S.prompt = null; p.buttons[+el.dataset.prompt].run(); render(); return; }
    if ((el = btn('[data-peek]'))) { S.peek[+el.dataset.peek] ^= 1; render(); return; }
    if ((el = btn('[data-lp]'))) {
      const [pi, n] = el.dataset.lp.split(':').map(Number);
      if (n < 0) loseLp(pi, -n, 'manual'); else { P(pi).lp += n; log(`${P(pi).name} gains ${n} LP.`); }
      render(); return;
    }
    if ((el = btn('[data-fdeck]'))) { pileDialog(+el.dataset.fdeck, 'fdeck'); return; }
    if ((el = btn('[data-do]'))) { doAction(el.dataset.do); return; }

    const m = S.mode;
    // Placement
    if (m?.type === 'place') {
      const z = btn('.zone.valid');
      if (z && +z.dataset.pi === m.pi) {
        finishPlace(m.zone === 'mon' ? +z.dataset.mon : +z.dataset.act);
        render();
      }
      return;
    }
    // Paying
    if (m?.type === 'pay') {
      const c = btn('[data-uid]');
      if (c && payEligible(+c.dataset.uid)) {
        const uid = +c.dataset.uid;
        m.picks.has(uid) ? m.picks.delete(uid) : m.picks.add(uid);
        render();
      }
      return;
    }
    // Attacking
    if (m?.type === 'attack') {
      const plate = btn('[data-plate]');
      if (plate && isTarget(+plate.dataset.plate, 'direct')) { resolveAttack({ kind: 'direct' }); render(); return; }
      const barZ = btn('[data-bar]');
      if (barZ && isTarget(+barZ.dataset.pi, 'bar', +barZ.dataset.bar)) { resolveAttack({ kind: 'barrier', i: +barZ.dataset.bar }); render(); return; }
      const c = btn('[data-uid]');
      if (c) {
        const loc = locate(+c.dataset.uid);
        if (loc.where === 'mon' && loc.pi !== m.pi) { resolveAttack({ kind: 'monster', uid: loc.inst.uid }); render(); return; }
      }
      MC.toast('Pick an opponent monster, face-up Barrier, or (no Barriers left) the opponent');
      return;
    }

    const pz = btn('[data-pilezone]');
    if (pz) {
      const which = pz.dataset.pilezone, pi = +pz.dataset.pi;
      if (which === 'deck' && pi === S.active && S.phase === 0) { draw(P(pi)); render(); return; }
      pileDialog(pi, which); return;
    }
    const c = btn('[data-uid]');
    if (c) {
      const uid = +c.dataset.uid, loc = locate(uid);
      if (loc.where === 'hand' && S.active !== loc.pi && !S.peek[loc.pi]) { MC.toast('Hidden hand — use Peek'); return; }
      S.sel = S.sel === uid ? null : uid;
      render(); return;
    }
  }

  MC.TableView = {
    mount(el) {
      root = el;
      demoBoard();
      render();
      root.addEventListener('click', onClick);
      root.addEventListener('mouseover', e => {
        const c = e.target.closest('[data-uid]');
        const uid = c ? +c.dataset.uid : null;
        if (uid !== S.hover && (uid != null || S.hover != null)) {
          S.hover = uid;
          if (uid != null) updateInspector();
        }
      });
      root.addEventListener('mouseleave', () => { S.hover = null; updateInspector(); });
      new ResizeObserver(() => fit()).observe(root);
    },
    show() { requestAnimationFrame(fit); },
  };
})();
