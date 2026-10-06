# MonCards

Digital card game prototype. Rules live in [RULES.md](RULES.md).

## App

A static web app with no build step. Open `index.html` in a browser (works from `file://`) or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Two views:

- **Card Index** (`#index`): browse every card, filter by kind, tag or search, and pick a deck to see its list and legality check.
- **Play Table** (`#table`): a hot-seat mockup duel on a 3D pixel table. It enforces zones, footprint, charge costs, battle damage and turn-1 rules. You apply card effects by hand with the inspector controls. It opens on a demo board; use **New duel** for the full setup flow (deck pick → field selection → draw 7).

## Layout

| Path | What |
|---|---|
| `data/cards.js` | Card database (`MC.CARDS`) and sample decks (`MC.DECKS`). Edit this to add cards. |
| `src/core.js` | Card rendering, procedural pixel art, icons, deck validation |
| `src/index-view.js` | Card Index view |
| `src/table-view.js` | Play Table view and duel engine |
| `src/main.js` | Router, modal, toast |
| `style.css` | All styling |

Cards flagged `sample: true` are placeholders that fill out the two Insect decks.
Art is generated procedurally from each card's id until real sprites exist.
