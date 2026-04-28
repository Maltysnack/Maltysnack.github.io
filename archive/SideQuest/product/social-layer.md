# SideQuest — Social Layer (Future Vision)

## The idea

SideQuest starts as a solo product. Your character is yours. Your habits are personal. But the long-term vision is a social layer where your character exists in a shared world — you can find your friends, see how they're doing, build a guild, and do things together.

This is not v1. But it should be designed with this in mind so the data model doesn't fight it later.

---

## What the social layer looks like

### Profiles
Every user has a public character profile:
- Class, stage, active feats
- Current streaks (displayed as general "strong streak" not exact numbers — privacy default)
- Chronicle excerpts (opt-in public posts)
- Guild affiliation

You share your profile via a link or a short code. Viewing someone's profile shows their class, feats, and public chronicle.

### Friends
- Add by username or short code
- See their class and current active habits (streak health, not exact count)
- Receive a notification when a friend levels up or earns a feat
- See their activity in a feed ("Aria reached Stage 3 Knight — Champion")

### Guilds
- Create or join a guild (up to 20 members, arbitrary cap to start)
- Guild has a shared quest board — guild quests require multiple members to each complete their individual habit
- Example guild quest: "Five members complete their daily exercise this week" → everyone gets bonus XP
- Guild leaderboard: ranked by collective streak days or XP

### Party XP bonus
When two friends both complete the same daily habit on the same day, they each get a small Party XP bonus (+10%). Not coordinated in real-time — resolved at end of day. "You and 2 guild members all trained today. Fellowship bonus earned."

This is passive, not active. You don't have to coordinate in the app — you just both do the habit, and the app notices.

---

## Guild structure

| Role | Permissions |
|---|---|
| Guild Master | Create guild, set guild quests, invite/remove members |
| Officer | Invite members, post to guild board |
| Member | Complete guild quests, view guild board |

Guild quests are set weekly by the Guild Master — they pick from a list of collective goals. Not user-defined from scratch (too complex to moderate).

---

## What this requires (technically)

This cannot be localStorage. The social layer needs:
- User accounts (email or Sign in with Apple)
- Backend (simple — user records, friend links, guild records, daily completion logs)
- The completion data is already local — at end of day, the app syncs to the server
- No real-time requirement. Batch sync is fine.

**Stack recommendation:** Supabase (free tier covers this). Row-level security keeps profiles private by default. Auth built in. No server to maintain.

This is a Stage 4 feature. Don't build backend until the solo product is solid and has users.

---

## Privacy defaults

- Profiles are private by default. You opt into public.
- Streaks show as "active" / "strong" / "lapsed" — not exact day counts (unless user chooses to show them)
- Chronicle entries are private unless explicitly shared
- Guild activity is visible to guild members only

The app is about personal habits. Social pressure is a double-edged sword — the social layer should feel like a shared adventure, not a leaderboard that shames you.

---

## Narrative framing

In the world of Dawnhearth, guilds exist. You've always been able to see other adventurers in the tavern. The social layer is just... meeting them.

Guild Hall becomes a building in the world. You visit it to see your guildmates' latest deeds, accept guild quests, and post to the board. The guild quest completion event could read: "The Iron Dawn Guild has collectively trained for 47 days this month. The realm has taken notice."

---

## Phase roadmap

| Phase | Feature |
|---|---|
| v1 (now) | Solo play. Local storage. No accounts. |
| v2 | Accounts + profiles. Share your character. Sync to server. |
| v3 | Friends + feed. See friends' progress. Fellowship bonus. |
| v4 | Guilds. Shared quests. Guild board. Guild XP events. |
