/* ═══════════════════════════════════════
   sidebar.js - universal nav + dark theme + watermark + favicons
   Single source of truth. Edit here only.
   Root-relative paths.

   Favicons: bump FAVICON_VERSION when the icon files change. Every
   page that includes this script automatically picks up the new
   version on next load. Pages no longer need to hand-roll the icon
   block; this script injects canonical links into <head> if they're
   missing or stale.
═══════════════════════════════════════ */

(function () {
  const path = window.location.pathname;
  const FAVICON_VERSION = '3';

  /* ── Inject canonical favicon block into <head> ────────── */
  function ensureFavicons() {
    const want = [
      { rel: 'icon',             type: 'image/png', sizes: '32x32', href: `/favicon-32.png?v=${FAVICON_VERSION}` },
      { rel: 'icon',             href: `/favicon.ico?v=${FAVICON_VERSION}`, sizes: 'any' },
      { rel: 'apple-touch-icon', href: `/apple-touch-icon.png?v=${FAVICON_VERSION}` },
      { rel: 'manifest',         href: `/manifest.json?v=${FAVICON_VERSION}` },
    ];
    // Drop existing favicon-related links (any version) so we don't double up.
    document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').forEach(l => l.remove());
    for (const attrs of want) {
      const link = document.createElement('link');
      for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
      document.head.appendChild(link);
    }
    // Theme color meta (idempotent)
    if (!document.querySelector('meta[name="theme-color"]')) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = '#0c0c0c';
      document.head.appendChild(m);
    }
  }
  ensureFavicons();

  function active(href) {
    const file = href.split('/').pop();
    return (path.endsWith(href) || path.endsWith('/' + file))
      ? 'class="nav-active"'
      : '';
  }

  /* Dark only, site-wide (maltysnack's call, 29-10-2026). */
  document.documentElement.setAttribute('data-theme', 'dark');

  /* Top bar.
     A flat horizontal bar matching the portfolio site's chrome, so the two
     read as one design. Pages still contain <aside class="sidebar">; it is
     styled as the bar, so no page markup had to change. */

  const NAV = [
    { href: '/projects/fpl/',        label: 'FPL' },
    { href: '/projects/worldcup/',   label: 'World Cup' },
    { href: '/projects/flox/',       label: 'Flox' },
    { href: '/projects/algorithms/', label: 'Algorithms' },
    { href: '/games/dnd/',           label: 'dnd' },
    { href: '/games/duoclue/',       label: 'Duoclue' },
  ];

  const navLinks = NAV.map(function (item) {
    const current = path.startsWith(item.href) ? ' aria-current="page"' : '';
    return '<a href="' + item.href + '"' + current + '>' + item.label + '</a>';
  }).join('');

  const html = `
    <a class="bar-wordmark" href="/" aria-label="maltysnack, home">
      <img src="https://github.com/maltysnack.png" alt="" class="bar-avatar" />
      <span class="bar-name">maltysnack</span>
    </a>

    <nav class="bar-nav" aria-label="Sections">${navLinks}</nav>

    <a class="bar-icon" href="https://github.com/maltysnack" target="_blank" rel="noopener" aria-label="GitHub">
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.907-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.912.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
      </svg>
    </a>

  `;

  /* ── Watermark with red seed cell ────────── */
  const watermarkHtml = `
    <div class="watermark" aria-hidden="true">
      <svg viewBox="0 0 33 21" width="44" height="28">
        <rect class="seed" x="15" y="0" width="3" height="3"/>
        <path fill="currentColor" d="M12,3h3v3h-3z M15,3h3v3h-3z M18,3h3v3h-3z M9,6h3v3h-3z M12,6h3v3h-3z M21,6h3v3h-3z M6,9h3v3h-3z M9,9h3v3h-3z M15,9h3v3h-3z M18,9h3v3h-3z M21,9h3v3h-3z M24,9h3v3h-3z M3,12h3v3h-3z M6,12h3v3h-3z M15,12h3v3h-3z M27,12h3v3h-3z M0,15h3v3h-3z M3,15h3v3h-3z M9,15h3v3h-3z M12,15h3v3h-3z M15,15h3v3h-3z M18,15h3v3h-3z M24,15h3v3h-3z M27,15h3v3h-3z M30,15h3v3h-3z M0,18h3v3h-3z M9,18h3v3h-3z M24,18h3v3h-3z"/>
      </svg>
    </div>
  `;

  const el = document.querySelector('aside.sidebar') || document.getElementById('sidebar');
  if (el) {
    el.innerHTML = html;

    // On a phone the nav scrolls sideways; make sure the current page's
    // link is on screen rather than cut off at the edge.
    const nav = el.querySelector('.bar-nav');
    const here = nav && nav.querySelector('[aria-current]');
    if (here && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = here.offsetLeft - nav.offsetLeft - (nav.clientWidth - here.offsetWidth) / 2;
    }

    if (!document.querySelector('.watermark')) {
      document.body.insertAdjacentHTML('beforeend', watermarkHtml);
    }
  }
})();
