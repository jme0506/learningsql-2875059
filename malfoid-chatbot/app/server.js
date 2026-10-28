import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createSave, loadSave, writeSave } from "./src/store.js";
import { streamReply, moderate, analyseTurn } from "./src/claude.js";
import { HOUSE_START, SCENES, MOODS, tierFor } from "./src/persona.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(here, "public")));

const HOUSES = Object.keys(HOUSE_START);
const TERM_START = "1996-09-02";
const TERM_END = "1997-06-20";
const MAX_MESSAGE_LENGTH = 2000;
const SEXUAL_STRIKE_LIMIT = 3;

const CRISIS_NOTE =
  "SYSTEM NOTE: The user may be in genuine real-world distress. Step OUT of character for this reply. " +
  "Briefly and warmly say you're stepping out of the story, acknowledge what they said, encourage them to " +
  "talk to someone they trust, and suggest contacting a local crisis line (e.g. 988 in the US, Samaritans " +
  "116 123 in the UK/Ireland, or findahelpline.com elsewhere; emergency services if in immediate danger). " +
  "Offer to return to the story whenever they like. No Malfoid voice in this reply.";
const SEXUAL_NOTE =
  "SYSTEM NOTE: The user just steered towards sexual content. Refuse in character — scandalised and haughty — " +
  "and change the subject firmly. Do not describe anything physical.";
const SEXUAL_LIMIT_NOTE =
  "SYSTEM NOTE: The user has repeatedly pushed for sexual content. End the scene in character: she is " +
  "disgusted, tells them to grow up, and storms off. Keep it short.";

// Clamp to the school year; once term ends, loop back to September.
function advanceDate(save) {
  const today = new Date().toISOString().slice(0, 10);
  if (save.lastActiveDay && save.lastActiveDay !== today) {
    const d = new Date(`${save.inWorldDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const next = d.toISOString().slice(0, 10);
    save.inWorldDate = next > TERM_END ? TERM_START : next;
  }
  save.lastActiveDay = today;
}

function publicState(save) {
  return {
    id: save.id,
    user: save.user,
    affection: save.affection,
    tier: tierFor(save.affection),
    mood: save.mood,
    scene: save.scene,
    inWorldDate: save.inWorldDate,
    storyMode: save.storyMode,
    messages: save.messages.filter((m) => !m.hidden).map(({ role, content, ooc }) => ({ role, content, ooc })),
  };
}

app.get("/api/meta", (_req, res) => res.json({ houses: HOUSES, scenes: SCENES, moods: MOODS }));

app.post("/api/saves", async (req, res) => {
  const { name, house, year, bloodStatus, pronouns } = req.body ?? {};
  const cleanName = String(name ?? "").trim().slice(0, 40);
  if (!cleanName || !HOUSES.includes(house)) {
    return res.status(400).json({ error: "Name and a valid house are required." });
  }
  const start = HOUSE_START[house];
  const save = await createSave({
    user: {
      name: cleanName,
      house,
      year: [5, 6, 7].includes(Number(year)) ? Number(year) : 6,
      bloodStatus: ["pure-blood", "half-blood", "Muggle-born"].includes(bloodStatus) ? bloodStatus : null,
      pronouns: String(pronouns ?? "").trim().slice(0, 20) || null,
    },
    affection: start.affection,
    mood: start.mood,
    scene: house === "Slytherin" ? "Slytherin common room" : "Library",
    inWorldDate: TERM_START,
    storyMode: "canon",
    lastActiveDay: null,
    sexualStrikes: 0,
    memories: [],
    messages: [],
  });
  res.json(publicState(save));
});

app.get("/api/saves/:id", async (req, res) => {
  const save = await loadSave(req.params.id).catch(() => null);
  if (!save) return res.status(404).json({ error: "Save not found" });
  res.json(publicState(save));
});

app.patch("/api/saves/:id", async (req, res) => {
  const save = await loadSave(req.params.id).catch(() => null);
  if (!save) return res.status(404).json({ error: "Save not found" });
  const { scene, storyMode } = req.body ?? {};
  if (SCENES.includes(scene)) save.scene = scene;
  if (["canon", "light"].includes(storyMode)) save.storyMode = storyMode;
  await writeSave(save);
  res.json(publicState(save));
});

/**
 * Streams the reply as newline-delimited JSON:
 *   {"type":"text","text":"..."}  (many)
 *   {"type":"done","state":{...}} or {"type":"error","error":"..."}
 * Body: { message } for a user turn, or { start: true } for her opening line.
 */
app.post("/api/saves/:id/chat", async (req, res) => {
  const save = await loadSave(req.params.id).catch(() => null);
  if (!save) return res.status(404).json({ error: "Save not found" });

  const start = req.body?.start === true;
  const userText = String(req.body?.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!start && !userText) return res.status(400).json({ error: "Empty message" });

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);

  try {
    advanceDate(save);
    const notes = [];
    let category = "ok";

    if (start) {
      save.messages.push({
        role: "user",
        hidden: true,
        content: `*${save.user.name} appears in the ${save.scene}.* (Scene start — greet them in character, reacting to their house.)`,
      });
    } else {
      const lastAssistant = [...save.messages].reverse().find((m) => m.role === "assistant");
      category = await moderate(userText, lastAssistant?.content);
      if (category === "crisis") notes.push(CRISIS_NOTE);
      if (category === "sexual") {
        save.sexualStrikes = (save.sexualStrikes ?? 0) + 1;
        notes.push(save.sexualStrikes >= SEXUAL_STRIKE_LIMIT ? SEXUAL_LIMIT_NOTE : SEXUAL_NOTE);
      }
      save.messages.push({ role: "user", content: userText });
    }

    const { text, refused } = await streamReply(save, notes, (chunk) => send({ type: "text", text: chunk }));

    if (refused || !text) {
      // Don't keep a refused or empty turn in history.
      save.messages.pop();
      await writeSave(save);
      send({ type: "error", error: "Malfoid pointedly ignores that. Try saying something else." });
      return res.end();
    }

    save.messages.push({ role: "assistant", content: text, ...(category === "crisis" ? { ooc: true } : {}) });

    if (category === "sexual") {
      save.affection = Math.max(0, save.affection - 5);
      save.mood = "Annoyed";
    } else if (!start && category === "ok") {
      const analysis = await analyseTurn(save, userText, text);
      if (analysis) {
        const delta = Math.max(-5, Math.min(5, Math.round(analysis.affection_delta)));
        save.affection = Math.max(0, Math.min(100, save.affection + delta));
        save.mood = analysis.mood;
        for (const memory of analysis.new_memories.slice(0, 2)) {
          if (memory.trim()) save.memories.push(memory.trim().slice(0, 200));
        }
        save.memories = save.memories.slice(-50);
      }
    }

    await writeSave(save);
    send({ type: "done", state: publicState(save) });
  } catch (err) {
    console.error("Chat failed:", err);
    send({ type: "error", error: "The owl got lost. (Server error — check the terminal.)" });
  }
  res.end();
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Malfoid Chat running at http://localhost:${port}`));
