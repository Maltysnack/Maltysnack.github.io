# SideQuest — Roadmap & Version Log

## Versioning rules

- Version number is visible in the app at all times (bottom of profile tab or corner of home screen)
- Increment the patch (0.1.1 → 0.1.2) for each focused build session
- Increment the minor (0.1 → 0.2) only when we agree the batch of patches represents a meaningful product leap
- Increment the major (0.x → 1.0) when the product is genuinely shippable as a standalone app

---

## 0.1 — Foundation (next build)

**Goal:** Make it feel like an app, not a web page. Lay the structural foundation that everything else builds on.

### In scope

| Area | What gets built |
|---|---|
| PWA fix | Detect `window.navigator.standalone` — suppress sidebar.js and all website chrome in app mode |
| Layout | Remove phone-shell CSS on mobile. App is 100vw × 100vh. Bottom nav gets `env(safe-area-inset-bottom)` |
| Home screen | Full-screen CSS fantasy landscape. Large golden ❗ quest marker in centre. Quest count above it. Taps into quest log. |
| Background | Layered CSS silhouettes (ground, hills, castle on hill). Time-of-day sync (dawn/day/dusk/night) via `new Date().getHours()` |
| Quest log | WoW Classic style. Left panel: quest list grouped by Dailies / Weeklies / Quests. Right panel: selected quest detail with flavour text, objectives, XP reward, complete button. Mobile: list → detail as full-screen push navigation. |
| Rename | Sacred Rites → Dailies. Bounty Board → Quests. Consistent MMO naming throughout. |
| Citizen state | Starting class. Profile shows "Undeclared. All paths open." +5% XP on all quests. Flavour text framing: every legend starts undeclared. |
| XP stack | Sleep (+20% all XP) and water (+10% all XP) universal buffs active and visible |
| Version number | Displayed on home screen or profile tab. "v0.1" |

### Out of scope for 0.1

Everything else. Class unlocks, feats, quest givers, social — none of it. Get the shell right first.

---

## 0.1.x patch ladder

### 0.1.1 — Class unlocks
- 3-day streak triggers class unlock ceremony for Knight / Ranger / Acolyte
- Unlock: new title, class XP bonus (+50% on class daily), class flavour text on quests
- Unlock moment is a proper event — toast, animation, NPC quote from the class mentor
- Profile updates to show current class and stage

### 0.1.2 — Class stage progression
- Stage advancement for all three base classes (Stage 1 → 2 → 3 → 4)
- Milestones at 3 / 14 / 30 / 90 days
- Stage titles: Squire → Soldier → Knight → Champion (and equivalents for Ranger, Acolyte)
- Streak bonus: +5% per 7-day milestone, capped at 30%
- Profile shows stage, streak count, progress to next stage

### 0.1.3 — Duo classes
- Knight × Ranger → Vanguard path (Outrider → Vanguard → Sentinel → Ironstrider)
- Knight × Acolyte → Templar path (Adept → Paladin → Templar → Justicar)
- Ranger × Acolyte → Druid path (Seeker → Lorewalker → Druid → Archdruid)
- Duo unlock: 5 consecutive days maintaining BOTH habits simultaneously
- Stage milestones: 5 / 21 / 45 / 120 days
- Both class XP bonuses active when duo class held

### 0.1.4 — Feat system
- Pre-built feat quests available to accept (Monk, Chef, Scribe, Bard, Artist, Herald, Steward)
- Accepting a feat quest adds it to the daily board as an optional recurring
- 5 completions → feat badge unlocked, shown on profile
- Feat quests have pre-written flavour text and NPC names (no form required)

### 0.1.5 — Quest givers
- Quest giver board replaces "Add Quest" form as the primary way to add quests
- Each NPC has a portrait, name, dialogue, and one quest to offer
- Accepting via NPC card flow (not form)
- Class mentor NPCs (Captain Aldric, Wren, Elder Sova) give the three class dailies
- Feat NPCs (Brother Cael, Liria, Mira, etc.) give the feat quests
- Custom Quest ("The Notary") still available for non-standard quests, moved to advanced option

---

## 0.2 — Prestige & Notifications (target, when 0.1.x is solid)

**Goal:** Retention mechanics. Prestige is the long-term pull. Notifications are the daily reminder.

| Area | What gets built |
|---|---|
| Prestige path | Unlock when all three base classes reach Stage 3 simultaneously. Wanderer → Legendary → Mythic → The Eternal. Rare, celebrated. |
| Push notifications | OneSignal free tier. Service Worker. User sets daily reminder time. Streak-at-risk alert. Class-mentor-voiced messages. |
| Onboarding | First launch: character creation. Landscape + ❗ → class card selection → class mentor intro → first quest appears. |
| Missed day handling | Streak suspend (bonus paused, not lost). 7-day consecutive miss → dormant. Silent grace day after 7+ day streaks. |

---

## 0.3 — Accounts & Profiles (when 0.2 is stable)

**Goal:** Your character exists beyond your device. Share it.

| Area | What gets built |
|---|---|
| Sign in with Apple / email | Account creation. No form-filling — SSO first. |
| Cloud sync | Supabase backend. Daily completions sync at end of day. |
| Public profile | Shareable link. Shows class, stage, active feats. Streaks shown as "strong/active/lapsed" not exact counts (privacy default). |
| Profile card | Shareable image (like Spotify Wrapped). Class art, current stage, feat badges. |

---

## 0.4 — Social Layer

**Goal:** Find your friends. Do things together.

| Area | What gets built |
|---|---|
| Friends | Add by username or code. See their class and habit health. |
| Fellowship bonus | Both friends complete same daily → +10% XP each. Resolved end of day, passive. |
| Feed | Friends' level-ups, feat unlocks, class promotions appear in a Chronicle feed. |

---

## 1.0 — Guilds + possible native (long-term)

**Goal:** A complete social habit product. App Store candidate.

| Area | What gets built |
|---|---|
| Guilds | Create/join (up to 20). Guild quest board. Collective goals. Guild XP events. |
| Capacitor wrapper | Native iOS app. Enables HealthKit (auto-complete exercise quest), real alarms (Sleep at the Inn), haptic feedback, home screen widgets. |
| App Store | Apple Developer account. Submission. |
| Yonder link | Optional: SideQuest class standing affects Yonder character stats (future cross-product feature). |

---

## Staged for later (no version assigned)

- Apple Watch companion app
- Siri shortcuts ("Hey Siri, complete my training quest")
- Seasonal events (guild quests change with real-world seasons)
- Class prestige resets (optional — start over for cosmetic rewards)
- Yonder × SideQuest shared class system (cross-product)
