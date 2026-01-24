import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Clock, Key, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface RotationRecord {
  id: string;
  rotated_at: string;
  expires_at: string;
  status: "success" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "cron";
}

interface RotationResponse {
  success: boolean;
  message?: string;
  client_secret?: string;
  expires_at?: string;
  error?: string;
  instructions?: string;
}

export default function AppleKeyRotation() {
  const queryClient = useQueryClient();
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  // Fetch rotation history
  const { data: rotations, isLoading } = useQuery({
    queryKey: ["apple-key-rotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apple_key_rotations")
        .select("*")
        .order("rotated_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as RotationRecord[];
    },
  });

  // Rotate key mutation
  const rotateMutation = useMutation({
    mutationFn: async (): Promise<RotationResponse> => {
      const { data, error } = await supabase.functions.invoke("rotate-apple-secret", {
        body: { triggered_by: "manual" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.client_secret) {
        setGeneratedSecret(data.client_secret);
        toast.success("Apple client secret generated successfully!");
      } else {
        toast.error(data.error || "Failed to generate secret");
      }
      queryClient.invalidateQueries({ queryKey: ["apple-key-rotations"] });
    },
    onError: (error) => {
      toast.error(`Rotation failed: ${error.message}`);
    },
  });

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
              Generate a new Apple client secret using your .p8 signing key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {rotateMutation.isPending ? (
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
            <CardTitle>Automation Info</CardTitle>
            <CardDescription>
              About automatic key rotation
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A cron job is configured to automatically generate a new secret every 5.5 months, 
              giving you a 2-week buffer before expiration.
            </p>
            <p>
              <strong>Important:</strong> After the secret is generated (automatically or manually), 
              you still need to update it in your backend authentication settings. 
              The generated secret will appear in this dashboard and in the rotation history.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
