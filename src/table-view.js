/*
 * Play Table: a hot-seat mockup of a duel on a 3D pixel table.
 * Enforces the basics (zones, footprint, charge costs, blockers, battle damage,
 * turn-1 restrictions); other card effects are applied by hand from the dialog bar.
 * Cards can be clicked or dragged.
 */
(function () {
  const MC = window.MC;
  const PHASES = ['Draw', 'Standby', 'Main', 'Battle', 'End'];
  const MON_ZONES = 6, ACT_ZONES = 3;
  const SHELL = 'insect-shell';

  let uidSeq = 1;
  const mk = id => ({ uid: uidSeq++, id, card: MC.byId[id], mods: { atk: 0, def: 0, charge: 0 }, infected: false });
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hasTag = (card, t) => (card.tags || []).includes(t);

  let S, root;
  let pixel = 2;
  try { const v = localStorage.getItem('mc-pixel'); if (v !== null) pixel = +v; } catch (e) { /* storage blocked */ }

  // ───────────────────────── State ─────────────────────────
  function newPlayer(deckKey, name) {
    const d = MC.DECKS[deckKey];
    return {
      name, deckKey, lp: 6000,
      deck: shuffle(MC.expand(d.main).map(mk)),
      hand: [], gy: [],
      extra: MC.expand(d.extra).map(mk),
      fieldDeck: d.field.map(mk),
      monsters: [],                         // { inst, at } — `at` is the leftmost zone covered
      actions: Array(ACT_ZONES).fill(null), // { inst, faceDown }
      field: null,                          // { inst, faceDown }
      barriers: d.barriers.map(id => ({ inst: mk(id), faceDown: false })),
      boss: mk(d.boss),                     // in the Boss Zone; null while on the field
      attacked: new Set(),
    };
  }

  function newDuel(deckA, deckB) {
    S = {
      turn: 1, active: 0, phase: 0,
      players: [newPlayer(deckA, 'Player 1'), newPlayer(deckB, 'Player 2')],
      sel: null, hover: null, mode: null, prompt: null, peek: [false, false], log: [], over: false, drag: null,
    };
    S.players.forEach(p => { for (let i = 0; i < 7; i++) draw(p, true); });
    log('Duel start. All cards revealed. Barriers and Bosses placed face-up.');
  }

  const P = i => S.players[i];
  const opp = i => 1 - i;
  const log = msg => { S.log.unshift(msg); S.log.length = Math.min(S.log.length, 80); };
  const atk = inst => inst.card.atk + inst.mods.atk;
  const def = inst => inst.card.def + inst.mods.def;
  const fp = card => card.footprint || 1;

  /**
   * Charge of a card right now. `ctx` describes what it is paying for
   * ({ kind: 'tribute' | 'action', insect }) so conditional bonuses apply.
   */
  function charge(inst, pi, ctx) {
    let c = (inst.card.charge || 0) + inst.mods.charge;
    const b = inst.card.chargeBonus;
    if (b && ctx?.insect) {
      if (ctx.kind === 'tribute' && b.insectTribute) c += b.insectTribute;
      if (ctx.kind === 'action' && b.insectAction) c += b.insectAction;
    }
    if (inst.id === SHELL && pi != null) {
      P(pi).monsters.forEach(m => { c += m.inst.card.aura?.shellCharge || 0; });
    }
    return c;
  }

  function draw(p, silent) {
    if (!p.deck.length) { MC.toast(`${p.name}'s deck is empty`); return; }
    p.hand.push(p.deck.pop());
    if (!silent) log(`${p.name} draws a card.`);
  }

  function occupancy(p, ignoreUid) {
    const occ = Array(MON_ZONES).fill(-1);
    p.monsters.forEach((m, idx) => {
      if (m.inst.uid === ignoreUid) return;
      for (let k = 0; k < fp(m.inst.card); k++) occ[m.at + k] = idx;
    });
    return occ;
  }
  function freeStarts(p, n, ignoreUid) {
    const occ = occupancy(p, ignoreUid), out = [];
    for (let at = 0; at + n <= MON_ZONES; at++) if (occ.slice(at, at + n).every(v => v === -1)) out.push(at);
    return out;
  }
  /**
   * Footprint: the card itself sits in one zone and blocks its neighbours.
   * A footprint-n monster spans [at, at+n); the card shows in the middle zone
   * (left of middle for even n) and the rest of the span is blocked.
   */
  const cardOffset = n => Math.floor((n - 1) / 2);
  /** Best start for a footprint-n monster dropped on zone i: card lands on i if possible. */
  function startFor(p, n, i, ignoreUid) {
    const starts = freeStarts(p, n, ignoreUid);
    return starts.find(s => s + cardOffset(n) === i) ?? starts.find(s => s <= i && i < s + n) ?? null;
  }
  /** Zones where the card itself could land. */
  const cardZones = (p, n, ignoreUid) => new Set(freeStarts(p, n, ignoreUid).map(s => s + cardOffset(n)));

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

  /** Take an instance out of wherever it is (hand, field, piles). */
  function detach(loc) {
    const p = P(loc.pi);
    switch (loc.where) {
      case 'hand': p.hand.splice(loc.i, 1); break;
      case 'mon': p.monsters.splice(loc.i, 1); break;
      case 'act': p.actions[loc.i] = null; break;
      case 'gy': p.gy.splice(loc.i, 1); break;
      case 'extra': p.extra.splice(loc.i, 1); break;
      case 'deck': p.deck.splice(loc.i, 1); break;
      case 'boss': p.boss = null; break;
    }
    return loc.inst;
  }

  /** Send a card to its resting place: Bosses go home, everything else to the GY. */
  function bury(pi, inst) {
    reset(inst);
    if (inst.card.kind === 'boss') P(pi).boss = inst; else P(pi).gy.push(inst);
  }

  /** Remove a monster from the field. */
  function removeMonster(pi, uid, verb) {
    const loc = locate(uid);
    if (!loc || loc.where !== 'mon') return null;
    const inst = detach(loc);
    bury(pi, inst);
    log(`${inst.card.name} ${verb}${inst.card.kind === 'boss' ? ' — returns to the Boss Zone' : ''}.`);
    if (S.sel === uid) S.sel = null;
    shellPrompt(pi, `${inst.card.name} left the field`, inst);
    return inst;
  }

  /** Offer to summon an Insect Shell (its own trigger, or a Cocoon breaking). */
  function shellPrompt(pi, why, inst) {
    const p = P(pi);
    if (inst && !(hasTag(inst.card, 'Insect') && inst.id !== SHELL)) return;
    const shell = p.extra.find(x => x.id === SHELL);
    if (!shell || !freeStarts(p, 1).length) return;
    S.prompt = {
      title: 'Insect Shell',
      text: `${p.name}: ${why}. Summon 1 Insect Shell?`,
      buttons: [
        { label: 'Summon', run: () => startPlace(pi, shell, 'mon', { note: `An Insect Shell crawls out for ${p.name}.` }) },
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

  // ───────────────────────── Placement ─────────────────────────
  function startPlace(pi, inst, zone, opts = {}) {
    const p = P(pi);
    if (zone === 'mon') {
      const n = fp(inst.card);
      if (!freeStarts(p, n, inst.uid).length) { MC.toast(`No room: needs ${n} adjacent free Monster Zone${n > 1 ? 's' : ''}`); return false; }
      S.mode = { type: 'place', pi, uid: inst.uid, zone, n, ...opts };
    } else {
      if (!p.actions.includes(null)) { MC.toast('No free Action Zone'); return false; }
      S.mode = { type: 'place', pi, uid: inst.uid, zone, ...opts };
    }
    // A slot chosen up front (drag & drop) places immediately when it is still valid.
    if (opts.slot != null) {
      const slot = zone === 'mon' ? startFor(p, S.mode.n, opts.slot, inst.uid) : (p.actions[opts.slot] ? null : opts.slot);
      if (slot != null) finishPlace(slot);
    }
    return true;
  }

  function finishPlace(slot) {
    const m = S.mode, p = P(m.pi), loc = locate(m.uid);
    const moving = loc.where === 'mon';
    const inst = detach(loc);
    if (m.zone === 'mon') {
      p.monsters.push({ inst, at: slot });
      if (!moving) log(m.note || `${p.name} summons ${inst.card.name}${fp(inst.card) > 1 ? ` (Footprint ${fp(inst.card)})` : ''}.`);
    } else {
      p.actions[slot] = { inst, faceDown: !!m.faceDown };
      log(m.faceDown ? `${p.name} sets an Action card.` : `${p.name} activates ${inst.card.name}.`);
    }
    S.mode = null; S.sel = inst.uid;
  }

  // ───────────────────────── Paying Charge ─────────────────────────
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
  const paidSoFar = () => [...S.mode.picks].reduce((s, uid) => s + charge(locate(uid).inst, S.mode.pi, S.mode.ctx), 0);
  function confirmPay() {
    const m = S.mode, p = P(m.pi);
    const total = paidSoFar();
    if (total < m.cost) { MC.toast(`Need ${m.cost} Charge, have ${total}`); return; }
    const names = [];
    let lastInsect = null;
    [...m.picks].forEach(uid => {
      const loc = locate(uid);
      names.push(loc.inst.card.name);
      const inst = detach(loc);
      bury(m.pi, inst);
      if (loc.where === 'mon' && hasTag(inst.card, 'Insect') && inst.id !== SHELL) lastInsect = inst;
    });
    log(`${p.name} pays ${total}/${m.cost} Charge: ${names.join(', ')}.`);
    S.mode = null;
    m.then();
    if (lastInsect) shellPrompt(m.pi, `${lastInsect.card.name} was tributed`, lastInsect);
  }

  // ───────────────────────── Summon / activate helpers ─────────────────────────
  function summonFromHand(loc, slot) {
    const c = loc.inst.card, p = P(loc.pi);
    if (c.kind === 'basic') return startPlace(loc.pi, loc.inst, 'mon', { slot });
    if (c.kind === 'tribute') {
      if (S.turn === 1) { MC.toast('No Tribute summons on turn 1'); return; }
      startPay(loc.pi, c.cost,
        { basicOnly: true, label: `Tribute Summon ${c.name}`, exclude: loc.inst.uid, ctx: { kind: 'tribute', insect: hasTag(c, 'Insect') } },
        () => startPlace(loc.pi, loc.inst, 'mon', { slot, note: `${p.name} Tribute Summons ${c.name}!` }));
    }
  }
  function activateFromHand(loc, slot) {
    const c = loc.inst.card, p = P(loc.pi);
    if (!p.actions.includes(null)) { MC.toast('No free Action Zone'); return; }
    startPay(loc.pi, c.cost,
      { allowHand: true, label: `Activate ${c.name}`, exclude: loc.inst.uid, ctx: { kind: 'action', insect: hasTag(c, 'Insect') } },
      () => startPlace(loc.pi, loc.inst, 'act', { slot }));
  }

  // ───────────────────────── Battle ─────────────────────────
  function canAttack(pi, inst) {
    if (S.phase !== 3) return 'Attacks happen in the Battle Phase';
    if (pi !== S.active) return 'Only the turn player attacks';
    if (S.turn === 1) return 'Player 1 cannot attack on turn 1';
    if (inst.card.flags?.noAttack) return `${inst.card.name} cannot attack`;
    if (P(pi).attacked.has(inst.uid)) return 'Already attacked this turn';
    return '';
  }

  /** Declare an attack; the defender may redirect it with a Blocker first. */
  function declareAttack(target) {
    const m = S.mode, ap = m.pi, dp = opp(ap), attacker = locate(m.uid).inst;
    S.mode = null;
    const blockers = P(dp).monsters.filter(x => x.inst.card.flags?.blocker && x.inst.uid !== target.uid);
    if (blockers.length && !attacker.card.flags?.unblockable) {
      S.prompt = {
        title: 'Blocker',
        text: `${P(dp).name}: redirect ${attacker.card.name}'s attack to a Blocker?`,
        buttons: blockers.map(b => ({
          label: b.inst.card.name,
          run: () => { log(`${b.inst.card.name} blocks!`); resolveAttack(ap, attacker.uid, { kind: 'monster', uid: b.inst.uid }); },
        })).concat({ label: 'No', run: () => resolveAttack(ap, attacker.uid, target) }),
      };
      return;
    }
    resolveAttack(ap, attacker.uid, target);
  }

  function resolveAttack(ap, attackerUid, target) {
    const dp = opp(ap), aLoc = locate(attackerUid);
    if (!aLoc || aLoc.where !== 'mon') return;
    const attacker = aLoc.inst, a = atk(attacker);
    P(ap).attacked.add(attacker.uid);
    if (target.kind === 'barrier') {
      const b = P(dp).barriers[target.i];
      b.faceDown = true;
      log(`${attacker.card.name} smashes ${b.inst.card.name} (Barrier destroyed).`);
      if (b.inst.card.onBreak === 'infectAttacker') { attacker.infected = true; log(`↳ ${b.inst.card.name}: ${attacker.card.name} is Infected!`); }
      if (b.inst.card.onBreak === 'summonShell') shellPrompt(dp, `${b.inst.card.name} broke open`);
      return;
    }
    if (target.kind === 'direct') {
      log(`${attacker.card.name} attacks ${P(dp).name} directly!`);
      loseLp(dp, a, 'direct attack');
      return;
    }
    const t = locate(target.uid).inst, d = def(t);
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
    let i = p.deck.findIndex(x => x.id === id);
    if (i > -1) return p.deck.splice(i, 1)[0];
    i = p.hand.findIndex(x => x.id === id);
    if (i > -1) { const [x] = p.hand.splice(i, 1); p.hand.push(p.deck.pop()); return x; }
    return mk(id);
  }
  function giveHand(p, id) {
    if (p.hand.some(x => x.id === id)) return;
    p.deck.unshift(p.hand.shift());
    p.hand.push(take(p, id));
  }
  function demoBoard() {
    newDuel('hive', 'fungus');
    const [a, b] = S.players;
    a.field = { inst: a.fieldDeck.splice(0, 1)[0], faceDown: false };
    b.field = { inst: b.fieldDeck.splice(2, 1)[0], faceDown: false };
    a.monsters.push({ inst: take(a, 'beatstick-bug'), at: 0 });
    a.monsters.push({ inst: take(a, 'larva'), at: 1 });
    a.monsters.push({ inst: take(a, 'cicada'), at: 2 });
    a.monsters.push({ inst: a.extra.pop(), at: 4 });
    a.monsters.push({ inst: take(a, 'silkworm'), at: 5 });
    a.actions[0] = { inst: take(a, 'paralytic-sting'), faceDown: true };
    a.gy.push(take(a, 'dung-beetle'), take(a, 'forage'));
    giveHand(a, 'mantis'); giveHand(a, 'swarm-frenzy');

    const sa = take(b, 'soldier-ant'); sa.infected = true;
    b.monsters.push({ inst: sa, at: 0 });
    b.monsters.push({ inst: take(b, 'big-bad'), at: 2 });
    b.monsters.push({ inst: take(b, 'door-head-ant'), at: 4 });
    const fa = take(b, 'flying-ant'); fa.infected = true;
    b.monsters.push({ inst: fa, at: 5 });
    b.actions[1] = { inst: take(b, 'spore-cloud'), faceDown: false };
    b.actions[2] = { inst: take(b, 'fungal-mending'), faceDown: true };
    b.gy.push(take(b, 'ant-larva'), take(b, 'worker-ant'), take(b, 'rot'));
    a.barriers[3].faceDown = true;
    b.barriers[0].faceDown = true; b.barriers[2].faceDown = true;
    a.lp = 5000; b.lp = 4500;
    S.turn = 5; S.active = 0; S.phase = 2;
    S.log = [];
    log('Demo board loaded — turn 5, Player 1 Main Phase. Drag cards or click them.');
  }

  // ───────────────────────── Dialogs ─────────────────────────
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
      if (which === 'gy' || which === 'deck') return `<button class="btn" data-pile="hand" data-uid="${inst.uid}">To hand</button>`;
      if (which === 'extra') return `<button class="btn btn-hot" data-pile="summon" data-uid="${inst.uid}">Summon</button>`;
      if (which === 'fdeck') return `<button class="btn" data-pile="swap" data-uid="${inst.uid}">Swap in</button>`;
      return '';
    };
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
        p.hand.push(detach(loc));
        log(`${p.name} adds ${loc.inst.card.name} to hand from the ${title}.`);
        if (which === 'deck') shuffle(p.deck);
      } else if (act === 'summon') {
        if (S.turn === 1) { MC.toast('No Extra Deck summons on turn 1'); return; }
        MC.closeModal();
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

  /** Where the card being dragged may land (for highlighting). */
  function dropHints() {
    const d = S.drag && locate(S.drag);
    if (!d) return null;
    const c = d.inst.card, p = P(d.pi);
    const mainKind = ['basic', 'tribute', 'action'].includes(c.kind);
    const h = { pi: d.pi, mon: new Set(), act: new Set(), gy: d.where !== 'boss', deck: mainKind, hand: d.where !== 'hand' && mainKind };
    if (MC.isMonster(c) && (d.where !== 'hand' || ['basic', 'tribute'].includes(c.kind))) {
      h.mon = cardZones(p, fp(c), d.inst.uid);
    }
    if (c.kind === 'action' && d.where === 'hand') p.actions.forEach((a, i) => { if (!a) h.act.add(i); });
    return h;
  }

  function miniFor(pi, inst, { faceDown = false, where = '', extra = '', back } = {}) {
    const cls = [extra];
    if (S.sel === inst.uid) cls.push('selected');
    if (S.mode?.type === 'pay') {
      if (S.mode.picks.has(inst.uid)) cls.push('picked');
      else if (payEligible(inst.uid)) cls.push('eligible');
    }
    if (where === 'mon' && isTarget(pi, 'mon')) cls.push('target');
    if (S.mode?.uid === inst.uid) cls.push('acting');
    if (S.drag === inst.uid) cls.push('drag-src');
    if (where === 'mon' && P(pi).attacked.has(inst.uid)) cls.push('spent');
    if (['hand', 'mon', 'act', 'boss'].includes(where)) cls.push('draggable');
    const live = MC.isMonster(inst.card) && where === 'mon' ? charge(inst, pi) : null;
    return MC.renderMini(inst.card, {
      faceDown, back, mods: inst.mods, infected: inst.infected,
      charge: live != null && live !== (inst.card.charge ?? 0) ? live : null,
      extraClass: cls.join(' '),
      attrs: `data-uid="${inst.uid}"`,
      label: faceDown && where === 'act' ? 'SET' : '',
    });
  }

  function zone(cls, attrs, inner, label) {
    return `<div class="zone ${cls}" ${attrs}>${inner || ''}${label ? `<span class="z-label">${label}</span>` : ''}</div>`;
  }

  /** A pile drawn with physical thickness: more cards, taller stack. */
  function pile(pi, which, list, label, faceUpTop, hint) {
    const top = list[list.length - 1];
    const layers = list.length ? Math.min(7, 1 + Math.ceil(list.length / 7)) : 0;
    const back = which === 'extra' ? 'extra' : 'main';
    const face = !list.length ? '' : faceUpTop
      ? MC.renderMini(top.card, { extraClass: 'pile-top' })
      : MC.renderMini(null, { faceDown: true, back, extraClass: 'pile-top' });
    return zone(`z-pile ${hint ? 'drop-ok' : ''}`, `data-pilezone="${which}" data-pi="${pi}" style="--layers:${layers}"`,
      `<div class="stack edge-${faceUpTop ? 'gy' : back}">${Array.from({ length: Math.max(0, layers - 1) }, (_, k) =>
        `<i style="--n:${layers - 1 - k}"></i>`).join('')}${face}</div>` +
      `<span class="pile-count">${list.length}</span>`, label);
  }

  function sideHTML(pi) {
    const p = P(pi), mirror = pi === 1;
    const m = S.mode;
    const placing = m?.type === 'place' && m.pi === pi;
    const starts = placing && m.zone === 'mon' ? cardZones(p, m.n, m.uid) : new Set();
    const hints = dropHints();
    const myHints = hints && hints.pi === pi ? hints : null;

    const col = i => mirror ? MON_ZONES - i : i + 1;
    const blocked = new Set();
    p.monsters.forEach(({ inst, at }) => {
      const n = fp(inst.card), c = at + cardOffset(n);
      for (let k = at; k < at + n; k++) if (k !== c) blocked.add(k);
    });
    let mrow = '';
    for (let i = 0; i < MON_ZONES; i++) {
      const cls = (starts.has(i) ? 'valid ' : '') + (myHints?.mon.has(i) ? 'drop-ok ' : '') + (blocked.has(i) ? 'blocked' : '');
      mrow += `<div class="zone z-mon ${cls}" style="grid-column:${col(i)}" data-mon="${i}" data-pi="${pi}">` +
        (blocked.has(i) ? '<span class="z-block" title="Blocked by a Footprint">🚫</span>' : `<span class="z-label">M${i + 1}</span>`) + '</div>';
    }
    p.monsters.forEach(({ inst, at }) => {
      const n = fp(inst.card);
      mrow += `<div class="placed" style="grid-column:${col(at + cardOffset(n))}">${miniFor(pi, inst, { where: 'mon' })}</div>`;
    });

    const fieldCell = zone('z-field', `data-fieldzone data-pi="${pi}"`,
      p.field ? miniFor(pi, p.field.inst, { faceDown: p.field.faceDown, where: 'field' }) : '', 'Field');
    const bossCell = zone('z-boss', `data-bosszone data-pi="${pi}"`,
      p.boss ? miniFor(pi, p.boss, { where: 'boss' }) : MC.renderMini(null, { faceDown: true, back: 'boss', extraClass: 'boss-away' }), 'Boss');
    const bar = i => zone(`z-bar ${isTarget(pi, 'bar', i) ? 'target' : ''}`, `data-bar="${i}" data-pi="${pi}"`,
      miniFor(pi, p.barriers[i].inst, { faceDown: p.barriers[i].faceDown, where: 'bar', back: 'barrier' }), 'Barrier');
    const act = i => {
      const valid = placing && m.zone === 'act' && !p.actions[i];
      return zone(`z-act ${valid ? 'valid' : ''} ${myHints?.act.has(i) ? 'drop-ok' : ''}`, `data-act="${i}" data-pi="${pi}"`,
        p.actions[i] ? miniFor(pi, p.actions[i].inst, { faceDown: p.actions[i].faceDown, where: 'act' }) : '', 'Action');
    };

    let front = [fieldCell, `<div class="mrow">${mrow}</div>`, pile(pi, 'gy', p.gy, 'GY', true, myHints?.gy), pile(pi, 'extra', p.extra, 'Extra')];
    let back = [bossCell, bar(0), bar(1), act(0), act(1), act(2), bar(2), bar(3), pile(pi, 'deck', p.deck, 'Deck', false, myHints?.deck)];
    if (mirror) { front = front.reverse(); back = back.reverse(); }
    const rows = [`<div class="row">${front.join('')}</div>`, `<div class="row">${back.join('')}</div>`];
    if (mirror) rows.reverse();
    return `<div class="side side-${pi} ${S.active === pi ? 'is-active' : ''}">${rows.join('')}</div>`;
  }

  function plateHTML(pi) {
    const p = P(pi);
    const direct = isTarget(pi, 'direct');
    const up = p.barriers.filter(b => !b.faceDown).length;
    return `<div class="box plate ${S.active === pi ? 'is-active' : ''} ${direct ? 'target' : ''}" data-plate="${pi}">
      <span class="box-tab">${MC.esc(p.name)}${S.active === pi ? ' ▸' : ''}</span>
      <div class="plate-deck">${MC.esc(MC.DECKS[p.deckKey].name)}</div>
      <div class="lp">${MC.icon('heart')}<b>${p.lp}</b><span>LP</span></div>
      <div class="lp-bar"><i style="width:${Math.min(100, p.lp / 60)}%"></i></div>
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
    const hints = dropHints();
    const drop = hints && hints.pi === pi && hints.hand;
    const cards = p.hand.map(inst => miniFor(pi, inst, { faceDown: !shown, where: shown ? 'hand' : 'hand-hidden', extra: 'mini-hand' })).join('');
    return `<div class="hand hand-${pi} ${drop ? 'drop-ok' : ''}" data-handzone="${pi}">
      <div class="hand-label">${MC.esc(p.name)} · Hand ${p.hand.length}
        ${S.active !== pi ? `<button class="btn btn-sm" data-peek="${pi}">${S.peek[pi] ? 'Hide' : 'Peek'}</button>` : ''}</div>
      <div class="hand-cards">${cards || '<span class="empty">Empty hand</span>'}</div></div>`;
  }

  /** Top dialog box: what the game is waiting for. */
  function promptHTML() {
    const m = S.mode;
    let title, body, btns = '', hot = false;
    if (m?.type === 'pay') {
      const total = paidSoFar();
      title = m.label;
      body = `Pay <b>${m.cost}</b> Charge — selected <b class="${total >= m.cost ? 'ok' : ''}">${total}</b>.
        <small>${m.basicOnly ? 'Click Basic monsters to tribute.' : 'Click monsters to tribute or hand cards to discard.'}</small>`;
      btns = `<button class="btn btn-hot btn-sm" data-pay-ok ${total >= m.cost ? '' : 'disabled'}>Confirm</button>
        <button class="btn btn-sm" data-cancel>Cancel</button>`;
    } else if (m?.type === 'place') {
      title = locate(m.uid).inst.card.name;
      body = `Choose ${m.zone === 'mon' ? `a Monster Zone${m.n > 1 ? ` (covers ${m.n})` : ''}` : 'an Action Zone'}.`;
      btns = '<button class="btn btn-sm" data-cancel>Cancel</button>';
    } else if (m?.type === 'attack') {
      hot = true;
      title = `${locate(m.uid).inst.card.name} attacks!`;
      body = 'Choose a target: a monster, a face-up Barrier, or the player once all Barriers are down.';
      btns = '<button class="btn btn-sm" data-cancel>Cancel</button>';
    } else if (S.prompt) {
      title = S.prompt.title || 'Choose';
      body = MC.esc(S.prompt.text);
      btns = S.prompt.buttons.map((b, i) => `<button class="btn btn-sm ${i === 0 ? 'btn-hot' : ''}" data-prompt="${i}">${MC.esc(b.label)}</button>`).join('');
    } else {
      title = `${P(S.active).name} · ${PHASES[S.phase]} Phase`;
      body = S.phase === 3 ? 'Select a monster and press Attack.' : 'Drag cards from your hand onto the table, or click a card for options.';
    }
    return `<div class="box prompt ${hot ? 'box-hot' : ''}"><span class="box-tab">${MC.esc(title)}</span>
      <p>${body}</p><div class="prompt-btns">${btns}</div></div>`;
  }

  function controlsHTML() {
    if (!S.sel) return '<p class="hint">Click a card to select it.</p>';
    const loc = locate(S.sel);
    if (!loc) return '';
    const c = loc.inst.card, b = (act, label, hot) => `<button class="btn btn-sm ${hot ? 'btn-hot' : ''}" data-do="${act}">${label}</button>`;
    const out = [];
    if (loc.where === 'hand') {
      if (c.kind === 'basic') out.push(b('summon', 'Summon', 1));
      if (c.kind === 'tribute') out.push(b('tribute-summon', `Tribute Summon (${c.cost})`, 1));
      if (c.kind === 'action') out.push(b('activate', `Activate (${c.cost})`, 1), b('set', 'Set'));
      out.push(b('discard', 'Discard'));
    } else if (loc.where === 'mon') {
      const why = canAttack(loc.pi, loc.inst);
      out.push(`<button class="btn btn-sm btn-hot" data-do="attack" ${why ? `disabled title="${MC.esc(why)}"` : ''}>Attack</button>`);
      out.push(b('destroy', 'Destroy'), b('tribute', 'Tribute'));
      if (c.kind === 'basic' || c.kind === 'tribute') out.push(b('to-hand', 'To hand'));
      out.push(b('infect', loc.inst.infected ? 'Cure' : 'Infect'));
      out.push(`<span class="mods"><i>ATK</i>${b('atk:-100', '−')}${b('atk:100', '+')}<i>DEF</i>${b('def:-100', '−')}${b('def:100', '+')}<i>CHG</i>${b('charge:-1', '−')}${b('charge:1', '+')}</span>`);
      if (why) out.push(`<p class="hint">${MC.esc(why)}.</p>`);
    } else if (loc.where === 'act') {
      if (loc.slot.faceDown) out.push(b('flip-act', `Activate set (${c.cost} + ${MC.setCostLabel(c)})`, 1));
      out.push(b('resolve', 'Resolve → GY'));
    } else if (loc.where === 'bar') {
      out.push(b('flip', loc.slot.faceDown ? 'Flip face-up' : 'Destroy (flip down)'));
    } else if (loc.where === 'field') {
      out.push(b('flip', loc.slot.faceDown ? 'Flip face-up' : 'Flip face-down'));
      out.push(`<button class="btn btn-sm" data-fdeck="${loc.pi}">Swap</button>`);
    } else if (loc.where === 'boss') {
      out.push(b('boss-summon', 'Summon Boss', 1));
    }
    return out.join('');
  }

  /** Bottom dialog bar: portrait, name tab, text and stats — like a handheld card game. */
  function dialogHTML() {
    const uid = S.hover ?? S.sel;
    const loc = uid != null && locate(uid);
    const hidden = loc && loc.where === 'hand' && S.active !== loc.pi && !S.peek[loc.pi];
    if (!loc || hidden) {
      return `<div class="dialog"><div class="box portrait"><span class="portrait-empty">?</span></div>
        <div class="dialog-main"><div class="box textbox"><span class="box-tab">Inspect</span>
        <p class="hint">Hover a card to read it here. Drag cards to move them.</p></div>
        <div class="dialog-foot"><div class="box ctrlbox">${controlsHTML()}</div></div></div></div>`;
    }
    const c = loc.inst.card, k = MC.KINDS[c.kind];
    const lines = MC.formatText(c.text);
    const chips = (c.tags || []).map(MC.tagChip).join('') + (MC.isMonster(c) && fp(c) > 1 ? MC.footChip(fp(c)) : '');
    const live = loc.where === 'mon';
    const stats = MC.isMonster(c)
      ? MC.statBoxes(live ? atk(loc.inst) : c.atk, live ? def(loc.inst) : c.def)
      : c.kind === 'action' ? `<span class="stat stat-set">SET <b>${MC.setCostLabel(c)}</b></span>` : `<span class="stat-label">${MC.esc(c.archetype || k.long)}</span>`;
    const ch = c.charge != null || c.id === SHELL ? MC.chargePips(live ? charge(loc.inst, loc.pi) : (c.charge ?? 0), 's-chg') : '';
    return `<div class="dialog" style="--bc:${k.frame}">
      <div class="box portrait k-${c.kind} ${MC.SHOW_ART || !MC.isMonster(c) ? '' : 'no-art'}">${MC.artHTML(c)}${loc.inst.infected ? '<span class="inf-badge">INFECTED</span>' : ''}</div>
      <div class="dialog-main">
        <div class="box textbox"><span class="box-tab">${MC.esc(c.name)}${MC.costBadge(c)}</span>
          <div class="dialog-meta"><b>${k.long}</b>${chips}</div>
          <div class="dialog-text">${lines}</div></div>
        <div class="dialog-foot">
          <div class="box ctrlbox">${controlsHTML()}</div>
          <div class="box statbox">${stats}${ch}</div>
        </div>
      </div></div>`;
  }

  function render() {
    if (!S) return;
    root.classList.toggle('px-2', pixel === 2);
    root.classList.toggle('px-3', pixel === 3);
    root.innerHTML = `
      <div class="table-layout">
        <aside class="hud">
          ${plateHTML(1)}
          <div class="box turn"><span class="box-tab">Turn ${S.turn}</span>
            <ol class="phases">${PHASES.map((ph, i) => `<li class="${i === S.phase ? 'on' : i < S.phase ? 'done' : ''}">${ph}</li>`).join('')}</ol>
            <button class="btn btn-hot btn-wide" data-next>${S.phase === 4 ? 'End turn ▶' : 'Next phase ▶'}</button>
            <div class="turn-btns">
              <button class="btn btn-sm" data-draw>Draw</button>
              <button class="btn btn-sm" data-newduel>New duel</button>
              <button class="btn btn-sm" data-demo>Demo board</button>
            </div>
            <div class="px-toggle"><span>Pixel filter</span>${[0, 2, 3].map(n =>
              `<button class="btn btn-sm ${pixel === n ? 'on' : ''}" data-pixel="${n}">${n ? n + 'x' : 'Off'}</button>`).join('')}</div>
          </div>
          ${plateHTML(0)}
          <div class="box log"><span class="box-tab">Duel log</span>
            <ol>${S.log.map(l => `<li>${MC.esc(l)}</li>`).join('')}</ol></div>
        </aside>
        <div class="arena">
          ${promptHTML()}
          ${handHTML(1)}
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
        <aside class="dialog-slot">${dialogHTML()}</aside>
      </div>`;
    fit();
  }

  /**
   * Scale the 3D table to fill the stage and centre it both ways.
   * On the fixed-height desktop layout the stage is a flex child with a known
   * height; on small screens it has none, so the table sizes the stage instead.
   */
  function fit() {
    const stage = root.querySelector('.stage'), f = root.querySelector('.fit'), t = root.querySelector('.table3d');
    if (!stage || !t) return;
    const fixed = getComputedStyle(stage).flexGrow !== '0';
    if (fixed) stage.style.height = '';
    f.style.top = '0px';
    f.style.transform = 'translateX(-50%)';
    const edge = 26; // the table's front face, which getBoundingClientRect doesn't include
    const r1 = t.getBoundingClientRect();
    const sw = stage.clientWidth / (r1.width + 24);
    const sh = fixed ? stage.clientHeight / (r1.height + edge) : Infinity;
    const s = Math.max(0.3, Math.min(1.4, sw, sh));
    f.style.transform = `translateX(-50%) scale(${s})`;
    let sr = stage.getBoundingClientRect(), tr = t.getBoundingClientRect();
    if (!fixed) { stage.style.height = (tr.height + edge * s + 8) + 'px'; sr = stage.getBoundingClientRect(); }
    const free = sr.height - tr.height - edge * s;
    f.style.top = (sr.top - tr.top + Math.max(0, free / 2)) + 'px';
  }

  function updateDialog() {
    const el = root.querySelector('.dialog-slot');
    if (el) el.innerHTML = dialogHTML();
  }

  // ───────────────────────── Actions ─────────────────────────
  function doAction(act) {
    const loc = locate(S.sel), p = P(loc.pi), inst = loc.inst, c = inst.card;
    const [k, v] = act.split(':');
    if (v) { inst.mods[k] += +v; render(); return; }
    switch (act) {
      case 'summon':
      case 'tribute-summon':
        summonFromHand(loc); break;
      case 'activate':
        activateFromHand(loc); break;
      case 'set':
        startPlace(loc.pi, inst, 'act', { faceDown: true }); break;
      case 'discard':
        p.gy.push(detach(loc)); log(`${p.name} discards ${c.name}.`); S.sel = null; break;
      case 'attack':
        S.mode = { type: 'attack', pi: loc.pi, uid: inst.uid }; break;
      case 'destroy':
        removeMonster(loc.pi, inst.uid, 'is destroyed'); break;
      case 'tribute':
        removeMonster(loc.pi, inst.uid, 'is tributed'); break;
      case 'to-hand':
        p.hand.push(reset(detach(loc))); log(`${c.name} returns to ${p.name}'s hand.`); break;
      case 'infect':
        inst.infected = !inst.infected; log(`${c.name} is ${inst.infected ? 'Infected' : 'cured'}.`); break;
      case 'flip-act':
        startPay(loc.pi, c.cost + (c.setCost || 0),
          { allowHand: true, label: `Activate set ${c.name}`, exclude: inst.uid, ctx: { kind: 'action', insect: hasTag(c, 'Insect') } },
          () => { loc.slot.faceDown = false; log(`${p.name} flips ${c.name}.`); });
        break;
      case 'resolve':
        p.gy.push(detach(loc)); log(`${c.name} resolves and goes to the GY.`); S.sel = null; break;
      case 'flip':
        loc.slot.faceDown = !loc.slot.faceDown;
        log(`${p.name}'s ${c.name} flips ${loc.slot.faceDown ? 'face-down' : 'face-up'}.`);
        if (loc.where === 'bar' && loc.slot.faceDown && c.onBreak === 'summonShell') shellPrompt(loc.pi, `${c.name} broke open`);
        break;
      case 'boss-summon':
        startPlace(loc.pi, inst, 'mon', { note: `${p.name} summons their Boss, ${c.name}!` }); break;
    }
    render();
  }

  // ───────────────────────── Drag & drop ─────────────────────────
  let drag = null, suppressClick = false;

  function onPointerDown(e) {
    if (e.button !== 0 || S.mode) return;
    const el = e.target.closest('.mini.draggable[data-uid]');
    if (!el) return;
    drag = { uid: +el.dataset.uid, x0: e.clientX, y0: e.clientY, el, started: false };
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.started = true;
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = drag.el.outerHTML;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      S.drag = drag.uid; S.hover = drag.uid;
      render();
    }
    drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -60%) rotate(-4deg)`;
    const over = document.elementFromPoint(e.clientX, e.clientY);
    root.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover'));
    over?.closest('.drop-ok')?.classList.add('drop-hover');
  }

  function onPointerUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.started) return;
    d.ghost.remove();
    S.drag = null;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    handleDrop(d.uid, document.elementFromPoint(e.clientX, e.clientY));
    render();
  }

  function handleDrop(uid, el) {
    const loc = locate(uid);
    if (!loc || !el) return;
    const c = loc.inst.card, p = P(loc.pi);
    const same = node => node && +node.dataset.pi === loc.pi;
    const monZ = el.closest('[data-mon]'), actZ = el.closest('[data-act]');
    const pileZ = el.closest('[data-pilezone]'), handZ = el.closest('[data-handzone]');

    if (monZ && same(monZ)) {
      const slot = +monZ.dataset.mon;
      if (loc.where === 'hand') { summonFromHand(loc, slot); return; }
      if (loc.where === 'boss') { startPlace(loc.pi, loc.inst, 'mon', { slot, note: `${p.name} summons their Boss, ${c.name}!` }); return; }
      if (loc.where === 'mon') {
        const s = startFor(p, fp(c), slot, uid);
        if (s == null) { MC.toast('Not enough room there'); return; }
        p.monsters[loc.i].at = s;
        return;
      }
    }
    if (actZ && same(actZ) && loc.where === 'hand' && c.kind === 'action') {
      const slot = +actZ.dataset.act;
      if (p.actions[slot]) { MC.toast('That Action Zone is taken'); return; }
      S.prompt = {
        title: c.name, text: 'Activate it now, or set it face-down?',
        buttons: [
          { label: `Activate (${c.cost})`, run: () => activateFromHand(locate(uid), slot) },
          { label: 'Set', run: () => startPlace(loc.pi, locate(uid).inst, 'act', { faceDown: true, slot }) },
          { label: 'Cancel', run: () => {} },
        ],
      };
      return;
    }
    if (pileZ && same(pileZ)) {
      const which = pileZ.dataset.pilezone;
      if (which === 'gy' && loc.where !== 'boss') {
        if (loc.where === 'mon') { removeMonster(loc.pi, uid, 'is sent to the GY'); return; }
        p.gy.push(reset(detach(loc))); log(`${c.name} is sent to the GY.`); S.sel = null; return;
      }
      if (which === 'deck' && ['basic', 'tribute', 'action'].includes(c.kind)) {
        p.deck.push(reset(detach(loc))); shuffle(p.deck); log(`${c.name} is shuffled into ${p.name}'s Deck.`); S.sel = null; return;
      }
    }
    if (handZ && +handZ.dataset.handzone === loc.pi) {
      if (loc.where !== 'hand' && ['basic', 'tribute', 'action'].includes(c.kind)) {
        p.hand.push(reset(detach(loc))); log(`${c.name} returns to ${p.name}'s hand.`);
      }
      return; // dropping a hand card back on the hand is a no-op
    }
    MC.toast("Can't drop there");
  }

  // ───────────────────────── Clicks ─────────────────────────
  function onClick(e) {
    if (suppressClick) return;
    const t = e.target;
    const btn = sel => t.closest(sel);
    let el;

    if ((el = btn('[data-next]'))) { nextPhase(); render(); return; }
    if ((el = btn('[data-draw]'))) { draw(P(S.active)); render(); return; }
    if ((el = btn('[data-newduel]'))) { newDuelDialog(); return; }
    if ((el = btn('[data-demo]'))) { demoBoard(); render(); return; }
    if ((el = btn('[data-pixel]'))) {
      pixel = +el.dataset.pixel;
      try { localStorage.setItem('mc-pixel', pixel); } catch (err) { /* storage blocked */ }
      render(); return;
    }
    if ((el = btn('[data-cancel]'))) { S.mode = null; render(); return; }
    if ((el = btn('[data-pay-ok]'))) { confirmPay(); render(); return; }
    if ((el = btn('[data-prompt]'))) { const p = S.prompt; S.prompt = null; p.buttons[+el.dataset.prompt].run(); render(); return; }
    if ((el = btn('[data-peek]'))) { S.peek[+el.dataset.peek] = !S.peek[+el.dataset.peek]; render(); return; }
    if ((el = btn('[data-lp]'))) {
      const [pi, n] = el.dataset.lp.split(':').map(Number);
      if (n < 0) loseLp(pi, -n, 'manual'); else { P(pi).lp += n; log(`${P(pi).name} gains ${n} LP.`); }
      render(); return;
    }
    if ((el = btn('[data-fdeck]'))) { pileDialog(+el.dataset.fdeck, 'fdeck'); return; }
    if ((el = btn('[data-do]'))) { doAction(el.dataset.do); return; }

    const m = S.mode;
    if (m?.type === 'place') {
      const z = btn('.zone.valid');
      if (z && +z.dataset.pi === m.pi) {
        if (m.zone === 'mon') finishPlace(startFor(P(m.pi), m.n, +z.dataset.mon, m.uid));
        else finishPlace(+z.dataset.act);
        render();
      }
      return;
    }
    if (m?.type === 'pay') {
      const c = btn('[data-uid]');
      if (c && payEligible(+c.dataset.uid)) {
        const uid = +c.dataset.uid;
        m.picks.has(uid) ? m.picks.delete(uid) : m.picks.add(uid);
        render();
      }
      return;
    }
    if (m?.type === 'attack') {
      const plate = btn('[data-plate]');
      if (plate && isTarget(+plate.dataset.plate, 'direct')) { declareAttack({ kind: 'direct' }); render(); return; }
      const barZ = btn('[data-bar]');
      if (barZ && isTarget(+barZ.dataset.pi, 'bar', +barZ.dataset.bar)) { declareAttack({ kind: 'barrier', i: +barZ.dataset.bar }); render(); return; }
      const c = btn('[data-uid]');
      if (c) {
        const loc = locate(+c.dataset.uid);
        if (loc.where === 'mon' && loc.pi !== m.pi) { declareAttack({ kind: 'monster', uid: loc.inst.uid }); render(); return; }
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
      render();
    }
  }

  MC.TableView = {
    mount(el) {
      root = el;
      demoBoard();
      render();
      root.addEventListener('click', onClick);
      root.addEventListener('pointerdown', onPointerDown);
      // Card art is <img>; stop the browser's native image drag from hijacking ours.
      root.addEventListener('dragstart', e => e.preventDefault());
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', () => {
        if (drag?.ghost) drag.ghost.remove();
        drag = null;
        if (S.drag) { S.drag = null; render(); }
      });
      root.addEventListener('mouseover', e => {
        if (drag?.started) return;
        const c = e.target.closest('[data-uid]');
        const uid = c ? +c.dataset.uid : null;
        if (uid != null && uid !== S.hover) { S.hover = uid; updateDialog(); }
      });
      new ResizeObserver(() => fit()).observe(root);
    },
    show() { requestAnimationFrame(fit); },
  };
})();
