export type DashboardMailFrom = { address: string; name?: string };

function validSenderEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

/** Parse a plain email address or a safe display-name address for Nodemailer. */
export function parseDashboardMailFrom(value: string): DashboardMailFrom | null {
  if (value.length > 320 || /[\r\n]/.test(value)) return null;

  const normalized = value.trim();
  if (validSenderEmail(normalized)) return { address: normalized };

  const match = /^(?:"([^"\r\n]{1,100})"|([^<>\r\n]{1,100}))\s*<([^<>\s@]+@[^<>\s@]+)>$/.exec(normalized);
  if (!match) return null;

  const name = (match[1] ?? match[2] ?? "").trim();
  const address = match[3].trim();
  if (!name || name.length > 100 || !validSenderEmail(address)) return null;
  return { name, address };
}
