/*
 * MonCards card database.
 *
 * Plain script (not a module) so the app also runs straight from file://.
 * Names marked "working title" in the comments were not given yet — rename freely.
 *
 * Card fields:
 *   id         unique slug
 *   name       display name
 *   kind       'basic' | 'tribute' | 'extra' | 'action' | 'field' | 'barrier' | 'boss'
 *   atk, def   monster stats
 *   charge     Charge value (basic / tribute / action)
 *   cost       Charge Cost (tribute / action)
 *   setCost    extra cost when an Action is set and used on the opponent's turn (null = not decided)
 *   footprint  monster zones covered (tribute / extra / boss), default 1
 *   tags       array of Tags (there are no Types)
 *   keywords   rules keywords shown as chips: 'Blocker', 'Unblockable'
 *   archetype  barrier archetype label
 *   text       effect text (newline-separated)
 *   limit      copy-limit override (Infinity = unlimited)
 *   flags      engine hints for the mockup table:
 *                noAttack, noBattleLpLoss, blocker, unblockable
 *   chargeBonus  { insectTribute, insectAction } extra Charge in those payments
 *   aura         { shellCharge } bonus Charge for your Insect Shells while on the field
 *   onBreak      barrier trigger: 'summonShell' | 'infectAttacker'
 */
window.MC = window.MC || {};

