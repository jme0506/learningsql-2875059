# Malfoid Chat — MVP

Chat with **Malfoid (Draconia Malfoy)**, a 17-year-old Slytherin 6th year at Hogwarts in 1996–97. This is a personal fan project; see [`../SPEC.md`](../SPEC.md) and [`../CHARACTER_SHEET.md`](../CHARACTER_SHEET.md).

## Run it

You need Node 20+ and an Anthropic API key (from https://console.anthropic.com).

```bash
cd malfoid-chatbot/app
npm install
export ANTHROPIC_API_KEY=sk-ant-...     # Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
npm start
```

Open http://localhost:3000. Make a student profile, and Malfoid opens the scene.

## What's in the MVP

- **Onboarding**: name, house, year, and optional blood status and pronouns. Her opening line and starting affection depend on your house.
- **Streaming chat** in character, with her persona, voice, 6th-year knowledge and no knowledge of the future or of modern Muggle things.
- **Relationship progression**: a hidden affection score (0–100) across five tiers, Rival → Acquaintance → Friend → Close → Crush. It moves at most ±5 per message, so warmth has to be earned. A mood chip and an affection bar show in the header.
- **Memory**: she remembers up to 50 facts and moments about you across sessions.
- **Scenes and calendar**: a scene picker (Library, Potions, Quidditch pitch…). The in-world date starts on 2 Sep 1996 and moves forward a day each real day you chat. Canon 6th-year events unlock as the date passes them.
- **Scenario starters**: one-tap opening lines above the input box.
- **Story mode**: "canon tension" is the default, with her secret task as subtext only. You can switch to light-hearted in ⚙ Settings.
- **Safety**:
  - Romance stays PG and there's no sexual content. Each message is checked before she replies, and she shuts it down in character.
  - Every attempt costs affection. After 3 attempts she ends the scene.
  - Real distress makes her step out of character and point you to support.

## How it works

| Piece | File |
|---|---|
| Persona prompt, tiers, scenes, timeline | `src/persona.js` |
| Claude calls (chat stream, moderation, turn analysis) | `src/claude.js` |
| Express server and API | `server.js` |
| JSON-file saves (`data/saves/<id>.json`) | `src/store.js` |
| Frontend | `public/` |

Models, all overridable with environment variables:
- Chat uses `claude-opus-5-5` at `low` effort (`MALFOID_CHAT_MODEL`, `MALFOID_CHAT_EFFORT`). Server-side refusal fallbacks (`fallbacks: "default"`) are turned on.
- Moderation and the after-message affection/mood/memory analysis use `claude-haiku-5-5` (`MALFOID_UTILITY_MODEL`).
- To make chat cheaper, set `MALFOID_CHAT_MODEL=claude-sonnet-5-5`.

Each message runs one moderation call, one streamed chat call and one analysis call.

## Resetting

Use ⚙ Settings → *Start a new save*. Saves stay in `data/saves/`, which git ignores. Delete that folder to wipe them all.
