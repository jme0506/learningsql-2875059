// Builds malfoid.html from template.html, inlining avatar.js and the shared persona data from the Node app.
import { readFile, writeFile } from "node:fs/promises";
import * as persona from "../app/src/persona.js";

const here = new URL(".", import.meta.url);
const data = {
  PERSONA_PROMPT: persona.PERSONA_PROMPT,
  TIERS: persona.TIERS,
  MOODS: persona.MOODS,
  SCENES: persona.SCENES,
  HOUSE_START: persona.HOUSE_START,
  TIMELINE: persona.TIMELINE,
  CANON_TENSION_NOTE: persona.CANON_TENSION_NOTE,
  LIGHT_NOTE: persona.LIGHT_NOTE,
};
const template = await readFile(new URL("template.html", here), "utf8");
// The portrait lives in private/ (git-ignored: it isn't our artwork to redistribute).
const portrait = await readFile(new URL("private/malfoid.jpg", here));
const avatar = (await readFile(new URL("avatar.js", here), "utf8")).replace(
  '"__AVATAR_IMG__"',
  () => JSON.stringify(`data:image/jpeg;base64,${portrait.toString("base64")}`),
);
const json = JSON.stringify(data).replace(/</g, "\\u003c");
await writeFile(
  new URL("malfoid.html", here),
  template.replace("__AVATAR__", () => avatar).replace("__DATA__", () => json),
);
console.log("Wrote malfoid.html");
