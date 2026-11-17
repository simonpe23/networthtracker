export type Category = {
  id: string;
  name: string;
  color: string;
  target: number;
};

export type Holding = {
  id: string;
  name: string;
  institution: string;
  categoryId: string;
  kind: "asset" | "debt";
  value: number;
  updatedAt: string;
};

export type SnapshotHolding = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  color: string;
  kind: "asset" | "debt";
  value: number;
  /** Percentage of total assets; debts have a zero share. */
  share: number;
};

export type Snapshot = {
  id: string;
  date: string;
  assets: number;
  debts: number;
  capturedAt?: string;
  kind?: "manual" | "daily";
  holdings?: SnapshotHolding[];
};

export type HoldingHistoryEntry = {
  snapshotId: string;
  date: string;
  capturedAt: string;
  kind: "manual" | "daily";
  value: number;
  share: number;
  name: string;
  categoryName: string;
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
};

export type Activity = {
  id: string;
  date: string;
  message: string;
  detail: string;
};

export type Portfolio = {
  version: 1;
  currency: string;
  holdings: Holding[];
  categories: Category[];
  snapshots: Snapshot[];
  activity: Activity[];
  isDemo: boolean;
};

export const STORAGE_KEY = "folio-portfolio-v1";

const defaultCategories = (): Category[] => [
  { id: "cash", name: "Cash", color: "#0b8f6b", target: 20 },
  { id: "index", name: "Index Funds", color: "#28625c", target: 40 },
  { id: "bitcoin", name: "Bitcoin", color: "#e2a358", target: 15 },
  { id: "property", name: "Real Estate", color: "#b8cd75", target: 20 },
  { id: "risk", name: "High Risk", color: "#a9beb3", target: 5 },
];

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = () => localDate(new Date());

function validCurrency(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    return Intl.supportedValuesOf("currency").includes(value);
  } catch {
    return [
      "USD",
      "EUR",
      "GBP",
      "SEK",
      "NOK",
      "DKK",
      "CAD",
      "AUD",
      "CHF",
      "JPY",
    ].includes(value);
  }
}

export function createEmptyPortfolio(currency = "USD"): Portfolio {
  return {
    version: 1,
    currency: validCurrency(currency) ? currency : "USD",
    holdings: [],
    categories: defaultCategories(),
    snapshots: [],
    activity: [],
    isDemo: false,
  };
}

export function totals(holdings: Holding[]) {
  let assets = 0;
  let debts = 0;
  for (const holding of holdings) {
    if (holding.kind === "debt") debts += holding.value;
    else assets += holding.value;
  }
  return { assets, debts, netWorth: assets - debts };
}

export function allocation(holdings: Holding[], categories: Category[]) {
  const { assets } = totals(holdings);
  return categories.map((category) => {
    const value = holdings.reduce(
      (sum, holding) =>
        sum +
        (holding.kind === "asset" && holding.categoryId === category.id
          ? holding.value
          : 0),
      0,
    );
    const targetValue = (assets * category.target) / 100;
    return {
      ...category,
      value,
      actual: assets ? (value / assets) * 100 : 0,
      targetValue,
      gap: targetValue - value,
    };
  });
}

function snapshotHoldings(portfolio: Portfolio): SnapshotHolding[] {
  const { assets } = totals(portfolio.holdings);
  return portfolio.holdings.map((holding) => {
    const category = portfolio.categories.find(
      (item) => item.id === holding.categoryId,
    );
    return {
      id: holding.id,
      name: holding.name,
      categoryId: holding.categoryId,
      categoryName:
        holding.kind === "debt" ? "Debt" : (category?.name ?? "Uncategorized"),
      color:
        holding.kind === "debt" ? "#a9beb3" : (category?.color ?? "#0b8f6b"),
      kind: holding.kind,
      value: holding.value,
      share:
        holding.kind === "asset" && assets ? (holding.value / assets) * 100 : 0,
    };
  });
}

