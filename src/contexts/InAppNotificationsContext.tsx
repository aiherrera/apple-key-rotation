import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  IN_APP_NOTIFICATIONS_STORAGE_KEY,
  appendInAppNotification,
  markAllNotificationsRead,
  markNotificationRead,
  parseStoredNotifications,
  type InAppNotification,
  type InAppNotificationKind,
} from "@/lib/inAppNotifications";
import { useKvPersistence } from "@/contexts/KvPersistenceContext";

type AddInput = {
  kind: InAppNotificationKind;
  title: string;
  body: string;
};

type InAppNotificationsContextValue = {
  items: InAppNotification[];
  unreadCount: number;
  add: (input: AddInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const InAppNotificationsContext = createContext<InAppNotificationsContextValue | null>(null);

export function InAppNotificationsProvider({ children }: { children: ReactNode }) {
  const { kv, setItem } = useKvPersistence();
  const blob = kv[IN_APP_NOTIFICATIONS_STORAGE_KEY];

  const items = useMemo(
    () => parseStoredNotifications(blob ?? null),
    [blob],
  );

  const persist = useCallback(
    (next: InAppNotification[]) => {
      setItem(IN_APP_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
    },
    [setItem],
  );

  const add = useCallback(
    (input: AddInput) => {
      const next = appendInAppNotification(items, input);
      persist(next);
    },
    [items, persist],
  );

  const markRead = useCallback(
    (id: string) => {
      const next = markNotificationRead(items, id);
      persist(next);
    },
    [items, persist],
  );

  const markAllRead = useCallback(() => {
    const next = markAllNotificationsRead(items);
    persist(next);
  }, [items, persist]);

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      add,
      markRead,
      markAllRead,
      clearAll,
    }),
    [items, unreadCount, add, markRead, markAllRead, clearAll],
  );

  return (
    <InAppNotificationsContext.Provider value={value}>{children}</InAppNotificationsContext.Provider>
  );
}

export function useInAppNotifications(): InAppNotificationsContextValue {
  const ctx = useContext(InAppNotificationsContext);
  if (!ctx) {
    throw new Error("useInAppNotifications must be used within InAppNotificationsProvider");
  }
  return ctx;
}
