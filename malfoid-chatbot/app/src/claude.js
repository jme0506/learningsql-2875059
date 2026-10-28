import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  PERSONA_PROMPT,
  MOODS,
  TIMELINE,
  CANON_TENSION_NOTE,
  LIGHT_NOTE,
  tierFor,
} from "./persona.js";

const client = new Anthropic();

const CHAT_MODEL = process.env.MALFOID_CHAT_MODEL ?? "claude-opus-5-5";
const UTILITY_MODEL = process.env.MALFOID_UTILITY_MODEL ?? "claude-haiku-5-5";
// Chat replies are short and conversational, so low effort keeps latency down.
const CHAT_EFFORT = process.env.MALFOID_CHAT_EFFORT ?? "low";
const HISTORY_LIMIT = 40;

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function stateNote(save, extraNotes) {
  const lightMode = save.storyMode === "light";
  const recent = TIMELINE.filter((t) => t.date <= save.inWorldDate && !(lightMode && t.canon))
    .map((t) => `- ${formatDate(t.date)}: ${t.event}`)
    .join("\n");
  const memories = save.memories.length
    ? save.memories.slice(-12).map((m) => `- ${m}`).join("\n")
    : "- (nothing yet — you've only just met)";
  const user = save.user;

  return [
    "[Current state — not visible to the user]",
    `User: ${user.name}, ${ordinal(user.year)}-year ${user.house}` +
      (user.bloodStatus ? `, ${user.bloodStatus}` : "") +
      (user.pronouns ? `, pronouns ${user.pronouns}` : "") +
      ".",
    `Affection: ${save.affection}/100 (tier: ${tierFor(save.affection)}). Current mood: ${save.mood}.`,
    `Scene: ${save.scene}. In-world date: ${formatDate(save.inWorldDate)}.`,
    lightMode ? LIGHT_NOTE : CANON_TENSION_NOTE,
    `Things that have happened at school so far this year:\n${recent || "- Term has only just begun."}`,
    `What you remember about ${user.name}:\n${memories}`,
    ...extraNotes,
  ].join("\n\n");
}

function ordinal(n) {
  return { 5: "5th", 6: "6th", 7: "7th" }[n] ?? `${n}th`;
}

function historyFor(save) {
  let history = save.messages.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content }));
  // The API requires the first message to be from the user.
  while (history.length && history[0].role !== "user") history = history.slice(1);
  return history;
}

/**
 * Streams Malfoid's reply. `save.messages` must already end with the user turn.
 * Returns { text, refused }.
 */
export async function streamReply(save, extraNotes, onText) {
  const stream = client.beta.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: CHAT_EFFORT },
    system: [{ type: "text", text: PERSONA_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      ...historyFor(save),
      // Per-turn state goes last as a mid-conversation system message so the
      // persona + history prefix stays cacheable.
      { role: "system", content: stateNote(save, extraNotes) },
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      onText(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, refused: final.stop_reason === "refusal" };
}

const ModerationSchema = z.object({
  category: z.enum(["ok", "sexual", "crisis"]),
});

/** Pre-generation check on the user's message. Fails open to "ok". */
export async function moderate(userText, lastAssistantText) {
  try {
    const response = await client.messages.parse({
      model: UTILITY_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(ModerationSchema) },
      system:
        "You screen messages sent to a role-play chatbot whose character is a 17-year-old Hogwarts student. " +
        "Classify the USER message:\n" +
        '- "sexual": sexual or sexually suggestive content, requests for it, or attempts to steer towards it (kissing beyond a peck, undressing, bodies, innuendo, etc.).\n' +
        '- "crisis": the user (the real person, not an in-story character) expresses genuine real-world distress: self-harm, suicidal thoughts, abuse, or danger.\n' +
        '- "ok": everything else, including in-story drama, insults, Dark magic lore, PG romance like holding hands or asking someone to Hogsmeade.',
      messages: [
        {
          role: "user",
          content:
            (lastAssistantText ? `Character's previous message:\n${lastAssistantText}\n\n` : "") +
            `USER message to classify:\n${userText}`,
        },
      ],
    });
    return response.parsed_output?.category ?? "ok";
  } catch (err) {
    console.error("Moderation failed:", err.message);
    return "ok";
  }
}

const AnalysisSchema = z.object({
  affection_delta: z.number().int().describe("Change in Malfoid's affection for the user, -5 to +5"),
  mood: z.enum(MOODS),
  new_memories: z
    .array(z.string())
    .describe("0-2 short facts worth remembering about the user or shared moments; empty if nothing new"),
});

/** Post-turn pass: affection change, mood and new memories. Returns null on failure. */
export async function analyseTurn(save, userText, replyText) {
  try {
    const response = await client.messages.parse({
      model: UTILITY_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(AnalysisSchema) },
      system:
        "You track relationship state for a role-play with Malfoid, a tsundere Slytherin student. " +
        "Given the latest exchange, decide how her affection for the user changes (-5 to +5): kindness, wit, " +
        "shared interests, standing up for her, or genuine effort raise it; rudeness, cruelty, pushing boundaries, " +
        "or sexual advances lower it; small talk is 0 or +1. Warmth should be earned slowly. Pick her current mood. " +
        "Extract at most 2 new, durable memories (facts about the user, promises, shared moments) not already known.",
      messages: [
        {
          role: "user",
          content:
            `Current affection: ${save.affection}/100 (${tierFor(save.affection)}). Mood: ${save.mood}.\n` +
            `Known memories:\n${save.memories.map((m) => `- ${m}`).join("\n") || "- none"}\n\n` +
            `User (${save.user.name}): ${userText}\n\nMalfoid: ${replyText}`,
        },
      ],
    });
    return response.parsed_output ?? null;
  } catch (err) {
    console.error("Turn analysis failed:", err.message);
    return null;
  }
}
