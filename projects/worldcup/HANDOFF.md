# worldcup HANDOFF

Scratchpad for `/projects/worldcup/`.

## Status 26-10-2026

- One page: the Football Bankroll page (formerly `v2/`), now at `/projects/worldcup/`. The old 2026 tracker page and its JSON were retired; it lives in git history and the worldcup repo tag `wc2026-final`.
- Data: `bankroll.json` (republished by the worldcup repo's `bot.yml` after bet and settle runs) and `capsule.json` (static). Both from `scripts/export_site_v2.py` in `github.com/Maltysnack/worldcup`.
- What to show is set by `DISPLAY.md` in the worldcup repo. Read it before changing this page; the worldcup repo does not build or deploy this page any more.

## 27-10-2026: site bar, Odds tab

- The site top bar is back (`style.css` + `sidebar.js`, `body.fit`); `.app` is
  a flex child instead of `100dvh`. The page keeps its own type and palette;
  its yellow is `--hi`, renamed from `--accent` so the bar keeps the site red.
  The mark now reads "Football / bankroll" since the bar carries the name.
- Won is hidden until the first settlement (brief: no empty panels).
- Odds tab renders `upcoming` (panel 3) and `recent_passes` (panel 6), six
  rows each, three on phones; the future-tournament cards show only while
  both are empty. Neither field is in `bankroll.json` yet; tested with sample
  data injected in a headless browser. Reasons map "no edge" to "prices fair
  or model not confident enough".
- 28-10: the site took this page's design. The page's own palette and font
  links are gone; `--paper`, `--ink`, `--hi` and friends are now aliases for
  site tokens at the top of its `<style>`. Its yellow is now the site red.
- Elo leaderboard (panel 8) not built: the worldcup repo does not export
  `elo.json` yet.

## 29-10-2026: Ratings tab, all upcoming games

- Data now comes in via `bash scripts/sync-data.sh worldcup` (copies `~/worldcup/site_data/*.json`).
- New Ratings tab: `elo.json` top 20 as bars from 1500, two columns (top 10 on phones), `as_of` in the tag and stamp.
- Odds tab upcoming list reads `fixtures.json` (DISPLAY 3b) when present: every game on the feed, any distance out, with Sportsbet odds or "not priced yet". Falls back to `bankroll.json.upcoming`. `fixtures.json` 404s until the next bot bet run writes it; the page handles that.
- `odds.json` (title odds, panel 10) is synced but not rendered yet.

