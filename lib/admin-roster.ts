import { createSign } from "crypto";
import { passwordsMatch } from "@/lib/admin-session";

/** Tab «Thông tin chung của Admin» in the admin workbook. Not a secret; access stays on the sheet ACL. */
export const ADMIN_ROSTER_SPREADSHEET_ID = "1cbB5PELQVXnKsiKe5HCwg32kKBzgD5YpxwW1UNYLP5w";
export const ADMIN_ROSTER_SHEET_NAME = "Thông tin chung của Admin";
export const ADMIN_PHONE_HEADER = "Số Điện Thoại";
export const ADMIN_PIN_HEADER = "Mã PIN đăng nhập AI Seeding";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_PHONE_DIGITS = 20;
const MAX_PIN_LENGTH = 64;

export type ServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

export type CredentialStatus = "ok" | "missing_credential" | "invalid_credential";

export type RosterFailure =
  | "missing_credential"
  | "invalid_credential"
  | "forbidden"
  | "bad_sheet"
  | "unavailable";

export type PhonePinFailure = "empty" | "mismatch" | RosterFailure;

export type PhonePinResult = { ok: true } | { ok: false; reason: PhonePinFailure };

const LOGIN_ERROR_CODES: Record<PhonePinFailure, string> = {
  empty: "empty",
  mismatch: "mismatch",
  missing_credential: "sheet_config",
  invalid_credential: "sheet_invalid",
  forbidden: "sheet_forbidden",
  bad_sheet: "sheet_shape",
  unavailable: "sheet_down",
};

export function loginErrorCode(reason: PhonePinFailure): string {
  return LOGIN_ERROR_CODES[reason];
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

type Env = Record<string, string | undefined>;

export function rosterCredentialStatus(env: Env = process.env): CredentialStatus {
  return readServiceAccount(env).status;
}

/**
 * A row counts only when both the normalized phone and the exact PIN are non-empty and equal.
 * PIN comparison trims surrounding whitespace and keeps every other character.
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

  const env = options?.env ?? process.env;
  const credential = readServiceAccount(env);
  if (credential.status === "missing_credential") return { ok: false, reason: "missing_credential" };
  if (credential.status === "invalid_credential" || !credential.account) {
    return { ok: false, reason: "invalid_credential" };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const token = await requestAccessToken(credential.account, fetchImpl);
  if (!token.ok) return { ok: false, reason: token.reason };

  const sheet = await requestRosterValues(token.accessToken, fetchImpl);
  if (!sheet.ok) return { ok: false, reason: sheet.reason };

  const matched = matchAdminRoster(sheet.values, phone, pin);
  if (!matched.ok) return { ok: false, reason: "bad_sheet" };
  if (!matched.matched) return { ok: false, reason: "mismatch" };
  return { ok: true };
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

type AccountRead =
  | { status: "ok"; account: ServiceAccount }
  | { status: "missing_credential"; account?: undefined }
  | { status: "invalid_credential"; account?: undefined };

function readServiceAccount(env: Env): AccountRead {
  const jsonRaw = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const account = accountFromJson(jsonRaw);
    return account ? { status: "ok", account } : { status: "invalid_credential" };
  }

  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ?? "";
  if (!email && !key) return { status: "missing_credential" };
  if (!email || !key) return { status: "invalid_credential" };
  const privateKey = normalizePrivateKey(key);
  if (!email.includes("@") || !privateKey.includes("PRIVATE KEY")) {
    return { status: "invalid_credential" };
  }
  return { status: "ok", account: { clientEmail: email, privateKey } };
}

function accountFromJson(raw: string): ServiceAccount | null {
  const text = raw.startsWith("{") ? raw : decodeBase64(raw);
  if (!text?.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    const privateKey = normalizePrivateKey(parsed.private_key);
    if (!parsed.client_email.includes("@") || !privateKey.includes("PRIVATE KEY")) return null;
    return { clientEmail: parsed.client_email.trim(), privateKey };
  } catch {
    return null;
  }
}

function decodeBase64(value: string): string | null {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function normalizePrivateKey(value: string): string {
  const unquoted = value.trim().replace(/^["']|["']$/g, "");
  return unquoted.includes("\\n") ? unquoted.replace(/\\n/g, "\n") : unquoted;
}

function rosterRange(): string {
  return `'${ADMIN_ROSTER_SHEET_NAME}'!A1:Z1000`;
}

export function rosterValuesUrl(): string {
  return `https://sheets.googleapis.com/v4/spreadsheets/${ADMIN_ROSTER_SPREADSHEET_ID}/values/${encodeURIComponent(rosterRange())}?valueRenderOption=FORMATTED_VALUE`;
}

async function requestAccessToken(
  account: ServiceAccount,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: "invalid_credential" | "unavailable" }> {
  let assertion = "";
  try {
    assertion = createServiceAccountJwt(account);
  } catch {
    return { ok: false, reason: "invalid_credential" };
  }

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 401 || response.status === 400) return { ok: false, reason: "invalid_credential" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    const payload = (await response.json()) as { access_token?: unknown };
    if (typeof payload.access_token !== "string" || !payload.access_token) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, accessToken: payload.access_token };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

async function requestRosterValues(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; values: unknown } | { ok: false; reason: "forbidden" | "unavailable" }> {
  let response: Response;
  try {
    response = await fetchImpl(rosterValuesUrl(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    const payload = (await response.json()) as { values?: unknown };
    return { ok: true, values: payload.values ?? [] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function createServiceAccountJwt(account: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: account.clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(account.privateKey).toString("base64url")}`;
}
