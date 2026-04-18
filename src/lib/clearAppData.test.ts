import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_LOCAL_STORAGE_KEYS,
  clearAllAppData,
  type ClearAppDataDeps,
} from "@/lib/clearAppData";
import { ROTATION_IDB_NAME } from "@/hooks/useRotationHistory";

describe("clearAllAppData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes every app localStorage key, deletes rotation IDB, then reloads", async () => {
    const removed: string[] = [];
    const reload = vi.fn();
    let deletedName: string | null = null;

    const deleteDatabase = vi.fn((name: string) => {
      deletedName = name;
      const req = {
        onsuccess: null as (() => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        error: null as DOMException | null,
      };
      queueMicrotask(() => req.onsuccess?.());
      return req as unknown as IDBOpenDBRequest;
    });

    const deps: ClearAppDataDeps = {
      removeLocalStorageItem: (key) => {
        removed.push(key);
      },
      deleteDatabase,
      reload,
    };

    await clearAllAppData(deps);

    expect(removed.sort()).toEqual([...APP_LOCAL_STORAGE_KEYS].sort());
    expect(deletedName).toBe(ROTATION_IDB_NAME);
    expect(deleteDatabase).toHaveBeenCalledWith(ROTATION_IDB_NAME);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("rejects when deleteDatabase fails", async () => {
    const deleteDatabase = vi.fn(() => {
      const req = {
        onsuccess: null as (() => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        error: new DOMException("fail", "UnknownError"),
      };
      queueMicrotask(() => req.onerror?.(new Event("error")));
      return req as unknown as IDBOpenDBRequest;
    });

    const deps: ClearAppDataDeps = {
      removeLocalStorageItem: vi.fn(),
      deleteDatabase,
      reload: vi.fn(),
    };

    await expect(clearAllAppData(deps)).rejects.toBeDefined();
    expect(deps.reload).not.toHaveBeenCalled();
  });
});
