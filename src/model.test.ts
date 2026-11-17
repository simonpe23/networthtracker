import test from "node:test";
import assert from "node:assert/strict";
import {
  allocation,
  captureSnapshot,
  createDemoPortfolio,
  createEmptyPortfolio,
  formatMoney,
  getHoldingHistory,
  isPortfolio,
  loadPortfolio,
  parsePortfolio,
  recordSnapshot,
  totals,
} from "./model.ts";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("assets and debt produce net worth without reducing the allocation denominator", () => {
  const portfolio = createEmptyPortfolio();
  const timestamp = new Date().toISOString();
  portfolio.holdings = [
    {
      id: "cash",
      name: "Cash",
      institution: "",
      categoryId: "cash",
      kind: "asset",
      value: 30000,
      updatedAt: timestamp,
    },
    {
      id: "index",
      name: "Index",
      institution: "",
      categoryId: "index",
      kind: "asset",
      value: 70000,
      updatedAt: timestamp,
    },
    {
      id: "debt",
      name: "Debt",
      institution: "",
      categoryId: "cash",
      kind: "debt",
      value: 20000,
      updatedAt: timestamp,
    },
  ];
  assert.deepEqual(totals(portfolio.holdings), {
    assets: 100000,
    debts: 20000,
    netWorth: 80000,
  });
  const cash = allocation(portfolio.holdings, portfolio.categories).find(
    (category) => category.id === "cash",
  )!;
  assert.equal(cash.actual, 30);
  assert.equal(cash.targetValue, 20000);
  assert.equal(cash.gap, -10000);
});

test("demo current snapshot matches its holdings and history is chronological", () => {
  const portfolio = createDemoPortfolio();
  assert.equal(isPortfolio(portfolio), true);
  assert.deepEqual(totals(portfolio.holdings), {
    assets: 286450,
    debts: 24000,
    netWorth: 262450,
  });
  assert.equal(portfolio.snapshots.at(-1)!.assets, 286450);
  assert.equal(portfolio.snapshots.at(-1)!.debts, 24000);
  assert.equal(portfolio.snapshots.at(-1)!.date, dateKey(new Date()));
  assert.ok(
    portfolio.snapshots.every(
      (snapshot, index) =>
        !index || snapshot.date > portfolio.snapshots[index - 1].date,
    ),
  );
});

test("empty portfolios have finite zero allocations", () => {
  const portfolio = createEmptyPortfolio();
  for (const category of allocation(portfolio.holdings, portfolio.categories)) {
    assert.equal(category.actual, 0);
    assert.equal(category.value, 0);
    assert.equal(category.gap, 0);
  }
  assert.equal(isPortfolio(portfolio), true);
});

test("recordSnapshot is immutable and replaces the current day", () => {
  const original = createDemoPortfolio();
  const previousSnapshot = original.snapshots.at(-1)!;
  const changed = {
    ...original,
    holdings: original.holdings.map((holding) =>
      holding.id === "checking" ? { ...holding, value: 9000 } : holding,
    ),
  };
  const recorded = recordSnapshot(changed);
  assert.equal(recorded.snapshots.length, original.snapshots.length);
  assert.equal(recorded.snapshots.at(-1)!.assets, 286700);
  assert.equal(recorded.snapshots.at(-1)!.id, previousSnapshot.id);
  assert.equal(original.snapshots.at(-1)!.assets, 286450);
  assert.notEqual(recorded.snapshots, original.snapshots);
});

test("local storage loads valid data and falls back safely for malformed or inaccessible data", () => {
  const empty = createEmptyPortfolio("EUR");
  assert.deepEqual(
    loadPortfolio({ getItem: () => JSON.stringify(empty) }),
    empty,
  );
  assert.equal(loadPortfolio({ getItem: () => "{broken" }).isDemo, true);
  assert.equal(
    loadPortfolio({
      getItem: () => {
        throw new Error("denied");
      },
    }).isDemo,
    true,
  );
  assert.equal(
    loadPortfolio({
      getItem: () => JSON.stringify({ ...empty, currency: "bad" }),
    }).isDemo,
    true,
  );
});