function snapshotTime(snapshot: Snapshot) {
  return snapshot.capturedAt ?? `${snapshot.date.slice(0, 10)}T00:00:00.000Z`;
}

function sortSnapshots(snapshots: Snapshot[]) {
  return snapshots.sort(
    (a, b) => Date.parse(snapshotTime(a)) - Date.parse(snapshotTime(b)),
  );
}

function buildSnapshot(
  portfolio: Portfolio,
  date: Date,
  id: string,
  kind: "manual" | "daily",
): Snapshot {
  const current = totals(portfolio.holdings);
  return {
    id,
    date: localDate(date),
    capturedAt: date.toISOString(),
    kind,
    assets: current.assets,
    debts: current.debts,
    holdings: snapshotHoldings(portfolio),
  };
}

/** Maintain the current local day's working snapshot without changing explicit captures. */
export function recordSnapshot(portfolio: Portfolio): Portfolio {
  const now = new Date();
  const date = localDate(now);
  const isTodayDaily = (snapshot: Snapshot) =>
    snapshot.kind !== "manual" && snapshot.date.slice(0, 10) === date;
  const existing = portfolio.snapshots.find(isTodayDaily);
  const snapshot = buildSnapshot(
    portfolio,
    now,
    existing?.id ?? `snapshot-${date}`,
    "daily",
  );
  return {
    ...portfolio,
    snapshots: sortSnapshots([
      ...portfolio.snapshots.filter((item) => !isTodayDaily(item)),
      snapshot,
    ]),
  };
}

/** Save a point-in-time capture. Later balance, name, or category edits never change it. */
export function captureSnapshot(
  portfolio: Portfolio,
  date = new Date(),
): Portfolio {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const snapshot = buildSnapshot(
    portfolio,
    date,
    `manual-${date.getTime()}-${suffix}`,
    "manual",
  );
  return {
    ...portfolio,
    snapshots: sortSnapshots([...portfolio.snapshots, snapshot]),
  };
}

/** Legacy total-only snapshots cannot establish an individual holding's historical value. */
export function getHoldingHistory(
  portfolio: Portfolio,
  holdingId: string,
): HoldingHistoryEntry[] {
  const snapshots = sortSnapshots([...portfolio.snapshots]).filter(
    (snapshot) => snapshot.holdings !== undefined,
  );
  const current = portfolio.holdings.find(
    (holding) => holding.id === holdingId,
  );
  let metadata = snapshots
    .flatMap((snapshot) => snapshot.holdings ?? [])
    .find((holding) => holding.id === holdingId);
  if (!metadata && current)
    metadata = snapshotHoldings(portfolio).find(
      (holding) => holding.id === holdingId,
    );
  if (!metadata) return [];
  return snapshots.map((snapshot) => {
    const holding = snapshot.holdings!.find((item) => item.id === holdingId);
    if (holding) metadata = holding;
    return {
      snapshotId: snapshot.id,
      date: snapshot.date,
      capturedAt: snapshot.capturedAt ?? snapshot.date,
      kind: snapshot.kind ?? "daily",
      value: holding?.value ?? 0,
      share: holding?.share ?? 0,
      name: metadata!.name,
      categoryName: metadata!.categoryName,
      totalAssets: snapshot.assets,
      totalDebts: snapshot.debts,
      netWorth: snapshot.assets - snapshot.debts,
    };
  });
}

