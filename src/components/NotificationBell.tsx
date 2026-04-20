import { Link } from "react-router-dom";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useInAppNotifications } from "@/contexts/InAppNotificationsContext";
import type { InAppNotificationKind } from "@/lib/inAppNotifications";

function kindIcon(kind: InAppNotificationKind) {
  switch (kind) {
    case "expiry_reminder":
      return Bell;
    case "rotation_success":
      return CheckCircle2;
    case "rotation_failed":
      return XCircle;
  }
}

function kindIconClass(kind: InAppNotificationKind) {
  switch (kind) {
    case "rotation_success":
      return "text-green-600 dark:text-green-400";
    case "rotation_failed":
      return "text-destructive";
    default:
      return "text-primary";
  }
}

const PREVIEW_LIMIT = 8;

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useInAppNotifications();
  const preview = items.slice(0, PREVIEW_LIMIT);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications, no unread"
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">
          Notifications
        </DropdownMenuLabel>
        {preview.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllRead();
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto px-2 pb-2 pt-1">
              <ul className="flex flex-col gap-2">
                {preview.map((n) => {
                  const Icon = kindIcon(n.kind);
                  return (
                    <li key={n.id}>
                      <DropdownMenuItem
                        asChild
                        className={cn(
                          "cursor-pointer items-start gap-2 rounded-md border border-border/80 bg-card px-3 py-2.5 shadow-sm outline-none transition-colors focus:bg-accent data-[highlighted]:bg-accent",
                          !n.read && "border-primary/25 bg-primary/[0.07]",
                        )}
                      >
                        <Link
                          to="/notifications"
                          onClick={() => {
                            if (!n.read) markRead(n.id);
                          }}
                          className="flex w-full min-w-0 gap-2 no-underline"
                        >
                          <Icon
                            className={cn("mt-0.5 h-4 w-4 shrink-0", kindIconClass(n.kind))}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="line-clamp-1 text-sm font-medium leading-tight">
                              {n.title}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/notifications" className="w-full justify-center font-medium">
            View all history
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
