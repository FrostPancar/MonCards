# MonCards

Digital card game prototype. Rules live in [RULES.md](RULES.md).

## App

A static web app with no build step. Open `index.html` in a browser (works from `file://`) or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Two views:

- **Card Index** (`#index`): browse every card, filter by kind, tag or search, and pick a deck to see its list and legality check.
  The **+ Card Creator** button opens a form with a live preview. Any card can be edited (Edit in its
  detail view) or duplicated; new cards and edits are saved in the browser (edits can be reset), and
  **Copy code** gives a snippet to paste into `data/cards.js`. The **Art icons** and **Full text** options
  hide the art icon or drop the art area to give effect text more room.
- **Play Table** (`#table`): a hot-seat mockup duel on a 3D pixel table. Drag cards (hand → zones, field → other zones / GY / hand / deck) or click them. It enforces zones, footprint, charge costs (including conditional Charge bonuses), Blockers, Barrier triggers, battle damage and turn-1 rules. Other card effects you apply by hand from the dialog box. A mosaic **pixel filter** (Off / 2x / 3x) sits over the 3D table; UI and text stay sharp. It opens on a demo board; use **New duel** for the full setup flow (deck pick → field selection → draw 7).

## Layout

| Path | What |
|---|---|
| `data/cards.js` | Card database (`MC.CARDS`) and sample decks (`MC.DECKS`). Edit this to add cards. |
| `src/core.js` | Card rendering, procedural pixel art, icons, deck validation |
| `src/card-creator.js` | Card Creator form, custom-card storage |
| `src/index-view.js` | Card Index view |
| `src/table-view.js` | Play Table view and duel engine |
| `src/main.js` | Router, modal, toast |
| `style.css` | All styling |

The two Insect decks (Hive Queen, Brain-Eating Fungus) are the real lists; names marked
*working title* in `data/cards.js` still need naming. Monster art is hidden for now (`MC.SHOW_ART` in `src/core.js` brings the procedural
sprites back); cards show a dithered placeholder instead.
