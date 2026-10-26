# flox HANDOFF

Scratchpad for `/projects/flox/`. Root `HANDOFF.md` covers site-wide.

## 26-10-2026: rebuilt to the Flox repo's DISPLAY.md

The Flox repo owns this page's content (`~/Documents/flox/DISPLAY.md`).
Read it before touching anything here. The page is now: headline, River,
Markov, Grid, grammar table, nothing else. "What it is", the Creek hero, the
try hints and the meta line are gone.

Vendored verbatim, never edited here: `flox.js` (from `ts/dist/flox.js`) and
`showcase/{river,markov,grid}.flox` (from `examples/showcase/`), fetched
same-origin as the initial program text. To re-vendor, copy those four files
and `cmp` them. On 26-10 the brief, the showcase files and the engine build
were all uncommitted in the Flox repo (engine build dated 29-06); vendored
from its working tree.

## Layout (23-10-2026) (superseded)

One page, `data-layout="wide"`. The playground, docs index, grammar reference
and gallery are gone; `flox.js` moved from `playground/` to this folder,
contents untouched.

Order: lede, hero example (program and output side by side), what it is plus a
grid `compare` example, river flow (dam example), Markov chains, a compact
grammar table. Every example is an editable textarea that reruns `interpret()`
200 ms after typing stops; reset restores it. Programs live in the `EX` object
in the page script. The "try" hints under each example were checked against
the interpreter; recheck them if an example changes.

stderr with stdout present is shown as a dim note (the grid compare emits a
"supplies do not balance" note for the plant-offline scenario, by design).
Ligatures are off in the code panes so `->` reads as typed.

The stashed `/tmp` playground patch from 18-05-2026 is moot: the playground
no longer exists.

## 15-10-2026: commercial layer deleted

`api/flox-{checkout,portal,webhook}.js`, `cloud/`, `playground/cloud/` and
`GO-LIVE.md` are gone. Flox Cloud was a dormant Stripe plus Supabase layer
that never launched. **There is no product. Do not reintroduce one.**

The `gallery/` page went with it: it imported `../playground/cloud/store.js`,
so once that module was deleted the page returned 200 while being completely
broken at runtime. That is the bug that prompted sanitation check `[9]`,
which resolves every JS module import.
