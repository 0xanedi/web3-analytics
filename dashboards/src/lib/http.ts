/**
 * Tiny HTTP layer: JSON fetch with timeout, retry and a single error type.
 * No API keys anywhere — every endpoint is public/keyless.
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    readonly kind: "http" | "network" | "timeout" = "http",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchJSON<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 20_000, retries = 2 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        // 4xx (except 429) will not improve on retry
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new HttpError(`HTTP ${res.status} for ${shortUrl(url)}`, url, res.status);
        }
        throw new HttpError(`HTTP ${res.status} for ${shortUrl(url)}`, url, res.status);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && err.status !== undefined && err.status < 500 && err.status !== 429) {
        break; // client error — retrying is pointless
      }
      // A TypeError from fetch() is a transport failure (DNS block, offline,
      // CORS). Retrying in 400ms cannot fix it — fail fast so callers can fall
      // back immediately instead of after three timeouts.
      if (err instanceof TypeError) break;
      if (attempt < retries) await sleep(400 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof HttpError) throw lastError;

  // A bare fetch() rejection is a transport failure: DNS block, offline, CORS
  // preflight rejection, or an aborted timeout. Classify it so callers can show
  // a precise message instead of a generic "Failed to fetch".
  const name = (lastError as { name?: string } | null)?.name;
  const kind: "network" | "timeout" = name === "AbortError" ? "timeout" : "network";
  const raw = lastError instanceof Error ? lastError.message : String(lastError);
  const hint =
    kind === "timeout"
      ? "request timed out"
      : "host unreachable (DNS block, offline, or CORS)";
  throw new HttpError(`${hint}: ${raw} — ${shortUrl(url)}`, url, undefined, kind);
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname.length > 40 ? u.pathname.slice(0, 40) + "…" : u.pathname);
  } catch {
    return url.slice(0, 60);
  }
}
