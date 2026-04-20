import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Database,
  Download,
  Globe,
  Upload,
  Info,
  Linkedin,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  EXPIRY_THRESHOLD_OPTIONS,
  type ExpiryThresholdDay,
} from "@/lib/appSettings";
import { clearAllAppData } from "@/lib/clearAppData";
import { buildNotificationContent } from "@/lib/expiryNotifications";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import { useInAppNotifications } from "@/contexts/InAppNotificationsContext";
import { Badge } from "@/components/ui/badge";
import {
  APP_AUTHOR_LINKEDIN,
  APP_AUTHOR_WEBSITE,
  APP_DISPLAY_NAME,
  APP_DESCRIPTION,
} from "@/constants/appMeta";
import {
  APP_AUTHOR,
  RELEASE_HISTORY,
  type ReleaseChannel,
} from "@/constants/releaseHistory";
import {
  hasElectronSqlite,
  isElectronApp,
  showDesktopBackupSettings,
} from "@/lib/isElectronApp";

const SETTINGS_TABS = ["notifications", "data", "changelog", "about"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && SETTINGS_TABS.includes(value as SettingsTab);
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "notifications";

  const setTab = useCallback(
    (next: SettingsTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "notifications") {
            p.delete("tab");
          } else {
            p.set("tab", next);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <SettingsShell activeTab={activeTab} onTabChange={setTab}>
      {activeTab === "notifications" ? (
        <NotificationsSection />
      ) : activeTab === "data" ? (
        <DataPrivacySection />
      ) : activeTab === "changelog" ? (
        <ChangelogSection />
      ) : (
        <AboutSection />
      )}
    </SettingsShell>
  );
}

function SettingsShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: ReactNode;
}) {
  const isElectron = isElectronApp();

  const navItems = useMemo(
    () =>
      [
        { id: "notifications" as const, label: "Notifications", icon: Bell },
        { id: "data" as const, label: "Data & privacy", icon: Database },
        { id: "changelog" as const, label: "Changelog", icon: ScrollText },
        { id: "about" as const, label: "About", icon: Info },
      ] as const,
    [],
  );

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-muted/30",
        isElectron && "h-screen overflow-hidden",
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link to="/" aria-label="Back to home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">Settings</h1>
          <p className="truncate text-xs text-muted-foreground">
            Preferences and local data (stored on this device)
          </p>
        </div>
        <NotificationBell />
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col md:flex-row",
          isElectron && "min-h-0 overflow-hidden",
        )}
      >
        <nav
          className="shrink-0 border-b bg-card/50 p-2 md:w-56 md:border-b-0 md:border-r md:p-3"
          aria-label="Settings sections"
        >
          <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map(({ id, label, icon: Icon }) => {
              const selected = activeTab === id;
              return (
                <li key={id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => onTabChange(id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                    aria-current={selected ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="mx-auto min-h-0 w-full max-w-xl flex-1 space-y-6 overflow-y-auto px-4 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { settings, updateSettings } = useAppSettings();
  const { add: addInAppNotification } = useInAppNotifications();
  const [perm, setPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const notificationsSupported = typeof Notification !== "undefined";

  const requestPermission = useCallback(async () => {
    if (!notificationsSupported) return;
    const r = await Notification.requestPermission();
    setPerm(r);
  }, [notificationsSupported]);

  const previewExpiryNotification = useCallback(() => {
    if (!notificationsSupported) return;
    if (Notification.permission !== "granted") {
      toast.message("Allow notifications first", {
        description: "Use Request permission above, then try again.",
      });
      return;
    }
    const { title, body } = buildNotificationContent(7, [7]);
    try {
      new Notification(title, { body });
    } catch {
      toast.error("Could not show preview");
      return;
    }
    addInAppNotification({
      kind: "expiry_reminder",
      title,
      body,
    });
  }, [notificationsSupported, addInAppNotification]);

  const thresholdSet = useMemo(
    () => new Set(settings.expiryNotificationThresholds),
    [settings.expiryNotificationThresholds],
  );

  const toggleThreshold = (day: ExpiryThresholdDay, checked: boolean) => {
    const next = new Set(settings.expiryNotificationThresholds);
    if (checked) {
      next.add(day);
    } else {
      next.delete(day);
    }
    const arr = [...next].sort((a, b) => b - a) as ExpiryThresholdDay[];
    if (arr.length === 0) return;
    updateSettings({ expiryNotificationThresholds: arr });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Expiry reminders
          </CardTitle>
          <CardDescription className="text-xs">
            OS notifications when your current client secret is approaching expiry. Requires permission
            below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="expiry-notif-enabled" className="text-sm font-medium">
                Enable expiry notifications
              </Label>
              <p className="text-xs text-muted-foreground">Uses your system notification center</p>
            </div>
            <Switch
              id="expiry-notif-enabled"
              checked={settings.expiryNotificationsEnabled}
              onCheckedChange={(v) => updateSettings({ expiryNotificationsEnabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Remind me at (days before expiry)</Label>
            <div className="grid gap-2">
              {EXPIRY_THRESHOLD_OPTIONS.map((day) => (
                <label
                  key={day}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={thresholdSet.has(day)}
                    onCheckedChange={(c) => toggleThreshold(day, c === true)}
                    disabled={!settings.expiryNotificationsEnabled}
                  />
                  <span className="text-sm">
                    {day === 7 ? "One week (7 days)" : `${day} days`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification permission</CardTitle>
          <CardDescription className="text-xs">
            {notificationsSupported
              ? "Browser or desktop app must be allowed to show notifications."
              : "Notifications are not available in this environment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!notificationsSupported ? (
            <Alert>
              <BellOff className="h-4 w-4" />
              <AlertTitle className="text-sm">Unavailable</AlertTitle>
              <AlertDescription className="text-xs">
                The Notification API is not exposed here.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm">
                Status:{" "}
                <span className="font-medium capitalize">
                  {perm === "default" ? "not requested" : perm}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void requestPermission()}
                  disabled={perm === "granted"}
                >
                  {perm === "granted" ? "Permission granted" : "Request permission"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={previewExpiryNotification}
                  disabled={perm === "denied"}
                >
                  Preview sample
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview uses the same title and body as a real 7-day reminder (sample: 7 days left).
              </p>
              {perm === "denied" && !settings.notificationPermissionHintDismissed && (
                <Alert variant="destructive" className="py-2">
                  <AlertTitle className="text-sm">Blocked</AlertTitle>
                  <AlertDescription className="text-xs">
                    Enable notifications for this site or app in system settings if you change your
                    mind.
                  </AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => updateSettings({ notificationPermissionHintDismissed: true })}
                  >
                    Dismiss
                  </Button>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">In-app alerts</CardTitle>
          <CardDescription className="text-xs">
            Toasts when you open the app and sidebar “expiring soon” banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="startup-toasts" className="text-sm font-medium">
                Startup toasts
              </Label>
              <p className="text-xs text-muted-foreground">
                Warn when the secret is within the window below (on load)
              </p>
            </div>
            <Switch
              id="startup-toasts"
              checked={settings.startupToastsEnabled}
              onCheckedChange={(v) => updateSettings({ startupToastsEnabled: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inline-days" className="text-sm">
              Show “expiring soon” in sidebar within (days)
            </Label>
            <Input
              id="inline-days"
              type="number"
              min={1}
              max={365}
              className="max-w-[8rem]"
              value={settings.inlineExpiringDays}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 1 && n <= 365) {
                  updateSettings({ inlineExpiringDays: n });
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Compares against the latest successful generation’s expiry date.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

const channelLabel: Record<ReleaseChannel, string> = {
  latest: "Latest",
  beta: "Beta",
  alpha: "Alpha",
};

function ChangelogSection() {
  const appVersion = import.meta.env.VITE_APP_VERSION;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          What&apos;s new.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          A short history of releases.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          You&apos;re on <span className="font-medium text-foreground">v{appVersion}</span>
        </p>
      </div>

      <div className="relative border-l border-border pl-8">
        {RELEASE_HISTORY.map((entry) => {
          const isCurrent = entry.version === appVersion;
          const badgeIsLatest = isCurrent;
          const label = badgeIsLatest ? "Latest" : channelLabel[entry.channel];

          return (
            <div key={entry.version} className="relative pb-10 last:pb-2">
              <span
                className={cn(
                  "absolute -left-[33px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  isCurrent ? "bg-[hsl(var(--generate-mint))]" : "bg-muted-foreground/35",
                )}
                aria-hidden
              />
              <Card className="border shadow-sm">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2 pt-4">
                  <p className="text-sm font-semibold leading-none">
                    v{entry.version}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {entry.dateLabel}
                    </span>
                  </p>
                  <Badge
                    className={cn(
                      "shrink-0 border-0 font-medium",
                      badgeIsLatest &&
                        "bg-[hsl(var(--generate-mint))]/15 text-[hsl(var(--generate-mint))] hover:bg-[hsl(var(--generate-mint))]/20",
                      !badgeIsLatest && "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {label}
                  </Badge>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground marker:text-muted-foreground/70">
                    {entry.items.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">About</CardTitle>
        <CardDescription className="text-xs">
          {APP_DISPLAY_NAME} — credits and summary
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Author</p>
          <p className="mt-1 font-medium text-foreground">{APP_AUTHOR}</p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={APP_AUTHOR_WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5",
                "transition-colors hover:border-primary/25 hover:bg-muted/70",
              )}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--generate-mint))]/12 text-[hsl(var(--generate-mint))] ring-1 ring-[hsl(var(--generate-mint))]/20"
                aria-hidden
              >
                <Globe className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Website
                </span>
                <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                  aiherrera.com
                </span>
              </span>
            </a>
            <a
              href={APP_AUTHOR_LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5",
                "transition-colors hover:border-[#0A66C2]/35 hover:bg-muted/70",
              )}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] ring-1 ring-[#0A66C2]/15"
                aria-hidden
              >
                <Linkedin className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  LinkedIn
                </span>
                <span className="block truncate text-sm font-medium text-foreground group-hover:text-[#0A66C2]">
                  linkedin.com/in/aiherrera
                </span>
              </span>
            </a>
          </div>
        </div>
        <p className="text-xs leading-relaxed">{APP_DESCRIPTION}</p>
      </CardContent>
    </Card>
  );
}

function DataPrivacySection() {
  const [clearing, setClearing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [jsonReplaceOpen, setJsonReplaceOpen] = useState(false);
  const [dbPath, setDbPath] = useState<string | null>(null);

  useEffect(() => {
    if (!hasElectronSqlite()) return;
    void window.electronAPI!.sqlite!.getDbPath().then(setDbPath);
  }, []);

  const onConfirmClear = useCallback(async () => {
    setClearing(true);
    try {
      await clearAllAppData();
    } catch (e) {
      console.error(e);
      setClearing(false);
    }
  }, []);

  const onExportBackup = useCallback(async () => {
    if (!window.electronAPI?.sqlite) {
      toast.error("Database bridge unavailable", {
        description: "Quit and reinstall from a fresh npm run electron:build (and pack), or restart the app.",
      });
      return;
    }
    const r = await window.electronAPI.sqlite.exportDatabase();
    if (r.ok && r.path) {
      toast.success("Backup saved", { description: r.path });
    } else if (r.ok) {
      toast.success("Backup saved");
    } else {
      toast.message("Export canceled");
    }
  }, []);

  const onImportBackup = useCallback(async () => {
    if (!window.electronAPI?.sqlite) {
      toast.error("Database bridge unavailable", {
        description: "Quit and reinstall from a fresh npm run electron:build (and pack), or restart the app.",
      });
      return;
    }
    setImportOpen(false);
    const r = await window.electronAPI.sqlite.importDatabase();
    if (r.ok) {
      toast.success("Backup restored — reloading…");
    } else {
      toast.message("Restore canceled");
    }
  }, []);

  const onExportSnapshotJson = useCallback(async () => {
    if (!window.electronAPI?.sqlite) {
      toast.error("Database bridge unavailable", {
        description: "Quit and reinstall from a fresh npm run electron:build (and pack), or restart the app.",
      });
      return;
    }
    const r = await window.electronAPI.sqlite.exportSnapshotJson();
    if (r.ok && r.path) {
      toast.success("JSON snapshot saved", { description: r.path });
    } else if (r.ok) {
      toast.success("JSON snapshot saved");
    } else if (r.error) {
      toast.error(r.error);
    } else {
      toast.message("Export canceled");
    }
  }, []);

  const onImportSnapshotMerge = useCallback(async () => {
    if (!window.electronAPI?.sqlite) {
      toast.error("Database bridge unavailable", {
        description: "Quit and reinstall from a fresh npm run electron:build (and pack), or restart the app.",
      });
      return;
    }
    const r = await window.electronAPI.sqlite.importSnapshotJson("merge");
    if (r.ok) {
      toast.success("Snapshot merged — reloading…");
      window.location.reload();
    } else if (r.error) {
      toast.error(r.error);
    } else {
      toast.message("Import canceled");
    }
  }, []);

  const onImportSnapshotReplace = useCallback(async () => {
    if (!window.electronAPI?.sqlite) {
      toast.error("Database bridge unavailable", {
        description: "Quit and reinstall from a fresh npm run electron:build (and pack), or restart the app.",
      });
      return;
    }
    setJsonReplaceOpen(false);
    const r = await window.electronAPI.sqlite.importSnapshotJson("replace");
    if (r.ok) {
      toast.success("Snapshot restored — reloading…");
      window.location.reload();
    } else if (r.error) {
      toast.error(r.error);
    } else {
      toast.message("Import canceled");
    }
  }, []);

  const desktopBackups = showDesktopBackupSettings();

  return (
    <>
      {desktopBackups && !hasElectronSqlite() && (
        <Alert className="border-amber-600/40 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/30">
          <AlertTitle className="text-sm text-amber-950 dark:text-amber-100">
            Desktop backups need the database bridge
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-900 dark:text-amber-200/90">
            This window is running as the desktop app, but{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">window.electronAPI.sqlite</code>{" "}
            was not found. Quit completely, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">npm run electron:build</code>{" "}
            (or your pack script), reinstall the app, and try again. If you use dev mode, start with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">npm run electron:dev</code>.
          </AlertDescription>
        </Alert>
      )}

      {desktopBackups && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Back up local database</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Export or restore the full SQLite file (profiles, settings, rotation history, and saved
              client secrets). Restoring replaces all local app data and reloads the window.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dbPath && (
              <p className="break-all font-mono text-[10px] text-muted-foreground" title={dbPath}>
                {dbPath}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void onExportBackup()}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export backup…
              </Button>
              <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    Restore from backup…
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Replace data from backup?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This replaces the current database with the selected file. All unsaved changes
                      in this session will be lost. The app will reload immediately after.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button type="button" onClick={() => void onImportBackup()}>
                      Restore
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {desktopBackups && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portable backup (JSON)</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Export or import a JSON file with profiles, settings, and rotation history (including
              saved JWTs). Useful for moving data between machines without copying the raw SQLite file.
              Merge upserts settings and only adds rotation rows whose IDs are not already in the
              database. Replace clears all app data first, then loads the file (same end state as a
              fresh install plus the snapshot).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onExportSnapshotJson()}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export JSON snapshot…
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onImportSnapshotMerge()}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                Import JSON (merge)…
              </Button>
              <AlertDialog open={jsonReplaceOpen} onOpenChange={setJsonReplaceOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    Import JSON (replace all)…
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Replace all data from JSON?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes every profile, setting, rotation, and saved secret in this app,
                      then loads the selected snapshot. Choose a merge import instead if you only want
                      to add missing rows. The window reloads after a successful replace.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button type="button" variant="destructive" onClick={() => void onImportSnapshotReplace()}>
                      Replace and import
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Clear all app data</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Remove everything this app has stored on this device: Apple Developer profile fields,
          rotation history, notification reminder state, and all settings. This does not delete your
          <code className="mx-0.5 rounded bg-muted px-1 py-0.5 text-[0.7rem]">.p8</code> key files on
          disk. You cannot undo this action.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={clearing}>
              Clear all data…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all app data?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  This will permanently delete your profiles, rotation history, expiry notification
                  state, and preferences from this app. The page will reload afterward.
                </span>
                <span className="block font-medium text-foreground">This cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={clearing}
                onClick={() => void onConfirmClear()}
              >
                {clearing ? "Clearing…" : "Yes, clear everything"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
    </>
  );
}
