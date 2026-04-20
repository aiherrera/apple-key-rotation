/** Row shape stored in SQLite (Electron) and returned from persistence layer. */

export type PersistedRotationRow = {
  id: string;
  profile_id: string;
  rotated_at: string;
  expires_at: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  jwt: string | null;
  key_id: string | null;
  team_id: string | null;
  services_id: string | null;
};
