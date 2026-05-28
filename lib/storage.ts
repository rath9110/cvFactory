import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  ApplicationSession,
  ApplicationSessionSchema,
  MasterProfile,
  MasterProfileSchema,
} from "./profile-types";

export type StorageDriver = "fs" | "redis";

export type Storage = {
  driver: StorageDriver;
  loadProfile(): Promise<MasterProfile>;
  saveProfile(profile: MasterProfile): Promise<void>;
  saveSession(session: ApplicationSession): Promise<void>;
  loadSession(id: string): Promise<ApplicationSession>;
  listSessions(): Promise<Array<{ id: string; updated_at: string }>>;
  deleteSession(id: string): Promise<boolean>;
};

function validProfile(raw: unknown): MasterProfile {
  return MasterProfileSchema.parse(raw);
}

function validSession(raw: unknown): ApplicationSession {
  return ApplicationSessionSchema.parse(raw);
}

function assertId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error("Invalid application id");
  }
}

// ---------- filesystem backend ----------

function fsStorage(): Storage {
  const dataDir = path.join(process.cwd(), "data");
  const profilePath = path.join(dataDir, "master_profile.json");
  const appsDir = path.join(dataDir, "applications");

  async function ensureAppsDir() {
    await fs.mkdir(appsDir, { recursive: true });
  }

  function fileFor(id: string): string {
    assertId(id);
    return path.join(appsDir, `${id}.json`);
  }

  return {
    driver: "fs",

    async loadProfile() {
      const raw = await fs.readFile(profilePath, "utf8");
      return validProfile(JSON.parse(raw));
    },

    async saveProfile(profile) {
      const validated = validProfile(profile);
      await fs.writeFile(
        profilePath,
        JSON.stringify(validated, null, 2) + "\n",
        "utf8"
      );
    },

    async saveSession(session) {
      await ensureAppsDir();
      const validated = validSession(session);
      await fs.writeFile(
        fileFor(validated.id),
        JSON.stringify(validated, null, 2),
        "utf8"
      );
    },

    async loadSession(id) {
      const raw = await fs.readFile(fileFor(id), "utf8");
      return validSession(JSON.parse(raw));
    },

    async listSessions() {
      try {
        const entries = await fs.readdir(appsDir);
        const results: Array<{ id: string; updated_at: string }> = [];
        for (const file of entries) {
          if (!file.endsWith(".json")) continue;
          const id = file.slice(0, -".json".length);
          try {
            const raw = await fs.readFile(path.join(appsDir, file), "utf8");
            const session = validSession(JSON.parse(raw));
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
    },

    async deleteSession(id) {
      try {
        await fs.unlink(fileFor(id));
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw err;
      }
    },
  };
}

// ---------- redis backend ----------

function redisStorage(): Storage {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis storage selected but UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set"
    );
  }
  const redis = new Redis({ url, token });

  const PROFILE_KEY = "cvfactory:profile";
  const SESSION_PREFIX = "cvfactory:session:";
  const SESSION_INDEX = "cvfactory:session_index"; // hash: id -> updated_at

  function sessionKey(id: string): string {
    assertId(id);
    return SESSION_PREFIX + id;
  }

  return {
    driver: "redis",

    async loadProfile() {
      const raw = await redis.get<unknown>(PROFILE_KEY);
      if (raw == null) {
        throw new Error(
          "Master profile not initialised in Redis. Seed it via POST /api/profile/seed or upload the local master_profile.json."
        );
      }
      // Upstash automatically deserialises JSON; if it returned a string fall back to parsing.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return validProfile(parsed);
    },

    async saveProfile(profile) {
      const validated = validProfile(profile);
      await redis.set(PROFILE_KEY, JSON.stringify(validated));
    },

    async saveSession(session) {
      const validated = validSession(session);
      await Promise.all([
        redis.set(sessionKey(validated.id), JSON.stringify(validated)),
        redis.hset(SESSION_INDEX, { [validated.id]: validated.updated_at }),
      ]);
    },

    async loadSession(id) {
      const raw = await redis.get<unknown>(sessionKey(id));
      if (raw == null) {
        const err = new Error("Session not found") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return validSession(parsed);
    },

    async listSessions() {
      const index = (await redis.hgetall<Record<string, string>>(SESSION_INDEX)) ?? {};
      return Object.entries(index)
        .map(([id, updated_at]) => ({ id, updated_at: String(updated_at) }))
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    },

    async deleteSession(id) {
      const removed = await redis.del(sessionKey(id));
      await redis.hdel(SESSION_INDEX, id);
      return removed > 0;
    },
  };
}

// ---------- driver selection ----------

function detectDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER;
  if (explicit === "fs" || explicit === "redis") return explicit;
  return process.env.UPSTASH_REDIS_REST_URL ? "redis" : "fs";
}

let cached: Storage | null = null;
let cachedDriver: StorageDriver | null = null;

export function storage(): Storage {
  const driver = detectDriver();
  if (cached && cachedDriver === driver) return cached;
  cached = driver === "redis" ? redisStorage() : fsStorage();
  cachedDriver = driver;
  return cached;
}

export function currentDriver(): StorageDriver {
  return detectDriver();
}
