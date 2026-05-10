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
import re
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


_DEALS_DAMAGE = re.compile(r"deals \w+ damage to (any target|target creature|target opponent|target player|each (creature|opponent))")
_DRAW_VARIANTS = re.compile(r"\b(draws?|put .+ into your hand|look at the top \w+ cards.+(into your hand|hand))\b")
_PUT_INTO_HAND = re.compile(r"put .+ into (?:your |their )?hand")
_DEALS_EACH_CREATURE = re.compile(r"deals \w+ damage to each (creature|opponent and each creature)")


def derive_tags(card: dict) :
    """Rule-based tagger. Derives semantic tags from type_line + oracle_text.
    Not as rich as Scryfall's hand-curated tagger but free, deterministic, and
    captures the categories that matter for deck composition.
    """
    text = (card.get("oracle_text", "") or "").lower()
    type_line = (card.get("type_line", "") or "").lower()
    tags = set()

    is_creature = "creature" in type_line
    is_instant = "instant" in type_line
    is_sorcery = "sorcery" in type_line
    is_spell = is_instant or is_sorcery
    is_land = "land" in type_line
    is_enchantment = "enchantment" in type_line
    is_artifact = "artifact" in type_line
    is_planeswalker = "planeswalker" in type_line

    if is_creature: tags.add("creature")
    if is_spell: tags.add("spell")
    if is_instant: tags.add("instant")
    if is_sorcery: tags.add("sorcery")
    if is_land: tags.add("land")
    if is_enchantment and not is_creature: tags.add("enchantment")
    if is_artifact and not is_creature: tags.add("artifact")
    if is_planeswalker: tags.add("planeswalker")

    # ── Removal ──
    if is_spell or is_creature or is_enchantment or is_artifact:
        if any(p in text for p in [
            "destroy target", "exile target creature", "exile target nonland",
            "destroy each", "exile target permanent", "exile target nonland permanent",
        ]):
            tags.add("removal")
        if _DEALS_DAMAGE.search(text):
            tags.add("removal")
        # -N/-N effects (death by -N toughness)
        if re.search(r"target creature gets [-−]\d", text):
            tags.add("removal")
        # "fight" effects
        if "fights target creature" in text or "fights another target creature" in text:
            tags.add("removal")

    # ── Sweepers ──
    if _DEALS_EACH_CREATURE.search(text) or "destroy all creatures" in text \
            or "exile all creatures" in text or "destroy all" in text:
        tags.add("sweeper")

    # ── Counterspells ──
    if "counter target" in text and ("spell" in text or "ability" in text):
        tags.add("counterspell")

    # ── Card draw / hand-fill ──
    if "draw a card" in text or "draw two cards" in text or "draw three cards" in text \
            or "draws a card" in text or "draw cards equal" in text \
            or _PUT_INTO_HAND.search(text):
        tags.add("card-draw")

    # ── Discard / hand attack ──
    if "discard" in text and ("target player" in text or "opponent" in text or "each opponent" in text):
        tags.add("discard")

    # ── Ramp / mana ──
    if is_creature and ("{t}: add" in text or "tap: add" in text):
        tags.add("mana-creature")
        tags.add("ramp")
    if is_spell and "search your library" in text and "land" in text:
        tags.add("ramp")
    if "additional land" in text or "play an additional land" in text:
        tags.add("ramp")
    if is_land and ("{t}: add" in text or "tap: add" in text):
        # Most lands. Distinguish utility lands by also having other text.
        if len(text) > 80:  # has more than just basic mana ability
            tags.add("utility-land")

    # ── Tokens ──
    if "create" in text and "token" in text:
        tags.add("tokens")

    # ── +1/+1 counters ──
    if "+1/+1 counter" in text:
        tags.add("counters-plus")

    # ── Lifegain / drain ──
    if "you gain" in text and "life" in text:
        tags.add("lifegain")
    if "loses" in text and "life" in text and "opponent" in text:
        tags.add("drain")

    # ── Recursion ──
    if any(p in text for p in [
        "return target creature card from your graveyard",
        "return it to the battlefield",
        "return target permanent card from your graveyard",
    ]):
        tags.add("recursion")

    # ── Tutoring ──
    if "search your library" in text and not is_land:
        if "creature card" in text or "instant card" in text or "sorcery card" in text \
                or "card with mana value" in text or "card named" in text:
            tags.add("tutor")

    # ── Finisher / big creature ──
    try:
        power_str = str(card.get("power", "") or "")
        cmc = card.get("cmc", 0) or 0
        if power_str.isdigit():
            power = int(power_str)
            if is_creature and power >= 5 and cmc >= 4:
                tags.add("finisher")
    except (AttributeError, ValueError):
        pass

    # ── Keyword tags from Scryfall's keywords array ──
    keywords = [k.lower() for k in (card.get("keywords") or [])]
    for kw in ["flying", "trample", "menace", "haste", "deathtouch", "lifelink",
               "first strike", "double strike", "vigilance", "ward", "hexproof",
               "indestructible", "flash", "reach", "defender", "scry", "prowess",
               "convoke", "delve", "landfall", "kicker", "cycling", "flashback"]:
        if kw in keywords:
            tags.add("kw-" + kw.replace(" ", "-"))

    # ── Archetype hooks ──
    if "graveyard" in text:
        tags.add("graveyard-matters")
    if "instant or sorcery" in text:
        tags.add("spells-matter")
    if "noncreature" in text or "non-creature" in text:
        tags.add("noncreature-matters")
    if "treasure token" in text:
        tags.add("treasure")
    if "artifact" in text and not is_artifact:
        if "create" in text or "another artifact" in text:
            tags.add("artifact-matters")
    if "creature you control" in text and is_spell:
        tags.add("creature-buff")
    if "scry" in text:
        tags.add("scry")

    # ── X-spell payoffs ──
    if "{x}" in (card.get("mana_cost", "") or "").lower():
        tags.add("x-spell")

    return sorted(tags)


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
        "oracle_text": card.get("oracle_text", "") or "",
        "colors": card.get("color_identity", []),
        "set": (card.get("set", "") or "").upper(),
        "cn": card.get("collector_number", ""),
        "released_at": card.get("released_at", ""),
        "scryfall_uri": card.get("scryfall_uri", ""),
        "legal_standard": legalities.get("standard", "") == "legal",
        "keywords": card.get("keywords", []),
        "tags": derive_tags(card),
    }


def name_keys(card: dict) :
    """Possible names a card could be referenced by in our deck data.
    magic.gg uses both 'X // Y' (full) and 'X' (front-face only) inconsistently
    for DFC and split cards, so we cache under both. Aliases are marked so the
    frontend can dedupe at search time."""
    keys = [card["name"]]
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
    SCHEMA_VERSION = "v7-tagger-tags-improved"
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
            card = index[name]
            meta = extract_meta(card)
            meta["in_dataset"] = name in in_dataset
            # Mark front-face-only aliases so frontend can hide them from search
            meta["is_alias"] = ("//" in card["name"]) and (name != card["name"])
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
