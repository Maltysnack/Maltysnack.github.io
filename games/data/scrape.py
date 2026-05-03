#!/usr/bin/env python3
"""Scrape weekly Traditional Standard ranked decklists from magic.gg.

Iterates Mondays from 2024-07-22 (the earliest scrapeable page in the new
custom-element format) through today and pulls every <deck-list> block.
Tolerates 404s (some weeks were skipped).

Output: games/data/decks_raw.json
"""

import json
import re
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

START = date(2024, 7, 22)
END = date.today()
BASE = "https://magic.gg/decklists/traditional-standard-ranked-decklists"
UA = "maltysnack-magic-meta/0.1 (https://github.com/maltysnack)"

MONTHS = ["january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"]


def slug_for(d: date) -> str:
    return f"{MONTHS[d.month - 1]}-{d.day}-{d.year}"


def mondays(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=7)


def fetch(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


DECK_RE = re.compile(r"<deck-list([^>]*)>(.*?)</deck-list>", re.S)
ATTR_RE = re.compile(r'(\w[\w-]*)="([^"]*)"')
SECTION_RE = re.compile(r"<(main-deck|side-board|companion-card)>(.*?)</\1>", re.S)
LINE_RE = re.compile(r"^\s*(\d+)\s+(.+?)\s*$")


def parse_section(body: str) -> list[dict]:
    out = []
    for raw in body.strip().splitlines():
        m = LINE_RE.match(raw)
        if m:
            out.append({"qty": int(m.group(1)), "name": m.group(2)})
    return out


def parse_page(html: str) -> list[dict]:
    decks = []
    for attrs_blob, body in DECK_RE.findall(html):
        attrs = dict(ATTR_RE.findall(attrs_blob))
        sections = {name: parse_section(content)
                    for name, content in SECTION_RE.findall(body)}
        decks.append({
            "deck_title": attrs.get("deck-title", ""),
            "subtitle": attrs.get("subtitle", ""),
            "event_date": attrs.get("event-date", ""),
            "event_name": attrs.get("event-name", ""),
            "format": attrs.get("format", ""),
            "main": sections.get("main-deck", []),
            "side": sections.get("side-board", []),
            "companion": sections.get("companion-card", []),
        })
    return decks


def main():
    out_path = Path(__file__).parent / "decks_raw.json"
    all_decks = []
    weeks_with_data = 0
    weeks_404 = 0
    weeks_empty = 0

    for d in mondays(START, END):
        url = f"{BASE}-{slug_for(d)}"
        html = fetch(url)
        if html is None:
            weeks_404 += 1
            print(f"  404  {d}", file=sys.stderr)
            continue
        decks = parse_page(html)
        if not decks:
            weeks_empty += 1
            print(f"  ---  {d}  (no decks in page)", file=sys.stderr)
            continue
        for deck in decks:
            deck["week"] = d.isoformat()
        all_decks.extend(decks)
        weeks_with_data += 1
        print(f"  {len(decks):3d}  {d}", file=sys.stderr)
        time.sleep(0.4)

    out_path.write_text(json.dumps(all_decks, indent=2))
    print(f"\n{weeks_with_data} weeks with data, {weeks_empty} empty, {weeks_404} 404s",
          file=sys.stderr)
    print(f"{len(all_decks)} decks total → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
