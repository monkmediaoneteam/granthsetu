/**
 * Reads an env var, treating blanks and unedited .env.example placeholders as
 * unset. Copying .env.example and filling in only some values is the normal
 * way to start, and a half-filled file must behave like a missing value rather
 * than sending "rzp_test_xxxxxxxx" to a payment provider.
 */
const PLACEHOLDER = /xxxxxxxx|user:password@|@host\/|change-this|your-|<[a-z-]+>/i;

export function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  if (!v || PLACEHOLDER.test(v)) return undefined;
  return v;
}

export function requireEnv(name: string, hint: string): string {
  const v = env(name);
  if (!v) throw new Error(`${name} is not set. ${hint}`);
  return v;
}
