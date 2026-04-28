# SideQuest — Quest Givers & Pre-Built Quests

## The problem with forms

The current "Add Quest" flow is a form. You type a name, pick an icon, set XP, write a description. This is fine for custom one-off quests, but it's completely wrong for common activities.

If someone wants to start meditating, they shouldn't have to build a quest from scratch. There should be a monk standing outside the temple ready to give them the quest.

This is the WoW model: you don't create quests, you receive them from quest givers. The quest giver already has the name, the flavour text, the XP, the objective. You just accept it.

---

## Quest giver model

Instead of a form, the "Add Quest" flow is a visit to the Quest Giver's board — a roster of NPCs, each holding a specific quest type.

Each NPC:
- Has a name and role in the world
- Holds one (or a small set of) pre-built quests
- Gives you the quest with full flavour text when you tap them
- Connects to feat progress automatically (accepting the meditation quest links to the Monk feat)

You tap the NPC → see the quest (name, description, objectives, rewards, feat connection) → accept or decline.

---

## Pre-built quest library

### Class dailies (always available — these are the core three)

| Quest | Quest giver | Habit | Class link |
|---|---|---|---|
| Train at the Barracks | Captain Aldric, Barracks Commander | Exercise 30min | Knight path |
| Explore the Kingdom | Wren, the Gate Scout | Go outside / walk | Ranger path |
| Study Ancient Tomes | Elder Sova, the Librarian | Read 20min | Acolyte path |

These appear in the daily quest board by default. They don't need to be "accepted" — they reset every day automatically.

---

### Feat quests (optional, accept once, then recur)

These are offered by NPCs around Dawnhearth. You visit them once to accept the quest. After that, it appears in your daily board as a recurring optional. Completing it 5 times unlocks the feat.

| NPC | Quest | Habit | Feat |
|---|---|---|---|
| Brother Cael, the Monk | Stillness at Dawn | Meditate (any duration) | 🧘 Monk |
| Mira, the Cook | Prepare the Hearth Meal | Cook from scratch | 🍳 Chef |
| Old Pen, the Chronicler | Write in the Chronicle | Journal / write | 📓 Scribe |
| Liria, the Wandering Bard | Songs of the Road | Play an instrument / practice | 🎵 Bard |
| Gareth, the Herbalist | Tend the Body | Stretch / recovery / mobility | (future feat) |
| Davel, the Courier | Speak to a Stranger | Social interaction | 🤝 Herald |
| The Steward | Keep the Grounds | Clean / organise | 🧹 Steward |
| Ilara, the Painter | The Open Studio | Create something | 🎨 Artist |

---

### User-created quests (custom, advanced)

For anything that doesn't fit the pre-built library, the custom quest creator still exists. But it's not the default. It's accessed via:

- A separate NPC ("The Notary") who helps you write your own contract
- Or a "Custom Quest" option at the bottom of the quest giver board

Custom quests don't connect to feat progress automatically — they're personal bounties. They can have custom icons, names, XP values, and frequency.

---

## The interaction design

**Finding quest givers:**

Quest givers are discoverable in the world — not in a settings menu or form. Options:
1. They appear on the main quest board as "available" tabs alongside dailies
2. In the future (with map/world view), they're NPCs you visit by tapping on buildings
3. For now: a scrollable "Quest Givers" panel accessible from the quest log, each NPC shown with their portrait, name, and quest teaser

**Accepting a quest:**

1. Tap the NPC card
2. Full-screen quest offer appears: NPC portrait, their dialogue, quest name, objectives, XP reward, feat connection ("This quest contributes to the Monk feat")
3. Two buttons: "Accept" (gold) and "Maybe later" (dismiss)
4. On accept: quest added to daily board. Flavour text changes to past-tense confirmation: "Cael nods. 'The practice begins when you do.'"

**Quest giver dialogue (examples):**

*Brother Cael offering the meditation quest:*
> "The noise of the world does not stop. But you can. Five minutes, ten, whatever you have. Come to the temple at dawn, or wherever you are. Just stop. I'll know."

*Liria offering the Bard quest:*
> "You play? Then play. It doesn't matter if no one hears it. The songs keep you company when the road is long. Pick it up when you can. I'm not keeping score — but I am keeping watch."

*Ilara offering the Artist quest:*
> "You don't need to make something great. You need to make something. The studio is open. The rest follows."

---

## Why this matters

The quest giver model does three things:

1. **Reduces friction** — Accepting a pre-built quest takes 3 taps. Building one from a form takes 10+ inputs and assumptions about what XP is reasonable.

2. **Adds world texture** — Every habit has a character behind it. You're not setting a reminder to meditate; Brother Cael is waiting for you. That's a very different relationship with a habit.

3. **Guides feat discovery** — Users don't have to know what feats are available. They explore the quest giver board and naturally discover "oh, there's a cooking quest. I cook sometimes." The feat system reveals itself through exploration, not a tutorial.

---

## Connection to class unlock

When a user accepts one of the three class dailies (train / explore / study) and completes it 3 days in a row, the class unlock ceremony fires. The NPC who gave them the quest is involved in the unlock text:

> Captain Aldric, Barracks Commander: "Three days. You kept your word. I don't say this lightly — you've earned the right to call yourself Squire. The work gets harder. Come back tomorrow."

The quest giver becomes the class mentor. This creates continuity — the NPC who gave you the quest witnesses your growth.
