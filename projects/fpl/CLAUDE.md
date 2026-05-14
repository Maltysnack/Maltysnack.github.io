# FPL: domain rules

Repo-wide rules from `/CLAUDE.md` apply here too. This file adds FPL-specific ones.

## Data shape

- User-facing dates render `dd-mm-yyyy`. Internal JSON (timestamps in `api-cache.json`, `history.json`) stays ISO `yyyy-mm-dd` for sortability. Convert at the render layer.

## Variant defaults

- The browser prediction formula in `index.html` and the Node prediction in `sync.js` must produce the same number for the same player. Keep them aligned. When `sync.js` changes, mirror in `index.html` and vice versa.
- If a `squad-sim.js` (CLI backtester) is added later, its defaults must match `sync.js`'s `PUBLIC_VARIANT`.

## Backtesting

- Single-season backtests are smoke tests, not strategy evidence. Use a full 3-season tournament for any decision about strategy ranking.
- Tournament re-run cost: 30 to 180 minutes of laptop CPU, $0 of Claude tokens (process runs locally).

## Closing issues

- Comment with the commit hash that shipped the fix.
