import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfileEditorDialog } from "@/components/ProfileEditorDialog";
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
  DialogDescription,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  FileInput,
  Eye,
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
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useRotationHistory, type RotationRecord } from "@/hooks/useRotationHistory";
import type { PersistedRotationRow } from "@/lib/persistedRotation";
import { useExpiryNotifications } from "@/hooks/useExpiryNotifications";
import { useProfiles } from "@/hooks/useProfiles";
import { useAppSettings } from "@/hooks/useAppSettings";
import { decodeAppleClientSecretPayload } from "@/lib/appleJwtDecode";
import { generateAppleClientSecret } from "@/lib/appleJwt";
import { validateAppleIds } from "@/lib/appleConfigValidation";
import { copyToClipboard as copyText } from "@/lib/copyToClipboard";
import { setElectronLastClientSecret } from "@/lib/electronLastClientSecret";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/electronMenuEvents";
import { useInAppNotifications } from "@/contexts/InAppNotificationsContext";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { hasElectronSqlite, isElectronApp } from "@/lib/isElectronApp";

const SAVED_SECRETS_PAGE_SIZE = 20;

function dragExitsDropSurface(e: React.DragEvent<HTMLElement>): boolean {
  const next = e.relatedTarget as Node | null;
  return next === null || !e.currentTarget.contains(next);
}

function persistedRowToRecord(row: PersistedRotationRow): RotationRecord {
  return {
    id: row.id,
    profile_id: row.profile_id,
    rotated_at: row.rotated_at,
    expires_at: row.expires_at,
    status: row.status as RotationRecord["status"],
    error_message: row.error_message,
    triggered_by: row.triggered_by as RotationRecord["triggered_by"],
    jwt: row.jwt,
    key_id: row.key_id,
    team_id: row.team_id,
    services_id: row.services_id,
    user_note: row.user_note,
  };
}

