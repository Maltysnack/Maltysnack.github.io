# maltysnack.github.io

Milo Watkinson's portfolio: a short intro, contact details, a resume PDF and
links to each project. Live at [maltysnack.github.io](https://maltysnack.github.io/).

Plain HTML and CSS, no build step. Each project lives in its own repo with its
own GitHub Pages site; this site only links to them. Nothing publishes into
this repo.

- `index.html`, `style.css`: the page
- `milo-watkinson-resume.pdf`: built from the private resume repo with the
  phone number left out
- `projects/*/index.html`: redirects from old addresses
- `scripts/sanitize.sh`: checks run on every push (em dashes, phone numbers,
  internal notes, broken links)
