# MonCards — Game Rules (Draft v0.2)

> Working draft. Sections marked **🔶 Open question** are gaps or ambiguities in the
> current design that need a decision before the rules are final.

---

## 1. Overview

MonCards is a two-player digital card game. Each player brings a **Main Deck**, a
**Side Deck**, an **Extra Deck**, a **Field Deck**, **4 Barrier cards** and **1 Boss
Monster**. Every card is revealed to the opponent before the duel, so the game is about
reading the matchup, not hiding information.

You win by reducing your opponent's **Life Points (LP)** from **6000** to **0**.

---

## 2. Deck Construction

| Pile           | Size          | Max copies per card | Notes                                         |
|----------------|---------------|---------------------|-----------------------------------------------|
| Main Deck      | 50 cards      | 4                   | Basic monsters, Tribute monsters, Action cards |
| Side Deck      | 15 cards      | 4                   | Swapped with the Main Deck before the duel     |
| Extra Deck     | 10 cards      | 2                   | Extra Deck monsters only                       |
| Field Deck     | 4 cards       | 1                   | Field cards only                               |
| Barrier cards  | 4 cards       | 4                   | Duplicates allowed (e.g. 4× *Cocoon*); see §6.6 |
| Boss Monster   | 1 card        | —                   |                                               |

