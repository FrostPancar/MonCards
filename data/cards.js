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
 *   roles      playstyle tags for the Deck Builder's flavor chart: Swarm, Destruction, Buff/Debuff,
 *              Consistency, Draw (any card kind; see MC.ROLES in core.js)
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
    id: 'hive-queen', name: 'Hive Queen', kind: 'boss', roles: ['Swarm'],
    atk: 3000, def: 3000, footprint: 3, tags: ['Insect'],
    text:
      'When your Insects are sent from the field to the GY, put them under this card instead.\n' +
      'At the start of your turn, you can swap an "Insect Shell" on the field with a Basic Insect under this card.\n' +
      'Summon: when this card has 15+ cards under it, shuffle all of them into your Deck/Extra Deck.\n' +
      'On Summon: summon any number of Basic Insects from your Deck.\n' +
      'When this card would be destroyed, you can tribute another Insect instead.',
  },
  {
    id: 'brain-eating-fungus', name: 'Brain-Eating Fungus', kind: 'boss', roles: ['Buff/Debuff'],
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
    id: 'insect-shell', name: 'Insect Shell', kind: 'extra', roles: ['Swarm'], method: 'trigger',
    atk: 100, def: 100, footprint: 1, tags: ['Insect'], limit: Infinity,
    flags: { noAttack: true, noBattleLpLoss: true },
    text:
      'Summon: when one of your Insect monsters (except "Insect Shell") is tributed or destroyed.\n' +
      'Cannot attack. You don\'t lose LP when this card is destroyed in battle.\n' +
      'You can have more than 2 of this card in your Extra Deck.',
  },

  // ───────────────────── Hive Queen deck: Basics ─────────────────────
  { id: 'beatstick-bug', name: 'Beatstick Bug', kind: 'basic',
    atk: 1500, def: 1500, charge: 0, tags: ['Insect'], text: '' },
  { id: 'beetle-defender', name: 'Beetle Defender', kind: 'basic',
    atk: 1000, def: 1500, charge: 1, tags: ['Insect'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker.' },
  { id: 'larva', name: 'Larva', kind: 'basic',
    atk: 100, def: 100, charge: 3, tags: ['Insect'], chargeBonus: { insectTribute: 2 },
    text: 'On Tribute: +2 Charge when tributed for an Insect monster.' },
  { id: 'dung-beetle', name: 'Dung Beetle', kind: 'basic', roles: ['Buff/Debuff'],
    atk: 1200, def: 1000, charge: 2, tags: ['Insect'], aura: { shellCharge: 2 },
    text: '"Insect Shell"s on your field get +2 Charge.' },
  { id: 'silkworm', name: 'Silkworm', kind: 'basic',
    atk: 500, def: 500, charge: 2, tags: ['Insect'], chargeBonus: { insectTribute: 2, insectAction: 2 },
    text: 'On Tribute: +2 Charge when used for an Insect Action card or an Insect monster.' },

  // ───────────────────── Tribute monsters ─────────────────────
  { id: 'mantis', name: 'Mantis', kind: 'tribute',
    atk: 3000, def: 1500, charge: 0, cost: 7, footprint: 1, tags: ['Insect'],
    text: 'Once per turn: after this card destroys a Barrier or monster, it can attack again.' },
  { id: 'moth', name: 'Moth', kind: 'tribute',
    atk: 1500, def: 1500, charge: 3, cost: 5, footprint: 1, tags: ['Insect'],
    text: 'On Summon: you can play an Insect Action card without paying its cost.' },
  { id: 'wasp', name: 'Wasp', kind: 'tribute', roles: ['Destruction'],
    atk: 2000, def: 1000, charge: 3, cost: 6, footprint: 1, tags: ['Insect'],
    text: 'You can tribute this card to destroy 1 of your opponent\'s monsters.' },
  { id: 'cicada', name: 'Cicada', kind: 'tribute', roles: ['Buff/Debuff', 'Draw'],
    atk: 2000, def: 2500, charge: 3, cost: 7, footprint: 1, tags: ['Insect'], aura: { shellCharge: 2 },
    text: '"Insect Shell"s gain +2 Charge.\nWhen an Insect is Tribute Summoned: draw 2.' },

  // ───────────────────── Hive Queen deck: Actions (working titles) ─────────────────────
  { id: 'forage', name: 'Forage', kind: 'action', roles: ['Consistency'],
    charge: 2, cost: 0, setCost: null, tags: ['Insect'],
    text: 'Add 1 Insect from your Deck to your hand.' },
  { id: 'molt', name: 'Molt', kind: 'action', roles: ['Draw'],
    charge: 2, cost: 0, setCost: 2, tags: ['Insect'],
    text: 'Tribute 1 Insect: draw 2.' },
  { id: 'paralytic-sting', name: 'Paralytic Sting', kind: 'action', roles: ['Buff/Debuff'],
    charge: 2, cost: 2, setCost: 4, tags: ['Insect'],
    text: 'Tribute 1 Insect: negate a monster\'s effects.' },
  { id: 'swarm-frenzy', name: 'Swarm Frenzy', kind: 'action', roles: ['Buff/Debuff'],
    charge: 2, cost: 2, setCost: 2, tags: ['Insect'],
    text: 'Your Insects gain 1000 ATK this turn.' },
  { id: 'chew-through', name: 'Chew Through', kind: 'action', roles: ['Destruction'],
    charge: 2, cost: 0, setCost: null, tags: ['Insect'],
    text: 'Tribute 1 Insect: destroy 1 Action card, OR pay +2 cost to flip your opponent\'s Field card face-down until end of turn.' },

  // ───────────────────── Fungus deck: Basics (Ants) ─────────────────────
  { id: 'door-head-ant', name: 'Door Head Ant', kind: 'basic',
    atk: 800, def: 1000, charge: 2, tags: ['Insect', 'Ant'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker.' },
  { id: 'soldier-ant', name: 'Soldier Ant', kind: 'basic',
    atk: 1200, def: 1200, charge: 0, tags: ['Insect', 'Ant'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Blocker.' },
  { id: 'worker-ant', name: 'Worker Ant', kind: 'basic', roles: ['Draw'],
    atk: 500, def: 500, charge: 2, tags: ['Insect', 'Ant'],
    text: 'On Summon: draw 1.' },
  { id: 'ant-larva', name: 'Ant Larva', kind: 'basic', roles: ['Consistency'],
    atk: 100, def: 100, charge: 3, tags: ['Insect', 'Ant'],
    text: 'On Summon: add 1 Ant from your Deck to your hand.' },
  { id: 'fire-ant', name: 'Fire Ant', kind: 'basic', roles: ['Buff/Debuff'],
    atk: 500, def: 500, charge: 1, tags: ['Insect', 'Ant'],
    text: 'Tribute this card and target 1 of your opponent\'s monsters: it can\'t be tributed or attack until the end of your opponent\'s turn.\nCan be used to target Infected monsters during your opponent\'s turn.' },
  { id: 'flying-ant', name: 'Flying Ant', kind: 'basic',
    atk: 1200, def: 500, charge: 0, tags: ['Insect', 'Ant'], keywords: ['Unblockable'], flags: { unblockable: true },
    text: 'Unblockable.' },

  // ───────────────────── Fungus deck: Tributes ─────────────────────
  { id: 'big-bad', name: 'Big Bad', kind: 'tribute', roles: ['Destruction'],
    atk: 3000, def: 2500, charge: 4, cost: 12, footprint: 2, tags: ['Insect'],
    text: 'Once per turn: destroy 1 monster and 1 Action card.' },
  { id: 'stalls-bff', name: 'Stalls BFF', kind: 'tribute', roles: ['Destruction'],
    atk: 2000, def: 2500, charge: 2, cost: 8, footprint: 1, tags: ['Insect', 'Ant'],
    text: 'Once per turn: tribute a monster to flip 1 of your Barriers face-up, then you can destroy 1 Basic monster.' },
  { id: 'emperor', name: 'Emperor', kind: 'tribute', roles: ['Buff/Debuff'],
    atk: 3200, def: 2500, charge: 4, cost: 18, footprint: 2, tags: ['Insect', 'Ant'],
    text: 'On Summon: your opponent can\'t use Action cards until the end of their turn, and negate all their non-Boss monster effects until the end of your turn.' },

  // ───────────────────── Fungus deck: Actions (working titles) ─────────────────────
  { id: 'spore-cloud', name: 'Spore Cloud', kind: 'action', roles: ['Buff/Debuff'],
    charge: 2, cost: 0, setCost: 2, tags: ['Fungus'],
    text: 'Infect 1 monster on the field.' },
  { id: 'rot', name: 'Rot', kind: 'action', roles: ['Destruction'],
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
  { id: 'total-bloom', name: 'Total Bloom', kind: 'action', roles: ['Destruction'],
    charge: 2, cost: 20, setCost: null, tags: ['Fungus'],
    text: 'Destroy all cards your opponent controls on the field.' },

  // ───────────────────────── Field cards ─────────────────────────
  { id: 'lamp', name: 'Lamp', kind: 'field', roles: ['Consistency', 'Swarm'],
    text: 'Once per turn: reveal the top 5 cards of your Deck and play 1 Basic Insect among them.' },
  { id: 'royal-nursery', name: 'Royal Nursery', kind: 'field', roles: ['Consistency'],      // working title
    text: 'Once per turn: when an Insect is summoned, add 1 Insect from your Deck to your hand.' },
  { id: 'brood-chamber', name: 'Brood Chamber', kind: 'field', roles: ['Consistency'],      // working title
    text: 'When an Insect you control is destroyed: add 1 Insect from your Deck to your hand.' },
  { id: 'offering-pit', name: 'Offering Pit', kind: 'field', roles: ['Draw'],        // working title
    text: 'Destroy 1 Insect you control: draw 2.' },
  { id: 'ant-trail', name: 'Ant Trail', kind: 'field', roles: ['Draw'],              // working title
    text: 'Shuffle 1 Ant from your hand into your Deck: draw 2.' },
  { id: 'spore-vent', name: 'Spore Vent', kind: 'field', roles: ['Buff/Debuff'],            // working title
    text: 'Tribute 1 Infected Ant: Infect 1 of your opponent\'s monsters.' },
  { id: 'rotting-grove', name: 'Rotting Grove', kind: 'field', roles: ['Buff/Debuff'],      // working title
    text: 'Infected non-Ant monsters lose an extra 100 ATK for each Infected monster on the field.' },

  // ───────────────────────── Barrier cards ─────────────────────────
  { id: 'cocoon', name: 'Cocoon', kind: 'barrier', roles: ['Swarm'], archetype: 'On Destroy', onBreak: 'summonShell',
    text: 'On Destroy: summon 1 "Insect Shell".' },
  { id: 'moldy-shield', name: 'Moldy Shield', kind: 'barrier', roles: ['Buff/Debuff'], archetype: 'On Destroy', onBreak: 'infectAttacker',
    text: 'On Destroy: Infect the attacking monster.' },
  // ═════════════════════ Bedrock Golem deck (Stone) ═════════════════════
  // Rubble: a destroyed Stone monster with a "Rubble:" line goes to a free Barrier Zone
  // instead of the GY. There it counts as a face-up Barrier and its Rubble effect is live.
  // Rubble can be tributed to pay Charge costs. Excavate = summon a Rubble card back.

  // Boss
  {
    id: 'bedrock-titan', name: 'Bedrock Titan', kind: 'boss', roles: ['Swarm', 'Buff/Debuff'],
    atk: 3500, def: 3500, footprint: 3, tags: ['Stone', 'Golem'],
    text:
      'Boss Zone: once per turn, Excavate 1 Rubble card.\n' +
      'Summon: tribute Rubble cards with a total Charge of 12 or more.\n' +
      'On Summon: place any number of Stone monsters from your GY in your free Barrier Zones as Rubble.\n' +
      'Gains 300 ATK/DEF for each Rubble card you control.\n' +
      'When this card would be destroyed, you can send 1 of your Rubble cards to the GY instead.',
  },

  // Basics
  { id: 'pebble-sprite', name: 'Pebble Sprite', kind: 'basic',
    atk: 300, def: 300, charge: 3, tags: ['Stone'], flags: { rubble: true }, chargeBonus: { rubble: 2 },
    text: 'Rubble: +2 Charge when tributed from the Barrier Zone.' },
  { id: 'cobble-guard', name: 'Cobble Guard', kind: 'basic',
    atk: 1000, def: 1600, charge: 1, tags: ['Stone', 'Golem'], keywords: ['Blocker'], flags: { blocker: true, rubble: true },
    text: 'Blocker.\nRubble: when an opponent\'s monster attacks your monster, you can redirect the attack to this Rubble.' },
  { id: 'quarry-worker', name: 'Quarry Worker', kind: 'basic', roles: ['Consistency', 'Draw'],
    atk: 1200, def: 1000, charge: 2, tags: ['Stone'], flags: { rubble: true },
    text: 'On Summon: look at the top 3 cards of your Deck, add 1 Stone card among them to your hand and put the rest on the bottom.\nRubble: once per turn, shuffle 1 card from your hand into your Deck to draw 1.' },
  { id: 'granite-brute', name: 'Granite Brute', kind: 'basic', roles: ['Buff/Debuff'],
    atk: 1500, def: 1500, charge: 0, tags: ['Stone', 'Golem'], flags: { rubble: true },
    text: 'Rubble: your Stone monsters gain 200 DEF.' },
  { id: 'geode-crawler', name: 'Geode Crawler', kind: 'basic', roles: ['Draw'],
    atk: 800, def: 800, charge: 2, tags: ['Stone'], flags: { rubble: true },
    text: 'Rubble: when this Rubble is destroyed by an attack, draw 2.' },
  { id: 'shale-slinger', name: 'Shale Slinger', kind: 'basic', roles: ['Destruction', 'Buff/Debuff'],
    atk: 1300, def: 700, charge: 1, tags: ['Stone'], flags: { rubble: true },
    text: 'Once per turn: send 1 of your Rubble cards to the GY to destroy 1 face-up Action card.\nRubble: monsters that attack this Rubble lose 300 ATK until end of turn.' },

  // Tributes
  { id: 'basalt-sentinel', name: 'Basalt Sentinel', kind: 'tribute',
    atk: 1800, def: 2400, charge: 2, cost: 6, footprint: 1, tags: ['Stone', 'Golem'], keywords: ['Blocker'], flags: { blocker: true, rubble: true },
    text: 'Blocker.\nRubble: once per turn, your other Rubble cards can\'t be destroyed by an attack.' },
  { id: 'obsidian-edge', name: 'Obsidian Edge', kind: 'tribute', roles: ['Swarm', 'Buff/Debuff'],
    atk: 2800, def: 1200, charge: 1, cost: 7, footprint: 1, tags: ['Stone'], flags: { rubble: true },
    text: 'Once per turn: when this card destroys a monster, Excavate 1 Rubble card.\nRubble: once per turn, 1 Stone monster you control gains 500 ATK until end of turn.' },
  { id: 'monolith-warden', name: 'Monolith Warden', kind: 'tribute', roles: ['Swarm'],
    atk: 2600, def: 3000, charge: 3, cost: 10, footprint: 2, tags: ['Stone', 'Golem'], flags: { rubble: true },
    text: 'On Summon: Excavate up to 2 Basic Stone monsters.\nRubble: an attack only destroys this Rubble if the attacker has 2000 or more ATK.' },
  { id: 'crag-behemoth', name: 'Crag Behemoth', kind: 'tribute', roles: ['Destruction', 'Buff/Debuff'],
    atk: 3200, def: 2800, charge: 4, cost: 14, footprint: 2, tags: ['Stone', 'Golem'], flags: { rubble: true },
    text: 'Gains 300 ATK for each Rubble card you control.\nOnce per turn: tribute 1 of your Rubble cards to destroy 1 card on the field.\nRubble: your Excavated monsters gain 500 ATK.' },

  // Actions
  { id: 'excavation', name: 'Excavation', kind: 'action', roles: ['Swarm'],
    charge: 2, cost: 1, setCost: 1, tags: ['Stone'],
    text: 'Excavate 1 Rubble card.' },
  { id: 'landslide', name: 'Landslide', kind: 'action', roles: ['Destruction'],
    charge: 2, cost: 4, setCost: 2, tags: ['Stone'],
    text: 'Send any number of your Rubble cards to the GY: destroy that many of your opponent\'s monsters with 1500 or less DEF.' },
  { id: 'reinforce', name: 'Reinforce', kind: 'action',
    charge: 2, cost: 0, setCost: 2, tags: ['Stone'],
    text: 'Move 1 Stone monster you control to a free Barrier Zone as Rubble.' },
  { id: 'petrify', name: 'Petrify', kind: 'action', roles: ['Buff/Debuff'],
    charge: 2, cost: 3, setCost: 2, tags: ['Stone'],
    text: 'Target 1 of your opponent\'s monsters: it gains the Stone tag and can\'t attack until the end of their next turn. If it is destroyed while Stone, place it in your Barrier Zone as Rubble.' },
  { id: 'rockfall', name: 'Rockfall', kind: 'action', roles: ['Destruction'],
    charge: 1, cost: 2, setCost: 0, tags: ['Stone'],
    text: 'When an opponent\'s monster attacks one of your Rubble cards: destroy the attacking monster.' },
  { id: 'masons-blueprint', name: 'Mason\'s Blueprint', kind: 'action', roles: ['Consistency'],
    charge: 3, cost: 0, setCost: null, tags: ['Stone'],
    text: 'Add 1 Stone Tribute monster from your Deck to your hand. You can\'t Excavate this turn.' },

  // Extra Deck
  { id: 'rubble-hound', name: 'Rubble Hound', kind: 'extra', roles: ['Swarm'], method: 'formation',
    atk: 1400, def: 1000, footprint: 1, tags: ['Stone'],
    text: 'Summon: send 2 Basic Stone monsters from your hand or field to the GY.\nOn Summon: Excavate 1 Rubble card.' },
  { id: 'gravel-swarm', name: 'Gravel Swarm', kind: 'extra', method: 'charge',
    atk: 1000, def: 1000, footprint: 2, tags: ['Stone'],
    text: 'Summon: pay a Charge Cost of 6 using only Rubble cards.\nCan\'t be destroyed in battle while you control 2 or more Rubble cards.' },
  { id: 'keystone-golem', name: 'Keystone Golem', kind: 'extra', method: 'special',
    atk: 3000, def: 3000, footprint: 2, tags: ['Stone', 'Golem'],
    text: 'Summon: when all 4 of your Barrier Zones hold Rubble, send all of them to the GY.\nYour opponent can\'t attack your other monsters.' },
  { id: 'fossil-wyrm', name: 'Fossil Wyrm', kind: 'extra', roles: ['Consistency'], method: 'special',
    atk: 2400, def: 2000, footprint: 1, tags: ['Stone'],
    text: 'Summon: shuffle 3 Stone monsters with different names from your GY into your Deck.\nOnce per turn: banish 1 card in your GY to place 1 Stone monster from your GY in a free Barrier Zone as Rubble.' },
  { id: 'gargoyle-sentry', name: 'Gargoyle Sentry', kind: 'extra', roles: ['Swarm'], method: 'special',
    atk: 1800, def: 1800, footprint: 1, tags: ['Stone', 'Golem'], keywords: ['Blocker'], flags: { blocker: true },
    text: 'Summon: when one of your Stone monsters becomes Rubble, send that Rubble to the GY (this works on either player\'s turn).\nBlocker.' },

  // Field
  { id: 'quarry', name: 'Quarry', kind: 'field', roles: ['Draw'],
    text: 'Once per turn: when one of your Stone monsters becomes Rubble, draw 1.' },
  { id: 'fault-line', name: 'Fault Line', kind: 'field', roles: ['Buff/Debuff'],
    text: 'Your Rubble cards gain +1 Charge.' },
  { id: 'mountain-pass', name: 'Mountain Pass', kind: 'field',
    text: 'If able, your opponent\'s monsters must attack a Rubble card.' },
  { id: 'ancient-ruins', name: 'Ancient Ruins', kind: 'field', roles: ['Consistency'],
    text: 'Once per turn: swap 1 of your Rubble cards with a Stone monster in your hand.' },

  // Barriers
  { id: 'cairn', name: 'Cairn', kind: 'barrier', roles: ['Swarm'], archetype: 'On Destroy',
    text: 'On Destroy: Excavate 1 Rubble card.' },
  { id: 'bedrock-bulwark', name: 'Bedrock Bulwark', kind: 'barrier', roles: ['Buff/Debuff'], archetype: 'Tag Bonus', tags: ['Stone'],
    text: 'While face-up: your Stone monsters gain 300 DEF.' },
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
  golem: {
    name: 'Bedrock Golems',
    boss: 'bedrock-titan',
    barriers: ['cairn', 'cairn', 'bedrock-bulwark', 'bedrock-bulwark'],
    field: ['quarry', 'fault-line', 'mountain-pass', 'ancient-ruins'],
    main: [
      ['pebble-sprite', 4], ['cobble-guard', 4], ['quarry-worker', 4], ['granite-brute', 4], ['geode-crawler', 3], ['shale-slinger', 3],
      ['basalt-sentinel', 3], ['obsidian-edge', 3], ['monolith-warden', 2], ['crag-behemoth', 2],
      ['excavation', 4], ['landslide', 3], ['reinforce', 3], ['petrify', 3], ['rockfall', 3], ['masons-blueprint', 2],
    ],
    extra: [['rubble-hound', 2], ['gravel-swarm', 2], ['keystone-golem', 2], ['fossil-wyrm', 2], ['gargoyle-sentry', 2]],
    side: [],
  },
};

/**
 * Roles for shared custom cards made in the Card Creator (they live in the shared store, not this file).
 * Applied only while a card has no `roles` of its own; once someone sets roles in the Card Creator
 * (even none), those win.
 */
MC.ROLE_SEED = {
  '4-leaf-clover-farmer': ['Draw'],
  'arcane-idol': ['Consistency'],
  'arch-hemonarch-gk6p': ['Buff/Debuff'],
  'blazing-idol': ['Destruction'],
  'blood-battlemage-o9v1': ['Buff/Debuff'],
  'blood-brute-747r': ['Buff/Debuff'],
  'blood-channeler-bo2j': ['Buff/Debuff'],
  'blood-exchange-xzfl': ['Buff/Debuff'],
  'blood-rush-mug7': ['Destruction'],
  'blood-siphon-ta66': ['Buff/Debuff'],
  'blood-urn-np19': ['Buff/Debuff'],
  'blood-well-q5ci': ['Draw'],
  'blood-worm-2hhp': ['Buff/Debuff'],
  'brain-worm': ['Buff/Debuff', 'Destruction'],
  'charity': ['Draw'],
  'crimson-sky-cjhb': ['Buff/Debuff'],
  'cult-initiate-a3aa': ['Buff/Debuff', 'Swarm'],
  'cultist-gpk9': ['Swarm'],
  'dry-plains-9j85': ['Buff/Debuff'],
  'dual-blood-wielder-40cx': ['Buff/Debuff'],
  'energized-barrier': ['Buff/Debuff'],
  'energy-shield-pu93': ['Buff/Debuff'],
  'eternal-phoenix': ['Swarm', 'Destruction'],
  'forgotten-god': ['Swarm'],
  'hemoglyph-tablet-1d6j': ['Swarm', 'Buff/Debuff'],
  'mana-golem': ['Consistency'],
  'normalize-d91y': ['Draw'],
  'overcharge-grid-km9e': ['Buff/Debuff'],
  'parallel-focus': ['Draw'],
  'rock-formation-myi4': ['Consistency'],
  'sealed-curse': ['Swarm'],
  'terraform-mywl': ['Consistency'],
  'unearthed-idol': ['Swarm'],
};
