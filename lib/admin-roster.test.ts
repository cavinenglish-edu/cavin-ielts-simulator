import assert from "node:assert/strict";
import { generateKeyPairSync } from "crypto";
import { describe, it } from "node:test";
import {
  ADMIN_PHONE_HEADER,
  ADMIN_PIN_HEADER,
  ADMIN_ROSTER_SPREADSHEET_ID,
  loginErrorCode,
  matchAdminRoster,
  normalizePhone,
  normalizePrivateKey,
  rosterCredentialStatus,
  rosterValuesUrl,
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

  it("finds the columns wherever they sit", () => {
    const values = [[ADMIN_PIN_HEADER, ADMIN_PHONE_HEADER], ["abc", "0988.111.222"]];
    assert.equal(isMatch(values, "0988111222", "abc"), true);
  });
});

describe("admin roster credentials", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("treats a missing Google credential as not configured", () => {
    assert.equal(rosterCredentialStatus({}), "missing_credential");
    assert.equal(rosterCredentialStatus({ GOOGLE_SERVICE_ACCOUNT_EMAIL: "a@b.c" }), "invalid_credential");
  });

  it("accepts a JSON key and an escaped private key", () => {
    const json = JSON.stringify({ client_email: "roster@example.iam.gserviceaccount.com", private_key: pem });
    assert.equal(rosterCredentialStatus({ GOOGLE_SERVICE_ACCOUNT_JSON: json }), "ok");
    const encoded = Buffer.from(json, "utf8").toString("base64");
    assert.equal(rosterCredentialStatus({ GOOGLE_SERVICE_ACCOUNT_JSON: encoded }), "ok");
    assert.equal(
      rosterCredentialStatus({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "roster@example.iam.gserviceaccount.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: JSON.stringify(pem).slice(1, -1),
      }),
      "ok",
    );
    assert.ok(normalizePrivateKey(JSON.stringify(pem).slice(1, -1)).includes("BEGIN PRIVATE KEY"));
  });

  it("does not send the phone or PIN to Google and fails closed without a credential", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new Error("network");
    };
    const missing = await verifyAdminPhonePin("0900111111", "1111", { env: {}, fetchImpl });
    assert.deepEqual(missing, { ok: false, reason: "missing_credential" });
    assert.equal(calls, 0);
    assert.equal(loginErrorCode("missing_credential"), "sheet_config");

    const empty = await verifyAdminPhonePin("----", "   ", { env: {}, fetchImpl });
    assert.deepEqual(empty, { ok: false, reason: "empty" });
  });

  it("matches from the sheet response and never puts the PIN on the request URL", async () => {
    const phone = "0900555666";
    const pin = "Seeding-9";
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      urls.push(url);
      assert.equal(url.includes(pin), false);
      assert.equal(url.includes(phone), false);
      const body = typeof init?.body === "string" ? init.body : "";
      assert.equal(body.includes(pin), false);
      assert.equal(body.includes(phone), false);
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "token-test" }), { status: 200 });
      }
      assert.equal(url.includes(ADMIN_ROSTER_SPREADSHEET_ID), true);
      assert.equal(url, rosterValuesUrl());
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer token-test");
      return new Response(
        JSON.stringify({ values: roster([["1", "Chi", "0900.555.666", pin]]) }),
        { status: 200 },
      );
    };

    const ok = await verifyAdminPhonePin(phone, pin, {
      env: {
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "roster@example.iam.gserviceaccount.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: pem,
      },
      fetchImpl,
    });
    assert.deepEqual(ok, { ok: true });
    assert.equal(urls.length, 2);

    const denied: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "token-test" }), { status: 200 });
      }
      return new Response("{}", { status: 403 });
    };
    const forbidden = await verifyAdminPhonePin(phone, pin, {
      env: {
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "roster@example.iam.gserviceaccount.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: pem,
      },
      fetchImpl: denied,
    });
    assert.deepEqual(forbidden, { ok: false, reason: "forbidden" });
    assert.equal(loginErrorCode("forbidden"), "sheet_forbidden");
  });
});
