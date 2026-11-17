#!/usr/bin/env bash
# Checks run on every push (see .github/workflows/sanitize.yml).
# Run locally: bash scripts/sanitize.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
errors=0
fail() { echo "FAIL: $1"; errors=$((errors+1)); }

files=$(git ls-files '*.html' '*.css' '*.js' '*.md' '*.yml')

# No em dashes anywhere.
hits=$(grep -l "—" $files 2>/dev/null)
[ -n "$hits" ] && fail "em dashes in: $hits"

# No phone numbers on the public site (the PDF is built without one).
hits=$(grep -lE '\b0[0-9]{3} ?[0-9]{3} ?[0-9]{3}\b|\+61' $files 2>/dev/null)
[ -n "$hits" ] && fail "phone number in: $hits"

# No internal notes served as pages.
hits=$(git ls-files | grep -iE '(^|/)(CLAUDE|HANDOFF|AGENTS)\.md$|(^|/)\.claude/')
[ -n "$hits" ] && fail "internal notes would be public: $hits"

# Root-relative links must point at a file in this repo, or at another repo's
# Pages site (/<repo>/) that is listed here.
other_sites="/worldcup-model/ /Dartabase/ /flox/ /cadence/"
for f in $(git ls-files '*.html'); do
  for href in $(grep -oE '(href|src)="/[^"]*"' "$f" | sed -E 's/^[a-z]+="//; s/"$//; s/[?#].*//'); do
    case " $other_sites " in *" $href "*) continue;; esac
    target=".${href}"
    [ -d "$target" ] && target="$target/index.html"
    [ -e "$target" ] || fail "$f links to missing $href"
  done
done

if [ "$errors" -gt 0 ]; then echo "$errors problem(s)"; exit 1; fi
echo "OK"
