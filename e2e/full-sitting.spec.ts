import { expect, type Page, test } from "@playwright/test";

const MEDIA = "/cursor/stores/bc-d6d6e118-e6a0-46c1-ad83-078ea6c49ef9/media";
const ACCESS_CODE = "482913";

function parseClock(text: string): number {
  const [minutes, seconds] = text.trim().split(":").map((part) => Number(part));
  return minutes * 60 + seconds;
}

function visibleTimer(page: Page) {
  return page.getByTestId("exam-timer").filter({ visible: true }).last();
}

async function fastForward(page: Page, addMs: number) {
  await page.evaluate(() => {
    const flag = window as Window & { __sectionLocked?: boolean };
    flag.__sectionLocked = false;
    const shown = (node: Element) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.closest("[hidden]")) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const mark = () => {
      const nodes = [...document.querySelectorAll("[data-testid='section-locked']")];
      if (nodes.some(shown)) flag.__sectionLocked = true;
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
  const response = await page.request.post("/api/e2e/clock", { data: { addMs } });
  expect(response.ok()).toBeTruthy();
  await page.evaluate(() => {
    document.dispatchEvent(new Event("exam-session-refresh"));
  });
}

async function reachReading(page: Page) {
  const started = await page.request.post("/api/e2e/bootstrap");
  expect(started.ok()).toBeTruthy();
  await page.goto("/exam/listening");
  await expect(page.getByTestId("question-nav").getByRole("button")).toHaveCount(2);
  await page.getByTestId("play-audio").click();
  await expect(page.getByTestId("exam-timer")).toHaveText("02:00");
  await expect(page.getByTestId("listening-phase")).toHaveText("Review");
  await fastForward(page, 130_000);
  await expect(page).toHaveURL(/\/exam\/reading/);
  await expect.poll(async () => page.evaluate(() => Boolean((window as Window & { __sectionLocked?: boolean }).__sectionLocked))).toBe(true);
}

test("pin header keeps a single entry button", async ({ page }) => {
  await page.goto("/exam");
  await expect(page.getByRole("button", { name: "Nhập Mã PIN Dự Thi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập PIN" })).toHaveCount(0);
  await page.locator("header").first().screenshot({ path: `${MEDIA}/pin-header.png` });
});

test("audio review then reading clock forces writing", async ({ page }) => {
  await reachReading(page);
  await expect(page.getByTestId("reading-passage")).toBeVisible();
  await expect(page.getByTestId("reading-questions")).toBeVisible();
  await page.screenshot({ path: `${MEDIA}/reading-split.png` });
  await fastForward(page, 60 * 60 * 1000 + 15_000);
  await expect(page).toHaveURL(/\/exam\/writing/);
  await expect.poll(async () => page.evaluate(() => Boolean((window as Window & { __sectionLocked?: boolean }).__sectionLocked))).toBe(true);
  await page.getByTestId("writing-task-1").click();
  await page.getByTestId("writing-response").fill("The harbour was busier in the morning than in the evening.");
  await page.getByTestId("writing-task-2").click();
  await expect(page.getByTestId("writing-response")).toHaveValue("");
  await page.getByTestId("writing-response").fill("Cities should keep a working harbour.");
  await page.getByTestId("writing-task-1").click();
  await expect(page.getByTestId("writing-response")).toHaveValue("The harbour was busier in the morning than in the evening.");
  await expect(page.getByTestId("writing-word-count")).toContainText("từ");
  await expect(page.getByTestId("writing-response")).toHaveAttribute("spellcheck", "false");
  await page.getByTestId("writing-task-2").click();
  await page.screenshot({ path: `${MEDIA}/writing-tasks.png` });
});

test("reload keeps the reading answer and about 30:00", async ({ page }) => {
  await reachReading(page);
  const answer = page.getByTestId("reading-questions").getByTestId("short-answer");
  await answer.fill("north");
  await fastForward(page, 30 * 60 * 1000);
  await expect.poll(async () => parseClock(await visibleTimer(page).innerText())).toBeLessThanOrEqual(30 * 60 + 5);
  const before = parseClock(await visibleTimer(page).innerText());
  expect(before).toBeGreaterThanOrEqual(29 * 60);
  await page.reload();
  await expect(page.getByTestId("reading-questions").getByTestId("short-answer")).toHaveValue("north");
  const after = parseClock(await visibleTimer(page).innerText());
  expect(after).toBeGreaterThanOrEqual(29 * 60);
  expect(after).toBeLessThanOrEqual(30 * 60 + 5);
  expect(after).not.toBe(60 * 60);
  await page.screenshot({ path: `${MEDIA}/reading-recovered.png` });
});

test("writing url during reading returns to reading", async ({ page }) => {
  await reachReading(page);
  await page.goto("/exam/writing");
  await expect(page).toHaveURL(/\/exam\/reading/);
  await expect(page.getByTestId("reading-passage")).toBeVisible();
  await page.screenshot({ path: `${MEDIA}/writing-guard.png` });
});

test("start test stays disabled until the access code and volume slider", async ({ page }) => {
  const started = await page.request.post("/api/e2e/bootstrap", { data: { phase: "pretest" } });
  expect(started.ok()).toBeTruthy();
  await page.goto("/exam/check");
  await expect(page.getByTestId("candidate-info")).toContainText("NGUYEN VAN A");
  await expect(page.getByTestId("candidate-info")).toContainText("Chưa có trên hồ sơ");
  const start = page.getByTestId("start-test");
  await expect(start).toBeDisabled();
  await page.getByTestId("volume-slider").fill("45");
  await expect(start).toBeDisabled();
  await page.getByTestId("access-code").fill("000000");
  await page.getByTestId("access-submit").click();
  await expect(page.getByRole("status")).toContainText("không đúng");
  await expect(start).toBeDisabled();
  await page.getByTestId("access-code").fill(ACCESS_CODE);
  await page.getByTestId("access-submit").click();
  await expect(start).toBeEnabled();
  await page.getByTestId("headphone-play").click();
});
