import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PHONE_HEADER,
  ADMIN_PIN_HEADER,
  loginErrorCode,
  matchAdminRoster,
  normalizePhone,
  verifyAdminPhonePin,
} from "./admin-roster";

const header = ["STT", "Tên Admin", ADMIN_PHONE_HEADER, ADMIN_PIN_HEADER];

function roster(rows: string[][]): string[][] {
  return [header, ...rows];
}

function isMatch(values: unknown, phone: string, pin: string): boolean {
  const result = matchAdminRoster(values, phone, pin);
  assert.equal(result.ok, true);
  if (!result.ok) return false;
  return result.matched;
}

describe("admin roster match", () => {
  it("normalizes phones to digits and compares the PIN exactly", () => {
    const values = roster([
      ["1", "An", "0900.111.222", "Pin-A"],
      ["2", "Bình", "0912 333 444", "pin-a"],
    ]);
    assert.equal(normalizePhone("0900.111.222"), "0900111222");
    assert.equal(isMatch(values, "0900 111 222", "Pin-A"), true);
    assert.equal(isMatch(values, "0900111222", "pin-a"), false);
    assert.equal(isMatch(values, "0912.333.444", "pin-a"), true);
    assert.equal(isMatch(values, "0900111222", "PIN-A"), false);
    assert.equal(isMatch(values, "0900111222", "Pin -A"), false);
  });

  it("matches a row only when both phone and PIN match", () => {
    const values = roster([
      ["1", "An", "0900111111", "1111"],
      ["2", "Bình", "0900222222", "2222"],
    ]);
    assert.equal(isMatch(values, "0900111111", "2222"), false);
    assert.equal(isMatch(values, "+84900222222", "2222"), false);
    assert.equal(isMatch(values, "0900-222-222", " 2222 "), true);
  });

  it("ignores empty rows and does not borrow a PIN from another row", () => {
    const values = roster([
      ["", "", "", ""],
      ["3", "Trống", "", "9999"],
      ["4", "Thiếu PIN", "0900333333", ""],
      ["5", "Đủ", "0900444444", "4444"],
    ]);
    assert.equal(isMatch(values, "0900333333", "9999"), false);
    assert.equal(isMatch(values, "0900444444", "4444"), true);
  });

  it("rejects a sheet that is missing either header", () => {
    const missing = matchAdminRoster([["Số Điện Thoại", "Tên"]], "0900111111", "1111");
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.reason, "bad_sheet");
  });
});

describe("live sheet check", () => {
  const scriptUrl = "https://script.google.com/macros/s/example/exec";

  it("does not call the sheet when the phone or PIN is empty", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new Error("should not fetch");
    };
    const empty = await verifyAdminPhonePin("----", "   ", { env: { ADMIN_ROSTER_SCRIPT_URL: scriptUrl }, fetchImpl });
    assert.deepEqual(empty, { ok: false, reason: "empty" });
    assert.equal(calls, 0);
  });

  it("fails closed when the web app URL is not configured", async () => {
    const missing = await verifyAdminPhonePin("0900111111", "1111", {
      env: { GOOGLE_SERVICE_ACCOUNT_JSON: "{\"client_email\":\"ignored\"}" },
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });
    assert.deepEqual(missing, { ok: false, reason: "unavailable" });
    assert.equal(loginErrorCode("unavailable"), "unavailable");
  });

  it("accepts only an explicit match from the live script", async () => {
    const phone = "0900555666";
    const pin = "Seeding-9";
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      assert.equal(String(input), scriptUrl);
      const body = typeof init?.body === "string" ? init.body : "";
      const parsed = JSON.parse(body) as { phone?: string; pin?: string };
      assert.equal(parsed.phone, phone);
      assert.equal(parsed.pin, pin);
      return new Response(JSON.stringify({ match: true }), { status: 200 });
    };
    const ok = await verifyAdminPhonePin(phone, pin, { env: { ADMIN_ROSTER_SCRIPT_URL: scriptUrl }, fetchImpl });
    assert.deepEqual(ok, { ok: true });
    assert.deepEqual(seen, [scriptUrl]);

    const denied: typeof fetch = async () => new Response(JSON.stringify({ match: false }), { status: 200 });
    const mismatch = await verifyAdminPhonePin(phone, pin, {
      env: { ADMIN_ROSTER_SCRIPT_URL: scriptUrl },
      fetchImpl: denied,
    });
    assert.deepEqual(mismatch, { ok: false, reason: "mismatch" });
    assert.equal(loginErrorCode("mismatch"), "mismatch");
  });
});
