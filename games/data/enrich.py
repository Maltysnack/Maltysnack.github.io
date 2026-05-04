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


def http_bytes(url: str, attempts: int = 3) -> bytes:
    """Stream-download with retries — bulk files are >100MB and connections drop."""
    last_err = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=600) as resp:
                chunks = []
                while True:
                    chunk = resp.read(1 << 20)  # 1 MB
                    if not chunk:
                        break
                    chunks.append(chunk)
                return b"".join(chunks)
        except Exception as e:
            last_err = e
            print(f"  download attempt {attempt + 1}/{attempts} failed: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise last_err


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
        "cmc": card.get("cmc", 0),
        "type_line": card.get("type_line", ""),
        "colors": card.get("color_identity", []),
        "set": (card.get("set", "") or "").upper(),
        "cn": card.get("collector_number", ""),
        "released_at": card.get("released_at", ""),
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


def standard_legal_names_from_bulk(bulk: list[dict]) -> set[str]:
    """Return the set of names of all Standard-legal cards (one printing each).
    Lets us surface playable cards in search even if no winning deck has run them.
    """
    names = set()
    for card in bulk:
        legal = card.get("legalities", {}).get("standard", "")
        if legal != "legal":
            continue
        names.add(card["name"])
        for k in name_keys(card):
            names.add(k)
    return names


def main():
    decks = json.loads(RAW.read_text())
    in_dataset = set()
    for d in decks:
        for c in d.get("main", []):
            in_dataset.add(c["name"])
        for c in d.get("side", []):
            in_dataset.add(c["name"])

    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    # Schema migration: old cache entries may lack new fields. Force-refresh
    # any entry missing released_at so we get it on this pass.
    stale = {n for n, m in cache.items()
             if not isinstance(m, dict) or "released_at" not in m}
    if stale:
        print(f"  forcing refresh of {len(stale)} entries (missing released_at)",
              file=sys.stderr)
        for n in stale:
            cache.pop(n, None)

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

    standard_legal = standard_legal_names_from_bulk(bulk)
    print(f"  {len(standard_legal)} Standard-legal names known", file=sys.stderr)

    needed = (in_dataset | standard_legal) - cache.keys()
    print(f"{len(in_dataset)} in-dataset cards, "
          f"{len(standard_legal)} Standard-legal, {len(needed)} to resolve",
          file=sys.stderr)

    resolved_via_bulk = 0
    still_missing = []
    for name in needed:
        if name in index:
            meta = extract_meta(index[name])
            meta["in_dataset"] = name in in_dataset
            cache[name] = meta
            resolved_via_bulk += 1
        else:
            still_missing.append(name)

    # Re-tag in_dataset on already-cached entries (set membership may have shifted)
    for name, meta in cache.items():
        if isinstance(meta, dict):
            meta["in_dataset"] = name in in_dataset

    print(f"  {resolved_via_bulk} resolved from bulk", file=sys.stderr)

    if still_missing:
        print(f"  {len(still_missing)} need per-card fallback…", file=sys.stderr)
        failed = []
        for i, name in enumerate(still_missing):
            meta = fetch_card(name)
            if meta:
                meta["in_dataset"] = name in in_dataset
                cache[name] = meta
            else:
                failed.append(name)
            time.sleep(RATE_DELAY)
            if (i + 1) % 25 == 0:
                print(f"    [{i+1}/{len(still_missing)}]", file=sys.stderr)
        if failed:
            print(f"  failed to resolve {len(failed)} cards", file=sys.stderr)
            for n in failed[:20]:
                print(f"    {n}", file=sys.stderr)

    CACHE.write_text(json.dumps(cache, separators=(",", ":")))
    size_kb = CACHE.stat().st_size // 1024
    print(f"\ncache: {len(cache)} entries, {size_kb} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
