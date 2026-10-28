// Builds malfoid.html from template.html, injecting the shared persona data from the Node app.
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
const json = JSON.stringify(data).replace(/</g, "\\u003c");
await writeFile(new URL("malfoid.html", here), template.replace("__DATA__", () => json));
console.log("Wrote malfoid.html");
