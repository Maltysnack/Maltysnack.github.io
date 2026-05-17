# /api/upload · Vercel function

Receives a parsed character JSON from `/dnd/`, validates it, and opens a pull request adding the file to `dnd/characters/`.

## One-time setup (you only do this once)

### 1. Create a fine-grained GitHub PAT

Go to **github.com/settings/personal-access-tokens/new** and create a token with:

- **Resource owner**: Maltysnack
- **Repository access**: Only select `Maltysnack/Maltysnack.github.io`
- **Repository permissions**:
  - **Contents**: Read and write
  - **Pull requests**: Read and write
  - (everything else: no access)
- **Expiration**: pick a reasonable date (set a calendar reminder to rotate)

Copy the token (starts with `github_pat_`).

### 2. Add it to Vercel

Vercel dashboard → **dnd-upload** project → **Settings** → **Environment Variables** → add:

- **Key**: `GITHUB_TOKEN`
- **Value**: paste the token
- **Environments**: Production (and Preview, if you want)

Then **redeploy** the project so the new env var takes effect (Settings → Deployments → latest → ⋯ → Redeploy, or push any commit).

### 3. Verify

Once redeployed, the upload form's "Submit for review" button on `maltysnack.github.io/dnd/` will work end-to-end. A successful submission opens a PR titled `New character: <name>` against `main`. Review the JSON and click Merge.

## After merge

A PR merge adds `dnd/characters/<id>.json` to main. To finish wiring it up to the browse page and create the per-character HTML shim, run locally:

```sh
node dnd/scripts/build-dnd-index.js
git add -A && git commit -m "build(dnd): index after upload" && git push
```

(Or wire this into a GitHub Action so it runs on every PR merge automatically.)

## Local development

The function runs on Vercel only; there's no local API. To smoke-test the function logic, you can `vercel dev` from the repo root with `GITHUB_TOKEN` exported in your shell.

## Files

- `api/upload.js` · the function
- `vercel.json` · minimal Vercel config (deploys `vercel-out/` as static + `api/` as functions)
- `.vercelignore` · keeps the rest of the static site out of the Vercel deploy
- `vercel-out/index.html` · placeholder that redirects vercel.app visitors to maltysnack.github.io/dnd/
