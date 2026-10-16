import { expect, type Page, test } from "@playwright/test";

const MEDIA = "/cursor/stores/bc-d6d6e118-e6a0-46c1-ad83-078ea6c49ef9/media";

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
  await expect(page.getByTestId("question-nav").getByRole("button")).toHaveCount(6);
  const table = page.getByTestId("form-table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row", { name: "Model" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Year" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Condition" })).toBeVisible();
  await expect(page.getByTestId("form-note")).toContainText("The seller lives in");
  await page.getByLabel("Model").fill("Corolla");
  await page.getByTestId("play-audio").click();
  await expect(page.getByTestId("exam-timer")).toHaveText("02:00");
  await expect(page.getByTestId("listening-phase")).toHaveText("Review");
  const submitted = page.waitForResponse(
    (response) => response.url().includes("/api/exam/submit") && response.request().method() === "POST",
  );
  await fastForward(page, 130_000);
  const body = (await (await submitted).json()) as { objective?: { items?: unknown; total?: number } };
  expect(body.objective?.items).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain("Anna");
  expect(body.objective?.total).toBe(6);
  await expect(page.getByTestId("paper-sent")).toHaveText("Bài đã được gửi.");
  await expect(page.getByTestId("raw-score")).toHaveCount(0);
  await expect(page.getByText("đáp án:")).toHaveCount(0);
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

test("empty library explains random draw and mix", async ({ page }) => {
  await page.goto("/exam?library=empty");
  await expect(page.getByTestId("exam-library-empty")).toBeVisible();
  await expect(page.getByTestId("random-exam-empty")).toContainText("Đề thi Ngẫu nhiên");
  await expect(page.getByTestId("practice-mix-empty")).toBeVisible();
  await expect(page.getByTestId("access-code")).toHaveCount(0);
  await expect(page.getByText("Travel, Journeys")).toHaveCount(0);
  await expect(page.getByTestId("exam-card")).toHaveCount(0);
});

test("pin opens an actual paper without an access code", async ({ page }) => {
  await page.goto("/exam");
  await page.getByTestId("tab-actual").click();
  await page.getByText("Actual Harbour Sitting").click();
  await page.getByTestId("pin-input").fill("1234");
  await page.getByTestId("pin-submit").click();
  await expect(page).toHaveURL(/\/exam\/check/);
  await expect(page.getByTestId("candidate-info")).toContainText("NGUYEN VAN A");
  await expect(page.getByTestId("access-code")).toHaveCount(0);
  await expect(page.getByTestId("headphone-play")).toBeVisible();
  const start = page.getByTestId("start-test");
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page).toHaveURL(/\/exam\/listening/);
});

test("forecast stays separate from actual and luyen tron", async ({ page }) => {
  await page.goto("/exam");
  await expect(page.getByTestId("practice-mix")).toBeVisible();
  await page.getByTestId("tab-forecast").click();
  await expect(page.getByText("Forecast: Daily Routines")).toBeVisible();
  await expect(page.getByText("Actual Harbour Sitting")).toHaveCount(0);
  await expect(page.getByTestId("practice-mix-empty")).toBeVisible();
  await page.getByTestId("tab-actual").click();
  await expect(page.getByText("Actual Harbour Sitting")).toBeVisible();
  await expect(page.getByText("Forecast: Daily Routines")).toHaveCount(0);
  await expect(page.getByTestId("practice-mix")).toBeVisible();
});

test("empty forecast tab waits for admin", async ({ page }) => {
  await page.goto("/exam?library=empty");
  await page.getByTestId("tab-forecast").click();
  await expect(page.getByTestId("forecast-empty")).toContainText("Admin xuất bản");
});

test("finished receipt shows bands and the listening key", async ({ page }) => {
  const started = await page.request.post("/api/e2e/bootstrap", { data: { phase: "done" } });
  expect(started.ok()).toBeTruthy();
  await page.goto("/exam/receipt");
  await expect(page.getByTestId("receipt-band-listening")).toHaveText("Band 7.0");
  await expect(page.getByTestId("receipt-score-listening")).toHaveText("30/40");
  await expect(page.getByTestId("receipt-estimate-listening")).toHaveCount(0);
  await expect(page.getByTestId("receipt-key-listening")).toContainText("đáp án: Anna");
  await expect(page.getByTestId("receipt-band-reading")).toHaveText("Band 7.0");
  await expect(page.getByTestId("receipt-note-writing")).toContainText("không được nhìn thấy");
  await expect(page.getByTestId("receipt-band-speaking")).toHaveText("Band 6.5");
  await expect(page.getByTestId("receipt-overall")).toHaveText("Điểm tổng 7.0");
  await page.screenshot({ path: `${MEDIA}/receipt-bands.png`, fullPage: true });
});

test("part 2 prepares in silence, then records", async ({ page }) => {
  const started = await page.request.post("/api/e2e/bootstrap", { data: { phase: "speaking" } });
  expect(started.ok()).toBeTruthy();
  await page.goto("/exam/room?preview=prep");
  await expect(page.getByTestId("speaking-part2-prep")).toBeVisible();
  await expect(page.getByTestId("speaking-part2-text")).toContainText("Describe a harbour or river you know.");
  await expect(page.getByTestId("speaking-part-progress")).toHaveText("Part 2");
  await expect(page.getByTestId("speaking-record-dot")).toHaveCount(0);
  await expect(page.getByTestId("recording-leave-guard")).toContainText("Bản ghi sẽ mất");
  await page.screenshot({ path: `${MEDIA}/speaking-part2-prep.png`, fullPage: true });

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.goto("/exam/room?preview=record");
  await expect(page.getByTestId("speaking-part2-recording")).toBeVisible();
  await expect(page.getByTestId("speaking-record-dot")).toBeVisible();
  await expect(page.getByTestId("speaking-level-meter")).toBeVisible();
  await expect(page.getByTestId("speaking-part2-timer")).toBeVisible();
  await page.screenshot({ path: `${MEDIA}/speaking-part2-recording.png`, fullPage: true });
});
