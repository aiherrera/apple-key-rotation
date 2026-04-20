import { useCallback, useLayoutEffect, useMemo } from "react";
import { useKvPersistence } from "@/contexts/KvPersistenceContext";

export interface AppleProfile {
  id: string;
  name: string;
  keyId: string;
  teamId: string;
  servicesId: string;
}

export const PROFILES_KEY = "apple_key_profiles_v1";
export const ACTIVE_KEY = "apple_key_profile_active";

export const LEGACY_KEY_ID = "apple_key_id";
export const LEGACY_TEAM_ID = "apple_team_id";
export const LEGACY_SERVICES_ID = "apple_services_id";

function createId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Read profiles from storage snapshot without writing (default profile is created in-memory if needed). */
export function loadProfilesReadOnly(
  get: (key: string) => string | undefined,
): { profiles: AppleProfile[]; activeId: string } {
  const raw = get(PROFILES_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppleProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const active = get(ACTIVE_KEY) ?? parsed[0].id;
        const validActive = parsed.some((p) => p.id === active) ? active : parsed[0].id;
        return { profiles: parsed, activeId: validActive };
      }
    } catch {
      // migrate
    }
  }

  const keyId = get(LEGACY_KEY_ID) ?? "";
  const teamId = get(LEGACY_TEAM_ID) ?? "";
  const servicesId = get(LEGACY_SERVICES_ID) ?? "";
  const p: AppleProfile = {
    id: createId(),
    name: "Default",
    keyId,
    teamId,
    servicesId,
  };
  return { profiles: [p], activeId: p.id };
}

export function useProfiles() {
  const { kv, setItem } = useKvPersistence();

  const kvProfiles = kv[PROFILES_KEY];
  const kvActive = kv[ACTIVE_KEY];
  const kvLegacyKey = kv[LEGACY_KEY_ID];
  const kvLegacyTeam = kv[LEGACY_TEAM_ID];
  const kvLegacySvc = kv[LEGACY_SERVICES_ID];

  useLayoutEffect(() => {
    if (kv[PROFILES_KEY]) return;
    const next = loadProfilesReadOnly((k) => kv[k]);
    setItem(PROFILES_KEY, JSON.stringify(next.profiles));
    setItem(ACTIVE_KEY, next.activeId);
  }, [kvProfiles, kvLegacyKey, kvLegacyTeam, kvLegacySvc, setItem, kv]);

  const { profiles, activeId } = useMemo(
    () => loadProfilesReadOnly((k) => kv[k]),
    [kvProfiles, kvActive, kvLegacyKey, kvLegacyTeam, kvLegacySvc, kv],
  );

  const persist = useCallback(
    (next: AppleProfile[], nextActive: string) => {
      setItem(PROFILES_KEY, JSON.stringify(next));
      setItem(ACTIVE_KEY, nextActive);
    },
    [setItem],
  );

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? profiles[0],
    [profiles, activeId],
  );

  const setActiveId = useCallback(
    (id: string) => {
      if (!profiles.some((p) => p.id === id)) return;
      setItem(ACTIVE_KEY, id);
    },
    [profiles, setItem],
  );

  const updateField = useCallback(
    (field: keyof Omit<AppleProfile, "id">, value: string) => {
      if (!activeProfile) return;
      const next = profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, [field]: value } : p,
      );
      persist(next, activeId);
    },
    [profiles, activeProfile, activeId, persist],
  );

  const addProfile = useCallback(() => {
    const base = activeProfile;
    const p: AppleProfile = {
      id: createId(),
      name: `Profile ${profiles.length + 1}`,
      keyId: base?.keyId ?? "",
      teamId: base?.teamId ?? "",
      servicesId: base?.servicesId ?? "",
    };
    persist([...profiles, p], p.id);
  }, [profiles, activeProfile, persist]);

  const removeProfile = useCallback(
    (id: string) => {
      if (profiles.length <= 1) return;
      const next = profiles.filter((p) => p.id !== id);
      const nextActive = id === activeId ? next[0].id : activeId;
      persist(next, nextActive);
    },
    [profiles, activeId, persist],
  );

  const renameProfile = useCallback(
    (id: string, name: string) => {
      const next = profiles.map((p) => (p.id === id ? { ...p, name } : p));
      persist(next, activeId);
    },
    [profiles, activeId, persist],
  );

  return {
    profiles,
    activeId,
    activeProfile,
    setActiveId,
    updateField,
    addProfile,
    removeProfile,
    renameProfile,
  };
}
