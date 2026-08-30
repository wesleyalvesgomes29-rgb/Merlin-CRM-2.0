export const MASTER_INVITE_CODE = "MERLIN-ADMIN-2026";

export function getAuthCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (!origin) return headers;

  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isCloudflarePages = hostname.endsWith(".pages.dev");
    const isCloudRun = hostname.endsWith(".run.app");
    const isSameHost = host ? (originUrl.host === host || hostname === host.split(":")[0]) : false;

    if (isLocalhost || isCloudflarePages || isCloudRun || isSameHost) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  } catch {
    // ignore
  }

  return headers;
}

export function generateRandomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 10000,
      hash: "SHA-512"
    },
    baseKey,
    512
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomInviteCode(prefix = "MERLIN"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${part1}-${part2}`;
}
