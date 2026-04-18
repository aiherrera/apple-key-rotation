import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Copy,
  AlertTriangle,
  Upload,
  Shield,
  FileKey,
  Trash2,
  Download,
  History,
  Pencil,
  Eraser,
  Terminal,
  Plus,
  Settings,
  ScrollText,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRotationHistory } from "@/hooks/useRotationHistory";
import { useExpiryNotifications } from "@/hooks/useExpiryNotifications";
import { useProfiles } from "@/hooks/useProfiles";
import { useAppSettings } from "@/hooks/useAppSettings";
import { generateAppleClientSecret } from "@/lib/appleJwt";
import { validateAppleIds } from "@/lib/appleConfigValidation";
import { copyToClipboard as copyText } from "@/lib/copyToClipboard";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/electronMenuEvents";
import { cn } from "@/lib/utils";

export default function AppleKeyRotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [privateKeyContent, setPrivateKeyContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropHover, setDropHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyIdInputRef = useRef<HTMLInputElement>(null);

  const isElectron = import.meta.env.VITE_ELECTRON === "true";

  const {
    profiles,
    activeId,
    activeProfile,
    setActiveId,
    updateField,
    addProfile,
    removeProfile,
    renameProfile,
  } = useProfiles();

  const keyId = activeProfile?.keyId ?? "";
  const teamId = activeProfile?.teamId ?? "";
  const servicesId = activeProfile?.servicesId ?? "";

  const { rotations, isLoading, addRotation, clearHistory, exportHistory } = useRotationHistory();
  useExpiryNotifications(rotations, isLoading, settings);

  const applyP8Content = useCallback((content: string, name: string) => {
    if (!content.includes("-----BEGIN PRIVATE KEY-----")) {
      toast.error("Invalid .p8 file format");
      return;
    }
    setPrivateKeyContent(content);
    setFileName(name);
    toast.success("Key loaded in memory");
  }, []);

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      toast.success("History cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleExportHistory = () => {
    if (rotations.length === 0) {
      toast.error("No history to export");
      return;
    }
    exportHistory();
    toast.success("History exported");
  };

  const copySecret = useCallback(async () => {
    if (!generatedSecret) {
      toast.error("No secret to copy yet");
      return;
    }
    await copyText(generatedSecret);
    toast.success("Copied to clipboard");
  }, [generatedSecret]);

  const copyEnvSnippet = useCallback(async () => {
    if (!generatedSecret) {
      toast.error("No secret to copy yet");
      return;
    }
    await copyText(`APPLE_CLIENT_SECRET=${generatedSecret}`);
    toast.success("Copied .env line");
  }, [generatedSecret]);

  useEffect(() => {
    if (!settings.startupToastsEnabled) return;
    if (isLoading || !rotations || rotations.length === 0) return;

    const latestSuccess = rotations.find((r) => r.status === "success");
    if (!latestSuccess) return;

    const expiresAt = new Date(latestSuccess.expires_at).getTime();
    const daysRemaining = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= settings.inlineExpiringDays && daysRemaining > 0) {
      toast.warning(`Your Apple client secret expires in ${daysRemaining} days!`, {
        description: "Generate a new secret soon to avoid authentication failures.",
        duration: 10000,
      });
    } else if (daysRemaining <= 0) {
      toast.error("Your Apple client secret has expired!", {
        description: "Generate a new secret immediately to restore Apple Sign-In.",
        duration: 15000,
      });
    }
  }, [isLoading, rotations, settings.startupToastsEnabled, settings.inlineExpiringDays]);

  useEffect(() => {
    const st = location.state as { openCommandPalette?: boolean } | null;
    if (st?.openCommandPalette) {
      setCommandOpen(true);
      void navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const onOpenPalette = () => setCommandOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
  }, []);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    const unsub = window.electronAPI.onMenuAction((action) => {
      if (action === "copy-secret") {
        void copySecret();
      } else if (action === "open-p8") {
        void (async () => {
          const r = await window.electronAPI!.openP8File();
          if (!r.canceled && r.content && r.fileName) {
            applyP8Content(r.content, r.fileName);
          }
        })();
      }
    });
    return unsub;
  }, [isElectron, copySecret, applyP8Content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        if (generatedSecret) {
          e.preventDefault();
          void copySecret();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generatedSecret, copySecret]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".p8")) {
      toast.error("Please upload a .p8 file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      applyP8Content(content, file.name);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setPrivateKeyContent(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearGeneratedSecret = () => {
    setGeneratedSecret(null);
  };

  const handleRotate = async () => {
    if (!privateKeyContent) {
      toast.error("Please upload your .p8 file first");
      return;
    }

    const validation = validateAppleIds(keyId, teamId, servicesId);
    if (!validation.ok) {
      validation.errors.forEach((m) => toast.error(m));
      return;
    }

    setIsRotating(true);

    try {
      const { secret, expiresAt } = await generateAppleClientSecret({
        keyId: keyId.trim(),
        teamId: teamId.trim(),
        servicesId: servicesId.trim(),
        privateKeyPem: privateKeyContent,
      });

      setGeneratedSecret(secret);

      await addRotation({
        rotated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "success",
        error_message: null,
        triggered_by: "manual",
      });

      clearFile();
      toast.success("Apple client secret generated successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await addRotation({
        rotated_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        status: "failed",
        error_message: errorMessage,
        triggered_by: "manual",
      });

      toast.error(`Generation failed: ${errorMessage}`);
    } finally {
      setIsRotating(false);
    }
  };

  const latestRotation = rotations?.[0];
  const latestSuccessRotation = useMemo(
    () => rotations.find((r) => r.status === "success"),
    [rotations],
  );
  const isExpiringSoon = useMemo(() => {
    if (!latestSuccessRotation?.expires_at) return false;
    const days = Math.ceil(
      (new Date(latestSuccessRotation.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
    return days > 0 && days <= settings.inlineExpiringDays;
  }, [latestSuccessRotation, settings.inlineExpiringDays]);

  const idPreview = validateAppleIds(keyId, teamId, servicesId);

  const p8ByteLength = useMemo(() => {
    if (!privateKeyContent) return 0;
    return new TextEncoder().encode(privateKeyContent).length;
  }, [privateKeyContent]);

  const cardClass = cn(isElectron && "shadow-sm");

  const openRename = () => {
    if (activeProfile) {
      setRenameValue(activeProfile.name);
      setRenameOpen(true);
    }
  };

  const submitRename = () => {
    if (activeProfile && renameValue.trim()) {
      renameProfile(activeProfile.id, renameValue.trim());
      setRenameOpen(false);
    }
  };

  const statusPanel = (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
        <Card className={cardClass}>
          <CardHeader className={cn(isElectron && "space-y-1 pb-2 pt-4")}>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Current
            </CardTitle>
            <CardDescription className="text-xs">Last rotation and expiry</CardDescription>
          </CardHeader>
          <CardContent className={cn(isElectron && "pb-4 pt-0")}>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : latestRotation ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {latestRotation.status === "success" ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Failed
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last: {new Date(latestRotation.rotated_at).toLocaleString()}
                </p>
                {isExpiringSoon && latestSuccessRotation && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Expiring soon</AlertTitle>
                    <AlertDescription className="text-xs">
                      Secret expires{" "}
                      {new Date(latestSuccessRotation.expires_at).toLocaleDateString()}.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Expires: </span>
                  <span className="font-medium">{new Date(latestRotation.expires_at).toLocaleDateString()}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (
                    {Math.ceil(
                      (new Date(latestRotation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    )}{" "}
                    days left)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No rotations yet. Generate a secret in the main panel.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="min-h-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleExportHistory}
              disabled={!rotations || rotations.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClearHistory}
              disabled={!rotations || rotations.length === 0}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
        <Card className={cardClass}>
          <CardHeader className={cn(isElectron && "space-y-1 pb-2 pt-4")}>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Recent events
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(isElectron && "pb-4 pt-0")}>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : rotations && rotations.length > 0 ? (
              <div className="divide-y overflow-hidden rounded-md border">
                {rotations.map((rotation) => (
                  <div
                    key={rotation.id}
                    className="flex flex-col gap-1.5 px-2 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {rotation.status === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-tight sm:text-sm">
                          {new Date(rotation.rotated_at).toLocaleString()}
                        </p>
                        {rotation.error_message && (
                          <p className="mt-0.5 break-words text-xs text-destructive">{rotation.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 pl-6 sm:justify-end sm:pl-0">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {rotation.triggered_by}
                      </Badge>
                      {rotation.status === "success" && (
                        <span className="text-xs text-muted-foreground">
                          Exp. {new Date(rotation.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No history yet. Successful generations will list here with expiry dates.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const mainWorkspace = (
    <div className="flex flex-col gap-6 p-4 md:p-5">
      <Alert
        className={cn(
          "border-green-600/40 bg-green-50/90 py-2.5 dark:border-green-800/50 dark:bg-green-950/30",
          "flex flex-nowrap items-center gap-2",
          "[&>svg]:static [&>svg]:left-auto [&>svg]:top-auto [&>svg~*]:pl-0 [&>svg+div]:translate-y-0",
        )}
        role="note"
      >
        <Shield className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
        <div className="text-sm leading-snug text-green-900 dark:text-green-300">
          <span className="font-semibold">
            {isElectron ? "Local & private" : "Client-side only"}
          </span>{" "}
          <span className="font-normal text-green-800/95 dark:text-green-400/95">
            {isElectron ? (
              <>
                (.p8 is <strong>never sent to a server</strong>. Kept in memory for signing, then cleared.)
              </>
            ) : (
              <>
                (Runs in your browser. .p8 is <strong>never sent to a server</strong>; discarded after signing.)
              </>
            )}
          </span>
        </div>
      </Alert>

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Configuration</p>
        <Card className={cardClass}>
          <CardHeader className={cn(isElectron && "space-y-1 pb-2 pt-4")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription className="text-xs">
                  Saved locally. Key ID, Team ID, and Services ID are set in Generate below.
                </CardDescription>
              </div>
              <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 overflow-x-auto sm:gap-2">
                <Select value={activeId} onValueChange={setActiveId}>
                  <SelectTrigger
                    className={cn("w-32 shrink-0 sm:w-40", isElectron && "h-9 text-sm")}
                  >
                    <SelectValue placeholder="Profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={addProfile}
                  title="Add profile"
                  aria-label="Add profile"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={openRename}
                  title="Rename profile"
                  aria-label="Rename profile"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={profiles.length <= 1}
                  onClick={() => activeProfile && removeProfile(activeProfile.id)}
                  title="Remove profile"
                  aria-label="Remove profile"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn(isElectron && "pb-4 pt-0")}>
            <p className="text-xs text-muted-foreground">
              Find identifiers in your{" "}
              <a
                href="https://developer.apple.com/account"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Apple Developer account
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generate</p>
        <Card
          className={cn(
            "generate-demo overflow-hidden rounded-2xl border bg-card shadow-sm",
            cardClass,
          )}
        >
          <CardHeader className={cn("pb-2 pt-4 sm:pb-3", isElectron && "space-y-1")}>
            <CardTitle className="text-base">New client secret</CardTitle>
            <CardDescription className="text-xs">Upload your .p8 and sign a client secret (JWT) locally.</CardDescription>
          </CardHeader>
          <CardContent className={cn("pb-4 pt-0", isElectron && "pb-4")}>
            <input
              type="file"
              accept=".p8"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              id="p8-upload"
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
              <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="keyId" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Key ID
                    </Label>
                    <Input
                      ref={keyIdInputRef}
                      id="keyId"
                      placeholder="e.g., ABC123DEFG"
                      value={keyId}
                      onChange={(e) => updateField("keyId", e.target.value)}
                      className={cn(isElectron && "h-9 text-sm")}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={keyId.length > 0 && !idPreview.ok}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="teamId" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Team ID
                    </Label>
                    <Input
                      id="teamId"
                      placeholder="e.g., TEAM123456"
                      value={teamId}
                      onChange={(e) => updateField("teamId", e.target.value)}
                      className={cn(isElectron && "h-9 text-sm")}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={teamId.length > 0 && !idPreview.ok}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="servicesId"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Services ID
                    </Label>
                    <Input
                      id="servicesId"
                      placeholder="e.g., com.example.app"
                      value={servicesId}
                      onChange={(e) => updateField("servicesId", e.target.value)}
                      className={cn(isElectron && "h-9 text-sm")}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={servicesId.length > 0 && !idPreview.ok}
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Signing key
                  </p>
                  {!privateKeyContent ? (
                    <label
                      htmlFor="p8-upload"
                      className={cn(
                        "flex min-h-[12rem] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-[hsl(var(--generate-drop-bg))] transition-colors sm:min-h-[14rem]",
                        "border-[hsl(var(--generate-drop-border))]",
                        dropHover && "ring-2 ring-[hsl(var(--generate-mint))]/50",
                        "lg:min-h-0",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropHover(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropHover(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropHover(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const dataTransfer = new DataTransfer();
                          dataTransfer.items.add(file);
                          if (fileInputRef.current) {
                            fileInputRef.current.files = dataTransfer.files;
                            fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                          }
                        }
                      }}
                    >
                      <div className="pointer-events-none flex flex-1 flex-col items-center justify-center px-4 py-8">
                        <Upload className="mb-2 h-7 w-7 text-[hsl(var(--generate-mint))]" />
                        <p className="mb-1 text-center text-sm text-muted-foreground">
                          <span className="font-medium">Drop</span> or <span className="font-medium">click</span> to
                          select .p8
                        </p>
                        <p className="text-center text-xs text-muted-foreground">In memory only — not stored on disk</p>
                      </div>
                    </label>
                  ) : (
                    <div
                      className={cn(
                        "flex min-h-[12rem] flex-1 items-center justify-between rounded-xl border border-[hsl(var(--generate-drop-border))]/60 sm:min-h-[14rem]",
                        "bg-[hsl(var(--generate-file-card))] p-3 shadow-md lg:min-h-0",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileKey className="h-8 w-8 shrink-0 text-[hsl(var(--generate-mint))]" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {p8ByteLength} bytes · PKCS#8
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearFile}>
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                {!idPreview.ok && (keyId || teamId || servicesId) && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTitle className="text-sm">Check identifiers</AlertTitle>
                    <AlertDescription>
                      <ul className="list-inside list-disc text-xs">
                        {idPreview.errors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="button"
                  onClick={() => void handleRotate()}
                  disabled={isRotating || !privateKeyContent || !idPreview.ok}
                  className="w-full rounded-xl bg-[hsl(var(--generate-mint))] font-medium text-[hsl(var(--generate-mint-foreground))] shadow-sm hover:bg-[hsl(var(--generate-mint-hover))] disabled:opacity-60"
                >
                  {isRotating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate new secret
                    </>
                  )}
                </Button>
              </div>

              <div className="flex min-h-[280px] min-w-0 flex-col lg:min-h-[320px]">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Client_secret (JWT)
                </p>
                <div
                  className={cn(
                    "relative flex min-h-0 flex-1 flex-col rounded-xl border",
                    "border-[hsl(var(--generate-jwt-border))] bg-[hsl(var(--generate-jwt-bg))]",
                  )}
                  aria-busy={isRotating}
                  role="region"
                  aria-label="Client secret output"
                >
                  <div className="relative min-h-[12rem] flex-1 overflow-hidden p-3 pr-12 pt-3 font-mono text-xs leading-relaxed text-[hsl(var(--generate-jwt-fg))] sm:min-h-[14rem]">
                    {generatedSecret ? (
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all" tabIndex={0} aria-label="Generated client secret">
                        {generatedSecret}
                      </pre>
                    ) : (
                      <pre
                        className={cn(
                          "select-none text-[hsl(var(--generate-jwt-muted))]",
                          isRotating && "opacity-40",
                        )}
                      >
                        {"// signing ES256…"}
                      </pre>
                    )}
                    {generatedSecret && (
                      <div className="absolute right-2 top-2 flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 bg-background/90"
                          onClick={() => void copySecret()}
                          aria-label="Copy secret to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--generate-jwt-border))] px-3 py-2">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--generate-jwt-muted))]"
                      aria-hidden
                    />
                    <p className="text-xs text-[hsl(var(--generate-jwt-muted))]">
                      {generatedSecret
                        ? "Secret ready — copy into your Sign in with Apple / OAuth provider settings."
                        : isRotating
                          ? "Signing with your .p8…"
                          : "Waiting for signature"}
                    </p>
                  </div>
                  {generatedSecret && (
                    <div className="flex flex-wrap gap-2 border-t border-[hsl(var(--generate-jwt-border))] px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 bg-background/80"
                        onClick={() => void copyEnvSnippet()}
                      >
                        <Terminal className="mr-1 h-3.5 w-3.5" />
                        Copy as .env
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={clearGeneratedSecret}>
                        <Eraser className="mr-1 h-3.5 w-3.5" />
                        Clear from screen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-muted/30",
        isElectron && "h-screen overflow-hidden",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Key className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
              Apple OAuth Key Rotation
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Rotate your Sign in with Apple client secret (~every 6 months).{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setCommandOpen(true)}
              >
                Quick actions
              </button>
              <span className="text-muted-foreground"> · ⌘K</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2" asChild>
            <Link to="/settings">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          {isElectron && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Desktop
            </Badge>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-b bg-card md:w-80 md:border-b-0 md:border-r">
          {statusPanel}
        </aside>
        <main className="min-h-0 flex-1 overflow-y-auto bg-background/50">{mainWorkspace}</main>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename profile</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search actions…" />
        <CommandList>
          <CommandEmpty>No actions found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void handleRotate();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate new secret
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void copySecret();
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy generated secret
              <CommandShortcut>⌘⇧C</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void copyEnvSnippet();
              }}
            >
              <Terminal className="mr-2 h-4 w-4" />
              Copy as .env line
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleExportHistory();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export history JSON
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void navigate("/settings");
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Open settings
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void navigate("/settings?tab=changelog");
              }}
            >
              <ScrollText className="mr-2 h-4 w-4" />
              Open changelog
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                void navigate("/settings?tab=about");
              }}
            >
              <Info className="mr-2 h-4 w-4" />
              Open about
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                keyIdInputRef.current?.focus();
              }}
            >
              <Key className="mr-2 h-4 w-4" />
              Focus Key ID
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Links">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                window.open("https://developer.apple.com/account/", "_blank", "noopener,noreferrer");
              }}
            >
              Open Apple Developer
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
