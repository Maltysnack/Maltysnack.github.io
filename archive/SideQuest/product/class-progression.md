# SideQuest — Class Progression Design

## The core idea

You start as a Citizen — undeclared, no specialisation. The five dailies are available to everyone. Over time, completing specific dailies consistently unlocks classes. The class you hold reflects the habits you actually have, not the ones you intend to have.

This mirrors real life: you don't decide to become a reader, you become one by reading. The class is a recognition of what you're already doing.

---

## The five dailies and their roles

| Daily | Real habit | Mechanic role | Class path |
|---|---|---|---|
| Rest at the Inn | Sleep 8h | Universal XP multiplier | — |
| Drink from the Spring | Drink 2L water | Universal XP % boost | — |
| Study Ancient Tomes | Read 20min | Class daily → Acolyte | Acolyte |
| Explore the Kingdom | Walk / go outside | Class daily → Ranger | Ranger |
| Train at the Barracks | Exercise 30min | Class daily → Knight | Knight |

Sleep and water are infrastructure — they don't define a class, they amplify everything. This is correct because they're foundational habits that benefit any lifestyle. Think of them as rested XP (sleep) and consumable buff (water).

---

## Class unlock conditions

Complete the class daily **3 days in a row** → unlock that class.

| Class | Unlock condition | What changes |
|---|---|---|
| Acolyte | Read 3 consecutive days | +50% XP on Study Ancient Tomes; INT flavour on quests; staff avatar |
| Ranger | Walk 3 consecutive days | +50% XP on Explore the Kingdom; AGI flavour; bow avatar |
| Knight | Train 3 consecutive days | +50% XP on Train at the Barracks; STR flavour; sword avatar |
| Citizen | Starting class | +5% XP on ALL quests, no specialisation bonus |

---

## Open design questions (decide before building)

### Q1: One class or multi-class?

**Option A — One class at a time (choose your path)**
- You can unlock all three but only hold one active class
- Switching class requires a 3-day re-qualification in the new class
- Pros: meaningful choice, clear identity, more drama in switching
- Cons: punishes diverse habit formation, which is the actual goal

**Option B — Multi-class (unlock and keep)**
- Each class is unlocked permanently once earned
- Active bonuses stack (if you maintain all three streaks)
- Your displayed title is determined by your longest current streak
- Pros: rewards building multiple habits, progression never feels lost
- Cons: less tension, no trade-off

**Option C — Multi-class with a primary**
- You hold all unlocked classes
- You CHOOSE which is your "primary" (displayed title, avatar, narrative flavour)
- All class bonuses are active regardless of primary
- Pros: best of both, real identity choice without punishing diversity

**Recommendation: Option B.** This is a habit tracker, not a competitive RPG. Punishing someone for exercising AND reading would be perverse. Let them build all three. The displayed class defaults to the one with the current longest streak, which naturally shifts as habits evolve.

---

### Q2: What happens when you miss a day?

**Option A — Lose the class immediately**
- Miss one day of your class daily → drop back to Citizen
- Must re-qualify from scratch (3 in a row)
- Too punishing. Life happens. This would make users quit.

**Option B — Lose the class bonus, keep the class**
- Miss a day → class bonus suspended for that day only
- Resume the next day and the bonus returns
- Miss 7 days in a row → class goes dormant (lose title, keep unlock)
- Re-activate by doing the daily 2 days in a row
- Balanced. Punishes neglect but not human error.

**Option C — Streak protection consumable**
- Miss a day → spend 50 XP to protect the streak (like Duolingo's streak freeze)
- Or earn "Oath Shields" that auto-protect one missed day
- Monetisation hook: premium users get 2 shields/week, free users get 1

**Recommendation: Option B with one automatic grace day per week.** Not advertised — just built in. If you've maintained the streak for 7+ days, one missed day doesn't break it. This is based on how habit research actually works — the occasional missed day doesn't break a habit, but two in a row often does.

---

### Q3: Does class loss feel bad enough to matter?

This is the tension the mechanic lives on. The unlock should feel earned, the loss should feel consequential, but not demoralising. The moment of unlock needs to be the biggest XP toast in the app — a proper class ceremony. The visual shift (new avatar, new title) is the payoff.

The moment of loss, if it happens, should be quiet — not a dramatic punishment, just a gentle "Your Acolyte oath has grown cold. Read again to rekindle it." No shame, just a nudge.

---

## The XP stack (how it all adds up)

**Base quest XP:** 25–40 depending on quest difficulty

**Multipliers apply in order:**
1. Sleep bonus: +20% to all XP if completed today
2. Water bonus: +10% to all XP if completed today
3. Class bonus: +50% to the class-specific daily
4. Streak bonus: +5% for every 7-day streak milestone (7 days = +5%, 14 = +10%, 30 = +15%, cap 30%)

**Example — Day 14, all-in Acolyte:**
- Study Ancient Tomes: 25 XP base
- × 1.20 (slept) × 1.10 (hydrated) × 1.50 (Acolyte) × 1.10 (14-day streak) = 54 XP

**Example — Citizen, no buffs:**
- Study Ancient Tomes: 25 XP base × 1.05 (Citizen) = 26 XP

The gap between a fully-buffed dedicated class member and a lapsed Citizen doing the minimum is roughly 2× XP per quest. That's meaningful but not demoralising.

---

## Citizen's role in the arc

Citizen must feel like a valid starting place, not a placeholder that shames you into changing. The framing matters:

**Bad framing:** "You're just a Citizen. Unlock a real class."

**Good framing:** "Every legend starts undeclared. The path reveals itself through action."

Citizen gets +5% XP on everything — they're a generalist. Their profile shows: "Undeclared. All paths open." Their quests have neutral flavour (no class-specific text).

The first class unlock is the first real moment of identity in the app. Make it count.

---

## Class flavour text examples

Each class-specific daily should have different description text depending on your class:

| Daily | Citizen text | Knight text | Ranger text | Acolyte text |
|---|---|---|---|---|
| Train at Barracks | "A body kept ready." | "A Knight without training is armour without a sword." | "You keep your legs sharp. The road demands it." | "The mind suffers when the body is neglected." |
| Explore the Kingdom | "The world is wider than Dawnhearth." | "Scouting the perimeter. Good discipline." | "The forest remembers your footsteps." | "The ancient paths lead somewhere, if you follow them." |
| Study Ancient Tomes | "Knowledge has its uses." | "A Knight reads so they know what they're protecting." | "Maps, tracking signs, weather patterns. All worth knowing." | "The texts do not repeat themselves to those who do not return." |

---

## Future classes (beyond the initial three)

The current five dailies only map to three classes. Future class expansions could include:

| New daily | Habit | Class |
|---|---|---|
| Prepare a Meal | Cook from scratch | Chef / Alchemist |
| Speak with a Stranger | Social interaction | Bard |
| Tend the Grounds | Clean / organise | Steward |
| Write in the Chronicle | Journal | Scribe |
| Meditate at Dawn | Mindfulness | Druid |

Each new class would need a new daily added to the user's quest board. These are not default — they'd be user-added weeklies or custom quests that, when maintained, unlock the class.

---

## The Yonder connection (future, not now)

When Yonder v1.0 is built and both products are polished standalone, the natural link is:

Your SideQuest class IS your Yonder class. Maintaining your SideQuest Knight status for 30 days earns your Yonder Knight a permanent +2 STR. Maintaining Acolyte earns +2 INT. This makes real-world habits meaningfully affect your idle RPG character.

Not now. But design SideQuest's class system with this in mind — the same class names, the same stat mappings.
