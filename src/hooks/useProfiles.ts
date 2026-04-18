import { useCallback, useMemo, useState } from "react";

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

function loadInitialProfiles(): { profiles: AppleProfile[]; activeId: string } {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppleProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const active =
          localStorage.getItem(ACTIVE_KEY) ?? parsed[0].id;
        const validActive = parsed.some((p) => p.id === active)
          ? active
          : parsed[0].id;
        return { profiles: parsed, activeId: validActive };
      }
    } catch {
      // migrate
    }
  }

  const keyId = localStorage.getItem(LEGACY_KEY_ID) ?? "";
  const teamId = localStorage.getItem(LEGACY_TEAM_ID) ?? "";
  const servicesId = localStorage.getItem(LEGACY_SERVICES_ID) ?? "";
  const p: AppleProfile = {
    id: createId(),
    name: "Default",
    keyId,
    teamId,
    servicesId,
  };
  localStorage.setItem(PROFILES_KEY, JSON.stringify([p]));
  localStorage.setItem(ACTIVE_KEY, p.id);
  return { profiles: [p], activeId: p.id };
}

export function useProfiles() {
  const [{ profiles, activeId }, setState] = useState(loadInitialProfiles);

  const persist = useCallback((next: AppleProfile[], nextActive: string) => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    localStorage.setItem(ACTIVE_KEY, nextActive);
    setState({ profiles: next, activeId: nextActive });
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? profiles[0],
    [profiles, activeId],
  );

  const setActiveId = useCallback(
    (id: string) => {
      if (!profiles.some((p) => p.id === id)) return;
      localStorage.setItem(ACTIVE_KEY, id);
      setState((s) => ({ ...s, activeId: id }));
    },
    [profiles],
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
      const nextActive =
        id === activeId ? next[0].id : activeId;
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
