import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, CheckCircle2, XCircle, Clock, Key, Copy, AlertTriangle, Upload, Shield, FileKey, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { useRotationHistory } from "@/hooks/useRotationHistory";
import { generateAppleClientSecret } from "@/lib/appleJwt";

// Local storage keys for config (not sensitive - just identifiers)
const STORAGE_KEY_ID = "apple_key_id";
const STORAGE_TEAM_ID = "apple_team_id";
const STORAGE_SERVICES_ID = "apple_services_id";

export default function AppleKeyRotation() {
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [privateKeyContent, setPrivateKeyContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apple config state (persisted to localStorage)
  const [keyId, setKeyId] = useState(() => localStorage.getItem(STORAGE_KEY_ID) || "");
  const [teamId, setTeamId] = useState(() => localStorage.getItem(STORAGE_TEAM_ID) || "");
  const [servicesId, setServicesId] = useState(() => localStorage.getItem(STORAGE_SERVICES_ID) || "");

  // Use IndexedDB for rotation history
  const { rotations, isLoading, addRotation, clearHistory, exportHistory } = useRotationHistory();

  // Save config to localStorage when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ID, keyId);
  }, [keyId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TEAM_ID, teamId);
  }, [teamId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SERVICES_ID, servicesId);
  }, [servicesId]);

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

  // Check for expiring secret on page load
  useEffect(() => {
    if (isLoading || !rotations || rotations.length === 0) return;

    const latestSuccess = rotations.find((r) => r.status === "success");
    if (!latestSuccess) return;

    const expiresAt = new Date(latestSuccess.expires_at).getTime();
    const daysRemaining = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 30 && daysRemaining > 0) {
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
  }, [isLoading, rotations]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.p8')) {
      toast.error("Please upload a .p8 file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content.includes("-----BEGIN PRIVATE KEY-----")) {
        toast.error("Invalid .p8 file format");
        return;
      }
      setPrivateKeyContent(content);
      setFileName(file.name);
      toast.success("File loaded securely in memory");
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  // Clear the file
  const clearFile = () => {
    setPrivateKeyContent(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Rotate key handler - now fully client-side
  const handleRotate = async () => {
    if (!privateKeyContent) {
      toast.error("Please upload your .p8 file first");
      return;
    }

    if (!keyId || !teamId || !servicesId) {
      toast.error("Please fill in all Apple configuration fields");
      return;
    }

    setIsRotating(true);

    try {
      const { secret, expiresAt } = await generateAppleClientSecret({
        keyId,
        teamId,
        servicesId,
        privateKeyPem: privateKeyContent,
      });

      setGeneratedSecret(secret);

      // Save to IndexedDB
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

      // Log failure to IndexedDB
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const latestRotation = rotations?.[0];
  const isExpiringSoon = latestRotation?.expires_at
    ? new Date(latestRotation.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 // 30 days
    : false;

  const isConfigComplete = keyId && teamId && servicesId;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Apple OAuth Key Rotation</h1>
          <p className="text-muted-foreground mt-2">
            Manage your Apple Sign-In client secret. Apple requires rotating this every 6 months.
          </p>
        </div>

        {/* Security Notice */}
        <Alert className="border-green-600/50 bg-green-50 dark:bg-green-950/20">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-400">100% Client-Side & Secure</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Everything runs in your browser. Your .p8 private key is <strong>never sent to any server</strong>. 
            It's loaded in memory, used to sign the JWT locally, and immediately discarded.
          </AlertDescription>
        </Alert>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Apple Configuration
            </CardTitle>
            <CardDescription>
              Enter your Apple Developer account identifiers (saved locally)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="keyId">Key ID</Label>
                <Input
                  id="keyId"
                  placeholder="e.g., ABC123DEFG"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamId">Team ID</Label>
                <Input
                  id="teamId"
                  placeholder="e.g., TEAM123456"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servicesId">Services ID</Label>
                <Input
                  id="servicesId"
                  placeholder="e.g., com.example.app"
                  value={servicesId}
                  onChange={(e) => setServicesId(e.target.value)}
                />
              </div>
            </div>
            {!isConfigComplete && (
              <p className="text-sm text-muted-foreground">
                Find these values in your{" "}
                <a
                  href="https://developer.apple.com/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary"
                >
                  Apple Developer account
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Status
            </CardTitle>
            <CardDescription>
              Last rotation status and expiration information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : latestRotation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {latestRotation.status === "success" ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Last rotated: {new Date(latestRotation.rotated_at).toLocaleDateString()}
                  </div>
                </div>

                {isExpiringSoon && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Expiring Soon!</AlertTitle>
                    <AlertDescription>
                      Your Apple client secret expires on{" "}
                      {new Date(latestRotation.expires_at).toLocaleDateString()}.
                      Rotate it now to avoid authentication failures.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-sm">
                  <span className="text-muted-foreground">Expires:</span>{" "}
                  <span className="font-medium">
                    {new Date(latestRotation.expires_at).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({Math.ceil((new Date(latestRotation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No rotations recorded yet. Generate your first secret below.</p>
            )}
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card>
          <CardHeader>
            <CardTitle>Generate New Secret</CardTitle>
            <CardDescription>
              Upload your .p8 signing key to generate a new Apple client secret
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload Area */}
            <div className="space-y-3">
              <input
                type="file"
                accept=".p8"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                id="p8-upload"
              />

              {!privateKeyContent ? (
                <label
                  htmlFor="p8-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add("border-primary", "bg-primary/10");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      if (fileInputRef.current) {
                        fileInputRef.current.files = dataTransfer.files;
                        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                    <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                    <p className="mb-1 text-sm text-muted-foreground">
                      <span className="font-semibold">Drag & drop</span> or <span className="font-semibold">click to upload</span> your .p8 file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      File is only loaded in memory, never stored
                    </p>
                  </div>
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <FileKey className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{fileName}</p>
                      <p className="text-xs text-muted-foreground">Ready to generate secret</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFile}>
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={handleRotate}
              disabled={isRotating || !privateKeyContent || !isConfigComplete}
              className="w-full sm:w-auto"
            >
              {isRotating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Secret
                </>
              )}
            </Button>

            {generatedSecret && (
              <div className="space-y-3">
                <Separator />
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Secret Generated!</AlertTitle>
                  <AlertDescription>
                    Copy this secret and update it in your Apple OAuth provider settings.
                  </AlertDescription>
                </Alert>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-32 overflow-y-auto">
                    {generatedSecret}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(generatedSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Rotation History</CardTitle>
              <CardDescription>
                Recent key rotation events (stored locally)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportHistory}
                disabled={!rotations || rotations.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                disabled={!rotations || rotations.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : rotations && rotations.length > 0 ? (
              <div className="space-y-3">
                {rotations.map((rotation) => (
                  <div
                    key={rotation.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {rotation.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(rotation.rotated_at).toLocaleString()}
                        </p>
                        {rotation.error_message && (
                          <p className="text-xs text-destructive">{rotation.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {rotation.triggered_by}
                      </Badge>
                      {rotation.status === "success" && (
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(rotation.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No rotation history yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
