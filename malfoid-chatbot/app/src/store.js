import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

// One JSON file per save. Plenty for a personal MVP; swap for SQLite later.
const DATA_DIR = path.resolve(process.env.MALFOID_DATA_DIR ?? "data/saves");

const ID_RE = /^[0-9a-f-]{36}$/;

function fileFor(id) {
  if (!ID_RE.test(id)) throw new Error("Invalid save id");
  return path.join(DATA_DIR, `${id}.json`);
}

export async function createSave(fields) {
  await mkdir(DATA_DIR, { recursive: true });
  const now = new Date().toISOString();
  const save = { id: randomUUID(), createdAt: now, updatedAt: now, ...fields };
  await writeSave(save);
  return save;
}

export async function loadSave(id) {
  try {
    return JSON.parse(await readFile(fileFor(id), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function writeSave(save) {
  save.updatedAt = new Date().toISOString();
  const file = fileFor(save.id);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(save, null, 2));
  await rename(tmp, file);
}
