import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useInAppNotifications } from "@/contexts/InAppNotificationsContext";
import type { InAppNotificationKind } from "@/lib/inAppNotifications";
import { cn } from "@/lib/utils";
import { isElectronApp } from "@/lib/isElectronApp";

function kindMeta(kind: InAppNotificationKind): { label: string; Icon: typeof Bell; className: string } {
  switch (kind) {
    case "expiry_reminder":
      return { label: "Expiry reminder", Icon: Bell, className: "text-primary" };
    case "rotation_success":
      return {
        label: "Rotation success",
        Icon: CheckCircle2,
        className: "text-green-600 dark:text-green-400",
      };
    case "rotation_failed":
      return { label: "Rotation failed", Icon: XCircle, className: "text-destructive" };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export default function NotificationHistory() {
  const { items, unreadCount, markRead, markAllRead, clearAll } = useInAppNotifications();
  const isElectron = isElectronApp();

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
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            Notification history
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {items.length === 0
              ? "No entries yet"
              : `${items.length} saved · ${unreadCount} unread`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            Mark all read
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-destructive hover:text-destructive"
                disabled={items.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes every in-app notification from this device. System notifications are not
                  affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button type="button" variant="destructive" onClick={clearAll}>
                  Clear all
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In-app feed</CardTitle>
            <CardDescription className="text-xs">
              Rotations, reminders, and expiry alerts that were recorded while using the app (stored
              locally).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                When you generate a secret, get an expiry reminder, or a system notification fires, entries
                appear here.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map((n) => {
                  const { label, Icon, className } = kindMeta(n.kind);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:bg-muted/50",
                          !n.read && "border-primary/30 bg-primary/[0.05]",
                        )}
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                        }}
                      >
                        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {label}
                            </span>
                            {!n.read && (
                              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-medium leading-snug">{n.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
