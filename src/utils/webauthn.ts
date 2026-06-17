// Real WebAuthn (passkey / biometric) helpers for the browser side.
// These drive the native OS biometric prompt (fingerprint / face) via the
// platform authenticator and exchange challenges with the server. This is
// genuine public-key authentication — not a simulated success.
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

// Returns true if this browser/device exposes a platform authenticator
export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

// Register a new biometric credential for the currently logged-in user.
export async function registerBiometric(token: string): Promise<void> {
  const optRes = await fetch("/api/auth/webauthn/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!optRes.ok) throw new Error(await readError(optRes, "שגיאה בקבלת אפשרויות הרישום"));
  const options = await optRes.json();

  // Triggers the native biometric prompt
  const attResp = await startRegistration({ optionsJSON: options });

  const verRes = await fetch("/api/auth/webauthn/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(attResp),
  });
  if (!verRes.ok) throw new Error(await readError(verRes, "אימות הרישום הביומטרי נכשל"));
}

// Authenticate an existing user via their registered biometric credential.
export async function loginBiometric(
  username: string
): Promise<{ username: string; token: string; biometricRegistered: boolean }> {
  const optRes = await fetch("/api/auth/webauthn/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!optRes.ok) throw new Error(await readError(optRes, "לא נמצא מפתח ביומטרי רשום"));
  const options = await optRes.json();

  // Triggers the native biometric prompt and signs the server challenge
  const authResp = await startAuthentication({ optionsJSON: options });

  const verRes = await fetch("/api/auth/webauthn/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, ...authResp }),
  });
  if (!verRes.ok) throw new Error(await readError(verRes, "האימות הביומטרי נכשל"));
  return verRes.json();
}
