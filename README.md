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
  detail view) or duplicated; new cards and edits are shared with everyone (edits can be reset), and
  **Copy code** gives a snippet to paste into `data/cards.js`. The **Art icons** and **Full text** options
  hide the art icon or drop the art area to give effect text more room. A **Light/Dark** toggle switches the index theme.
  The **⚒ Deck Builder** button opens a panel for building a deck: a small card index on the left (collapsible
  sort & filter menu, click to add, − or right-click to remove) and live stats on the right: a Charge curve, a stat
  triangle per card type (Basic, Tribute, Action) and a tag counter, each compared with the average of the other decks.
  Decks are saved in this browser (**Save deck**) and appear in the deck lists once legal.
- **Play Table** (`#table`): a hot-seat mockup duel on a 3D pixel table. Drag cards (hand → zones, field → other zones / GY / hand / deck) or click them. It enforces zones, footprint, charge costs (including conditional Charge bonuses), Blockers, Barrier triggers, battle damage and turn-1 rules. Other card effects you apply by hand from the dialog box. Click a player's LP number to edit it. On desktop the left and right panels can be tucked away with the edge tabs to enlarge the board; they slide back in as an overlay when the pointer touches that screen edge. The hand of the player who isn't taking their turn folds away (use **Peek at hand** on their panel). It opens on a demo board; use **New duel** for the full setup flow (deck pick → field selection → draw 7).

## Layout

| Path | What |
|---|---|
| `data/cards.js` | Card database (`MC.CARDS`) and sample decks (`MC.DECKS`). Edit this to add cards. |
| `src/core.js` | Card rendering, procedural pixel art, icons, deck validation |
| `src/card-creator.js` | Card Creator form, shared card store client (cache, offline queue, sync) |
| `netlify/functions/cards.mts` | `/api/cards`: shared custom cards and edits (Netlify Blobs) |
| `src/deck-builder.js` | Deck Builder panel, deck stats and saved decks |
| `src/index-view.js` | Card Index view |
| `src/table-view.js` | Play Table view and duel engine |
| `src/main.js` | Router, modal, toast |
| `style.css` | All styling |

## Shared card store

Custom cards and edits to existing cards are shared by everyone who uses the site. They're
saved through `/api/cards`, a Netlify Function (`netlify/functions/cards.mts`) backed by a
site-wide Netlify Blobs store, so they show up on every device and browser. Each browser keeps a
cached copy (instant load, works offline). Changes made while the store can't be reached are queued
and sent on the next sync, which happens on page load and whenever the tab comes back into view.

There is no login: anyone with the site link can add, edit or delete shared cards. Opening
`index.html` straight from disk (`file://`) has no store, so changes stay on that device until it
runs on a deployed site. To develop the function locally, run `npm install` and `npx netlify dev`.

The two Insect decks (Hive Queen, Brain-Eating Fungus) are the real lists; names marked
*working title* in `data/cards.js` still need naming. Monster art is hidden for now (`MC.SHOW_ART` in `src/core.js` brings the procedural
sprites back); cards show a dithered placeholder instead.
