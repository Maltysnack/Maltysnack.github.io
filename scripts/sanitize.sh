#!/usr/bin/env bash
# scripts/sanitize.sh
# Mechanical sanitation pass. Catches drift between sessions.
# Exit 0 if clean, 1 if any FAIL category.
#
# Run locally: bash scripts/sanitize.sh
# Runs in CI on every push to main.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

errors=0
warnings=0

note_fail() { echo "  FAIL: $1"; errors=$((errors+1)); }
note_warn() { echo "  WARN: $1"; warnings=$((warnings+1)); }
note_ok()   { echo "  OK: $1"; }

echo "=== Sanitation pass ==="

# Files we care about: HTML, JS, CSS, MD, YAML in the project.
# Exclude: .git, node_modules, _next bundles, dnd character sheets that have raw apostrophes etc.
src_files() {
  find . -type f \
    \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" \) \
    -not -path "./.git/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/_next/*" \
    -not -path "*/duoclue/*"
}

# ── 1. Em dashes ──────────────────────────────────────────────────────────────
echo ""
echo "[1] em dashes"
em_hits=$(src_files | xargs grep -ln "—" 2>/dev/null || true)
if [[ -n "$em_hits" ]]; then
  note_fail "em dashes found:"
  echo "$em_hits" | sed 's/^/        /'
else
  note_ok "no em dashes"
fi

# ── 2. Junk files ─────────────────────────────────────────────────────────────
echo ""
echo "[2] junk files"
junk=$(find . -type f \
  \( -name ".DS_Store" -o -name "Thumbs.db" -o -name "*.swp" -o -name "*~" \) \
  -not -path "./.git/*" 2>/dev/null || true)
if [[ -n "$junk" ]]; then
  note_fail "junk files present:"
  echo "$junk" | sed 's/^/        /'
else
  note_ok "no junk files"
fi

# ── 3. Personal info leaks ────────────────────────────────────────────────────
echo ""
echo "[3] personal info"
real_name=$(src_files | xargs grep -lEi "milo[-. ]?watkinson|milo\.watkinson" 2>/dev/null | grep -v scripts/sanitize.sh || true)
phones=$(src_files | xargs grep -lE '\b[0-9]{3}[-.\ ][0-9]{3}[-.\ ][0-9]{4}\b' 2>/dev/null | grep -v scripts/sanitize.sh || true)
emails=$(src_files | xargs grep -lE '[A-Za-z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|icloud|students\.mq)\.' 2>/dev/null | grep -v scripts/sanitize.sh || true)

pi_clean=1
if [[ -n "$real_name" ]]; then note_fail "real name pattern found:"; echo "$real_name" | sed 's/^/        /'; pi_clean=0; fi
if [[ -n "$phones" ]];    then note_fail "phone number pattern found:"; echo "$phones" | sed 's/^/        /'; pi_clean=0; fi
if [[ -n "$emails" ]];    then note_fail "personal email pattern found:"; echo "$emails" | sed 's/^/        /'; pi_clean=0; fi
[[ "$pi_clean" -eq 1 ]] && note_ok "no personal info patterns"

# ── 4. Untracked source files ─────────────────────────────────────────────────
echo ""
echo "[4] untracked source files"
untracked=$(git ls-files --others --exclude-standard | grep -E '\.(html|css|js|json|md)$' || true)
if [[ -n "$untracked" ]]; then
  note_warn "untracked source files (likely need 'git add'):"
  echo "$untracked" | sed 's/^/        /'
else
  note_ok "no untracked source files"
fi

# ── 5. Broken internal links from sidebar/home ───────────────────────────────
echo ""
echo "[5] broken internal links"
links=$(grep -hoE 'href="/[^"#]+"' sidebar.js index.html 2>/dev/null | sed 's/href="//;s/"$//' | sort -u)
broken=""
for l in $links; do
  if [[ "$l" == */ ]]; then
    target=".${l}index.html"
  else
    target=".${l}"
  fi
  if [[ ! -e "$target" ]]; then
    broken="${broken}        $l -> $target (missing)\n"
  fi
done
if [[ -n "$broken" ]]; then
  note_fail "broken links from sidebar/home:"
  echo -e "$broken"
else
  note_ok "all sidebar/home links resolve"
fi

# ── 6. New page added without sidebar entry ──────────────────────────────────
# Heuristic: a top-level *.html or /projects/*.html that exists but isn't in sidebar.js
# Intentional easter eggs (reachable only via in-page links) go in the ignore list.
# coffeetime is the morning sister of happyhour, only linked from the wordmark toggle.
echo ""
echo "[6] orphaned pages (exist but not in sidebar)"
ignore_paths='/index.html|/grosh.html|/reginald.html|/wren/.*|/shelf/.*|/dnd/.*|/projects/coffeetime.html'
orphans=""
while IFS= read -r p; do
  rel="${p#.}"
  if [[ "$rel" =~ $ignore_paths ]]; then continue; fi
  if ! grep -qF "\"$rel\"" sidebar.js 2>/dev/null; then
    orphans="${orphans}        $rel\n"
  fi
done < <(find . -type f -name "*.html" \
  -not -path "./.git/*" -not -path "*/node_modules/*" -not -path "*/_next/*" -not -path "*/duoclue/*")

if [[ -n "$orphans" ]]; then
  note_warn "pages not linked from sidebar:"
  echo -e "$orphans"
else
  note_ok "every public page is reachable from sidebar"
fi

# ── 7. Site pages missing the apple-touch-icon block ─────────────────────────
# Any HTML page that includes /style.css (so it's part of the main site) must
# also include apple-touch-icon. Self-contained sub-apps (Duoclue, Happy Hour,
# anything not using /style.css) are exempt.
echo ""
echo "[7] favicon / apple-touch-icon coverage"
missing_icons=""
while IFS= read -r p; do
  if grep -q '"/style.css"' "$p" 2>/dev/null; then
    if ! grep -q 'apple-touch-icon' "$p" 2>/dev/null; then
      missing_icons="${missing_icons}        ${p#./}\n"
    fi
  fi
done < <(find . -type f -name "*.html" \
  -not -path "./.git/*" -not -path "*/node_modules/*" -not -path "*/_next/*" -not -path "*/duoclue/*")

if [[ -n "$missing_icons" ]]; then
  note_fail "site pages missing apple-touch-icon block:"
  echo -e "$missing_icons"
else
  note_ok "every site page has the icon block"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Summary ==="
echo "  errors:   $errors"
echo "  warnings: $warnings"
if [[ "$errors" -gt 0 ]]; then
  echo "FAIL"
  exit 1
fi
echo "Clean."
exit 0
