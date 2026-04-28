# SideQuest — Context & Background

## What it is
A fantasy-themed habit tracker and to-do app, built as a PWA (installable to iOS home screen). The conceit is that daily life is an RPG — your habits are quests, your chores are bounties, and completing them earns XP and levels you up.

## File locations
- **App:** `projects/sidequest.html`
- **PWA manifest:** `manifest-sidequest.json`
- **Context docs:** `SideQuest/` (this folder)
- **Design system:** `SideQuest/design-system.md`

---

## Structure

### Three types of tasks

| Type | Fantasy name | Resets | User can add? |
|---|---|---|---|
| Default quests | "The Sacred Rites" | Daily | No (always on) |
| Daily quests | "Daily Quests" | Daily | Yes |
| Weekly quests | "Weekly Quests" | Monday | Yes |
| Missions | "Bounty Board" | Never (one-off) | Yes |

### Default quests (always active, can't be removed)
These are the five core healthy habits. Always visible. Always reset each day.

| Quest name | Real habit | XP |
|---|---|---|
| Rest at the Wayfarers Inn | Sleep 8 hours | 30 |
| Drink from the Sacred Spring | Drink 2L water | 25 |
| Train at the Barracks | Exercise 30 minutes | 40 |
| Explore the Kingdom | Go outside | 20 |
| Study Ancient Tomes | Read 20 minutes | 25 |

---

## Tab layout

1. **Quest Board** — Default quests + user dailies + user weeklies, grouped by type
2. **Bounty Board** — One-off missions / to-do list
3. **Add Quest** — Form to create new daily or weekly quest
4. **Adventurer's Hall** — Profile, level, XP, stats, achievements

---

## XP & Level system

- 500 XP per level
- 20 levels total

| Level | Title |
|---|---|
| 1 | Peasant |
| 2 | Squire |
| 3 | Footman |
| 4 | Scout |
| 5 | Ranger |
| 6 | Knight |
| 7 | Champion |
| 8 | Thane |
| 9 | Paladin |
| 10 | Warlord |
| 11 | Mage |
| 12 | Archmage |
| 13 | Sorcerer |
| 14 | Enchanter |
| 15 | Mystic |
| 16 | Overlord |
| 17 | Dragonfriend |
| 18 | Legendborn |
| 19 | Mythic |
| 20 | The Eternal |

---

## Achievements
Unlockable badges displayed in the Adventurer's Hall.

| ID | Name | Condition |
|---|---|---|
| first_quest | First Blood | Complete your first quest |
| streak_3 | Three-Day March | 3-day streak |
| streak_7 | Week of the Warrior | 7-day streak |
| streak_30 | The Long Campaign | 30-day streak |
| quest_10 | Veteran | 10 total quests |
| quest_50 | Seasoned Adventurer | 50 total quests |
| quest_100 | Hundred Deeds | 100 total quests |
| level_5 | Knighted | Reach level 5 |
| level_10 | Lord of the Realm | Reach level 10 |
| all_daily | Perfect Day | Complete all daily quests in one day |
| mission_first | Bounty Hunter | Complete first mission |
| mission_10 | Mercenary | Complete 10 missions |

---

## Planned features (not yet built)

### Phase 2 — Push notifications (via OneSignal)
- Daily reminder at user-set time: "Your quests await, adventurer"
- Quest completion notification: reward message + XP earned
- Streak milestone notifications
- Weekly inspiring fantasy quote (auto-generated or curated list)
- Streak at-risk warning: "You haven't completed your quests today"

### Phase 3 — Native iOS (Capacitor)
- Proper `.ipa`, App Store submission
- Home screen widgets showing quest progress
- Haptic feedback on quest completion
- Siri shortcuts ("Hey Siri, mark exercise quest done")
- Persistent storage (no 7-day Safari PWA wipe)

### Phase 4 — Cloud & social
- User accounts, cross-device sync
- Friend guilds — see each other's streaks
- Guild quests — shared goals
- Leaderboard

---

## Design intent

**Feel:** Dark, parchment-and-gold fantasy RPG. Think a well-worn adventurer's journal. Not cartoonish — serious, slightly gritty, satisfying to use.

**Visual themes:**
- Shields, swords, dragons, wizards, stars, scrolls
- Candle/torch light aesthetic — warm amber golds against dark browns
- Parchment textures on cards
- Heavy serif headings (Cinzel), readable body text (Crimson Text)

**Key moments to feel good:**
- Checking off a quest — satisfying animation, XP toast
- Levelling up — dramatic splash with new title
- Streak milestone — fanfare
- All dailies done — "Perfect Day" achievement unlock

**Designer handoff:** See `SideQuest/design-system.md` for all tokens, placeholder locations, and component specs.

---

## localStorage keys

| Key | Contents |
|---|---|
| `sq_quests` | User-added daily/weekly quests array |
| `sq_missions` | One-off missions array |
| `sq_xp` | Total XP earned (number) |
| `sq_stats` | `{ totalQuests, streak, daysActive, lastDate }` |
| `sq_completions` | `{ [dateISO]: [questId, ...] }` — daily completion log |
| `sq_achievements` | Array of unlocked achievement IDs |
