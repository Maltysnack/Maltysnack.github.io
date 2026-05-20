# Stories: schema and flow

Stories are the hand-written narratives on the Magic meta-explorer's Stories
tab. Each one calls out a real movement in the metagame and explains what it
means. They are editorial: the prose carries the site's voice, so a human
writes them.

## The flow (do not skip)

1. `detect_stories.py` runs after the weekly pipeline and emits
   `story_candidates.json`: a shortlist of `{kind, evidence}` records. It does
   **not** write prose.
2. A human (with Claude) reads the candidates and drafts story prose.
3. Drafts are reviewed and refined together.
4. A story reaches `stories.json` and the live tab **only after explicit
   approval**.

`story_candidates.json` is a curator artifact. The frontend never loads it,
and the weekly workflow may regenerate and commit it freely (candidates are
not stories). `stories.json` is hand-edited and is never auto-committed.

## stories.json schema

Top level:

| field          | meaning                                              |
|----------------|------------------------------------------------------|
| `generated_at` | ISO date the file was last hand-edited               |
| `window_label` | human label for the data window, e.g. "data through 11-05-2026" |
| `current_week` | ISO week the current stories belong to               |
| `window_weeks` | list of ISO weeks the data covers                    |
| `stories`      | list of story objects                                |

Each story object:

| field      | meaning                                                       |
|------------|---------------------------------------------------------------|
| `id`       | unique kebab-case slug                                        |
| `week`     | ISO week the story surfaced (drives archiving, see below)     |
| `status`   | `active`, `resolved`, or `withdrawn`                          |
| `kind`     | one of the six kinds below                                    |
| `is_shell` | `true` if `cards` form a playable shell (enables the "load shell into selection" button) |
| `title`    | short headline                                                |
| `summary`  | one or two sentences                                          |
| `stats`    | list of `{label, value}` evidence rows                        |
| `detail`   | a paragraph of interpretation                                 |
| `cards`    | list of card names the story is about                         |

User-facing dates inside `stats`/`detail` are `dd-mm-yyyy`; `week`,
`current_week`, and `window_weeks` stay ISO for sorting.

## Archiving

The Stories tab shows stories whose `week` equals `current_week` as the live
list, and collapses everything else into the archive section automatically.
To retire a story, leave it in `stories.json` and advance `current_week`; it
falls into the archive on its own. Set `status` to `resolved` or `withdrawn`
to show that badge.

## The six kinds

`detect_stories.py` auto-detects five of the six. `color-gap` is hand-written
only. Thresholds below are the constants at the top of `detect_stories.py`.

### returning-cluster
A card package (an NMF cluster) that was present, vanished, and came back.
Detector: a cluster's top 8 members; the cluster is "present" in a week when
at least 3 of them appear in a ladder deck. Flags a gap of at least 4 absent
weeks followed by a return within the last 3 weeks.

### copy-conversion
A card the ladder used to splash as a 1-of or 2-of and now runs as a 4-of.
Detector: recent average copies at least 3.5, prior average at most 2.5, run
in at least 6 recent decks.

### post-pt-shift
A card whose ladder share jumped sharply, typically after a Pro Tour seeds
new tech. Detector: `explore.risen` entries with a delta of at least 8
points. A shell is attached when the card is also a catalyst.

### returning-card
A single card that vanished and came back. Detector: present at least 5% of
ladder decks before a gap of at least 4 absent weeks, back within the last 3
weeks. Present means at least 3% share.

### pt-vs-ladder
Cards the pros over-index on that the ladder has not adopted. Detector: the
`explore.pt_picks` list, bundled into one candidate (the story is the
pattern, not any single card).

### color-gap
A color or color pair underrepresented relative to the rest of the meta. Not
auto-detected; write these by hand when you spot one.

## Candidate fields

Each record in `story_candidates.json`:

| field                | meaning                                            |
|----------------------|----------------------------------------------------|
| `kind`               | one of the kinds above                             |
| `key`                | stable dedup key                                   |
| `headline_hint`      | a neutral factual one-liner, **not** final prose   |
| `is_shell`           | best-guess shell flag                              |
| `cards`              | cards the candidate is about                       |
| `stats`              | pre-filled `{label, value}` evidence rows          |
| `already_in_stories` | `true` if an active story already covers a card    |

Turn a candidate into a story by writing `id`, `title`, `summary`, `detail`,
picking the `kind`, and setting `week`/`status`. The `stats` and `cards` can
usually carry over close to as-is.