export function createDemoPortfolio(): Portfolio {
  const now = new Date();
  const date = today();
  const timestamp = now.toISOString();
  const portfolio: Portfolio = {
    ...createEmptyPortfolio(),
    isDemo: true,
    holdings: [
      {
        id: "savings",
        name: "High-yield savings",
        institution: "Marcus by Goldman Sachs",
        categoryId: "cash",
        kind: "asset",
        value: 42500,
        updatedAt: timestamp,
      },
      {
        id: "checking",
        name: "Everyday account",
        institution: "Chase",
        categoryId: "cash",
        kind: "asset",
        value: 8750,
        updatedAt: timestamp,
      },
      {
        id: "vanguard",
        name: "S&P 500 index fund",
        institution: "Vanguard · VOO",
        categoryId: "index",
        kind: "asset",
        value: 112400,
        updatedAt: timestamp,
      },
      {
        id: "btc",
        name: "Bitcoin",
        institution: "Cold wallet · BTC",
        categoryId: "bitcoin",
        kind: "asset",
        value: 46800,
        updatedAt: timestamp,
      },
      {
        id: "property",
        name: "Property investment",
        institution: "Real estate portfolio",
        categoryId: "property",
        kind: "asset",
        value: 62000,
        updatedAt: timestamp,
      },
      {
        id: "ventures",
        name: "Venture investments",
        institution: "Private investments",
        categoryId: "risk",
        kind: "asset",
        value: 14000,
        updatedAt: timestamp,
      },
      {
        id: "loan",
        name: "Student loan",
        institution: "Education loan",
        categoryId: "cash",
        kind: "debt",
        value: 24000,
        updatedAt: timestamp,
      },
    ],
    snapshots: [],
    activity: [
      {
        id: "demo-welcome",
        date: timestamp,
        message: "Welcome to your bigger picture",
        detail:
          "You are exploring an example portfolio. Start fresh whenever you are ready.",
      },
      {
        id: "demo-update",
        date: new Date(now.getTime() - 86400000).toISOString(),
        message: "S&P 500 index fund updated",
        detail: "Example balance updated to $112,400.",
      },
      {
        id: "demo-targets",
        date: new Date(now.getTime() - 3 * 86400000).toISOString(),
        message: "Allocation targets set",
        detail: "A little intention behind every investment.",
      },
    ],
  };
  // Illustrative historical balances belong to the clearly labeled example portfolio only.
  const growth = [
    0.7, 0.73, 0.72, 0.77, 0.79, 0.8, 0.84, 0.83, 0.88, 0.91, 0.94, 0.97,
  ];
  portfolio.snapshots = growth
    .map((factor, index) => {
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - 11 + index,
        0,
        12,
      );
      const snapshotDate = localDate(monthEnd);
      const assets = Math.round(286450 * factor);
      const debts = 24000 + (11 - index) * 450;
      let allocatedAssets = 0;
      const assetHoldings = portfolio.holdings.filter(
        (holding) => holding.kind === "asset",
      );
      const historicalHoldings = portfolio.holdings.map((holding) => {
        if (holding.kind === "debt") return { ...holding, value: debts };
        const last = holding.id === assetHoldings.at(-1)?.id;
        const value = last
          ? Math.round((assets - allocatedAssets) * 100) / 100
          : Math.round((holding.value / 286450) * assets * 100) / 100;
        allocatedAssets += value;
        return { ...holding, value };
      });
      return buildSnapshot(
        { ...portfolio, holdings: historicalHoldings },
        monthEnd,
        `demo-${snapshotDate}`,
        "daily",
      );
    })
    .filter((snapshot) => snapshot.date < date);
  return recordSnapshot(portfolio);
}

export function formatMoney(value: number, currency: string, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: validCurrency(currency) ? currency : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 2,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const string = (value: unknown): value is string => typeof value === "string";
const nonempty = (value: unknown): value is string =>
  string(value) && value.trim().length > 0;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const dateString = (value: unknown): value is string =>
  string(value) &&
  /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) &&
  Number.isFinite(Date.parse(value));
const uniqueIds = (values: Array<{ id: string }>) =>
  new Set(values.map((value) => value.id)).size === values.length;

