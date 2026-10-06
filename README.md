# MonCards

Digital card game prototype. Rules live in [RULES.md](RULES.md).

## App

A static web app with no build step. Open `index.html` in a browser (works from `file://`) or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Two views:

- **Card Index** (`#index`): browse every card, filter by kind, tag or search, and pick a deck to see its list and legality check.
- **Play Table** (`#table`): a hot-seat mockup duel on a 3D pixel table. Drag cards (hand → zones, field → other zones / GY / hand / deck) or click them. It enforces zones, footprint, charge costs (including conditional Charge bonuses), Blockers, Barrier triggers, battle damage and turn-1 rules. Other card effects you apply by hand from the dialog box. A mosaic **pixel filter** (Off / 2x / 3x) sits over the 3D table; UI and text stay sharp. It opens on a demo board; use **New duel** for the full setup flow (deck pick → field selection → draw 7).

## Layout

| Path | What |
|---|---|
| `data/cards.js` | Card database (`MC.CARDS`) and sample decks (`MC.DECKS`). Edit this to add cards. |
| `src/core.js` | Card rendering, procedural pixel art, icons, deck validation |
| `src/index-view.js` | Card Index view |
| `src/table-view.js` | Play Table view and duel engine |
| `src/main.js` | Router, modal, toast |
| `style.css` | All styling |

The two Insect decks (Hive Queen, Brain-Eating Fungus) are the real lists; names marked
*working title* in `data/cards.js` still need naming. Art is generated procedurally from each
card's id (one-colour silhouettes) until real sprites exist.
