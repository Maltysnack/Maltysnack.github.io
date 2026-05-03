#!/usr/bin/env python3
"""Enrich card names with Scryfall metadata (image URLs, mana cost, types).

Uses Scryfall's bulk-data endpoint — one ~50MB download per run gets every
card's metadata, way faster and more polite than per-card lookups for full
sweeps. Maintains a local scryfall.json with only the entries we need.
Falls back to per-card fuzzy lookup for anything the bulk file misses.

Outputs:
  scryfall.json — { name: { image, image_small, mana_cost, type_line, ... } }
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "decks_raw.json"
CACHE = HERE / "scryfall.json"
UA = "maltysnack-magic-meta/0.2 (https://github.com/maltysnack)"
RATE_DELAY = 0.10


def http_json(url: str) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def http_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read()


def extract_meta(card: dict) -> dict:
    if "image_uris" in card:
        imgs = card["image_uris"]
        mana = card.get("mana_cost", "") or ""
    elif "card_faces" in card and card["card_faces"]:
        face = card["card_faces"][0]
        imgs = face.get("image_uris", {}) or {}
        mana = face.get("mana_cost", "") or card.get("mana_cost", "") or ""
    else:
        imgs = {}
        mana = ""

    return {
        "image": imgs.get("normal", ""),
        "image_small": imgs.get("small", ""),
        "art_crop": imgs.get("art_crop", ""),
        "mana_cost": mana,
        "type_line": card.get("type_line", ""),
        "colors": card.get("color_identity", []),
        "set": (card.get("set", "") or "").upper(),
        "cn": card.get("collector_number", ""),
        "scryfall_uri": card.get("scryfall_uri", ""),
    }


def name_keys(card: dict) -> list[str]:
    """Possible names a card could be referenced by in our deck data."""
    keys = [card["name"]]
    # DFC: also accept the front face name alone
    if "//" in card["name"]:
        keys.append(card["name"].split(" // ")[0])
    return keys


def fetch_card(name: str) -> dict | None:
    q = urllib.parse.quote(name)
    for endpoint in (f"https://api.scryfall.com/cards/named?exact={q}",
                     f"https://api.scryfall.com/cards/named?fuzzy={q}"):
        try:
            return extract_meta(http_json(endpoint))
        except urllib.error.HTTPError as e:
            if e.code != 404:
                return None
        except Exception:
            return None
    return None


def main():
    decks = json.loads(RAW.read_text())
    needed = set()
    for d in decks:
        for c in d.get("main", []):
            needed.add(c["name"])
        for c in d.get("side", []):
            needed.add(c["name"])

    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    missing = needed - cache.keys()
    print(f"{len(needed)} cards needed, {len(cache)} cached, {len(missing)} to resolve",
          file=sys.stderr)

    if missing:
        # Use bulk-data: one big download, indexed locally.
        print("fetching Scryfall bulk-data manifest…", file=sys.stderr)
        bulk_index = http_json("https://api.scryfall.com/bulk-data")
        oracle = next((b for b in bulk_index["data"]
                       if b["type"] == "oracle_cards"), None)
        if not oracle:
            print("ERROR: oracle_cards bulk file not found", file=sys.stderr)
            sys.exit(1)
        size_mb = oracle["size"] / (1024 * 1024)
        print(f"downloading {size_mb:.0f}MB oracle_cards bulk…", file=sys.stderr)
        bulk = json.loads(http_bytes(oracle["download_uri"]))
        print(f"  {len(bulk)} cards in bulk file, indexing…", file=sys.stderr)

        index = {}
        for card in bulk:
            for key in name_keys(card):
                if key not in index:
                    index[key] = card

        resolved_via_bulk = 0
        still_missing = []
        for name in missing:
            if name in index:
                cache[name] = extract_meta(index[name])
                resolved_via_bulk += 1
            else:
                still_missing.append(name)

        print(f"  {resolved_via_bulk} resolved from bulk", file=sys.stderr)

        # Per-card fallback for the rest (likely name-format edge cases)
        if still_missing:
            print(f"  {len(still_missing)} need per-card fallback…", file=sys.stderr)
            failed = []
            for i, name in enumerate(still_missing):
                meta = fetch_card(name)
                if meta:
                    cache[name] = meta
                else:
                    failed.append(name)
                time.sleep(RATE_DELAY)
                if (i + 1) % 25 == 0:
                    print(f"    [{i+1}/{len(still_missing)}]", file=sys.stderr)
            if failed:
                print(f"  failed to resolve {len(failed)} cards:", file=sys.stderr)
                for n in failed[:20]:
                    print(f"    {n}", file=sys.stderr)

    CACHE.write_text(json.dumps(cache, separators=(",", ":")))
    size_kb = CACHE.stat().st_size // 1024
    print(f"\ncache: {len(cache)} entries, {size_kb} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
