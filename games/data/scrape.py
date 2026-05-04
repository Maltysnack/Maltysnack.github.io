#!/usr/bin/env python3
"""Scrape Standard decklists from magic.gg.

Three sources:
  1. Weekly Traditional Bo3 ladder lists (URL-pattern enumeration of Mondays).
  2. /decklists index, for premier event pages (Pro Tour, Champions Cup, RC,
     Spotlight, MIT, SEA, ANZ, EU Magic Series, etc.).
  3. /news index, for articles with embedded decklists (Pro Tour Top 8 lives
     here, not under /decklists).

Each deck is tagged with a weight reflecting source quality:
  ladder = 1, premier event = 3, PT main field = 5, PT Top 8 = 10.

Output: games/data/decks_raw.json
"""

import json
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

START = date(2024, 7, 22)
END = date.today()
LADDER_BASE = "https://magic.gg/decklists/traditional-standard-ranked-decklists"
DECKLISTS_INDEX = "https://magic.gg/decklists"
NEWS_INDEX = "https://magic.gg/news"
UA = "maltysnack-magic-meta/0.3 (https://github.com/maltysnack)"

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


def parse_event_date(s: str) -> str | None:
    """Convert "May 01, 2026" to "2026-05-01". Tolerates variants."""
    if not s:
        return None
    for fmt in ("%B %d, %Y", "%B %d %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_page(html: str, weight: int, source_url: str, default_week: str = "") -> list[dict]:
    decks = []
    for attrs_blob, body in DECK_RE.findall(html):
        attrs = dict(ATTR_RE.findall(attrs_blob))
        if attrs.get("format", "").strip() != "Standard":
            continue
        sections = {name: parse_section(content)
                    for name, content in SECTION_RE.findall(body)}
        # Skip empty decks.
        if not sections.get("main-deck"):
            continue
        wk = parse_event_date(attrs.get("event-date", "")) or default_week
        decks.append({
            "deck_title": attrs.get("deck-title", "").strip(),
            "subtitle": attrs.get("subtitle", "").strip(),
            "event_date": attrs.get("event-date", "").strip(),
            "event_name": attrs.get("event-name", "").strip(),
            "format": attrs.get("format", "").strip(),
            "main": sections.get("main-deck", []),
            "side": sections.get("side-board", []),
            "companion": sections.get("companion-card", []),
            "week": wk,
            "weight": weight,
            "source": source_url,
        })
    return decks


def classify_weight(slug: str) -> int:
    s = slug.lower()
    if "pro-tour" in s and ("top-8" in s or "top-eight" in s):
        return 10
    if "pro-tour" in s:
        return 5
    premier_keywords = (
        "champions-cup", "regional-championship", "magic-spotlight",
        "magic-series", "mtg-china-open", "championship-final",
        "anz-super-series", "championship-finals",
    )
    if any(k in s for k in premier_keywords):
        return 3
    return 1


INDEX_LINK_RE = re.compile(r'href="(/decklists/[a-z0-9\-]+)"')
NEWS_LINK_RE = re.compile(r'href="(/news/[a-z0-9\-]+)"')


def discover_decklist_slugs() -> list[str]:
    html = fetch(DECKLISTS_INDEX) or ""
    slugs = sorted(set(INDEX_LINK_RE.findall(html)))
    # Strip the leading "/decklists/" prefix
    return [s.removeprefix("/decklists/") for s in slugs]


def discover_news_slugs() -> list[str]:
    html = fetch(NEWS_INDEX) or ""
    slugs = sorted(set(NEWS_LINK_RE.findall(html)))
    return [s.removeprefix("/news/") for s in slugs]


def dedupe(decks: list[dict]) -> list[dict]:
    """If the same NAMED player + event_date appears more than once (e.g., a
    Top 8 deck also appears in the Day 1 page), keep the highest-weight copy.

    Anonymous ladder decks ("Platinum-Mythic Rank Player") are never deduped
    against each other; we can't tell them apart so we trust the source.
    """
    ANON = "Platinum-Mythic Rank Player"
    anon_decks = [d for d in decks if not d.get("deck_title") or d["deck_title"] == ANON]
    named_decks = [d for d in decks if d.get("deck_title") and d["deck_title"] != ANON]

    best_by_key: dict[tuple, dict] = {}
    for d in named_decks:
        key = (d["deck_title"], d.get("event_date", ""), d.get("event_name", ""))
        if key not in best_by_key or d["weight"] > best_by_key[key]["weight"]:
            best_by_key[key] = d
    return anon_decks + list(best_by_key.values())


def main():
    out_path = Path(__file__).parent / "decks_raw.json"
    all_decks: list[dict] = []
    counts = {"ladder": 0, "premier_index": 0, "news_articles": 0}

    # ── Source 1: weekly Traditional ladder ──
    print("source 1: weekly Traditional ladder", file=sys.stderr)
    for d in mondays(START, END):
        url = f"{LADDER_BASE}-{slug_for(d)}"
        html = fetch(url)
        if html is None:
            continue
        wk = d.isoformat()
        decks = parse_page(html, weight=1, source_url=url, default_week=wk)
        if decks:
            for deck in decks:
                deck["week"] = wk  # ladder pages don't have per-deck event_date
            all_decks.extend(decks)
            counts["ladder"] += len(decks)
        time.sleep(0.3)
    print(f"  {counts['ladder']} ladder decks", file=sys.stderr)

    # ── Source 2: /decklists index for premier events ──
    print("source 2: /decklists index (premier events)", file=sys.stderr)
    seen_ladder_pattern = re.compile(r"^traditional-standard-ranked-decklists-")
    for slug in discover_decklist_slugs():
        if seen_ladder_pattern.match(slug):
            continue  # already covered by source 1
        url = f"https://magic.gg/decklists/{slug}"
        html = fetch(url)
        if html is None:
            continue
        weight = classify_weight(slug)
        decks = parse_page(html, weight=weight, source_url=url)
        if decks:
            all_decks.extend(decks)
            counts["premier_index"] += len(decks)
            print(f"  {len(decks):3d} decks (weight {weight})  {slug}", file=sys.stderr)
        time.sleep(0.3)
    print(f"  {counts['premier_index']} premier-event decks total", file=sys.stderr)

    # ── Source 3: /news articles with embedded deck-lists ──
    print("source 3: /news articles", file=sys.stderr)
    for slug in discover_news_slugs():
        url = f"https://magic.gg/news/{slug}"
        html = fetch(url)
        if html is None or "<deck-list" not in html:
            continue
        weight = classify_weight(slug)
        decks = parse_page(html, weight=weight, source_url=url)
        if decks:
            all_decks.extend(decks)
            counts["news_articles"] += len(decks)
            print(f"  {len(decks):3d} decks (weight {weight})  {slug}", file=sys.stderr)
        time.sleep(0.3)
    print(f"  {counts['news_articles']} news-article decks total", file=sys.stderr)

    # ── Dedupe ──
    before = len(all_decks)
    all_decks = dedupe(all_decks)
    print(f"\ndeduped: {before} → {len(all_decks)} (removed {before - len(all_decks)} duplicates)",
          file=sys.stderr)

    out_path.write_text(json.dumps(all_decks, indent=2))
    print(f"wrote {len(all_decks)} decks → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
