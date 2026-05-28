export const AUTH_COOKIE = "cvf_session";

export function authToken(): string | null {
  const t = process.env.APP_AUTH_TOKEN;
  return t && t.length > 0 ? t : null;
}

export function isAuthRequired(): boolean {
  return authToken() !== null;
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function cookieMatches(value: string | undefined): boolean {
  const t = authToken();
  if (!t) return true; // auth disabled
  if (!value) return false;
  return constantTimeEquals(value, t);
}

export function tokenMatches(submitted: string): boolean {
  const t = authToken();
  if (!t) return false;
  return constantTimeEquals(submitted, t);
}
