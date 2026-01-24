import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base64URL encode (RFC 7515)
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert PEM to raw key bytes
function pemToBytes(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate Apple client secret JWT
async function generateAppleClientSecret(
  keyId: string,
  teamId: string,
  servicesId: string,
  privateKeyPem: string
): Promise<{ secret: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 15777000; // ~6 months in seconds (182.5 days)
  const exp = now + expiresIn;
  const expiresAt = new Date(exp * 1000);

  // JWT Header
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  // JWT Payload
  const payload = {
    iss: teamId,
    iat: now,
    exp: exp,
    aud: "https://appleid.apple.com",
    sub: servicesId,
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const keyBuffer = pemToBytes(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  // Convert signature to Uint8Array and base64url encode
  const signature = new Uint8Array(signatureBuffer);
  const signatureB64 = base64UrlEncode(signature);

  return {
    secret: `${signingInput}.${signatureB64}`,
    expiresAt,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables for Apple config
    const keyId = Deno.env.get("APPLE_KEY_ID");
    const teamId = Deno.env.get("APPLE_TEAM_ID");
    const servicesId = Deno.env.get("APPLE_SERVICES_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!keyId || !teamId || !servicesId) {
      throw new Error("Missing required Apple OAuth environment variables (APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_SERVICES_ID)");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Parse request body - private key comes from user upload (never stored)
    let privateKey: string | null = null;
    let triggeredBy = "manual";
    
    try {
      const body = await req.json();
      privateKey = body?.private_key || null;
      if (body?.triggered_by === "cron") {
        triggeredBy = "cron";
      }
    } catch {
      // No body or invalid JSON
    }

    if (!privateKey) {
      throw new Error("Private key is required. Please upload your .p8 file.");
    }

    // Validate private key format
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      throw new Error("Invalid private key format. Please upload a valid .p8 file.");
    }

    // Generate the new client secret
    const { secret, expiresAt } = await generateAppleClientSecret(
      keyId,
      teamId,
      servicesId,
      privateKey
    );

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the rotation in the database (never log the private key!)
    const { error: insertError } = await supabase
      .from("apple_key_rotations")
      .insert({
        expires_at: expiresAt.toISOString(),
        status: "success",
        triggered_by: triggeredBy,
      });

    if (insertError) {
      console.error("Failed to log rotation:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Apple client secret generated successfully",
        client_secret: secret,
        expires_at: expiresAt.toISOString(),
        triggered_by: triggeredBy,
        instructions: "Update this secret in your Apple OAuth provider settings in the backend authentication configuration.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Error rotating Apple secret:", error.message);

    // Try to log the failure (never log private key details)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("apple_key_rotations").insert({
          expires_at: new Date().toISOString(),
          status: "failed",
          error_message: error.message,
          triggered_by: "manual",
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