test("persistence validation rejects invalid numbers, duplicate IDs and dangling categories", () => {
  const portfolio = createDemoPortfolio();
  assert.equal(
    isPortfolio({
      ...portfolio,
      holdings: [{ ...portfolio.holdings[0], value: -1 }],
    }),
    false,
  );
  assert.equal(
    isPortfolio({
      ...portfolio,
      holdings: [{ ...portfolio.holdings[0], value: Infinity }],
    }),
    false,
  );
  assert.equal(
    isPortfolio({
      ...portfolio,
      holdings: [{ ...portfolio.holdings[0], categoryId: "missing" }],
    }),
    false,
  );
  assert.equal(
    isPortfolio({
      ...portfolio,
      categories: [...portfolio.categories, portfolio.categories[0]],
    }),
    false,
  );
});

test("a debt-only portfolio with no categories survives a JSON backup round trip", () => {
  const portfolio = createEmptyPortfolio();
  portfolio.categories = [];
  portfolio.holdings = [
    {
      id: "loan",
      name: "Loan",
      institution: "",
      categoryId: "",
      kind: "debt",
      value: 1250.75,
      updatedAt: new Date().toISOString(),
    },
  ];
  assert.equal(isPortfolio(portfolio), true);
  assert.deepEqual(parsePortfolio(JSON.stringify(portfolio)), portfolio);
  assert.deepEqual(totals(portfolio.holdings), {
    assets: 0,
    debts: 1250.75,
    netWorth: -1250.75,
  });
  assert.equal(
    isPortfolio({
      ...portfolio,
      holdings: [{ ...portfolio.holdings[0], kind: "asset" }],
    }),
    false,
  );
});

test("money displays preserve cents without adding decimals to whole balances", () => {
  assert.equal(formatMoney(1250, "USD"), "$1,250");
  assert.equal(formatMoney(1250.75, "USD"), "$1,250.75");
  assert.equal(formatMoney(0.01, "USD"), "$0.01");
  assert.equal(formatMoney(-1250.75, "USD"), "-$1,250.75");
  assert.equal(formatMoney(1250000, "USD", true), "$1.3M");
});

test("manual captures remain immutable while only today's daily snapshot is updated", () => {
  const portfolio = recordSnapshot(createDemoPortfolio());
  const daily = portfolio.snapshots.find(
    (snapshot) => snapshot.date === dateKey(new Date()),
  )!;
  const captured = captureSnapshot(captureSnapshot(portfolio));
  const manuals = captured.snapshots.filter(
    (snapshot) => snapshot.kind === "manual",
  );
  assert.equal(manuals.length, 2);
  assert.notEqual(manuals[0].id, manuals[1].id);
  const originals = JSON.stringify(manuals);
  const changed = recordSnapshot({
    ...captured,
    holdings: captured.holdings.map((holding) => ({
      ...holding,
      value: holding.value + 100,
    })),
  });
  assert.equal(changed.snapshots.length, captured.snapshots.length);
  assert.equal(
    changed.snapshots.find((snapshot) => snapshot.id === daily.id)!.assets,
    287050,
  );
  assert.equal(
    JSON.stringify(
      changed.snapshots.filter((snapshot) => snapshot.kind === "manual"),
    ),
    originals,
  );
  assert.equal(
    captured.snapshots.find((snapshot) => snapshot.id === daily.id)!.assets,
    286450,
  );
  assert.equal(isPortfolio(changed), true);
});

test("holding captures retain their original shares and metadata after edits and deletion", () => {
  const portfolio = createEmptyPortfolio();
  const updatedAt = new Date().toISOString();
  portfolio.holdings = [
    {
      id: "a",
      name: "Savings",
      institution: "",
      categoryId: "cash",
      kind: "asset",
      value: 30,
      updatedAt,
    },
    {
      id: "b",
      name: "Index",
      institution: "",
      categoryId: "index",
      kind: "asset",
      value: 70,
      updatedAt,
    },
    {
      id: "loan",
      name: "Loan",
      institution: "",
      categoryId: "",
      kind: "debt",
      value: 200,
      updatedAt,
    },
  ];
  const initial = captureSnapshot(portfolio, new Date("2026-01-01T12:00:00Z"));
  const edited = captureSnapshot(
    {
      ...initial,
      holdings: initial.holdings.map((holding) =>
        holding.id === "a"
          ? {
              ...holding,
              name: "Renamed savings",
              categoryId: "bitcoin",
              value: 90,
            }
          : holding.id === "b"
            ? { ...holding, value: 10 }
            : holding,
      ),
    },
    new Date("2026-02-01T12:00:00Z"),
  );
  const deleted = captureSnapshot(
    {
      ...edited,
      holdings: edited.holdings.filter((holding) => holding.id !== "a"),
    },
    new Date("2026-03-01T12:00:00Z"),
  );
  const history = getHoldingHistory(deleted, "a");
  assert.deepEqual(
    history.map(({ value, share }) => ({ value, share })),
    [
      { value: 30, share: 30 },
      { value: 90, share: 90 },
      { value: 0, share: 0 },
    ],
  );
  assert.equal(history[0].name, "Savings");
  assert.equal(history[0].categoryName, "Cash");
  assert.equal(history[1].name, "Renamed savings");
  assert.equal(history[1].categoryName, "Bitcoin");
  assert.equal(history[2].name, "Renamed savings");
  assert.equal(history[0].netWorth, -100);
  assert.equal(history[2].totalAssets, 10);
  assert.equal(getHoldingHistory(deleted, "loan")[0].share, 0);
  assert.equal(isPortfolio(deleted), true);
});

