/* ═══════════════════════════════════════
   sidebar.js — universal nav
   Single source of truth. Edit here only.
   Uses root-relative paths for GitHub Pages.
   Mobile: collapses to hamburger dropdown.
═══════════════════════════════════════ */

(function () {
  const path = window.location.pathname;

  function active(href) {
    const file = href.split('/').pop();
    return (path.endsWith(href) || path.endsWith('/' + file))
      ? 'class="nav-active"'
      : '';
  }

  const html = `
    <div class="sidebar-header">
      <a href="/index.html" class="logo-link">
        <img src="https://github.com/maltysnack.png" alt="" class="avatar" />
        <span class="site-name">maltysnack</span>
      </a>
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>

    <div class="sidebar-body" id="sidebar-body">
      <nav class="nav">

        <div class="nav-section">
          <span class="nav-label">Films</span>
          <ul>
            <li><a href="/films/filmclub.html" ${active('/films/filmclub.html')}>Filmclub</a></li>
          </ul>
        </div>

        <div class="nav-section">
          <span class="nav-label">Projects</span>
          <ul>
            <li><a href="/projects/saltysnacks.html" ${active('/projects/saltysnacks.html')}>Saltysnacks</a></li>
            <li><a href="/projects/fantasyfootball.html" ${active('/projects/fantasyfootball.html')}>FPL Predicted XI</a></li>
          </ul>
        </div>

        <div class="nav-section">
          <span class="nav-label">More</span>
          <ul>
            <li><a href="/proveyourself.html" ${active('/proveyourself.html')}>proveyourself</a></li>
            <li><a href="/cv.html" ${active('/cv.html')}>CV</a></li>
          </ul>
        </div>

      </nav>

      <footer class="sidebar-footer">
        <a href="https://github.com/maltysnack" target="_blank" rel="noopener" title="GitHub">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.907-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.912.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
        </a>
        <a href="https://twitch.tv/maltysnack" target="_blank" rel="noopener" title="Twitch" class="twitch-link">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
        </a>
        <a href="https://youtube.com/@Maltysnack" target="_blank" rel="noopener" title="YouTube" class="youtube-link">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>
      </footer>
    </div>
  `;

  const el = document.querySelector('aside.sidebar') || document.getElementById('sidebar');
  if (el) {
    el.innerHTML = html;

    const toggle = document.getElementById('sidebar-toggle');
    const body   = document.getElementById('sidebar-body');
    if (toggle && body) {
      toggle.addEventListener('click', function () {
        const open = body.classList.toggle('open');
        toggle.classList.toggle('open', open);
      });
    }
  }
})();
