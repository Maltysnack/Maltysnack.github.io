"""Claude Code PreToolUse hook. Several page sessions share this one checkout,
so block git commands that sweep up, stash or discard other sessions' work.
Commands aimed at another repo (cd or git -C elsewhere) pass."""

import json
import re
import sys

SWEEP = re.compile(
    # git at command position only, so the words inside a heredoc or message don't trip it.
    r"(?:^|[;&|(]|\n)\s*git\b[^;&|\n]*?\s("
    r"add\s+(-A|--all|-u|--update|\.(\s|$))"
    r"|commit\s+[^;&|]*(-a\b|--all\b|-[a-zA-Z]*a[a-zA-Z]*\s)"
    r"|stash\b"
    r"|reset\s+[^;&|]*--hard"
    r"|checkout\s+(--\s+)?\.(\s|$)"
    r"|restore\s+[^;&|]*\.(\s|$)"
    r"|clean\b)")
ELSEWHERE = re.compile(r"(\bcd\s+|git\s+-C\s+)['\"]?(?![^\s'\"]*Maltysnack\.github\.io)[~/][^\s;&|]*")

cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
if SWEEP.search(cmd) and not ELSEWHERE.search(cmd):
    print("Blocked: other page sessions share this checkout. Stage and commit only your own paths "
          "(git add projects/<page>/ then git commit -m ... -- projects/<page>/), pull with "
          "git pull --rebase --autostash origin main, and never stash, reset --hard, clean or add -A here. "
          "See 'Parallel page sessions' in CLAUDE.md.", file=sys.stderr)
    sys.exit(2)
