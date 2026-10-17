export function allowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" || host === "fcmregistrations.googleapis.com" ||
      host === "updates.push.services.mozilla.com" || host.endsWith(".push.apple.com") ||
      host === "push.services.mozilla.com" || host.endsWith(".notify.windows.com");
  } catch { return false; }
}

export function shouldRetryDelivery(input: { status: string; errorCode: string | null; lastAttempt: number; now: number }) {
  const [code, rawAttempts] = (input.errorCode ?? "").split(":");
  const attempts = Number(rawAttempts || "1");
  return input.status === "failed" && (code === "429" || /^5\d\d$/.test(code) || code === "PUSH_ERROR") &&
    Number.isFinite(attempts) && attempts < 3 && input.now - input.lastAttempt >= 15 * 60_000;
}
