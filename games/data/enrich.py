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

    legalities = card.get("legalities", {}) or {}
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
        "legal_standard": legalities.get("standard", "") == "legal",
        "keywords": card.get("keywords", []),
    }


def name_keys(card: dict) :
    """Possible names a card could be referenced by in our deck data."""
    keys = [card["name"]]
    # DFC: also accept the front face name alone
    if "//" in card["name"]:
        keys.append(card["name"].split(" // ")[0])
    return keys


def fetch_card(name: str) -> dict:
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


def standard_legal_names_from_bulk(bulk) :
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


# ── Printing-quality scoring ─────────────────────────────────────────────────
# When picking which printing to cache for a given card name, we prefer base
# black-bordered prints from booster sets over promos, showcases, borderless,
# extended-art, etc. Score each printing; highest wins.
PROMO_SET_TYPES = {"promo", "memorabilia", "alchemy", "spellbook", "minigame", "treasure_chest", "vanguard", "planechase", "archenemy"}
BAD_FRAME_EFFECTS = {"showcase", "extendedart", "borderless", "fullart", "etched", "snow"}


def printing_score(card) -> int:
    """Higher = more standard art. Used to pick the best printing per name.

    Hard rules first (set_type, border, frame_effects, image_status), then a
    recency tiebreaker so reprints from current Standard sets win over older
    printings when both are clean.
    """
    score = 0
    set_type = card.get("set_type", "")
    if set_type in ("expansion", "core"): score += 1000
    elif set_type == "draft_innovation": score += 800
    elif set_type == "starter": score += 600
    elif set_type in ("masters", "commander"): score += 400
    elif set_type in PROMO_SET_TYPES: score -= 500
    border = card.get("border_color", "")
    if border == "black": score += 300
    elif border == "white": score += 100
    elif border == "borderless": score -= 400
    elif border == "silver": score -= 200
    frame_effects = set(card.get("frame_effects", []) or [])
    if frame_effects & BAD_FRAME_EFFECTS: score -= 600
    if card.get("lang", "") == "en": score += 100
    img_status = card.get("image_status", "")
    if img_status == "highres_scan": score += 100
    elif img_status in ("missing", "placeholder"): score -= 2000
    if card.get("digital", False): score -= 300
    if card.get("legalities", {}).get("standard", "") == "legal": score += 50

    # Recency tiebreaker: prefer the newest clean printing. Adds up to ~1500
    # for very-recent cards, decaying for older ones. Keeps reprints from
    # current Standard sets winning over the original 1990s/2000s printing.
    released = card.get("released_at", "") or ""
    if len(released) >= 4:
        try:
            year = int(released[:4])
            score += min(1500, max(0, (year - 1993) * 30))  # 30 pts per year since 1993
        except ValueError:
            pass

    return score


def main():
    decks = json.loads(RAW.read_text())
    in_dataset = set()
    for d in decks:
        for c in d.get("main", []):
            in_dataset.add(c["name"])
        for c in d.get("side", []):
            in_dataset.add(c["name"])

    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    # We've changed printing-selection logic. Force-refresh every entry so we
    # pick the best printing under the new scoring rules. Marker key tracks
    # the schema version; bumping it triggers a full rebuild of the cache.
    SCHEMA_VERSION = "v3-recency-tiebreak"
    if cache.get("__schema__") != SCHEMA_VERSION:
        print(f"  schema bump: rebuilding entire cache ({len(cache)} entries)",
              file=sys.stderr)
        cache = {"__schema__": SCHEMA_VERSION}

    print("fetching Scryfall bulk-data manifest…", file=sys.stderr)
    bulk_index = http_json("https://api.scryfall.com/bulk-data")
    # default_cards has multiple printings per card; pick the best one ourselves
    # (oracle_cards picks one but doesn't always pick the standard art).
    default_bulk = next((b for b in bulk_index["data"]
                         if b["type"] == "default_cards"), None)
    if not default_bulk:
        print("ERROR: default_cards bulk file not found", file=sys.stderr)
        sys.exit(1)
    size_mb = default_bulk["size"] / (1024 * 1024)
    print(f"downloading {size_mb:.0f}MB default_cards bulk…", file=sys.stderr)
    bulk = json.loads(http_bytes(default_bulk["download_uri"]))
    print(f"  {len(bulk)} printings in bulk file, picking best per name…", file=sys.stderr)

    # For each name, pick the printing with the highest printing_score.
    index = {}
    best_score = {}
    for card in bulk:
        s = printing_score(card)
        for key in name_keys(card):
            if key not in best_score or s > best_score[key]:
                best_score[key] = s
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
