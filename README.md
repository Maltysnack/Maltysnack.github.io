# maltysnack.github.io

Milo Watkinson's site. Live at [maltysnack.github.io](https://maltysnack.github.io/).

The home page is a flock simulation (boids) over a small city. The top bar
links to each project, which lives in its own repo with its own GitHub Pages
site. Plain HTML, CSS and JavaScript, no build step.

- `index.html`, `projects/flock/`: the flock
- `sidebar.js`: the top bar on every page; the project list lives here
- `style.css`, `design/palette.css`: styles
- `projects/*/index.html`: redirects from old addresses
- `scripts/sanitize.sh`: checks run on every push (em dashes, phone numbers,
  internal notes, broken links)
