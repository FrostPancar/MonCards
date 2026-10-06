# MonCards — Game Rules (Draft v0.1)

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
| Barrier cards  | 4 cards       | —                   | See §6.5 for Barrier-specific limits           |
| Boss Monster   | 1 card        | —                   |                                               |

- Some cards override the copy limit in their own text (e.g. *Insect Remains*: "you can
  have more than 2 of this card in your Extra Deck").
- 🔶 **Open question:** does the 4-copy limit count Main + Side combined (Yu-Gi-Oh! style)
  or each pile separately? *The index app currently validates Main + Side combined.*
- 🔶 **Open question:** can a deck run duplicate Barrier cards, or are they 1 copy each?

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

| Type             | Frame   | Lives in        | Has Charge | Has Charge Cost | Footprint |
|------------------|---------|-----------------|------------|-----------------|-----------|
| Basic Monster    | Slate   | Main Deck       | ✅          | —               | 1         |
| Tribute Monster  | Crimson | Main Deck       | ✅ (opt.)   | ✅ 5–30          | ✅         |
| Extra Deck Mon.  | Teal    | Extra Deck      | ❌          | special          | ✅         |
| Action           | Amber   | Main Deck       | ✅          | ✅               | —         |
| Field            | Green   | Field Deck      | —          | —               | —         |
| Barrier          | Steel   | Barrier Zones   | —          | —               | —         |
| Boss Monster     | Violet  | Boss Zone       | (opt.)     | special          | ✅         |

### Shared monster anatomy

- **Name**
- **ATK / DEF** — there are no battle positions. A monster uses **ATK when attacking**
  and **DEF when being attacked**.
- **Type** — at most one (e.g. *Earth*). A card may have no Type.
- **Tags** — any number (e.g. *Insect*, *Fungus*, *Undead*).
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
    monsters with the required Type/Tag **equal to the Footprint size** of the Extra Deck
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
| **Basic Protector**  | While face-up, take **100** less damage when your Basic/Extra Deck monsters are destroyed in battle (**200** less for Type-specific, **300** less for Tag-specific versions). **Max 1 Basic Protector per deck.** |
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

## 9. Sample Cards & Anatomy

Card anatomy, top to bottom (the app renders cards this way):

```
┌──────────────────────────────┐
│ NAME                    ◆ 3  │  ← Charge (diamond) / Charge Cost on Tribute & Action
│ Tribute · Earth              │  ← card type · Type
│ ┌──────────────────────────┐ │
│ │        pixel art         │ │
│ └──────────────────────────┘ │
│ [Insect] [Undead]   ▣▣ FP 2  │  ← Tags · Footprint
│ Effect text…                 │
│ ⚔ 2200        ⛨ 1500         │  ← ATK / DEF
└──────────────────────────────┘
```

### Insect Remains *(Extra Deck Monster — shared by both Insect decks)*

- **ATK 100 / DEF 100**, Charge — (Extra Deck: none), Footprint 1
- Tags: **Insect** · Type: none
- You can summon 1 *Insect Remains* when one of your Insect monsters (except *Insect
  Remains*) is tributed or destroyed.
- Cannot attack. You don't lose LP when this card is destroyed in battle.
- **Special rule:** you can have more than 2 copies of this card in your Extra Deck.

Both Insect decks run **10× Insect Remains** as their entire Extra Deck.

### Hive Queen *(Boss — Insect deck A)*

- **ATK 3000 / DEF 3000**, Footprint **3**, Tags: **Insect**
- When your Insects are sent from the field to the GY, put them under this card instead.
- At the start of your turn, you can swap an *Insect Remains* on the field with a Basic
  Insect under this card.
- When this card has at least 15 cards under it, you can shuffle all of them into your
  Deck / Extra Deck to summon this card.
- When this card is summoned, summon any number of Basic Insects from your Deck.
- When this card would be destroyed, you can tribute another Insect instead.

### Brain-Eating Fungus *(Boss — Insect deck B)*

- **ATK 100 / DEF 100**, Tags: **Fungus, Undead** · Type: **Earth**
- Once per turn, you can **infect** an Insect on your field (it gains the *Infected* tag);
  it gains Charge equal to the number of Infected Insects on your field.
- If an Infected Insect dies, the infection moves to an *Insect Remains*.
- Opponent's monsters that battle your Infected monsters also become Infected and lose
  100 ATK for each Infected card on the field.
- You can summon this card by tributing 4 Infected monsters on **either** field.
- While this card is on your field, all your Insects are Infected.
- Gains 400 ATK/DEF for every Infected card on the field.
- 🔶 *Footprint not specified — assumed 1.*

---

## 10. Glossary

| Term          | Meaning                                                              |
|---------------|----------------------------------------------------------------------|
| Charge        | A card's resource value used to pay Charge Costs                      |
| Charge Cost   | The total Charge needed to Tribute Summon or activate an Action       |
| Footprint     | Number of adjacent Monster Zones a monster occupies                  |
| Tribute       | Send a monster from your field to the GY as part of a cost            |
| Flip down     | Turn a card face-down (destroyed Barrier, Formation material, Field)  |
| Infected      | A status/tag applied by Fungus effects                                |
| Blocker       | A card that can redirect an attack to itself                          |
