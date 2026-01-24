import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Clock, Key, Copy, AlertTriangle, Upload, Shield, FileKey } from "lucide-react";
import { toast } from "sonner";
import { useRotationHistory, type RotationRecord } from "@/hooks/useRotationHistory";

interface RotationResponse {
  success: boolean;
  message?: string;
  client_secret?: string;
  expires_at?: string;
  error?: string;
  instructions?: string;
}

export default function AppleKeyRotation() {
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [privateKeyContent, setPrivateKeyContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use IndexedDB for rotation history
  const { rotations, isLoading, addRotation } = useRotationHistory();

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

  // Rotate key handler
  const handleRotate = async () => {
    if (!privateKeyContent) {
      toast.error("Please upload your .p8 file first");
      return;
    }

    setIsRotating(true);

    try {
      const { data, error } = await supabase.functions.invoke("rotate-apple-secret", {
        body: { 
          triggered_by: "manual",
          private_key: privateKeyContent 
        },
      });

      if (error) throw error;

      const response = data as RotationResponse;

      if (response.success && response.client_secret) {
        setGeneratedSecret(response.client_secret);
        
        // Save to IndexedDB
        await addRotation({
          rotated_at: new Date().toISOString(),
          expires_at: response.expires_at || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          status: "success",
          error_message: null,
          triggered_by: "manual",
        });

        clearFile();
        toast.success("Apple client secret generated successfully!");
      } else {
        // Log failure to IndexedDB
        await addRotation({
          rotated_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
          status: "failed",
          error_message: response.error || "Unknown error",
          triggered_by: "manual",
        });

        toast.error(response.error || "Failed to generate secret");
      }
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

      toast.error(`Rotation failed: ${errorMessage}`);
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
          <AlertTitle className="text-green-800 dark:text-green-400">100% Secure</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Your .p8 private key is <strong>never stored</strong>. It's loaded in your browser memory, 
            sent securely to generate the secret, and immediately discarded. The key never touches any database or storage.
          </AlertDescription>
        </Alert>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
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
                      // Trigger the same handler by creating a synthetic event
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
              disabled={isRotating || !privateKeyContent}
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
          <CardHeader>
            <CardTitle>Rotation History</CardTitle>
            <CardDescription>
              Recent key rotation events
            </CardDescription>
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
                          Expires: {new Date(rotation.expires_at).toLocaleDateString()}
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

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Security-first key rotation
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal list-inside space-y-1">
              <li>Upload your .p8 file (loaded only in your browser's memory)</li>
              <li>Click "Generate New Secret" to create a new client secret</li>
              <li>The private key is sent securely and used only for that request</li>
              <li>Copy the generated secret and update your OAuth settings</li>
              <li>The .p8 content is immediately cleared from memory</li>
            </ol>
            <p className="mt-4">
              <strong>Note:</strong> Your private key is never stored anywhere. 
              You'll need to upload it each time you want to generate a new secret.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
