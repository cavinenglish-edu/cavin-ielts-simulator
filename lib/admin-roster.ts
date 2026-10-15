import { passwordsMatch } from "@/lib/admin-session";

/** Tab «Thông tin chung của Admin». The sheet stays private; login asks a bound Apps Script, it does not copy rows. */
export const ADMIN_ROSTER_SPREADSHEET_ID = "1cbB5PELQVXnKsiKe5HCwg32kKBzgD5YpxwW1UNYLP5w";
export const ADMIN_ROSTER_SHEET_NAME = "Thông tin chung của Admin";
export const ADMIN_PHONE_HEADER = "Số Điện Thoại";
export const ADMIN_PIN_HEADER = "Mã PIN đăng nhập AI Seeding";

const MAX_PHONE_DIGITS = 20;
const MAX_PIN_LENGTH = 64;

export type PhonePinFailure = "empty" | "mismatch" | "unavailable";
export type PhonePinResult = { ok: true } | { ok: false; reason: PhonePinFailure };

const LOGIN_ERROR_CODES: Record<PhonePinFailure, string> = {
  empty: "empty",
  mismatch: "mismatch",
  unavailable: "unavailable",
};

export function loginErrorCode(reason: PhonePinFailure): string {
  return LOGIN_ERROR_CODES[reason];
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

type Env = Record<string, string | undefined>;

/**
 * A row counts only when both the normalized phone and the exact PIN are non-empty and equal.
 * PIN comparison trims surrounding whitespace and keeps every other character.
 * Used by tests and mirrored by scripts/admin-roster.gs.
 */
export function matchAdminRoster(
  values: unknown,
  phoneInput: string,
  pinInput: string,
): { ok: true; matched: boolean } | { ok: false; reason: "bad_sheet" } {
  const rows = asRows(values);
  const header = rows[0];
  if (!header) return { ok: false, reason: "bad_sheet" };
  const phoneIndex = header.findIndex((cell) => cell === ADMIN_PHONE_HEADER);
  const pinIndex = header.findIndex((cell) => cell === ADMIN_PIN_HEADER);
  if (phoneIndex < 0 || pinIndex < 0) return { ok: false, reason: "bad_sheet" };

  const phone = normalizePhone(phoneInput);
  const pin = pinInput.trim();
  if (!phone || !pin) return { ok: true, matched: false };

  for (const row of rows.slice(1)) {
    const rowPhone = normalizePhone(row[phoneIndex] ?? "");
    const rowPin = (row[pinIndex] ?? "").trim();
    if (!rowPhone || !rowPin) continue;
    if (passwordsMatch(rowPhone, phone) && passwordsMatch(rowPin, pin)) {
      return { ok: true, matched: true };
    }
  }
  return { ok: true, matched: false };
}

export async function verifyAdminPhonePin(
  phoneInput: string,
  pinInput: string,
  options?: { env?: Env; fetchImpl?: typeof fetch },
): Promise<PhonePinResult> {
  const phone = normalizePhone(phoneInput);
  const pin = pinInput.trim();
  if (!phone || !pin) return { ok: false, reason: "empty" };
  if (phone.length > MAX_PHONE_DIGITS || pin.length > MAX_PIN_LENGTH) {
    return { ok: false, reason: "mismatch" };
  }

  const url = (options?.env ?? process.env).ADMIN_ROSTER_SCRIPT_URL?.trim();
  if (!url) return { ok: false, reason: "unavailable" };

  const fetchImpl = options?.fetchImpl ?? fetch;
  let sawMismatch = false;
  for (const candidate of phoneLookupKeys(phone)) {
    const result = await askRosterScript(url, candidate, pin, fetchImpl);
    if (result.ok) return result;
    if (result.reason === "mismatch") {
      sawMismatch = true;
      continue;
    }
    return result;
  }
  return { ok: false, reason: sawMismatch ? "mismatch" : "unavailable" };
}

/** Sheets stores some phone cells as numbers, which drops a single leading 0. */
export function phoneLookupKeys(digits: string): string[] {
  const keys = [digits];
  if (digits.startsWith("0") && digits.length > 1) keys.push(digits.slice(1));
  else if (digits.length > 0 && digits.length < MAX_PHONE_DIGITS) keys.push(`0${digits}`);
  return [...new Set(keys)];
}

async function askRosterScript(
  url: string,
  phone: string,
  pin: string,
  fetchImpl: typeof fetch,
): Promise<PhonePinResult> {
  let response: Response;
  try {
    response = await postRoster(url, phone, pin, fetchImpl);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!payload || typeof payload !== "object") return { ok: false, reason: "unavailable" };
  const record = payload as { match?: unknown; error?: unknown };
  if (record.error) return { ok: false, reason: "unavailable" };
  if (record.match === true) return { ok: true };
  if (record.match === false) return { ok: false, reason: "mismatch" };
  return { ok: false, reason: "unavailable" };
}

async function postRoster(url: string, phone: string, pin: string, fetchImpl: typeof fetch): Promise<Response> {
  const first = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ phone, pin }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (first.status < 300 || first.status >= 400) return first;
  const location = first.headers.get("location");
  if (!location) return first;
  return fetchImpl(new URL(location, url), {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
}

function asRows(values: unknown): string[][] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => cellText(cell)));
}

function cellText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}
