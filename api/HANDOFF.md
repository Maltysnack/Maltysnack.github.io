# api HANDOFF

> **These exist only for the D&D character upload.** The Flox checkout,
> portal and webhook functions were deleted 15-10-2026 along with the rest
> of Flox's dormant commercial layer. If D&D's upload flow is ever
> reworked, this whole folder and `vercel.json` can probably go.

Scratchpad for `/api/` Vercel serverless functions. Root `HANDOFF.md` covers site-wide.

## Functions

- `upload.js`: opens a PR for a new dnd character from a filled WotC PDF.
- `update.js`: opens a PR to update an existing character.

Both are consumed by `/games/dnd/`. See [`games/dnd/HANDOFF.md`](../games/dnd/HANDOFF.md) for the upload + polish flow.

## Wiring

- **Vercel project**: `dnd-upload` (team `maltysnacks-projects`). Production URL `dnd-upload-maltysnacks-projects.vercel.app`.
- **GitHub auto-deploy not connected.** Redeploy manually after touching `api/`: `vercel deploy --prod --yes` from repo root.
- **GitHub PAT env var on Vercel**: stored as `dnd_upload` (not `GITHUB_TOKEN`). Function reads any of `GITHUB_TOKEN | dnd_upload | DND_UPLOAD | GH_TOKEN`.

## Gotchas

- **Functions need explicit `committer` / `author` payload** to commit as `maltysnack` rather than the PAT owner's profile. Already wired; if removed, upload PRs revert to showing the PAT owner's display name.
