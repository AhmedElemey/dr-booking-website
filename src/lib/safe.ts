/** Resolves to `fallback` when a non-critical fetch fails (e.g. API down during a static build). */
export async function orFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}
