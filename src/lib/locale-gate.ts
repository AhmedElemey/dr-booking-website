/**
 * When the English language switch is off only `/ar` is served. Returns the
 * path to redirect an `/en…` request to, or null when the request is fine.
 */
export function englishRedirect(pathname: string, englishEnabled: boolean): string | null {
  if (englishEnabled) return null;
  if (pathname === "/en") return "/ar";
  if (pathname.startsWith("/en/")) return `/ar${pathname.slice(3)}`;
  return null;
}