MC.CARDS = [
  // ───────────────────────── Bosses ─────────────────────────
  {
    id: 'hive-queen', name: 'Hive Queen', kind: 'boss',
    atk: 3000, def: 3000, footprint: 3, tags: ['Insect'],
    text:
      'When your Insects are sent from the field to the GY, put them under this card instead.\n' +
      'At the start of your turn, you can swap an "Insect Shell" on the field with a Basic Insect under this card.\n' +
      'When this card has 15+ cards under it, you can shuffle all of them into your Deck/Extra Deck to summon this card.\n' +
      'When this card is summoned, summon any number of Basic Insects from your Deck.\n' +
      'When this card would be destroyed, you can tribute another Insect instead.',
  },
  {
    id: 'brain-eating-fungus', name: 'Brain-Eating Fungus', kind: 'boss',
    atk: 100, def: 100, footprint: 1, tags: ['Fungus', 'Undead'],
    text:
      'Once per turn: Infect an Insect on your field; it gains Charge equal to the number of Infected Insects on your field.\n' +
      'If an Infected Insect dies, the infection moves on to an "Insect Shell".\n' +
      'Opponent\'s monsters that battle your Infected monsters become Infected and lose 100 ATK for each Infected card on the field.\n' +
      'Summon: tribute 4 Infected monsters on either field.\n' +
      'While on your field, all your Insects are Infected.\n' +
      'Gains 400 ATK/DEF for every Infected card on the field.',
  },

  // ───────────────────────── Extra Deck ─────────────────────────
  {
    id: 'insect-shell', name: 'Insect Shell', kind: 'extra', method: 'trigger',
    atk: 100, def: 100, footprint: 1, tags: ['Insect'], limit: Infinity,
    flags: { noAttack: true, noBattleLpLoss: true },
    text:
      'You can summon 1 "Insect Shell" when one of your Insect monsters (except "Insect Shell") is tributed or destroyed.\n' +
      'Cannot attack. You don\'t lose LP when this card is destroyed in battle.\n' +
      'You can have more than 2 of this card in your Extra Deck.',
  },

  // ───────────────────── Hive Queen deck: Basics ─────────────────────
  { id: 'beatstick-bug', name: 'Beatstick Bug', kind: 'basic',
    atk: 1500, def: 1500, charge: 0, tags: ['Insect'], text: '' },
  { id: 'beetle-defender', name: 'Beetle Defender', kind: 'basic',
    atk: 1000, def: 1500, charge: 1, tags: ['Insect'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker: when an opponent\'s monster attacks, you can redirect the attack to this card.' },
  { id: 'larva', name: 'Larva', kind: 'basic',
    atk: 100, def: 100, charge: 3, tags: ['Insect'], chargeBonus: { insectTribute: 2 },
    text: '+2 Charge when tributed for an Insect monster.' },
  { id: 'dung-beetle', name: 'Dung Beetle', kind: 'basic',
    atk: 1200, def: 1000, charge: 2, tags: ['Insect'], aura: { shellCharge: 2 },
    text: '"Insect Shell"s on your field get +2 Charge.' },
  { id: 'silkworm', name: 'Silkworm', kind: 'basic',
    atk: 500, def: 500, charge: 2, tags: ['Insect'], chargeBonus: { insectTribute: 2, insectAction: 2 },
    text: '+2 Charge when used to pay for an Insect Action card or tributed for an Insect monster.' },

  // ───────────────────── Tribute monsters ─────────────────────
  { id: 'mantis', name: 'Mantis', kind: 'tribute',
    atk: 3000, def: 1500, charge: 0, cost: 7, footprint: 1, tags: ['Insect'],
    text: 'Once per turn: after this card destroys a Barrier or monster, it can attack again.' },
  { id: 'moth', name: 'Moth', kind: 'tribute',
    atk: 1500, def: 1500, charge: 3, cost: 5, footprint: 1, tags: ['Insect'],
    text: 'When summoned: you can play an Insect Action card without paying its cost.' },
  { id: 'wasp', name: 'Wasp', kind: 'tribute',
    atk: 2000, def: 1000, charge: 3, cost: 6, footprint: 1, tags: ['Insect'],
    text: 'You can tribute this card to destroy 1 of your opponent\'s monsters.' },
  { id: 'cicada', name: 'Cicada', kind: 'tribute',
    atk: 2000, def: 2500, charge: 3, cost: 7, footprint: 1, tags: ['Insect'], aura: { shellCharge: 2 },
    text: '"Insect Shell"s gain +2 Charge.\nWhen an Insect is Tribute Summoned: draw 2.' },

  // ───────────────────── Hive Queen deck: Actions (working titles) ─────────────────────
  { id: 'forage', name: 'Forage', kind: 'action',
    charge: 2, cost: 0, setCost: null, tags: ['Insect'],
    text: 'Add 1 Insect from your Deck to your hand.' },
  { id: 'molt', name: 'Molt', kind: 'action',
    charge: 2, cost: 0, setCost: 2, tags: ['Insect'],
    text: 'Tribute 1 Insect: draw 2.' },
  { id: 'paralytic-sting', name: 'Paralytic Sting', kind: 'action',
    charge: 2, cost: 2, setCost: 4, tags: ['Insect'],
    text: 'Tribute 1 Insect: negate a monster\'s effects.' },
  { id: 'swarm-frenzy', name: 'Swarm Frenzy', kind: 'action',
    charge: 2, cost: 2, setCost: 2, tags: ['Insect'],
    text: 'Your Insects gain 1000 ATK this turn.' },
  { id: 'chew-through', name: 'Chew Through', kind: 'action',
    charge: 2, cost: 0, setCost: null, tags: ['Insect'],
    text: 'Tribute 1 Insect: destroy 1 Action card, OR pay +2 cost to flip your opponent\'s Field card face-down until end of turn.' },

  // ───────────────────── Fungus deck: Basics (Ants) ─────────────────────
  { id: 'door-head-ant', name: 'Door Head Ant', kind: 'basic',
    atk: 800, def: 1000, charge: 2, tags: ['Insect', 'Ant'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker.' },
  { id: 'soldier-ant', name: 'Soldier Ant', kind: 'basic',
    atk: 1200, def: 1200, charge: 0, tags: ['Insect', 'Ant'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker.' },
  { id: 'worker-ant', name: 'Worker Ant', kind: 'basic',
    atk: 500, def: 500, charge: 2, tags: ['Insect', 'Ant'],
    text: 'When summoned: draw 1.' },
  { id: 'ant-larva', name: 'Ant Larva', kind: 'basic',
    atk: 100, def: 100, charge: 3, tags: ['Insect', 'Ant'],
    text: 'When summoned: add 1 Ant from your Deck to your hand.' },
  { id: 'fire-ant', name: 'Fire Ant', kind: 'basic',
    atk: 500, def: 500, charge: 1, tags: ['Insect', 'Ant'],
    text: 'Tribute this card and target 1 of your opponent\'s monsters: it can\'t be tributed or attack until the end of your opponent\'s turn.\nCan be used to target Infected monsters during your opponent\'s turn.' },
  { id: 'flying-ant', name: 'Flying Ant', kind: 'basic',
    atk: 1200, def: 500, charge: 0, tags: ['Insect', 'Ant'], keywords: ['Unblockable'], flags: { unblockable: true },
    text: 'Can\'t be blocked.' },

  // ───────────────────── Fungus deck: Tributes ─────────────────────
  { id: 'big-bad', name: 'Big Bad', kind: 'tribute',
    atk: 3000, def: 2500, charge: 4, cost: 12, footprint: 2, tags: ['Insect'],
    text: 'Once per turn: destroy 1 monster and 1 Action card.' },
  { id: 'stalls-bff', name: 'Stalls BFF', kind: 'tribute',
    atk: 2000, def: 2500, charge: 2, cost: 8, footprint: 1, tags: ['Insect', 'Ant'],
    text: 'Once per turn: tribute a monster to flip 1 of your Barriers face-up, then you can destroy 1 Basic monster.' },
  { id: 'emperor', name: 'Emperor', kind: 'tribute',
    atk: 3200, def: 2500, charge: 4, cost: 18, footprint: 2, tags: ['Insect', 'Ant'],
    text: 'When summoned: your opponent can\'t use Action cards until the end of their turn, and negate all their non-Boss monster effects until the end of your turn.' },

  // ───────────────────── Fungus deck: Actions (working titles) ─────────────────────
  { id: 'spore-cloud', name: 'Spore Cloud', kind: 'action',
    charge: 2, cost: 0, setCost: 2, tags: ['Fungus'],
    text: 'Infect 1 monster on the field.' },
  { id: 'rot', name: 'Rot', kind: 'action',
    charge: 2, cost: 2, setCost: 2, tags: ['Fungus'],
    text: 'Destroy 1 Infected monster.' },
  { id: 'hivemind-veto', name: 'Hivemind Veto', kind: 'action',
    charge: 0, cost: 4, setCost: null, tags: ['Fungus'],
    text: 'Tribute 1 Infected monster: negate an Action card activation.' },
  { id: 'puppet-strings', name: 'Puppet Strings', kind: 'action',
    charge: 0, cost: 4, setCost: null, tags: ['Fungus'],
    text: 'When your opponent attacks: change the attack target to an Infected monster.' },
  { id: 'fungal-mending', name: 'Fungal Mending', kind: 'action',
    charge: 2, cost: 4, setCost: null, tags: ['Fungus'],
    text: 'Activate when your monster would be destroyed: it is not destroyed.' },
  { id: 'total-bloom', name: 'Total Bloom', kind: 'action',
    charge: 2, cost: 20, setCost: null, tags: ['Fungus'],
    text: 'Destroy all cards your opponent controls on the field.' },

  // ───────────────────────── Field cards ─────────────────────────
  { id: 'lamp', name: 'Lamp', kind: 'field',
    text: 'Once per turn: reveal the top 5 cards of your Deck and play 1 Basic Insect among them.' },
  { id: 'royal-nursery', name: 'Royal Nursery', kind: 'field',      // working title
    text: 'Once per turn, when an Insect is summoned: add 1 Insect from your Deck to your hand.' },
  { id: 'brood-chamber', name: 'Brood Chamber', kind: 'field',      // working title
    text: 'When an Insect you control is destroyed: add 1 Insect from your Deck to your hand.' },
  { id: 'offering-pit', name: 'Offering Pit', kind: 'field',        // working title
    text: 'Destroy 1 Insect you control: draw 2.' },
  { id: 'ant-trail', name: 'Ant Trail', kind: 'field',              // working title
    text: 'Shuffle 1 Ant from your hand into your Deck: draw 2.' },
  { id: 'spore-vent', name: 'Spore Vent', kind: 'field',            // working title
    text: 'Tribute 1 Infected Ant: Infect 1 of your opponent\'s monsters.' },
  { id: 'rotting-grove', name: 'Rotting Grove', kind: 'field',      // working title
    text: 'Infected non-Ant monsters lose an extra 100 ATK for each Infected monster on the field.' },

  // ───────────────────────── Barrier cards ─────────────────────────
  { id: 'cocoon', name: 'Cocoon', kind: 'barrier', archetype: 'On Destroy', onBreak: 'summonShell',
    text: 'When this card is destroyed: summon 1 "Insect Shell".' },
  { id: 'moldy-shield', name: 'Moldy Shield', kind: 'barrier', archetype: 'On Destroy', onBreak: 'infectAttacker',
    text: 'When this card is destroyed: Infect the attacking monster.' },
];

MC.DECKS = {
  hive: {
    name: 'Hive Queen',
    boss: 'hive-queen',
    barriers: ['cocoon', 'cocoon', 'cocoon', 'cocoon'],
    field: ['lamp', 'royal-nursery', 'brood-chamber', 'offering-pit'],
    main: [
      ['beatstick-bug', 4], ['beetle-defender', 4], ['larva', 4], ['dung-beetle', 4], ['silkworm', 4],
      ['mantis', 3], ['moth', 3], ['wasp', 3], ['cicada', 3],
      ['forage', 4], ['molt', 4], ['paralytic-sting', 4], ['swarm-frenzy', 3], ['chew-through', 3],
    ],
    extra: [['insect-shell', 10]],
    side: [],
  },
  fungus: {
    name: 'Brain-Eating Fungus',
    boss: 'brain-eating-fungus',
    barriers: ['moldy-shield', 'moldy-shield', 'moldy-shield', 'moldy-shield'],
    field: ['lamp', 'ant-trail', 'spore-vent', 'rotting-grove'],
    main: [
      ['door-head-ant', 4], ['soldier-ant', 4], ['worker-ant', 4], ['ant-larva', 4], ['fire-ant', 4], ['flying-ant', 4],
      ['big-bad', 2], ['mantis', 2], ['stalls-bff', 4], ['emperor', 2],
      ['spore-cloud', 4], ['rot', 4], ['hivemind-veto', 2], ['puppet-strings', 2], ['fungal-mending', 2], ['total-bloom', 2],
    ],
    extra: [['insect-shell', 10]],
    side: [],
  },
};
