import { promises as fs } from "fs";
import path from "path";
import {
  ApplicationSession,
  ApplicationSessionSchema,
} from "./profile-types";

const APPS_DIR = path.join(process.cwd(), "data", "applications");

async function ensureDir(): Promise<void> {
  await fs.mkdir(APPS_DIR, { recursive: true });
}

function fileFor(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error("Invalid application id");
  }
  return path.join(APPS_DIR, `${id}.json`);
}

export function newApplicationId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export async function saveSession(session: ApplicationSession): Promise<void> {
  await ensureDir();
  const parsed = ApplicationSessionSchema.parse(session);
  await fs.writeFile(fileFor(parsed.id), JSON.stringify(parsed, null, 2), "utf8");
}

export async function loadSession(id: string): Promise<ApplicationSession> {
  const raw = await fs.readFile(fileFor(id), "utf8");
  return ApplicationSessionSchema.parse(JSON.parse(raw));
}

export async function listSessions(): Promise<
  Array<{ id: string; updated_at: string }>
> {
  try {
    const entries = await fs.readdir(APPS_DIR);
    const results: Array<{ id: string; updated_at: string }> = [];
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      const id = file.slice(0, -".json".length);
      try {
        const session = await loadSession(id);
        results.push({ id, updated_at: session.updated_at });
      } catch {
        // Skip malformed files
      }
    }
    results.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return results;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
