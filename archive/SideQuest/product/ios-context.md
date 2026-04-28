# SideQuest iOS — Build Context

## What it is
Fantasy-themed habit tracker iOS app. You complete daily habits = you earn XP and level up a character. RPG skin over a simple habit loop.

## Current state
v0.1 exists as a PWA at `maltysnack.github.io/projects/sidequest.html`. Moving to native Swift/SwiftUI for HealthKit, widgets, push notifications, App Store.

## Core concept
- 5 default dailies: Sleep, Water, Exercise, Walk Outside, Read
- Sleep = +20% XP multiplier for the day
- Water = +10% XP multiplier for the day
- XP stack: base × sleep × water × class bonus
- Complete 3 consecutive days of a habit → unlock a class

## Class system
**Base classes** (unlock: 3 consecutive days, stages at 3/14/30/90 days):
- Training → Knight: Squire → Soldier → Knight → Champion
- Walking → Ranger: Scout → Pathfinder → Ranger → Farstrider
- Reading → Acolyte: Initiate → Acolyte → Scholar → Sage

**Duo classes** (unlock: 5 days both habits, stages at 5/21/45/120 days):
- Knight × Ranger → Outrider → Vanguard → Sentinel → Ironstrider
- Knight × Acolyte → Adept → Paladin → Templar → Justicar
- Ranger × Acolyte → Seeker → Lorewalker → Druid → Archdruid

**Prestige** (all 3 at stage 3+): Wanderer → Legendary → Mythic → The Eternal

**Starting class:** Citizen (+5% XP, "Undeclared. All paths open.")

## Feat system
Occasional activities (not daily) earn badges. 5 completions = unlock feat.
Examples: Artist, Chef, Scribe, Bard, Monk, Herald, Steward
Feats stack alongside class — cosmetic identity, small perks.

## Quest types
- **Dailies** — reset every day (the 5 defaults + user-added)
- **Weeklies** — reset every Monday
- **Quests** — one-off tasks (former "bounties")

## XP & levels
- 300 XP per level, 20 levels
- Level names: Peasant → Squire → Footman → Scout → Ranger → Knight → Champion → Thane → Paladin → Warlord → Mage → Archmage → Sorcerer → Enchanter → Mystic → Overlord → Dragonfriend → Legendborn → Mythic → The Eternal

## Versioning
- v0.1 = foundation (what to build first)
- v1.0 = native iOS app working on device (the goal)
- Increment 0.1.1, 0.1.2 etc. for small additions. Only bump the middle digit when agreed.
- Show version number in the app (Hall/Profile screen)

## Native iOS features to build toward
- HealthKit: step count (Ranger), sleep data (sleep buff)
- Push notifications: daily quest reminders
- Home screen widget: quest count + streak
- Haptics on quest completion
- App Store distribution

## Design language
- Dark fantasy / medieval RPG aesthetic
- Fonts: Cinzel (headings), Crimson Text (body)
- Colors: dark brown bg (#0a0604), gold (#c8a84b), deep purple XP (#6a4aaa)
- Home screen: CSS landscape with castle silhouette, time-of-day sky — recreate this feel natively
- Quest log: WoW Classic style (grouped list → tap for detail)
- Golden ! marker on home screen showing quests remaining

## Staged for later (not v0.1)
- Social layer: accounts, friends, guilds, party XP bonuses
- Fellowship / guild quests
- Quest giver NPCs (pre-built quest templates so user doesn't have to build from scratch)
- Capacitor / cross-platform
- Link with Yonder (separate idle RPG in same universe)

## Tech
- Swift + SwiftUI
- SwiftData for persistence
- New repo: SideQuest-iOS (separate from website repo)
- Website repo: Maltysnack.github.io (keep PWA alive as reference)