test("zero-asset snapshots have finite shares and retain negative net worth", () => {
  const portfolio = createEmptyPortfolio();
  portfolio.holdings = [
    {
      id: "loan",
      name: "Loan",
      institution: "",
      categoryId: "",
      kind: "debt",
      value: 500,
      updatedAt: new Date().toISOString(),
    },
  ];
  const captured = captureSnapshot(portfolio);
  assert.equal(captured.snapshots[0].holdings![0].share, 0);
  assert.equal(getHoldingHistory(captured, "loan")[0].netWorth, -500);
  assert.equal(isPortfolio(captured), true);
  const empty = captureSnapshot(createEmptyPortfolio());
  assert.deepEqual(empty.snapshots[0].holdings, []);
  assert.equal(isPortfolio(empty), true);
});

test("legacy total-only backups stay valid without inventing per-holding history", () => {
  const portfolio = createDemoPortfolio();
  const legacy = {
    ...portfolio,
    snapshots: portfolio.snapshots.map(({ id, date, assets, debts }) => ({
      id,
      date,
      assets,
      debts,
    })),
  };
  assert.deepEqual(parsePortfolio(JSON.stringify(legacy)), legacy);
  assert.deepEqual(getHoldingHistory(legacy, "savings"), []);
  const captured = captureSnapshot(legacy);
  assert.equal(getHoldingHistory(captured, "savings").length, 1);
  const recorded = recordSnapshot(legacy);
  assert.equal(recorded.snapshots.length, legacy.snapshots.length);
  assert.equal(getHoldingHistory(recorded, "savings").length, 1);
});

test("snapshot validation rejects invalid optional metadata and inconsistent breakdowns", () => {
  const portfolio = captureSnapshot(createDemoPortfolio());
  const snapshot = portfolio.snapshots.at(-1)!;
  for (const invalid of [
    { ...snapshot, capturedAt: "not-a-date" },
    { ...snapshot, kind: "weekly" },
    { ...snapshot, holdings: null },
    { ...snapshot, holdings: [{ ...snapshot.holdings![0], share: 101 }] },
    {
      ...snapshot,
      holdings: snapshot.holdings!.map((holding, index) =>
        index === 0 ? { ...holding, share: 0 } : holding,
      ),
    },
    { ...snapshot, assets: snapshot.assets + 1 },
  ])
    assert.equal(isPortfolio({ ...portfolio, snapshots: [invalid] }), false);
  assert.deepEqual(parsePortfolio(JSON.stringify(portfolio)), portfolio);
});

test("illustrative demo holding histories match their snapshot totals", () => {
  const portfolio = createDemoPortfolio();
  assert.equal(
    getHoldingHistory(portfolio, "savings").length,
    portfolio.snapshots.length,
  );
  for (const snapshot of portfolio.snapshots) {
    const assets = snapshot.holdings!.filter(
      (holding) => holding.kind === "asset",
    );
    const debts = snapshot.holdings!.filter(
      (holding) => holding.kind === "debt",
    );
    assert.ok(
      Math.abs(
        assets.reduce((sum, holding) => sum + holding.value, 0) -
          snapshot.assets,
      ) < 0.000001,
    );
    assert.equal(
      debts.reduce((sum, holding) => sum + holding.value, 0),
      snapshot.debts,
    );
    assert.ok(
      Math.abs(assets.reduce((sum, holding) => sum + holding.share, 0) - 100) <
        0.000001,
    );
  }
});
