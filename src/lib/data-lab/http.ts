const REQUEST_TIMEOUT_MS = 10_000;

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

export function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  return error.message
    .replace(/(X-Auth-Token|X-API-KEY|api[_-]?key)[=: ]+[^\s,}]+/gi, "$1=[redacted]")
    .slice(0, 800);
}
