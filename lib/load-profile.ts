import { MasterProfile } from "./profile-types";
import { storage } from "./storage";

export async function loadProfile(): Promise<MasterProfile> {
  return storage().loadProfile();
}

export async function saveProfile(profile: MasterProfile): Promise<void> {
  return storage().saveProfile(profile);
}
