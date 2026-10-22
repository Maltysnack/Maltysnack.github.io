# flox HANDOFF

Scratchpad for `/projects/flox/`. Root `HANDOFF.md` covers site-wide.

## Layout

- The two flox docs pages use `data-layout="full"`. Do not drop the attribute.

## Stashed work (not applied)

- A `flox/playground/flox.js` patch (+205 / -27 lines) was stashed in the retired `~/maltysnack-site` clone. Saved as `/tmp/maltysnack-stash-0-flox-playground.patch` during the 18-05-2026 consolidation. Decide whether to apply or discard.


## 15-10-2026: commercial layer deleted

`api/flox-{checkout,portal,webhook}.js`, `cloud/`, `playground/cloud/` and
`GO-LIVE.md` are gone. Flox Cloud was a dormant Stripe plus Supabase layer
that never launched. **There is no product. Do not reintroduce one.**

The `gallery/` page went with it: it imported `../playground/cloud/store.js`,
so once that module was deleted the page returned 200 while being completely
broken at runtime. That is the bug that prompted sanitation check `[9]`,
which resolves every JS module import.

## In flight: cut to a single page

Specified, not started. One page with a short description of what Flox is,
two or three worked examples, the river flow, then Markov chains. Minimal and
interactive. The playground, grammar reference and gallery collapse into it
as inline editable examples rather than separate routes. **Keep the scope
small.**

The interpreter is the asset and stays untouched: 2,036 lines implementing a
real three-stage language, `Scanner` to `Parser` to `Interpreter`, with flow
tables, Markov maps, path tracing and a grid simulation. What changes is that
it is presented through a few small examples instead of a documentation site.
