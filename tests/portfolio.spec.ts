import { test, expect, type Locator, type Page } from "@playwright/test";
import { createDemoPortfolio, STORAGE_KEY } from "../src/model";

async function nav(
  page: Page,
  name: "Holdings" | "Allocation" | "History" | "Settings",
) {
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function fresh(page: Page) {
  await page.getByRole("button", { name: "Example portfolio" }).click();
  await page.getByRole("button", { name: "Start my portfolio" }).click();
}
async function add(page: Page, name: string, value: string, debt = false) {
  await page
    .getByRole("button", { name: "Add holding", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  if (debt)
    await dialog.getByRole("button", { name: "Debt", exact: true }).click();
  await dialog.getByLabel("Holding name").fill(name);
  await dialog.getByLabel("Current balance").fill(value);
  await dialog
    .getByRole("button", { name: "Add holding", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
}
async function fontSize(locator: Locator) {
  return locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}
async function contrast(locator: Locator) {
  return locator.evaluate((el) => {
    const rgba = (s: string) => {
      const values = s.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const combine = (f: number[], b: number[]) =>
      f.slice(0, 3).map((v, i) => v * f[3] + b[i] * (1 - f[3]));
    const parents: Element[] = [];
    for (let node: Element | null = el; node; node = node.parentElement)
      parents.push(node);
    let bg = [255, 255, 255];
    for (const node of parents.reverse())
      bg = combine(rgba(getComputedStyle(node).backgroundColor), bg);
    const fg = combine(rgba(getComputedStyle(el).color), bg);
    const lum = (rgb: number[]) =>
      rgb
        .map((c) => {
          const n = c / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = lum(fg),
      b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test("clear holdings first dashboard and readable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your portfolio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".net-worth-value")).toContainText("$262,450");
  await expect(page.locator(".summary-value").first()).toContainText(
    "$286,450",
  );
  await expect(page.locator(".summary-value").last()).toContainText("$24,000");
  await expect(page.locator(".holdings-panel")).toBeVisible();
  const tablePosition = await page.locator(".holdings-panel").boundingBox();
  const chartPosition = await page.locator(".overview-charts").boundingBox();
  expect(tablePosition!.y + tablePosition!.height).toBeLessThan(
    chartPosition!.y,
  );
  expect(
    await fontSize(page.locator(".holding-name").first()),
  ).toBeGreaterThanOrEqual(16);
  expect(
    await fontSize(page.locator(".holding-value").first()),
  ).toBeGreaterThanOrEqual(18);
  expect(
    await fontSize(page.locator(".holding-share strong").first()),
  ).toBeGreaterThanOrEqual(16);
  for (const selector of [
    ".holding-name",
    ".holding-value",
    ".holding-share strong",
    ".holding-institution",
    ".holdings-table th",
  ]) {
    expect(
      await contrast(page.locator(selector).first()),
      `${selector} contrast`,
    ).toBeGreaterThanOrEqual(4.5);
  }
  await page
    .getByRole("button", { name: "Add holding", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  for (const label of await dialog.locator(".form-label").all()) {
    expect(await fontSize(label)).toBeGreaterThanOrEqual(16);
    expect(await contrast(label)).toBeGreaterThanOrEqual(4.5);
  }
  for (const input of await dialog
    .locator("input:visible, select:visible")
    .all()) {
    expect(await fontSize(input)).toBeGreaterThanOrEqual(16);
    expect(await contrast(input)).toBeGreaterThanOrEqual(4.5);
  }
  await dialog.getByLabel("Holding name").fill("Test keyboard entry");
  await dialog.getByLabel("Current balance").fill("123.45");
  await expect(dialog.getByLabel("Holding name")).toHaveValue(
    "Test keyboard entry",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("holdings CRUD, correct debt denominator, filters and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await fresh(page);
  await expect(page.locator(".net-worth-value")).toContainText("$0");
  await add(page, "My savings", "100000");
  await add(page, "My investments", "50000");
  await add(page, "Loan", "20000", true);
  await expect(page.locator(".net-worth-value")).toContainText("$130,000");
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("button", { name: "My savings", exact: true }),
    }),
  ).toContainText("66.7%");
  await page.reload();
  await expect(page.locator(".net-worth-value")).toContainText("$130,000");
  await page.getByLabel("Edit My savings", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Current balance")
    .fill("120000.50");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".net-worth-value")).toContainText("$150,000.5");
  await page.getByLabel("Search holdings").fill("investments");
  await expect(page.locator(".holdings-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Search holdings").clear();
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(page.locator(".holdings-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "All holdings", exact: true }).click();
  await page.getByLabel("Edit My savings", { exact: true }).click();
  await page.getByLabel("Delete holding", { exact: true }).click();
  await page
    .getByRole("button", { name: "Delete holding", exact: true })
    .click();
  await expect(page.locator(".net-worth-value")).toContainText("$30,000");
});

test("bulk balances, category targets, currency and balance privacy", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Update balances", exact: true })
    .click();
  await page.getByLabel("High-yield savings balance").fill("50000");
  await page.getByRole("button", { name: "Save balances" }).click();
  await expect(page.locator(".net-worth-value")).toContainText("$269,950");
  await page.getByLabel("Hide balances", { exact: true }).click();
  await expect(page.locator(".net-worth-value")).not.toContainText("269,950");
  await page.getByLabel("Show balances", { exact: true }).click();
  await nav(page, "Settings");
  await page.getByLabel("Display currency").selectOption("EUR");
  await nav(page, "Holdings");
  await expect(page.locator(".net-worth-value")).toContainText("€269,950");
  await nav(page, "Allocation");
  await page
    .getByRole("button", { name: "Edit categories & targets", exact: true })
    .click();
  await page.getByLabel("Target for Cash", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Save targets" }).click();
  await expect(page.getByRole("alert")).toContainText("100%");
  await page.getByLabel("Target for Index Funds", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category 6 name").fill("Gold");
  await page.getByLabel("Target for Gold", { exact: true }).fill("5");
  await page.getByLabel("Target for High Risk", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save targets" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(".allocation-row").filter({ hasText: "Gold" }),
  ).toContainText("5%");
  await page.reload();
  await nav(page, "Allocation");
  await expect(
    page.locator(".allocation-row").filter({ hasText: "Gold" }),
  ).toContainText("5%");
});

test("manual snapshots preserve multiple same-day balances and per-holding shares after deletion", async ({
  page,
}) => {
  await page.goto("/");
  await fresh(page);
  await add(page, "My savings", "100000");
  await add(page, "My investments", "50000");
  await add(page, "Loan", "20000", true);
  await page
    .getByRole("button", { name: "Take snapshot", exact: true })
    .first()
    .click();
  const firstManual = (await stored(page)).snapshots.find(
    (s: any) => s.kind === "manual",
  );
  expect(
    firstManual.holdings.find((h: any) => h.name === "My savings").share,
  ).toBeCloseTo(66.6667, 3);
  await page.getByLabel("Edit My savings", { exact: true }).click();
  await page.getByRole("dialog").getByLabel("Current balance").fill("120000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Take snapshot", exact: true })
    .first()
    .click();
  const after = await stored(page);
  const manuals = after.snapshots.filter((s: any) => s.kind === "manual");
  expect(manuals).toHaveLength(2);
  expect(manuals[0]).toEqual(firstManual);
  expect(manuals[0].assets - manuals[0].debts).toBe(130000);
  expect(manuals[1].assets - manuals[1].debts).toBe(150000);
  const holdingId = after.holdings.find((h: any) => h.name === "My savings").id;
  await nav(page, "History");
  const savedRows = page
    .locator(".snapshot-table tbody > tr")
    .filter({ hasText: "Saved snapshot" });
  await expect(savedRows).toHaveCount(2);
  await savedRows
    .filter({ hasText: "$130,000" })
    .getByRole("button", { name: /^View snapshot/ })
    .click();
  const oldSaving = page
    .locator(".snapshot-detail-row")
    .filter({ hasText: "My savings" });
  await expect(oldSaving).toContainText("$100,000");
  await expect(oldSaving).toContainText("66.7%");
  await page.getByLabel("History for").selectOption(holdingId);
  await expect(page.locator(".snapshot-share")).toContainText([
    "70.6%",
    "70.6%",
    "66.7%",
  ]);
  await page
    .getByRole("button", { name: "Portfolio share", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "My savings share of assets over time",
      exact: true,
    }),
  ).toBeVisible();
  await nav(page, "Holdings");
  await page.getByLabel("Edit My savings", { exact: true }).click();
  await page.getByLabel("Delete holding", { exact: true }).click();
  await page
    .getByRole("button", { name: "Delete holding", exact: true })
    .click();
  await nav(page, "History");
  await page.getByLabel("History for").selectOption(holdingId);
  await expect(
    page.getByLabel("History for").locator("option:checked"),
  ).toHaveText("My savings (removed)");
  await expect(page.locator(".snapshot-share")).toContainText([
    "0%",
    "70.6%",
    "66.7%",
  ]);
  await expect(page.locator(".snapshot-net-worth")).toContainText([
    "$0",
    "$120,000",
    "$100,000",
  ]);
  await page.reload();
  await nav(page, "History");
  await page.getByLabel("History for").selectOption(holdingId);
  await expect(page.locator(".snapshot-share")).toContainText([
    "0%",
    "70.6%",
    "66.7%",
  ]);
});

test("old backups retain portfolio totals without fabricating holding history", async ({
  page,
}) => {
  const legacy = createDemoPortfolio();
  legacy.isDemo = false;
  legacy.snapshots = legacy.snapshots.map(({ id, date, assets, debts }) => ({
    id,
    date,
    assets,
    debts,
  }));
  await page.goto("/");
  await nav(page, "Settings");
  await page.getByLabel("Import SP Net Worth Tracker backup").setInputFiles({
    name: "old-folio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.getByRole("status")).toContainText("Portfolio restored");
  await nav(page, "History");
  await expect(page.locator(".snapshot-net-worth")).toHaveCount(
    legacy.snapshots.length,
  );
  await page
    .getByRole("button", { name: /^View snapshot/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Portfolio totals only", exact: true }),
  ).toBeVisible();
  await page.getByLabel("History for").selectOption("savings");
  await expect(
    page.getByRole("heading", {
      name: "No recorded history for this holding yet",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".history-stat").first().locator("strong"),
  ).toHaveText("—");
  await expect(
    page.locator(".history-stat").nth(1).locator("strong"),
  ).toHaveText("—");
  await expect(page.locator(".snapshot-net-worth")).toHaveCount(0);
  await nav(page, "Settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page
    .getByLabel("Import SP Net Worth Tracker backup")
    .setInputFiles(path!);
  expect((await stored(page)).snapshots).toEqual(legacy.snapshots);
  await page.getByLabel("Import SP Net Worth Tracker backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"broken":true}'),
  });
  await expect(page.getByRole("status")).toContainText("Unable to import");
  expect((await stored(page)).snapshots).toEqual(legacy.snapshots);
});

test("responsive pages, chart metrics and range controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const allPoints = await page.locator(".wealth-chart-point").count();
  await page.getByLabel("Chart metric").selectOption("assets");
  await expect(
    page.getByRole("img", { name: "Total assets over time", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3M", exact: true }).click();
  expect(await page.locator(".wealth-chart-point").count()).toBeLessThan(
    allPoints,
  );
  await page.getByLabel("Chart metric").selectOption("debts");
  await expect(
    page.getByRole("img", { name: "Total debts over time", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1Y", exact: true }).click();
  await page.getByLabel("Chart metric").selectOption("netWorth");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of [
      "Holdings",
      "Allocation",
      "History",
      "Settings",
    ] as const) {
      await nav(page, view);
      await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    }
    await nav(page, "Holdings");
    await page
      .getByRole("button", { name: "Add holding", exact: true })
      .first()
      .click();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    if (width === 390) {
      for (const input of await page
        .getByRole("dialog")
        .locator("input:visible,select:visible")
        .all())
        expect(await fontSize(input)).toBeGreaterThanOrEqual(16);
      await page.screenshot({
        path: "/workspace/folio-v2-mobile-modal.png",
        animations: "disabled",
      });
    }
    await page.getByLabel("Close dialog").click();
    await nav(page, "Allocation");
    await page
      .getByRole("button", { name: "Edit categories & targets", exact: true })
      .click();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    for (const input of await page
      .getByRole("dialog")
      .locator("input:not([type=color]):visible")
      .all())
      expect(await fontSize(input)).toBeGreaterThanOrEqual(16);
    for (const nameInput of await page
      .getByRole("dialog")
      .locator(".category-name-input")
      .all()) {
      expect((await nameInput.boundingBox())!.width).toBeGreaterThanOrEqual(
        140,
      );
    }
    if (width === 390)
      await page.screenshot({
        path: "/workspace/folio-v2-mobile-targets.png",
        animations: "disabled",
      });
    await page.getByLabel("Close dialog").click();
  }
  await nav(page, "Holdings");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/workspace/folio-v2-preview.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/workspace/folio-v2-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
