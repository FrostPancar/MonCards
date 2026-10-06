/*
 * MonCards card database.
 *
 * Plain script (not a module) so the app also runs straight from file://.
 * Cards marked `sample: true` are placeholders to fill the mockup decks —
 * replace them as the real card pool gets designed.
 *
 * Card fields:
 *   id         unique slug
 *   name       display name
 *   kind       'basic' | 'tribute' | 'extra' | 'action' | 'field' | 'barrier' | 'boss'
 *   atk, def   monster stats
 *   charge     Charge value (basic / tribute / action)
 *   cost       Charge Cost (tribute / action)
 *   footprint  monster zones covered (tribute / extra / boss), default 1
 *   type       single Type or null
 *   tags       array of Tags
 *   method     extra deck summoning style: 'fusion' | 'formation'
 *   archetype  barrier archetype label
 *   setCost    extra cost when an Action is set and used on the opponent's turn
 *   text       effect text (newline-separated)
 *   limit      copy-limit override (Infinity = unlimited)
 *   flags      engine hints for the mockup table: noAttack, noBattleLpLoss
 */
window.MC = window.MC || {};

MC.CARDS = [
  // ───────────────────────── Bosses ─────────────────────────
  {
    id: 'hive-queen', name: 'Hive Queen', kind: 'boss',
    atk: 3000, def: 3000, footprint: 3, type: null, tags: ['Insect'],
    text:
      'When your Insects are sent from the field to the GY, put them under this card instead.\n' +
      'At the start of your turn, you can swap an "Insect Remains" on the field with a Basic Insect under this card.\n' +
      'When this card has 15+ cards under it, you can shuffle all of them into your Deck/Extra Deck to summon this card.\n' +
      'When this card is summoned, summon any number of Basic Insects from your Deck.\n' +
      'When this card would be destroyed, you can tribute another Insect instead.',
  },
  {
    id: 'brain-eating-fungus', name: 'Brain-Eating Fungus', kind: 'boss',
    atk: 100, def: 100, footprint: 1, type: 'Earth', tags: ['Fungus', 'Undead'],
    text:
      'Once per turn: Infect an Insect on your field; it gains Charge equal to the number of Infected Insects on your field.\n' +
      'If an Infected Insect dies, the infection moves on to an "Insect Remains".\n' +
      'Opponent\'s monsters that battle your Infected monsters become Infected and lose 100 ATK for each Infected card on the field.\n' +
      'Summon: tribute 4 Infected monsters on either field.\n' +
      'While on your field, all your Insects are Infected.\n' +
      'Gains 400 ATK/DEF for every Infected card on the field.',
  },

  // ───────────────────────── Extra Deck ─────────────────────────
  {
    id: 'insect-remains', name: 'Insect Remains', kind: 'extra', method: 'trigger',
    atk: 100, def: 100, footprint: 1, type: null, tags: ['Insect'], limit: Infinity,
    flags: { noAttack: true, noBattleLpLoss: true },
    text:
      'You can summon 1 "Insect Remains" when one of your Insect monsters (except "Insect Remains") is tributed or destroyed.\n' +
      'Cannot attack. You don\'t lose LP when this card is destroyed in battle.\n' +
      'You can have more than 2 of this card in your Extra Deck.',
  },
  {
    id: 'swarm-cloud', name: 'Swarm Cloud', kind: 'extra', method: 'formation', sample: true,
    atk: 1600, def: 1200, footprint: 2, type: 'Wind', tags: ['Insect'],
    text: 'Formation: flip face-down 2 Insect monsters you control.\nWhen summoned, draw 1 card.',
  },
  {
    id: 'chimera-mantis', name: 'Chimera Mantis', kind: 'extra', method: 'fusion', sample: true,
    atk: 2400, def: 1800, footprint: 2, type: 'Wind', tags: ['Insect'],
    text: 'Fusion: summoned by "Metamorphosis" using 1 Insect with Wind Type + 1 Insect with Earth Type.\nCan attack twice per Battle Phase.',
  },

  // ───────────────────────── Basic monsters ─────────────────────────
  { id: 'soldier-beetle', name: 'Soldier Beetle', kind: 'basic', sample: true,
    atk: 1500, def: 1500, charge: 0, type: 'Earth', tags: ['Insect'], text: '' },
  { id: 'worker-ant', name: 'Worker Ant', kind: 'basic', sample: true,
    atk: 1200, def: 800, charge: 1, type: 'Earth', tags: ['Insect'], text: '' },
  { id: 'larva-sac', name: 'Larva Sac', kind: 'basic', sample: true,
    atk: 100, def: 100, charge: 4, type: 'Earth', tags: ['Insect'],
    text: 'Cannot attack.' , flags: { noAttack: true } },
  { id: 'scout-wasp', name: 'Scout Wasp', kind: 'basic', sample: true,
    atk: 1000, def: 600, charge: 2, type: 'Wind', tags: ['Insect'],
    text: 'When summoned: look at the top 3 cards of your Deck and put them back in any order.' },
  { id: 'drone-mantis', name: 'Drone Mantis', kind: 'basic', sample: true,
    atk: 1300, def: 1000, charge: 1, type: 'Wind', tags: ['Insect', 'Blocker'],
    text: 'Blocker: when an opponent\'s monster attacks, you can redirect the attack to this card.' },
  { id: 'brood-mother', name: 'Brood Mother', kind: 'basic', sample: true,
    atk: 600, def: 900, charge: 3, type: 'Earth', tags: ['Insect'],
    text: 'When this card is tributed: add 1 Basic Insect from your Deck to your hand.' },
  { id: 'swollen-tick', name: 'Swollen Tick', kind: 'basic', sample: true,
    atk: 300, def: 300, charge: 6, type: null, tags: ['Insect', 'Undead'],
    text: 'Can only be tributed for a Tribute Summon (cannot pay Action costs).\nWhen tributed: you take 300 damage.' },
  { id: 'hollow-husk', name: 'Hollow Husk', kind: 'basic', sample: true,
    atk: 1100, def: 1300, charge: 1, type: 'Earth', tags: ['Insect', 'Undead'], text: '' },
  { id: 'spore-carrier', name: 'Spore Carrier', kind: 'basic', sample: true,
    atk: 800, def: 800, charge: 2, type: 'Earth', tags: ['Fungus'],
    text: 'When destroyed: Infect 1 monster on the field.' },
  { id: 'cordyceps-drifter', name: 'Cordyceps Drifter', kind: 'basic', sample: true,
    atk: 500, def: 1100, charge: 3, type: 'Earth', tags: ['Fungus', 'Undead'],
    text: 'Infected monsters you control gain +1 Charge.' },

  // ───────────────────────── Tribute monsters ─────────────────────────
  { id: 'carapace-knight', name: 'Carapace Knight', kind: 'tribute', sample: true,
    atk: 2200, def: 1500, charge: 2, cost: 6, footprint: 1, type: 'Earth', tags: ['Insect'],
    text: 'Once per turn: negate the effects of 1 monster until end of turn.' },
  { id: 'hive-warden', name: 'Hive Warden', kind: 'tribute', sample: true,
    atk: 2600, def: 2400, charge: 3, cost: 8, footprint: 2, type: 'Earth', tags: ['Insect', 'Blocker'],
    text: 'Blocker.\nOther Insects you control cannot be destroyed when ATK = DEF.' },
  { id: 'mycelial-colossus', name: 'Mycelial Colossus', kind: 'tribute', sample: true,
    atk: 2800, def: 3000, charge: 0, cost: 10, footprint: 2, type: 'Earth', tags: ['Fungus', 'Undead'],
    text: 'When summoned: Infect all monsters your opponent controls.\nOpponent\'s Infected monsters have -1 Charge.' },

  // ───────────────────────── Action cards ─────────────────────────
  { id: 'pheromone-trail', name: 'Pheromone Trail', kind: 'action', sample: true,
    charge: 1, cost: 0, setCost: 2, tags: ['Insect'],
    text: 'Add 1 Basic Insect from your Deck to your hand.' },
  { id: 'molting', name: 'Molting', kind: 'action', sample: true,
    charge: 3, cost: 2, setCost: 1,
    text: 'Target 1 Insect you control: it gains 500 ATK/DEF until end of turn.' },
  { id: 'royal-jelly', name: 'Royal Jelly', kind: 'action', sample: true,
    charge: 2, cost: 2, setCost: 2,
    text: 'Target 1 Insect you control: it gains +2 Charge until end of turn.' },
  { id: 'sudden-swarm', name: 'Sudden Swarm', kind: 'action', sample: true,
    charge: 1, cost: 3, setCost: 1,
    text: 'When an opponent\'s monster attacks: summon 1 "Insect Remains" and redirect the attack to it.' },
  { id: 'metamorphosis', name: 'Metamorphosis', kind: 'action', sample: true,
    charge: 2, cost: 3, setCost: 3,
    text: 'Fusion: send the listed materials from your field to the GY to summon 1 Insect Fusion monster from your Extra Deck.' },
  { id: 'spore-burst', name: 'Spore Burst', kind: 'action', sample: true,
    charge: 2, cost: 4, setCost: 2, tags: ['Fungus'],
    text: 'Infect up to 2 monsters your opponent controls.' },

  // ───────────────────────── Field cards ─────────────────────────
  { id: 'the-hive', name: 'The Hive', kind: 'field', sample: true,
    text: 'Basic Insects you control gain +1 Charge.' },
  { id: 'rotting-grove', name: 'Rotting Grove', kind: 'field', sample: true,
    text: 'Infected monsters lose 200 ATK.' },
  { id: 'moonlit-marsh', name: 'Moonlit Marsh', kind: 'field', sample: true,
    text: 'Wind monsters gain 300 DEF.' },
  { id: 'sunken-ruins', name: 'Sunken Ruins', kind: 'field', sample: true,
    text: 'Once per turn: you can swap this card with another card from your Field Deck.' },

  // ───────────────────────── Barrier cards ─────────────────────────
  { id: 'chitin-ward', name: 'Chitin Ward', kind: 'barrier', archetype: 'Basic Protector', sample: true,
    tags: ['Insect'],
    text: 'While face-up: take 300 less damage when your Insect Basic/Extra Deck monsters are destroyed in battle.' },
  { id: 'royal-bulwark', name: 'Royal Bulwark', kind: 'barrier', archetype: 'Advanced Protector', sample: true,
    text: 'While face-up: damage you take when your Tribute/Boss monster is destroyed in battle becomes 800.' },
  { id: 'nectar-reserve', name: 'Nectar Reserve', kind: 'barrier', archetype: 'Charge Support', sample: true,
    text: 'Flip this card face-down: +3 Charge for a Tribute Summon or Action card you are paying for.' },
  { id: 'burst-cocoon', name: 'Burst Cocoon', kind: 'barrier', archetype: 'On Destroy', sample: true,
    text: 'When destroyed: draw 1 card.' },
  { id: 'thorn-hedge', name: 'Thorn Hedge', kind: 'barrier', archetype: 'Blocker', sample: true,
    text: 'Blocker: you can redirect an attack targeting your monster to this card.' },
  { id: 'spore-veil', name: 'Spore Veil', kind: 'barrier', archetype: 'Tag Bonus', sample: true,
    tags: ['Fungus'],
    text: 'While face-up: Fungus monsters you control gain 200 DEF and aren\'t destroyed when ATK = DEF.' },
  { id: 'necrotic-seal', name: 'Necrotic Seal', kind: 'barrier', archetype: 'On Destroy', sample: true,
    text: 'When destroyed: gain 500 LP.' },
];

