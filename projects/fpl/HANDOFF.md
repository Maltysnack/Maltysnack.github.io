# fpl HANDOFF

Scratchpad for `/projects/fpl/`. Root `HANDOFF.md` covers site-wide.

## Current state (as of 18-05-2026)

- Browser-rendered FPL tracker with squad view, captain card, transfer suggestions, GW+1/GW+2 toggle.
- Auto-syncs `api-cache` + `history` from a private engine (see recent `fpl: auto-sync` commits).
- My Team panel has Milo/Bot toggle.

## Layout

- Uses `data-layout="full"` on `<main>`. Do not drop the attribute.

## Gotchas

- **Browser FPL formula in `projects/fpl/index.html` is duplicated in `projects/fpl/sync.js`.** They must stay aligned. Editing one without the other = silent divergence in displayed numbers. If you change the formula, change both and grep for any other copies.
- Captain card surfaces haul tier + P(>=10) / P(>=15); these probability numbers come from the same formula, so the duplication risk applies here too.

## Wiring

- Sync workflow: `.github/workflows/sync-fpl.yml` (currently disabled as `.disabled` in the working tree: confirm with maltysnack before re-enabling).
