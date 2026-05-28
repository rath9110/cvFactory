import { ApplicationSession } from "./profile-types";
import { storage } from "./storage";

export function newApplicationId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export async function saveSession(session: ApplicationSession): Promise<void> {
  return storage().saveSession(session);
}

export async function loadSession(id: string): Promise<ApplicationSession> {
  return storage().loadSession(id);
}

export async function listSessions(): Promise<
  Array<{ id: string; updated_at: string }>
> {
  return storage().listSessions();
}

export async function deleteSession(id: string): Promise<boolean> {
  return storage().deleteSession(id);
}