MC.DECKS = {
  hive: {
    name: 'Hive Queen',
    boss: 'hive-queen',
    barriers: ['chitin-ward', 'royal-bulwark', 'nectar-reserve', 'thorn-hedge'],
    field: ['the-hive', 'rotting-grove', 'moonlit-marsh', 'sunken-ruins'],
    main: [
      ['soldier-beetle', 4], ['worker-ant', 4], ['larva-sac', 4], ['scout-wasp', 4],
      ['drone-mantis', 4], ['brood-mother', 4], ['swollen-tick', 2], ['hollow-husk', 4],
      ['carapace-knight', 3], ['hive-warden', 3],
      ['pheromone-trail', 4], ['molting', 4], ['royal-jelly', 3], ['sudden-swarm', 3],
    ],
    extra: [['insect-remains', 10]],
    side: [
      ['swollen-tick', 2], ['carapace-knight', 1], ['hive-warden', 1],
      ['metamorphosis', 3], ['spore-burst', 4], ['cordyceps-drifter', 4],
    ],
  },
  fungus: {
    name: 'Brain-Eating Fungus',
    boss: 'brain-eating-fungus',
    barriers: ['spore-veil', 'burst-cocoon', 'necrotic-seal', 'thorn-hedge'],
    field: ['rotting-grove', 'the-hive', 'moonlit-marsh', 'sunken-ruins'],
    main: [
      ['spore-carrier', 4], ['cordyceps-drifter', 4], ['hollow-husk', 4], ['worker-ant', 4],
      ['larva-sac', 4], ['soldier-beetle', 4], ['swollen-tick', 2], ['scout-wasp', 3],
      ['mycelial-colossus', 3], ['carapace-knight', 3],
      ['spore-burst', 4], ['pheromone-trail', 4], ['molting', 3], ['sudden-swarm', 4],
    ],
    extra: [['insect-remains', 10]],
    side: [
      ['brood-mother', 4], ['drone-mantis', 4], ['hive-warden', 3], ['royal-jelly', 4],
    ],
  },
};
