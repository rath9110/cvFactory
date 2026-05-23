import { promises as fs } from "fs";
import path from "path";
import { MasterProfile, MasterProfileSchema } from "./profile-types";

const PROFILE_PATH = path.join(process.cwd(), "data", "master_profile.json");

export async function loadProfile(): Promise<MasterProfile> {
  const raw = await fs.readFile(PROFILE_PATH, "utf8");
  return MasterProfileSchema.parse(JSON.parse(raw));
}

export async function saveProfile(profile: MasterProfile): Promise<void> {
  const validated = MasterProfileSchema.parse(profile);
  await fs.writeFile(PROFILE_PATH, JSON.stringify(validated, null, 2) + "\n", "utf8");
}