- Some cards override the copy limit in their own text (e.g. *Insect Shell*: "you can
  have more than 2 of this card in your Extra Deck").
- 🔶 **Open question:** does the 4-copy limit count Main + Side combined (Yu-Gi-Oh! style)
  or each pile separately? *The index app currently validates Main + Side combined.*
- Neither sample deck has a Side Deck yet; the index flags this as a warning, not an error.

### Card backs

Every pile has its own card back, so you can always tell where a face-down card came from:

| Back       | Used by                                   |
|------------|-------------------------------------------|
| Main       | Main Deck cards (hand, Deck, set Actions) |
| Extra      | Extra Deck                                |
| Boss       | Boss Monster                              |
| Field      | Field cards (e.g. while face-down)        |
| Barrier    | Barriers (a destroyed Barrier shows this) |

---

## 3. Board Layout

Each player has the following zones:

| Zone              | Count | Contents                                                   |
|-------------------|-------|------------------------------------------------------------|
| Monster Zones     | 6     | Basic, Tribute, Extra Deck monsters and a summoned Boss    |
| Action Zones      | 3     | Action cards (face-up or set face-down)                    |
| Field Zone        | 1     | Your chosen Field card                                     |
| Barrier Zones     | 4     | Your 4 Barrier cards                                       |
| Boss Zone         | 1     | Your Boss Monster while it is not on the field             |

Off-board piles: **Deck**, **Extra Deck**, **Field Deck**, **Graveyard (GY)**.

### Footprint

Tribute monsters, Extra Deck monsters and Bosses have a **Footprint size**. A monster
with Footprint *N* occupies *N* adjacent Monster Zones. You can't summon a monster if
you don't have enough adjacent free zones for its Footprint. Basic monsters always have
Footprint 1.

---

## 4. Duel Setup

1. **Reveal** all cards (all decks, Barriers, Boss) to the opponent.
2. **Side-decking:** swap any cards between your Main Deck and Side Deck (Main stays 50).
3. Place your **Boss** face-up in your Boss Zone and your **4 Barriers** face-up in your
   Barrier Zones.
4. **Choose your Field card** from your Field Deck *after seeing your opponent's deck*,
   and place it face-down in your Field Zone.
5. **Shuffle** your Main Deck and **draw 7**.
6. **Flip** both Field cards face-up.

Starting LP: **6000** each.

---

## 5. Turn Structure

**Draw Phase → Standby Phase → Main Phase → Battle Phase → End Phase**

There is **no Main Phase 2**. Anything you want to do after attacking must be done
through effects that can be used in the Battle Phase.

### First-turn restrictions

- Player 1 does **not draw** on their first turn and **cannot attack**.
- On **turn 1** **neither player can summon Tribute
  or Extra Deck monsters**.
- 🔶 **Open question:** does "turn 1" mean only the first turn of the duel, or each
  player's first turn? *The mockup table applies it to the first turn of the duel only.*

---

## 6. Card Types

Every card has a **frame color** that tells you its type at a glance.

| Card type        | Frame   | Lives in        | Has Charge | Has Charge Cost | Footprint |
|------------------|---------|-----------------|------------|-----------------|-----------|
| Basic Monster    | Bone    | Main Deck       | ✅          | —               | 1         |
| Tribute Monster  | Crimson | Main Deck       | ✅ (opt.)   | ✅ 5–30          | ✅         |
| Extra Deck Mon.  | Teal    | Extra Deck      | ❌          | special          | ✅         |
| Action           | Amber   | Main Deck       | ✅          | ✅               | —         |
| Field            | Green   | Field Deck      | —          | —               | —         |
| Barrier          | Blue    | Barrier Zones   | —          | —               | —         |
| Boss Monster     | Violet  | Boss Zone       | (opt.)     | special          | ✅         |

### Shared monster anatomy

- **Name**
- **ATK / DEF** — there are no battle positions. A monster uses **ATK when attacking**
  and **DEF when being attacked**.
- **Tags** — any number (e.g. *Insect*, *Ant*, *Fungus*, *Undead*). There are **no Types**;
  tags are the only creature classification, and each tag has a pixel icon.
- **Keywords** — rules shorthand shown next to tags (see §8 for *Blocker* / *Unblockable*).
- **Charge** — a number used to pay Charge Costs (see §7).
- **Effect text** (optional).

### 6.1 Basic Monsters

- **Normal Summoned without restriction** — no once-per-turn limit.
- Range from 1500/1500 0-Charge vanilla beatsticks to 100/100 4-Charge tribute fodder.
- Design guideline: **better cards carry less Charge**.
- 5+ Charge Basic monsters are rare and either have a **drawback when used to pay a
  cost** or are **limited** to only one use (only Tribute fodder, *or* only Action cost).
- Many important Tribute monsters have 1500 DEF, so 1500 ATK beatsticks stay relevant.

### 6.2 Tribute Monsters

- Different frame color from Basic monsters.
- Summoned by **tributing Basic monsters** you control whose **total Charge ≥ the
  Tribute monster's Charge Cost**.
- May have their own Charge value (so they can be tributed for something bigger).
- Most end-board pieces and main threats are Tribute monsters.

| Charge Cost | Profile                                                                  |
|-------------|--------------------------------------------------------------------------|
| 5–6         | Easy to summon, modest stats, useful utility effects (negate a monster's effect until end of turn, destroy an Action card, opponent's cards have less Charge until end of their turn, …) |
| 7–8         | Higher stats, more versatile                                              |
| 9–30        | Bosses-in-waiting / win conditions                                        |

- 🔶 **Open question:** can Tribute monsters themselves be tributed to pay for another
  Tribute monster? *(The rule text says "tributed basic cards".)*

### 6.3 Extra Deck Monsters

- Different frame color again. More accessible than Tribute monsters, so they are
  weaker attackers, **combo starters/extenders** or **consistency** pieces. Archetype-
  specific strong monsters may also live here.
- **No Charge value.**
- Two summoning styles:
  - **Fusion style** — summoned by an Action card that requires semi-specific monsters
    (think *Absolute Zero* / *Mask Change*).
  - **Formation style** (Synchro/Xyz replacement) — **flip face-down** a number of your
    monsters with the required Tag **equal to the Footprint size** of the Extra Deck
    monster.
- 🔶 **Open question:** for Formation style, does the Extra Deck monster sit on top of the
  flipped-down materials (covering exactly those zones), and what happens to the
  materials when it leaves the field?
- 🔶 **Open question:** destroyed Extra Deck monsters go to the GY (assumed) or back to
  the Extra Deck?

### 6.4 Action Cards

Spells and Traps are fused into a single **Action** type.

- Have their own **Charge** and a **Charge Cost**.
- Unlike Tribute monsters, you can pay an Action's Charge Cost by **tributing monsters
  and/or discarding cards from your hand** (including other Action cards) — each card
  contributes its Charge.
- Can be **set** face-down in an Action Zone and **activated on the opponent's turn**,
  but doing so has an **additional cost** (printed on the card).
- 🔶 **Open question:** where do resolved Action cards go (GY assumed) and can face-up
  "continuous" Actions stay on the field?

### 6.5 Field Cards

- Chosen from your **Field Deck** after seeing the opponent's deck; goes to your Field
  Zone and **stays there**.
- A few decks can **swap** their Field card with another from their Field Deck.
- Some effects can **flip the opponent's Field card face-down** until end of turn /
  start of next turn (its effect is off while face-down).

### 6.6 Barrier Cards

- Placed **face-up at the start** of the duel; can have effects while face-up.
- **Direct attacks are only possible once all 4 of the opponent's Barriers are destroyed.**
- **Destroying a Barrier** = flipping it face-down.

Barrier archetypes:

| Archetype            | Effect pattern                                                              |
|----------------------|------------------------------------------------------------------------------|
| **Basic Protector**  | While face-up, take **100** less damage when your Basic/Extra Deck monsters are destroyed in battle (**300** less for Tag-specific versions). **Max 1 Basic Protector per deck.** |
| **Advanced Protector** | Reduce damage taken when a Tribute/Boss monster is destroyed in battle to **800 / 600 / 500** |
| **Charge Support**   | Flip face-down to gain bonus Charge when Tribute Summoning or playing an Action card |
| **On-Destroy**       | When destroyed: draw, stun another attacker, deal/heal LP, tribute a monster to destroy a monster, add itself to hand as an unusable high-Charge Action card to pay other costs, … |
| **Blocker**          | Can redirect an attack to itself to save a monster                           |
| **Tag Bonus**        | While face-up, *X*-tagged monsters gain ATK/DEF/Charge, or aren't destroyed when ATK = DEF |

### 6.7 Boss Monster

- Starts the duel **face-up in its own Boss Zone**.
- Can be **placed on the field** when its requirements are met (printed on the card).
- When destroyed, it **returns to the Boss Zone** (not the GY).
- **Can have effects while in the Boss Zone.**

---

## 7. Charge

Charge is the game's resource. It is printed on cards, not tracked as a pool.

- **Tribute Summon:** tribute Basic monsters from your field; their Charge total must be
  **≥** the Tribute monster's Charge Cost.
- **Action cards:** pay the Charge Cost by tributing monsters and/or discarding cards from
  hand (Action cards included). Their Charge totals must be **≥** the cost.
- Effects can modify Charge (e.g. *Charge Support* Barriers, *Brain-Eating Fungus*
  infections, "opponent's cards have less Charge until end of their turn").
- 🔶 **Open question:** is overpaying allowed with no refund (assumed yes)?

---

## 8. Battle

During your Battle Phase, each of your monsters may attack once. 🔶 *(Once per monster
per turn assumed.)*

### Choosing a target

An attacker can target:

1. **An opponent's monster**, or
2. **An opponent's face-up Barrier**, or
3. **The opponent directly** — only if **all** their Barriers are face-down.

Attacks can be **redirected** by **Blocker** monsters/Barriers or by Action card effects.

- **Blocker:** when an opponent's monster attacks, the Blocker's controller can redirect the
  attack to the Blocker.
- **Unblockable** ("can't be blocked"): Blockers can't redirect this monster's attacks.

### Resolving an attack on a monster

Compare the attacker's **ATK** with the target's **DEF**:

| Result        | Outcome                                    |
|---------------|--------------------------------------------|
| ATK > DEF     | Target is destroyed                         |
| ATK = DEF     | **Both** monsters are destroyed             |
| ATK < DEF     | 🔶 **Open question** — nothing happens? attacker destroyed? *(Mockup: nothing happens.)* |

### Battle damage

Damage is **fixed per destroyed monster**, not the ATK/DEF difference. The **controller
of the destroyed monster** loses:

| Destroyed in battle            | LP lost |
|--------------------------------|---------|
| Basic or Extra Deck monster    | **500**  |
| Tribute monster or Boss        | **1000** |

- **Attacking a Barrier** destroys it (flip face-down). No LP damage.
  🔶 *Does a Barrier have DEF, or does any attack destroy it?* (Mockup: any attack.)
- **Direct attack** deals damage equal to the attacker's **ATK**.

---

## 9. Card Anatomy

Card anatomy, top to bottom (the app renders cards this way):

```
┌──────────────────────────────┐
│ NAME                         │
│ TRIBUTE              COST 7  │  ← card type · Charge Cost (Tribute)
│ ┌──────────────────────────┐ │
│ │ pixel art          ◆◆◆   │ │  ← Charge as icons (no number; ◇ = 0)
│ └──────────────────────────┘ │
│ [🐜 Insect] [Ant]       ▣▣   │  ← Tags (with icons) · Footprint
│ ON SUMMON: effect text…      │  ← keyword leads the line
│ ⚔ 2200            ⛨ 1500     │  ← ATK / DEF   (Actions: COST n · SET +n)
└──────────────────────────────┘
```

The frame color shows the card type (§6). Every card has a white rim and black outline,
like a physical card.

**Effect keywords** open a line when they fit: *Once per turn*, *On Summon*, *On Destroy*,
*On Tribute*, *Summon* (how the card is summoned), *Blocker*, *Unblockable*.

---

## 10. Decklists

Working titles (names not decided yet) are marked *†*. 🔶 Footprints for Tribute monsters
weren't specified: the app uses 1, except *Big Bad* and *Emperor* (2). Some tags are
guesses (marked *‡*).

### Shared cards

**Insect Shell** *(Extra Deck)* — 100/100, Footprint 1, Tags: Insect
- You can summon 1 *Insect Shell* when one of your Insect monsters (except *Insect Shell*)
  is tributed or destroyed.
- Cannot attack. You don't lose LP when this card is destroyed in battle.
- You can have more than 2 copies of this card in your Extra Deck.

Both decks run **10× Insect Shell** as their entire Extra Deck. *(Renamed from
"Insect Remains" to match the newer card text.)*

**Lamp** *(Field)* — Once per turn: reveal the top 5 cards of your Deck and play 1 Basic
Insect among them.

**Mantis** *(Tribute, both decks)* — 3000/1500, Cost 7, Charge 0. Once per turn: after
this card destroys a Barrier or monster, it can attack again.

### Hive Queen deck

**Boss — Hive Queen** — 3000/3000, Footprint 3, Tags: Insect
- When your Insects are sent from the field to the GY, put them under this card instead.
- At the start of your turn, you can swap an *Insect Shell* on the field with a Basic
  Insect under this card.
- When this card has at least 15 cards under it, you can shuffle all of them into your
  Deck / Extra Deck to summon this card.
- When this card is summoned, summon any number of Basic Insects from your Deck.
- When this card would be destroyed, you can tribute another Insect instead.

**Barriers:** 4× **Cocoon** — When destroyed: summon 1 *Insect Shell*.

**Field Deck:** Lamp · Royal Nursery† (once per turn, when an Insect is summoned: add an
Insect to hand) · Brood Chamber† (when an Insect is destroyed: add an Insect to hand; not
once per turn) · Offering Pit† (destroy an Insect: draw 2)

| # | Card | Kind | ATK/DEF | Charge | Cost | Text |
|---|------|------|---------|--------|------|------|
| 4 | Beatstick Bug | Basic | 1500/1500 | 0 | — | — |
| 4 | Beetle Defender | Basic | 1000/1500 | 1 | — | Blocker |
| 4 | Larva | Basic | 100/100 | 3 | — | +2 Charge when tributed for an Insect monster |
| 4 | Dung Beetle | Basic | 1200/1000 | 2 | — | Insect Shells on your field get +2 Charge |
| 4 | Silkworm | Basic | 500/500 | 2 | — | +2 Charge when paying for an Insect Action or tributed for an Insect monster |
| 3 | Mantis | Tribute | 3000/1500 | 0 | 7 | See shared cards |
| 3 | Moth | Tribute | 1500/1500 | 3 | 5 | When summoned: play an Insect Action without paying its cost |
| 3 | Wasp | Tribute | 2000/1000 | 3 | 6 | Tribute this to destroy an opponent's monster |
| 3 | Cicada | Tribute | 2000/2500 | 3 | 7 | Insect Shells gain +2 Charge; draw 2 when an Insect is Tribute Summoned |
| 4 | Forage† | Action | — | 2 | 0 (set ?) | Add an Insect from Deck to hand |
| 4 | Molt† | Action | — | 2 | 0 (set +2) | Tribute an Insect: draw 2 |
| 4 | Paralytic Sting† | Action | — | 2 | 2 (set +4) | Tribute an Insect: negate a monster's effects |
| 3 | Swarm Frenzy† | Action | — | 2 | 2 (set +2) | Your Insects gain 1000 ATK this turn |
| 3 | Chew Through† | Action | — | 2 | 0 (set ?) | Tribute an Insect: destroy an Action card, or pay +2 to flip the opponent's Field card face-down until end of turn |

20 Basic + 12 Tribute + 18 Action = **50**. Queen Actions are tagged *Insect* (so Moth and
Silkworm can use them).

### Brain-Eating Fungus deck

**Boss — Brain-Eating Fungus** — 100/100, Tags: Fungus, Undead (Footprint assumed 1)
- Once per turn, you can **infect** an Insect on your field (it becomes *Infected*); it
  gains Charge equal to the number of Infected Insects on your field.
- If an Infected Insect dies, the infection moves to an *Insect Shell*.
- Opponent's monsters that battle your Infected monsters also become Infected and lose
  100 ATK for each Infected card on the field.
- You can summon this card by tributing 4 Infected monsters on **either** field.
- While this card is on your field, all your Insects are Infected.
- Gains 400 ATK/DEF for every Infected card on the field.

**Barriers:** 4× **Moldy Shield** — When destroyed: Infect the attacking monster.

**Field Deck:** Lamp · Ant Trail† (shuffle an Ant from hand into Deck: draw 2) ·
Spore Vent† (tribute an Infected Ant: Infect an opponent's monster) · Rotting Grove†
(Infected non-Ant monsters lose an extra 100 ATK for each Infected monster on the field)

| # | Card | Kind | ATK/DEF | Charge | Cost | Text |
|---|------|------|---------|--------|------|------|
| 4 | Door Head Ant | Basic | 800/1000 | 2 | — | Blocker |
| 4 | Soldier Ant | Basic | 1200/1200 | 0 | — | Blocker |
| 4 | Worker Ant | Basic | 500/500 | 2 | — | When summoned: draw 1 |
| 4 | Ant Larva | Basic | 100/100 | 3 | — | When summoned: add an Ant from Deck to hand |
| 4 | Fire Ant | Basic | 500/500 | 1 | — | Tribute this and target an opponent's monster: it can't be tributed or attack until end of opponent's turn. Can target Infected monsters during the opponent's turn |
| 4 | Flying Ant | Basic | 1200/500 | 0 | — | Can't be blocked |
| 2 | Big Bad ‡ | Tribute | 3000/2500 | 4 | 12 | Once per turn: destroy a monster and an Action card |
| 2 | Mantis | Tribute | 3000/1500 | 0 | 7 | See shared cards |
| 4 | Stalls BFF ‡ | Tribute | 2000/2500 | 2 | 8 | Once per turn: tribute a monster to flip one of your Barriers face-up, then you can destroy a Basic monster |
| 2 | Emperor ‡ | Tribute | 3200/2500 | 4 | 18 | When summoned: opponent can't use Action cards until end of their turn, and negate all their non-Boss monster effects until end of your turn |
| 4 | Spore Cloud† | Action | — | 2 | 0 (set +2) | Infect a monster on the field |
| 4 | Rot† | Action | — | 2 | 2 (set +2) | Destroy an Infected monster |
| 2 | Hivemind Veto† | Action | — | 0 | 4 (set ?) | Tribute an Infected monster: negate an Action activation |
| 2 | Puppet Strings† | Action | — | 0 | 4 (set ?) | When the opponent attacks: change the target to an Infected monster |
| 2 | Fungal Mending† | Action | — | 2 | 4 (set ?) | When your monster would be destroyed: it is not destroyed |
| 2 | Total Bloom† | Action | — | 2 | 20 (set ?) | Destroy all cards your opponent controls on the field |

24 Basic + 10 Tribute + 16 Action = **50**. Ants are tagged *Insect* + *Ant*; Fungus Actions
are tagged *Fungus*.

🔶 **Open questions for these decks**
- "set ?" — the extra cost for using these Actions on the opponent's turn wasn't given.
  Several are reactive (Veto, Puppet Strings, Mending): is their set cost 0?
- Tribute monster footprints (see above).
- ‡ Tags for Big Bad, Stalls BFF and Emperor are guesses.
- Do Insect Shells count as "Insect" for Larva/Silkworm bonuses? (Yes in the app.)
- Can a Tribute Summon use Insect Shells as tributes? They're Extra Deck monsters, not
  Basics, so the app says no, but Dung Beetle/Cicada giving them Charge suggests yes.

---

## 11. Glossary

| Term          | Meaning                                                              |
|---------------|----------------------------------------------------------------------|
| Charge        | A card's resource value used to pay Charge Costs                      |
| Charge Cost   | The total Charge needed to Tribute Summon or activate an Action       |
| Footprint     | Number of adjacent Monster Zones a monster occupies                  |
| Tribute       | Send a monster from your field to the GY as part of a cost            |
| Flip down     | Turn a card face-down (destroyed Barrier, Formation material, Field)  |
| Infected      | A status applied by Fungus effects (shown with a spore icon)          |
| Blocker       | A card that can redirect an attack to itself                          |
| Unblockable   | A monster whose attacks Blockers can't redirect                       |