export default function AppleKeyRotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [privateKeyContent, setPrivateKeyContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState<"create" | "edit">("create");
  const [rotationMemo, setRotationMemo] = useState("");
  const [savedSecretsRevision, setSavedSecretsRevision] = useState(0);
  const [secretNoteDialog, setSecretNoteDialog] = useState<RotationRecord | null>(null);
  const [secretNoteDraft, setSecretNoteDraft] = useState("");
  const [dropHover, setDropHover] = useState(false);
  const [storedKeyDropHover, setStoredKeyDropHover] = useState(false);
  const [inMemoryKeyDropHover, setInMemoryKeyDropHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyIdInputRef = useRef<HTMLInputElement>(null);

  const [rememberKey, setRememberKey] = useState(false);
  const [canRememberKey, setCanRememberKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedPem, setRevealedPem] = useState<string | null>(null);

  const isElectron = isElectronApp();

  const {
    profiles,
    activeId,
    activeProfile,
    setActiveId,
    updateField,
    createProfile,
    saveProfile,
    removeProfile,
  } = useProfiles();

  const openProfileCreate = useCallback(() => {
    setProfileModalMode("create");
    setProfileModalOpen(true);
  }, []);

  const openProfileEdit = useCallback(() => {
    setProfileModalMode("edit");
    setProfileModalOpen(true);
  }, []);

  const keyId = activeProfile?.keyId ?? "";
  const teamId = activeProfile?.teamId ?? "";
  const servicesId = activeProfile?.servicesId ?? "";

  const refreshStoredKeyState = useCallback(async () => {
    if (!hasElectronSqlite() || !window.electronAPI?.privateKey) {
      setCanRememberKey(false);
      setHasStoredKey(false);
      return;
    }
    try {
      const encAvail = await window.electronAPI.privateKey.isEncryptionAvailable();
      setCanRememberKey(encAvail);
      const h = await window.electronAPI.privateKey.has(activeId);
      setHasStoredKey(h);
    } catch {
      setCanRememberKey(false);
      setHasStoredKey(false);
    }
  }, [activeId]);

  useEffect(() => {
    void refreshStoredKeyState();
  }, [refreshStoredKeyState]);

  useEffect(() => {
    setPrivateKeyContent(null);
    setFileName(null);
  }, [activeId]);

  const { rotations, allRotations, isLoading, addRotation, updateRotationUserNote, clearHistory, exportHistory } =
    useRotationHistory();
  const { add: addInAppNotification } = useInAppNotifications();
  useExpiryNotifications(allRotations, isLoading, settings);

  const savedSecrets = useMemo(
    () => allRotations.filter((r) => r.status === "success" && r.jwt),
    [allRotations],
  );

  /** Any successful JWT in local history (unfiltered). Used so the saved-secrets card stays mounted when the profile filter is narrow or stale. */
  const hasAnyElectronSavedSecrets = useMemo(
    () => allRotations.some((r) => r.status === "success" && Boolean(r.jwt)),
    [allRotations],
  );

  const [savedSecretsPage, setSavedSecretsPage] = useState(0);
  const [savedSecretsProfileFilter, setSavedSecretsProfileFilter] = useState<"all" | string>(
    "all",
  );
  const [pagedSavedSecrets, setPagedSavedSecrets] = useState<RotationRecord[]>([]);
  const [savedSecretsTotalCount, setSavedSecretsTotalCount] = useState(0);
  const [savedSecretsListLoading, setSavedSecretsListLoading] = useState(false);

  const profileNameById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.name])),
    [profiles],
  );

  const profileMetaById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    setSavedSecretsPage(0);
  }, [savedSecretsProfileFilter]);

  useEffect(() => {
    if (savedSecretsProfileFilter === "all") return;
    if (profiles.some((p) => p.id === savedSecretsProfileFilter)) return;
    setSavedSecretsProfileFilter("all");
  }, [profiles, savedSecretsProfileFilter]);

  useEffect(() => {
    if (!hasElectronSqlite()) return;
    let cancelled = false;
    setSavedSecretsListLoading(true);
    const profileId =
      savedSecretsProfileFilter === "all" ? undefined : savedSecretsProfileFilter;
    void (async () => {
      try {
        const sql = window.electronAPI!.sqlite!;
        const [rows, total] = await Promise.all([
          sql.listSavedSecrets({
            profileId,
            limit: SAVED_SECRETS_PAGE_SIZE,
            offset: savedSecretsPage * SAVED_SECRETS_PAGE_SIZE,
          }),
          sql.countSavedSecrets(profileId),
        ]);
        if (!cancelled) {
          setPagedSavedSecrets(rows.map(persistedRowToRecord));
          setSavedSecretsTotalCount(total);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPagedSavedSecrets([]);
          setSavedSecretsTotalCount(0);
        }
      } finally {
        if (!cancelled) setSavedSecretsListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    savedSecretsPage,
    savedSecretsProfileFilter,
    allRotations.length,
    savedSecretsRevision,
  ]);

  const savedSecretsPageCount = Math.max(
    1,
    Math.ceil(savedSecretsTotalCount / SAVED_SECRETS_PAGE_SIZE),
  );

  const showSavedSecretsPanel =
    (isElectron && !isLoading && hasAnyElectronSavedSecrets) ||
    (!isElectron && savedSecrets.length > 0);

  const applyP8Content = useCallback((content: string, name: string) => {
    if (!content.includes("-----BEGIN PRIVATE KEY-----")) {
      toast.error("Invalid .p8 file format");
      return;
    }
    setPrivateKeyContent(content);
    setFileName(name);
    toast.success("Key loaded in memory");
  }, []);

  const processP8File = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".p8")) {
        toast.error("Please use a .p8 private key file");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          const content = reader.result as string;
          if (!content.includes("-----BEGIN PRIVATE KEY-----")) {
            toast.error("Invalid .p8 file format");
            return;
          }
          if (
            isElectron &&
            rememberKey &&
            canRememberKey &&
            window.electronAPI?.privateKey
          ) {
            try {
              await window.electronAPI.privateKey.savePem(activeId, content);
              setHasStoredKey(true);
              setPrivateKeyContent(null);
              setFileName(`${file.name} (encrypted on this Mac)`);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              toast.success("Key saved securely on this device");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not save key");
            }
            return;
          }
          applyP8Content(content, file.name);
        })();
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
      };
      reader.readAsText(file);
    },
    [activeId, applyP8Content, canRememberKey, isElectron, rememberKey],
  );

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      toast.success("History cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleExportHistory = () => {
    if (allRotations.length === 0) {
      toast.error("No history to export");
      return;
    }
    exportHistory();
    toast.success("History exported");
  };

  const copySavedJwt = useCallback(async (jwt: string) => {
    await copyText(jwt);
    toast.success("Client secret copied");
  }, []);

  const handleSaveSecretNote = useCallback(async () => {
    if (!secretNoteDialog) return;
    try {
      await updateRotationUserNote(secretNoteDialog.id, secretNoteDraft);
      setSecretNoteDialog(null);
      setSavedSecretsRevision((x) => x + 1);
      toast.success("Memo saved");
    } catch {
      toast.error("Could not save memo");
    }
  }, [secretNoteDialog, secretNoteDraft, updateRotationUserNote]);

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
    if (isLoading || allRotations.length === 0) return;

    const latestSuccess = allRotations.find((r) => r.status === "success");
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
  }, [isLoading, allRotations, settings.startupToastsEnabled, settings.inlineExpiringDays]);

  useEffect(() => {
    setElectronLastClientSecret(generatedSecret);
  }, [generatedSecret]);

  useEffect(() => {
    const st = location.state as { openCommandPalette?: boolean } | null;
    if (st?.openCommandPalette) {
      setCommandOpen(true);
      void navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const st = location.state as {
      importedP8?: { content: string; fileName: string };
    } | null;
    if (st?.importedP8) {
      applyP8Content(st.importedP8.content, st.importedP8.fileName);
      void navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate, applyP8Content]);

  useEffect(() => {
    const onOpenPalette = () => setCommandOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
  }, []);

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
    processP8File(file);
  };

  const clearFile = () => {
    setPrivateKeyContent(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const chooseP8SecureDialog = useCallback(async () => {
    if (!window.electronAPI?.privateKey) return;
    const r = await window.electronAPI.privateKey.importFromDialog(activeId);
    if (r.ok && r.fileName) {
      setHasStoredKey(true);
      setPrivateKeyContent(null);
      setFileName(`${r.fileName} (encrypted on this Mac)`);
      toast.success("Key saved securely on this device");
    } else if (r.error) {
      toast.error(r.error);
    }
  }, [activeId]);

  const removeStoredKey = useCallback(async () => {
    if (!window.electronAPI?.privateKey) return;
    await window.electronAPI.privateKey.forget(activeId);
    setHasStoredKey(false);
    setFileName((prev) => (prev?.includes("(encrypted on this Mac)") ? null : prev));
    toast.message("Saved key removed from this device");
  }, [activeId]);

  const openRevealSavedPem = useCallback(async () => {
    if (!window.electronAPI?.privateKey) return;
    const r = await window.electronAPI.privateKey.revealPem(activeId);
    if (r.ok && r.pem) {
      setRevealedPem(r.pem);
      setRevealOpen(true);
    } else {
      toast.error(r.error ?? "Could not reveal key");
    }
  }, [activeId]);

  const exportSavedP8 = useCallback(async () => {
    if (!window.electronAPI?.privateKey) return;
    const r = await window.electronAPI.privateKey.exportPemToFile(activeId);
    if (r.ok && r.path) {
      toast.success("Exported .p8", { description: r.path });
    } else if (r.error) {
      toast.error(r.error);
    }
  }, [activeId]);

  const clearGeneratedSecret = () => {
    setGeneratedSecret(null);
  };

  const handleRotate = async () => {
    const hasSigningMaterial = Boolean(privateKeyContent) || hasStoredKey;
    if (!hasSigningMaterial) {
      toast.error("Please upload a .p8 or save one for this profile on this Mac");
      return;
    }

    const validation = validateAppleIds(keyId, teamId, servicesId);
    if (!validation.ok) {
      validation.errors.forEach((m) => toast.error(m));
      return;
    }

    setIsRotating(true);

    try {
      let secret: string;
      let expiresAt: Date;
      if (privateKeyContent) {
        const r = await generateAppleClientSecret({
          keyId: keyId.trim(),
          teamId: teamId.trim(),
          servicesId: servicesId.trim(),
          privateKeyPem: privateKeyContent,
        });
        secret = r.secret;
        expiresAt = r.expiresAt;
      } else {
        const r = await window.electronAPI!.appleSign!.signClientSecret({
          profileId: activeId,
          keyId: keyId.trim(),
          teamId: teamId.trim(),
          servicesId: servicesId.trim(),
        });
        if (!r.ok || !r.secret || !r.expiresAtIso) {
          throw new Error(r.error ?? "Signing failed");
        }
        secret = r.secret;
        expiresAt = new Date(r.expiresAtIso);
      }

      setGeneratedSecret(secret);

      await addRotation({
        rotated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "success",
        error_message: null,
        triggered_by: "manual",
        jwt: secret,
        profile_id: activeId,
        key_id: keyId.trim(),
        team_id: teamId.trim(),
        services_id: servicesId.trim(),
        user_note: rotationMemo.trim() || null,
      });

      setRotationMemo("");

      if (privateKeyContent) {
        clearFile();
      }
      toast.success("Apple client secret generated successfully!");
      addInAppNotification({
        kind: "rotation_success",
        title: "Client secret generated",
        body: `New secret expires on ${expiresAt.toLocaleDateString()}.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await addRotation({
        rotated_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        status: "failed",
        error_message: errorMessage,
        triggered_by: "manual",
        profile_id: activeId,
        key_id: keyId.trim(),
        team_id: teamId.trim(),
        services_id: servicesId.trim(),
        user_note: rotationMemo.trim() || null,
      });

      toast.error(`Generation failed: ${errorMessage}`);
      addInAppNotification({
        kind: "rotation_failed",
        title: "Client secret generation failed",
        body: errorMessage,
      });
    } finally {
      setIsRotating(false);
    }
  };

  const latestRotation = allRotations[0];
  const latestSuccessRotation = useMemo(
    () => allRotations.find((r) => r.status === "success"),
    [allRotations],
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

  const jwtDecodePreview = useMemo(() => {
    if (!generatedSecret) return null;
    return decodeAppleClientSecretPayload(generatedSecret);
  }, [generatedSecret]);

  const p8ByteLength = useMemo(() => {
    if (!privateKeyContent) return 0;
    return new TextEncoder().encode(privateKeyContent).length;
  }, [privateKeyContent]);

  const cardClass = cn(isElectron && "shadow-sm");

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
              disabled={allRotations.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClearHistory}
              disabled={allRotations.length === 0}
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
              <ul className="-mx-6 divide-y divide-border border-t">
                {rotations.map((rotation) => {
                  const rotatedAt = new Date(rotation.rotated_at);
                  const datePart = rotatedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const timePart = rotatedAt.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const expiresAt =
                    rotation.status === "success" ? new Date(rotation.expires_at) : null;
                  const expiresLabel = expiresAt
                    ? expiresAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;
                  const sourceLabel = rotation.triggered_by === "manual" ? "Manual" : "Scheduled";

                  return (
                    <li key={rotation.id} className="px-6 py-3">
                      <div className="flex gap-2">
                        {rotation.status === "success" ? (
                          <CheckCircle2
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500"
                            aria-hidden
                          />
                        ) : (
                          <XCircle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <time
                              dateTime={rotation.rotated_at}
                              className="text-sm font-medium leading-snug text-foreground tabular-nums"
                            >
                              <span className="sr-only">Rotated at </span>
                              {datePart}
                              <span className="font-normal text-muted-foreground"> · {timePart}</span>
                            </time>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium uppercase tracking-wide"
                            >
                              {sourceLabel}
                            </Badge>
                          </div>
                          {expiresLabel && (
                            <p className="text-xs leading-snug text-muted-foreground tabular-nums">
                              Secret expires {expiresLabel}
                            </p>
                          )}
                          {rotation.error_message && (
                            <p className="break-words text-xs leading-snug text-destructive">
                              {rotation.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
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
                (.p8 is <strong>never sent to a server</strong>. You may keep it in memory only, or save it
                encrypted on this Mac—JSON exports never include the key.)
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
                  Profiles group Apple IDs, local notes, and saved keys. Metadata is not sent to Apple.
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
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        textValue={p.tags.length ? `${p.name} ${p.tags.join(" ")}` : p.name}
                      >
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
                  onClick={openProfileCreate}
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
                  onClick={openProfileEdit}
                  title="Edit profile"
                  aria-label="Edit profile"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={profiles.length <= 1}
                  onClick={() => activeProfile && void removeProfile(activeProfile.id)}
                  title="Remove profile"
                  aria-label="Remove profile"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn(isElectron && "pb-4 pt-0")}>
            {activeProfile ? (
              <div className="mb-3 space-y-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Active profile
                </p>
                <div className="flex min-h-6 flex-wrap items-center gap-1">
                  {activeProfile.tags.length > 0 ? (
                    activeProfile.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal text-[10px]">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[10px] leading-none text-muted-foreground/90">No tags</span>
                  )}
                </div>
                {activeProfile.notes.trim() ? (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{activeProfile.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/80">No notes</p>
                )}
              </div>
            ) : null}
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
                  {privateKeyContent ? (
                    <div
                      className={cn(
                        "relative flex min-h-[12rem] flex-1 items-center justify-between rounded-xl border border-[hsl(var(--generate-drop-border))]/60 sm:min-h-[14rem]",
                        "bg-[hsl(var(--generate-file-card))] p-3 shadow-md lg:min-h-0",
                        inMemoryKeyDropHover &&
                          "ring-2 ring-[hsl(var(--generate-mint))]/40 ring-offset-2 ring-offset-background",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInMemoryKeyDropHover(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInMemoryKeyDropHover(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragExitsDropSurface(e)) setInMemoryKeyDropHover(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInMemoryKeyDropHover(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processP8File(file);
                      }}
                    >
                      {inMemoryKeyDropHover && (
                        <div
                          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-[10px] bg-background/85 px-4 text-center backdrop-blur-[2px]"
                          aria-hidden
                        >
                          <Upload className="h-6 w-6 text-[hsl(var(--generate-mint))]" />
                          <p className="text-sm font-medium text-foreground">Drop to replace key</p>
                          <p className="text-xs text-muted-foreground">Replaces the file in memory</p>
                        </div>
                      )}
                      <div className="flex min-w-0 items-center gap-3">
                        <FileKey className="h-8 w-8 shrink-0 text-[hsl(var(--generate-mint))]" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {p8ByteLength} bytes · PKCS#8 · in memory
                          </p>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={clearFile}
                            aria-label="Remove key from memory"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="font-medium">Remove from memory</p>
                          <p className="text-xs text-muted-foreground">Clears the loaded .p8 for this session.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : hasStoredKey ? (
                    <div
                      className={cn(
                        "relative flex min-h-[12rem] flex-1 flex-col justify-center gap-3 rounded-xl border border-[hsl(var(--generate-drop-border))]/60 p-4 sm:min-h-[14rem]",
                        "bg-[hsl(var(--generate-file-card))] shadow-md lg:min-h-0",
                        storedKeyDropHover &&
                          "ring-2 ring-[hsl(var(--generate-mint))]/40 ring-offset-2 ring-offset-background",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStoredKeyDropHover(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStoredKeyDropHover(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragExitsDropSurface(e)) setStoredKeyDropHover(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStoredKeyDropHover(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processP8File(file);
                      }}
                    >
                      {storedKeyDropHover && (
                        <div
                          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-[10px] bg-background/88 px-4 text-center backdrop-blur-[2px]"
                          aria-hidden
                        >
                          <Upload className="h-7 w-7 text-[hsl(var(--generate-mint))]" />
                          <p className="text-sm font-semibold text-foreground">Drop .p8 to replace</p>
                          <p className="max-w-[16rem] text-xs text-muted-foreground">
                            Uses your Remember setting: may save encrypted or load in memory only.
                          </p>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <FileKey className="h-8 w-8 shrink-0 text-[hsl(var(--generate-mint))]" aria-hidden />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">Saved .p8 for this profile</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Stored encrypted on this Mac. Generating uses the key in the app
                            process; revealing or exporting the PEM requires Touch ID or your login
                            password.
                          </p>
                          <p className="pt-1 text-[0.7rem] text-muted-foreground/90">
                            Tip: drag a new <span className="font-mono">.p8</span> onto this card to replace it.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 border-t border-border/50 pt-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => void openRevealSavedPem()}
                              aria-label="Reveal saved private key as PEM"
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">Reveal PEM</p>
                            <p className="text-xs text-muted-foreground">
                              Requires Touch ID or your Mac login password.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => void exportSavedP8()}
                              aria-label="Export saved key as .p8 file"
                            >
                              <Download className="h-4 w-4" aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">Export .p8</p>
                            <p className="text-xs text-muted-foreground">Save a copy after local authentication.</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => void chooseP8SecureDialog()}
                              aria-label="Replace saved key by choosing a new .p8 file"
                            >
                              <FileInput className="h-4 w-4" aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">Replace saved key</p>
                            <p className="text-xs text-muted-foreground">Choose a new .p8 to encrypt and store for this profile.</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              onClick={() => void removeStoredKey()}
                              aria-label="Remove saved key from this Mac"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">Remove saved key</p>
                            <p className="text-xs text-muted-foreground">Deletes the encrypted copy from this device only.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                      {isElectron && canRememberKey && (
                        <div className="flex items-start space-x-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                          <Checkbox
                            id="remember-p8"
                            checked={rememberKey}
                            onCheckedChange={(v) => setRememberKey(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="remember-p8" className="text-xs font-normal leading-snug cursor-pointer">
                            Remember key on this Mac (encrypted; excluded from JSON snapshot exports)
                          </Label>
                        </div>
                      )}
                      <label
                        htmlFor="p8-upload"
                        className={cn(
                          "group flex min-h-[13.5rem] flex-1 cursor-pointer flex-col rounded-2xl border-2 border-dashed",
                          "border-[hsl(var(--generate-drop-border))]/65",
                          "bg-[linear-gradient(180deg,hsl(var(--generate-drop-bg))_0%,hsl(var(--background)/0.92)_100%)]",
                          "shadow-[inset_0_1px_0_0_hsl(var(--generate-mint)/0.06)]",
                          "transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out",
                          "hover:border-[hsl(var(--generate-mint))]/55 hover:shadow-[inset_0_1px_0_0_hsl(var(--generate-mint)/0.12)]",
                          dropHover &&
                            "scale-[1.01] border-solid border-[hsl(var(--generate-mint))] bg-[hsl(var(--generate-drop-bg))] shadow-md",
                          dropHover &&
                            "ring-2 ring-[hsl(var(--generate-mint))]/25 [box-shadow:inset_0_0_0_1px_hsl(var(--generate-mint)/0.35)]",
                          "focus-within:outline-none focus-within:ring-2 focus-within:ring-[hsl(var(--generate-mint))]/30 focus-within:ring-offset-2 focus-within:ring-offset-background",
                          "lg:min-h-0",
                        )}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropHover(true);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropHover(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragExitsDropSurface(e)) setDropHover(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropHover(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) processP8File(file);
                        }}
                      >
                        <div className="pointer-events-none flex flex-1 flex-col items-center justify-center gap-4 px-5 py-9">
                          <div
                            className={cn(
                              "flex h-14 w-14 items-center justify-center rounded-2xl",
                              "bg-[hsl(var(--generate-mint))]/14 text-[hsl(var(--generate-mint))]",
                              "ring-1 ring-[hsl(var(--generate-mint))]/22",
                              "transition-transform duration-200 ease-out",
                              dropHover && "scale-110 ring-[hsl(var(--generate-mint))]/40",
                            )}
                            aria-hidden
                          >
                            <Upload className="h-7 w-7" strokeWidth={1.75} />
                          </div>
                          <div className="space-y-2 text-center">
                            <p className="text-sm font-semibold tracking-tight text-foreground">
                              {dropHover ? "Release to add key" : "Add your Apple signing key"}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Badge variant="secondary" className="font-mono text-[0.65rem] font-medium">
                                .p8
                              </Badge>
                              <span className="text-xs text-muted-foreground">Private key · PKCS #8</span>
                            </div>
                            <p className="mx-auto max-w-[19rem] text-xs leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground/85">Drop</span> the file here, or{" "}
                              <span className="font-medium text-foreground/85">click anywhere</span> to browse.
                            </p>
                            <p className="text-[0.7rem] leading-snug text-muted-foreground/90">
                              {isElectron && canRememberKey && rememberKey
                                ? "Remember is on — encrypts and stores only on this Mac."
                                : "Held in memory for this session — not written to disk."}
                            </p>
                          </div>
                        </div>
                      </label>
                      {isElectron && canRememberKey && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => void chooseP8SecureDialog()}
                              aria-label="Choose .p8 file and save encrypted on this Mac"
                            >
                              <FileKey className="h-4 w-4" aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">Choose .p8 (save encrypted)</p>
                            <p className="text-xs text-muted-foreground">
                              Pick a key file to store securely on this device; excluded from JSON exports.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
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

                <div className="space-y-1.5">
                  <Label htmlFor="rotation-memo" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Saved secret memo (optional)
                  </Label>
                  <Textarea
                    id="rotation-memo"
                    value={rotationMemo}
                    onChange={(ev) => setRotationMemo(ev.target.value)}
                    placeholder="e.g. Q1 rollout, swapped in prod on March 10…"
                    className="min-h-[64px] text-sm"
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Stored only with this device&apos;s rotation history—not in the JWT.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => void handleRotate()}
                  disabled={
                    isRotating || !(privateKeyContent || hasStoredKey) || !idPreview.ok
                  }
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
                  {generatedSecret && jwtDecodePreview?.ok === true && (
                    <div className="border-t border-[hsl(var(--generate-jwt-border))] px-3 py-2">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--generate-jwt-muted))]">
                        Decoded payload (read-only)
                      </p>
                      <pre className="max-h-36 overflow-auto rounded-md border border-[hsl(var(--generate-jwt-border))] bg-background/70 p-2 text-[10px] leading-snug text-[hsl(var(--generate-jwt-fg))]">
                        {JSON.stringify(jwtDecodePreview.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                  {generatedSecret && jwtDecodePreview?.ok === false && (
                    <div className="border-t border-[hsl(var(--generate-jwt-border))] px-3 py-2">
                      <p className="text-[10px] text-destructive">
                        Could not decode token: {jwtDecodePreview.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {showSavedSecretsPanel && (
        <section>
          <div className="min-h-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saved client secrets
            </p>
            <Card className={cardClass}>
              <CardHeader className={cn(isElectron && "space-y-1 pb-2 pt-4")}>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileKey className="h-4 w-4" />
                  Copy without .p8
                </CardTitle>
                <CardDescription className="text-xs">
                  JWTs from successful runs (stored locally on this device). Expired tokens still appear
                  for reference.
                  {isElectron ? (
                    <>
                      {" "}
                      There is no fixed cap on how many are kept; anyone with access to this Mac user
                      can read the app data folder.
                    </>
                  ) : null}
                </CardDescription>
                {isElectron && profiles.length > 0 && (
                  <div className="pt-2">
                    <Label htmlFor="saved-secrets-profile" className="sr-only">
                      Filter by profile
                    </Label>
                    <Select
                      value={savedSecretsProfileFilter}
                      onValueChange={(v) => setSavedSecretsProfileFilter(v)}
                    >
                      <SelectTrigger id="saved-secrets-profile" className="h-9 w-full max-w-xs text-sm">
                        <SelectValue placeholder="Profile filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All profiles</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            textValue={p.tags.length ? `${p.name} ${p.tags.join(" ")}` : p.name}
                          >
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardHeader>
              <CardContent className={cn(isElectron && "pb-4 pt-0")}>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border">
                  {isElectron && savedSecretsListLoading ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Loading saved secrets…
                    </p>
                  ) : (isElectron ? pagedSavedSecrets : savedSecrets).length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No secrets match this profile filter. Choose{" "}
                      <span className="font-medium text-foreground">All profiles</span> above to see
                      everything on this device.
                    </p>
                  ) : (
                    (isElectron ? pagedSavedSecrets : savedSecrets).map((r) => {
                    const profMeta = r.profile_id ? profileMetaById[r.profile_id] : undefined;
                    return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 border-b px-2 py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {r.profile_id ? (
                            <span className="font-medium text-foreground/80">
                              {profileNameById[r.profile_id] ?? "Profile"}
                              {" · "}
                            </span>
                          ) : null}
                          {new Date(r.rotated_at).toLocaleString()} · exp.{" "}
                          {new Date(r.expires_at).toLocaleDateString()}
                          {r.key_id ? (
                            <span className="block font-mono text-[10px] text-muted-foreground/90">
                              Key ID {r.key_id}
                            </span>
                          ) : null}
                        </p>
                        {profMeta && profMeta.tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {profMeta.tags.slice(0, 6).map((t) => (
                              <Badge key={t} variant="outline" className="px-1 py-0 text-[9px] font-normal">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {r.user_note?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                            {r.user_note}
                          </p>
                        ) : null}
                        <p className="truncate font-mono text-[10px] text-muted-foreground" title={r.jwt ?? ""}>
                          {(r.jwt ?? "").slice(0, 48)}…
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1 sm:pt-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setSecretNoteDialog(r);
                            setSecretNoteDraft(r.user_note ?? "");
                          }}
                          aria-label="Edit memo for saved secret"
                        >
                          <ScrollText className="mr-1 h-3.5 w-3.5" />
                          Memo
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => r.jwt && void copySavedJwt(r.jwt)}
                          disabled={!r.jwt}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy JWT
                        </Button>
                      </div>
                    </div>
                    );
                  })
                  )}
                </div>
                {isElectron &&
                  !savedSecretsListLoading &&
                  pagedSavedSecrets.length > 0 &&
                  savedSecretsTotalCount > SAVED_SECRETS_PAGE_SIZE && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      Page {savedSecretsPage + 1} of {savedSecretsPageCount} · {savedSecretsTotalCount}{" "}
                      saved
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={savedSecretsPage <= 0}
                        onClick={() => setSavedSecretsPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={savedSecretsPage >= savedSecretsPageCount - 1}
                        onClick={() =>
                          setSavedSecretsPage((p) =>
                            Math.min(savedSecretsPageCount - 1, p + 1),
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
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
          <NotificationBell />
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

      {activeProfile ? (
        <ProfileEditorDialog
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          mode={profileModalMode}
          createSeed={{
            name: `Profile ${profiles.length + 1}`,
            keyId: activeProfile.keyId,
            teamId: activeProfile.teamId,
            servicesId: activeProfile.servicesId,
            tags: [],
            notes: "",
          }}
          editProfile={profileModalMode === "edit" ? activeProfile : null}
          onCreate={createProfile}
          onSave={saveProfile}
        />
      ) : null}

      <Dialog
        open={secretNoteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSecretNoteDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saved secret memo</DialogTitle>
            <DialogDescription>
              Local note for this JWT only—not sent to Apple or embedded in the token.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={secretNoteDraft}
            onChange={(e) => setSecretNoteDraft(e.target.value)}
            placeholder="Deployment context, changelog link, expiry reminder…"
            className="min-h-[96px]"
            maxLength={2000}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSecretNoteDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveSecretNote()}>
              Save memo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          setRevealOpen(open);
          if (!open) setRevealedPem(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved private key</DialogTitle>
            <DialogDescription>
              Shown only after you authenticate. Close this window when you are done.
            </DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            className="h-48 w-full resize-y rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed"
            value={revealedPem ?? ""}
            aria-label="PEM contents"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (revealedPem) void copyText(revealedPem);
                toast.success("PEM copied");
              }}
              disabled={!revealedPem}
            >
              Copy PEM
            </Button>
            <Button type="button" onClick={() => setRevealOpen(false)}>
              Close
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
                void navigate("/notifications");
              }}
            >
              <Bell className="mr-2 h-4 w-4" />
              Open notifications
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