function validSnapshot(value: unknown): value is Snapshot {
  if (
    !object(value) ||
    !nonempty(value.id) ||
    !dateString(value.date) ||
    !positive(value.assets) ||
    !positive(value.debts)
  )
    return false;
  if (
    value.capturedAt !== undefined &&
    (!dateString(value.capturedAt) || !value.capturedAt.includes("T"))
  )
    return false;
  if (
    value.kind !== undefined &&
    value.kind !== "manual" &&
    value.kind !== "daily"
  )
    return false;
  if (value.holdings !== undefined) {
    if (
      !Array.isArray(value.holdings) ||
      !value.holdings.every(
        (holding) =>
          object(holding) &&
          nonempty(holding.id) &&
          nonempty(holding.name) &&
          string(holding.categoryId) &&
          nonempty(holding.categoryName) &&
          string(holding.color) &&
          /^#[0-9a-fA-F]{6}$/.test(holding.color) &&
          (holding.kind === "asset" || holding.kind === "debt") &&
          positive(holding.value) &&
          positive(holding.share) &&
          holding.share <= 100.000001,
      )
    )
      return false;
    const holdings = value.holdings as SnapshotHolding[];
    if (!uniqueIds(holdings)) return false;
    const assets = holdings.reduce(
      (sum, holding) => sum + (holding.kind === "asset" ? holding.value : 0),
      0,
    );
    const debts = holdings.reduce(
      (sum, holding) => sum + (holding.kind === "debt" ? holding.value : 0),
      0,
    );
    const near = (a: number, b: number) =>
      Math.abs(a - b) <= Math.max(0.000001, Math.abs(b) * 1e-10);
    if (!near(assets, value.assets) || !near(debts, value.debts)) return false;
    if (
      holdings.some(
        (holding) =>
          !near(
            holding.share,
            holding.kind === "asset" && assets
              ? (holding.value / assets) * 100
              : 0,
          ),
      )
    )
      return false;
  }
  return true;
}

export function isPortfolio(value: unknown): value is Portfolio {
  if (
    !object(value) ||
    value.version !== 1 ||
    !validCurrency(value.currency) ||
    typeof value.isDemo !== "boolean"
  )
    return false;
  if (
    !Array.isArray(value.categories) ||
    !value.categories.every(
      (category) =>
        object(category) &&
        nonempty(category.id) &&
        nonempty(category.name) &&
        string(category.color) &&
        /^#[0-9a-fA-F]{6}$/.test(category.color) &&
        positive(category.target) &&
        category.target <= 100,
    )
  )
    return false;
  const categories = value.categories as Category[];
  if (
    !uniqueIds(categories) ||
    categories.reduce((sum, category) => sum + category.target, 0) > 100.001
  )
    return false;
  const ids = new Set(categories.map((category) => category.id));
  if (
    !Array.isArray(value.holdings) ||
    !value.holdings.every(
      (holding) =>
        object(holding) &&
        nonempty(holding.id) &&
        nonempty(holding.name) &&
        string(holding.institution) &&
        string(holding.categoryId) &&
        (holding.kind === "debt" ||
          (holding.kind === "asset" && ids.has(holding.categoryId))) &&
        positive(holding.value) &&
        dateString(holding.updatedAt),
    )
  )
    return false;
  if (!uniqueIds(value.holdings as Holding[])) return false;
  if (!Array.isArray(value.snapshots) || !value.snapshots.every(validSnapshot))
    return false;
  if (!uniqueIds(value.snapshots as Snapshot[])) return false;
  if (
    !Array.isArray(value.activity) ||
    !value.activity.every(
      (activity) =>
        object(activity) &&
        nonempty(activity.id) &&
        dateString(activity.date) &&
        string(activity.message) &&
        string(activity.detail),
    )
  )
    return false;
  return uniqueIds(value.activity as Activity[]);
}

export function loadPortfolio(storage?: Pick<Storage, "getItem">): Portfolio {
  try {
    const source =
      storage ??
      (typeof localStorage !== "undefined" ? localStorage : undefined);
    const raw = source?.getItem(STORAGE_KEY);
    if (raw) {
      const value = parsePortfolio(raw);
      if (value) return value;
    }
  } catch {
    // Browsers may refuse local storage. The UI still works in memory.
  }
  return createDemoPortfolio();
}

export function parsePortfolio(raw: string): Portfolio | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isPortfolio(value) ? value : null;
  } catch {
    return null;
  }
}
