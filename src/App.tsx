import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bitcoin,
  Building2,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  History,
  CreditCard,
  Leaf,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { AllocationChart, WealthChart } from "./Charts";
import { BalancesModal, HoldingModal, Modal, TargetsModal } from "./Forms";
import HistoryView from "./HistoryView";
import {
  allocation,
  captureSnapshot,
  createDemoPortfolio,
  createEmptyPortfolio,
  formatMoney,
  formatPercent,
  loadPortfolio,
  parsePortfolio,
  recordSnapshot,
  STORAGE_KEY,
  totals,
} from "./model";
import type { Holding, Portfolio } from "./model";

type View = "Holdings" | "Allocation" | "History" | "Settings";
type Dialog =
  | { type: "holding"; holding?: Holding }
  | { type: "balances" }
  | { type: "targets" }
  | { type: "fresh" }
  | null;
const CURRENCIES = [
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
];
const viewInfo: Record<View, { title: string; description: string }> = {
  Holdings: {
    title: "Your portfolio",
    description: "What you own. What you owe. Where it all goes.",
  },
  Allocation: {
    title: "Find your balance",
    description: "See where your money is, and where you want it to be.",
  },
  History: {
    title: "Your portfolio over time",
    description: "Keep a record of your wealth, down to every holding.",
  },
  Settings: {
    title: "Settings",
    description: "Your preferences and your data.",
  },
};
const dateLabel = (date: string) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );
function AssetIcon({ name }: { name: string }) {
  const Icon = /debt|loan/i.test(name)
    ? CreditCard
    : /bitcoin|crypto/i.test(name)
      ? Bitcoin
      : /estate|property/i.test(name)
        ? Building2
        : /cash|saving|account/i.test(name)
          ? Wallet
          : BarChart3;
  return <Icon size={22} strokeWidth={1.8} />;
}

export default function App() {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => loadPortfolio());
  const [view, setView] = useState<View>("Holdings");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [range, setRange] = useState("1Y");
  const [series, setSeries] = useState<"netWorth" | "assets" | "debts">(
    "netWorth",
  );
  const [hidden, setHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All holdings");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [historyHolding, setHistoryHolding] = useState<string | undefined>(
    undefined,
  );
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [portfolio]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const current = totals(portfolio.holdings);
  const categories = allocation(portfolio.holdings, portfolio.categories);
  const currencies = [...new Set([...CURRENCIES, portfolio.currency])];
  const money = (value: number) =>
    hidden ? "••••••" : formatMoney(value, portfolio.currency);
  const snapshots = [...portfolio.snapshots].sort((a, b) =>
    (a.capturedAt || a.date).localeCompare(b.capturedAt || b.date),
  );
  const first = snapshots[0];
  const change = first ? current.netWorth - (first.assets - first.debts) : 0;
  const firstValue = first ? first.assets - first.debts : 0;
  const changePercent = firstValue ? (change / Math.abs(firstValue)) * 100 : 0;
  const latestManual = [...snapshots]
    .reverse()
    .find((s) => s.kind === "manual");
  const selectView = (next: View) => {
    setView(next);
    if (next === "History") setHistoryHolding(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewHoldingHistory = (holding: Holding) => {
    setHistoryHolding(holding.id);
    setView("History");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const update = (
    fn: (p: Portfolio) => Portfolio,
    message: string,
    detail: string,
  ) => {
    setPortfolio((p) =>
      recordSnapshot({
        ...fn(p),
        activity: [
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            message,
            detail,
          },
          ...p.activity,
        ].slice(0, 500),
      }),
    );
    setToast(message);
  };
  const takeSnapshot = () => {
    setPortfolio((p) => {
      const next = captureSnapshot(p);
      return {
        ...next,
        activity: [
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            message: "Snapshot saved",
            detail: `Net worth ${formatMoney(current.netWorth, p.currency)} · ${p.holdings.length} holdings captured`,
          },
          ...p.activity,
        ].slice(0, 500),
      };
    });
    setToast("Snapshot saved — balances and portfolio percentages captured.");
  };
  const saveHolding = (holding: Holding, edit: boolean) => {
    update(
      (p) => ({
        ...p,
        holdings: edit
          ? p.holdings.map((h) => (h.id === holding.id ? holding : h))
          : [...p.holdings, holding],
      }),
      edit ? "Holding updated" : "Holding added",
      `${holding.name} · ${formatMoney(holding.value, portfolio.currency)}`,
    );
    setDialog(null);
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(portfolio, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sp-net-worth-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Portfolio backup downloaded");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const data = parsePortfolio(await file.text());
      if (!data) throw new Error();
      setPortfolio(data);
      setToast("Portfolio restored from backup");
    } catch {
      setToast(
        "Unable to import. Choose a valid SP Net Worth Tracker JSON backup.",
      );
    }
    if (importRef.current) importRef.current.value = "";
  };
  const filtered = portfolio.holdings.filter((h) => {
    const category = portfolio.categories.find((c) => c.id === h.categoryId);
    return (
      `${h.name} ${h.institution} ${category?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All holdings" ||
        (filter === "Assets" && h.kind === "asset") ||
        (filter === "Debts" && h.kind === "debt")) &&
      (categoryFilter === "all" || categoryFilter === h.categoryId)
    );
  });
  const assetCount = portfolio.holdings.filter(
    (h) => h.kind === "asset",
  ).length;
  const debtCount = portfolio.holdings.length - assetCount;
  return (
    <div className="app">
      <header className="site-header">
        <div className="header-inner">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              selectView("Holdings");
            }}
            aria-label="SP Net Worth Tracker home"
          >
            <span className="brand-initials">SP</span>
            <span className="brand-name">Net Worth Tracker</span>
          </a>
          <nav aria-label="Main navigation">
            {(["Holdings", "Allocation", "History"] as View[]).map((name) => (
              <button
                key={name}
                className={view === name ? "active" : ""}
                aria-current={view === name ? "page" : undefined}
                onClick={() => selectView(name)}
              >
                {name === "Holdings" ? (
                  <Wallet size={19} />
                ) : name === "Allocation" ? (
                  <Target size={19} />
                ) : (
                  <History size={19} />
                )}
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button header-icon"
              aria-label={hidden ? "Show balances" : "Hide balances"}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
            <button
              className={`icon-button header-icon ${view === "Settings" ? "active" : ""}`}
              aria-label="Settings"
              onClick={() => selectView("Settings")}
            >
              <Settings2 size={21} />
            </button>
            <span className="profile-circle">S</span>
          </div>
        </div>
      </header>
      <main className="main-content">
        <div className="page-heading">
          <div>
            <h1>{viewInfo[view].title}</h1>
            {view !== "Holdings" && <p>{viewInfo[view].description}</p>}
          </div>
          <div className="page-actions">
            {portfolio.isDemo && (
              <button
                className="demo-badge"
                onClick={() => setDialog({ type: "fresh" })}
              >
                Example portfolio <ArrowUpRight size={16} />
              </button>
            )}
            {view === "Holdings" ? (
              <button className="button snapshot-button" onClick={takeSnapshot}>
                <Camera size={19} />
                Take snapshot
              </button>
            ) : view === "Allocation" ? (
              <button
                className="button primary"
                onClick={() => setDialog({ type: "targets" })}
              >
                <SlidersHorizontal size={19} />
                Edit categories & targets
              </button>
            ) : null}
          </div>
        </div>
        {storageError && (
          <div className="notice error" role="alert">
            Your browser couldn’t save the latest changes. Export a backup
            before closing this page.
          </div>
        )}
        {view === "Holdings" && (
          <>
            <section
              className="portfolio-summary"
              aria-label="Portfolio totals"
            >
              <div className="net-worth-overview">
                <p className="summary-label">
                  Net worth <span>{portfolio.currency}</span>
                </p>
                <div className="net-worth-value">{money(current.netWorth)}</div>
                <div className="metric-detail">
                  {snapshots.length > 1 ? (
                    <>
                      <span
                        className={
                          change >= 0 ? "change-positive" : "change-negative"
                        }
                      >
                        {change >= 0 ? (
                          <ArrowUpRight size={17} />
                        ) : (
                          <ArrowDownLeft size={17} />
                        )}{" "}
                        {hidden
                          ? "•••"
                          : `${change >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`}
                      </span>
                      <span>since {dateLabel(first.date)}</span>
                    </>
                  ) : (
                    <span>Assets minus debts</span>
                  )}
                </div>
              </div>
              <dl className="total-breakdown">
                <div>
                  <dt>Total assets</dt>
                  <dd className="summary-value">{money(current.assets)}</dd>
                </div>
                <div>
                  <dt>Total debts</dt>
                  <dd className="summary-value">{money(current.debts)}</dd>
                </div>
              </dl>
            </section>
            <section
              className="panel holdings-panel"
              aria-labelledby="holdings-title"
            >
              <div className="panel-header holdings-header">
                <div>
                  <div className="section-title">
                    <h2 id="holdings-title">Your holdings</h2>
                    <span className="count-badge">
                      {portfolio.holdings.length}
                    </span>
                  </div>
                </div>
                <div className="section-actions">
                  <button
                    className="button secondary"
                    onClick={() => setDialog({ type: "balances" })}
                    disabled={!portfolio.holdings.length}
                  >
                    <ArrowLeftRight size={18} />
                    Update balances
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setDialog({ type: "holding" })}
                  >
                    <Plus size={19} />
                    Add holding
                  </button>
                </div>
              </div>
              <div className="holdings-toolbar">
                <div className="segmented-control" aria-label="Filter holdings">
                  {["All holdings", "Assets", "Debts"].map((item) => (
                    <button
                      className={filter === item ? "selected" : ""}
                      aria-pressed={filter === item}
                      key={item}
                      onClick={() => setFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="holdings-search-tools">
                  <label className="category-filter">
                    <span className="sr-only">Filter by category</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {portfolio.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </label>
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      aria-label="Search holdings"
                      placeholder="Search holdings"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="table-scroll">
                <table className="holdings-table">
                  <thead>
                    <tr>
                      <th>Holding</th>
                      <th>Category</th>
                      <th className="align-right">Current value</th>
                      <th className="share-header">% of assets</th>
                      <th className="align-right actions-heading">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((h) => {
                      const c = portfolio.categories.find(
                        (c) => c.id === h.categoryId,
                      );
                      const share = current.assets
                        ? (h.value / current.assets) * 100
                        : 0;
                      return (
                        <tr key={h.id}>
                          <td>
                            <div className="holding-identity">
                              <span
                                className={`holding-icon ${h.kind === "debt" ? "debt" : ""}`}
                              >
                                <AssetIcon
                                  name={
                                    h.kind === "debt"
                                      ? "loan"
                                      : c?.name || h.name
                                  }
                                />
                              </span>
                              <div>
                                <button
                                  className="holding-name"
                                  onClick={() => viewHoldingHistory(h)}
                                  title={`View history for ${h.name}`}
                                >
                                  {h.name}
                                </button>
                                <span className="holding-institution">
                                  {h.institution || "Manual entry"}
                                </span>
                                <span className="mobile-category">
                                  {h.kind === "debt" ? "Debt" : c?.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`category-pill ${h.kind === "debt" ? "debt" : ""}`}
                            >
                              <i
                                style={{
                                  background:
                                    h.kind === "debt" ? "#9b623c" : c?.color,
                                }}
                              />
                              {h.kind === "debt"
                                ? "Debt"
                                : c?.name || "Uncategorized"}
                            </span>
                          </td>
                          <td
                            className={`holding-value align-right ${h.kind === "debt" ? "debt-value" : ""}`}
                          >
                            {h.kind === "debt" ? "− " : ""}
                            {money(h.value)}
                          </td>
                          <td>
                            <div className="holding-share">
                              <strong>
                                {h.kind === "debt" ? "—" : formatPercent(share)}
                              </strong>
                              {h.kind === "asset" && (
                                <div className="share-track">
                                  <span style={{ width: `${share}%` }} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`View history for ${h.name}`}
                              title="View history"
                              onClick={() => viewHoldingHistory(h)}
                            >
                              <History size={19} />
                            </button>
                            <button
                              className="edit-button"
                              aria-label={`Edit ${h.name}`}
                              onClick={() =>
                                setDialog({ type: "holding", holding: h })
                              }
                            >
                              <Pencil size={16} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <Wallet size={36} />
                  <h3>
                    {portfolio.holdings.length
                      ? "No matching holdings"
                      : "Add your first holding"}
                  </h3>
                  <p>
                    {portfolio.holdings.length
                      ? "Try a different search or category."
                      : "Start with your bank balance, an investment, or a debt."}
                  </p>
                  <button
                    className="button primary"
                    onClick={() =>
                      portfolio.holdings.length
                        ? (setSearch(""),
                          setFilter("All holdings"),
                          setCategoryFilter("all"))
                        : setDialog({ type: "holding" })
                    }
                  >
                    {portfolio.holdings.length
                      ? "Clear filters"
                      : "Add holding"}
                    <Plus size={18} />
                  </button>
                </div>
              )}
              <div className="holdings-footer">
                <span>
                  <ShieldCheck size={16} />
                  Saved in this browser
                </span>
                <span>Percentages use total assets, before debts.</span>
              </div>
            </section>
            <div className="snapshot-strip">
              <span className="snapshot-strip-icon">
                <Camera size={22} />
              </span>
              <div>
                <strong>
                  {latestManual
                    ? "Your latest saved snapshot"
                    : "Save a moment in your financial history"}
                </strong>
                <p>
                  {latestManual
                    ? `${dateLabel(latestManual.capturedAt || latestManual.date)} · Holdings and allocation captured`
                    : "Capture today’s net worth, each balance, and every asset’s percentage."}
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => selectView("History")}
              >
                View history <ArrowRight size={18} />
              </button>
            </div>
            <div className="overview-charts">
              <section className="panel trend-panel">
                <div className="panel-header">
                  <div>
                    <h2>How your wealth changes</h2>
                    <p>
                      {portfolio.isDemo
                        ? "Example data includes illustrative history."
                        : "Your recorded balances over time."}
                    </p>
                  </div>
                  <div className="range-tabs" aria-label="Chart time range">
                    {["1M", "3M", "6M", "1Y", "ALL"].map((r) => (
                      <button
                        key={r}
                        className={range === r ? "selected" : ""}
                        aria-pressed={range === r}
                        onClick={() => setRange(r)}
                      >
                        {r === "ALL" ? "All" : r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="chart-series">
                  <label>
                    <span className="sr-only">Chart metric</span>
                    <select
                      aria-label="Chart metric"
                      value={series}
                      onChange={(e) =>
                        setSeries(e.target.value as typeof series)
                      }
                    >
                      <option value="netWorth">Net worth</option>
                      <option value="assets">Total assets</option>
                      <option value="debts">Total debts</option>
                    </select>
                    <ChevronDown size={16} />
                  </label>
                  <span className="chart-unit">{portfolio.currency}</span>
                </div>
                <WealthChart
                  snapshots={portfolio.snapshots}
                  currency={portfolio.currency}
                  range={range}
                  series={series}
                  hidden={hidden}
                />
              </section>
              <section className="panel portfolio-mix">
                <div className="panel-header">
                  <div>
                    <h2>Your asset mix</h2>
                    <p>Where your money sits today.</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Manage allocation targets"
                    onClick={() => setDialog({ type: "targets" })}
                  >
                    <SlidersHorizontal size={21} />
                  </button>
                </div>
                <AllocationChart
                  items={categories}
                  total={current.assets}
                  currency={portfolio.currency}
                  hidden={hidden}
                />
                <button
                  className="mix-link"
                  onClick={() => selectView("Allocation")}
                >
                  Compare with your targets <ArrowRight size={18} />
                </button>
              </section>
            </div>
          </>
        )}
        {view === "Allocation" && (
          <>
            <div className="allocation-layout">
              <section className="panel allocation-overview">
                <div className="panel-header">
                  <div>
                    <h2>Current allocation</h2>
                    <p>Based on {money(current.assets)} in total assets.</p>
                  </div>
                </div>
                <AllocationChart
                  items={categories}
                  total={current.assets}
                  currency={portfolio.currency}
                  hidden={hidden}
                />
              </section>
              <section className="panel allocation-targets">
                <div className="panel-header">
                  <div>
                    <h2>Actual vs. target</h2>
                    <p>Plan your next move with a clear comparison.</p>
                  </div>
                </div>
                <div className="allocation-column-labels">
                  <span>Category</span>
                  <span>Actual / Target</span>
                  <span>Difference</span>
                </div>
                {categories.map((c) => (
                  <div className="allocation-row" key={c.id}>
                    <div className="allocation-category">
                      <span
                        className="category-symbol"
                        style={{ background: c.color }}
                      />
                      <h3>{c.name}</h3>
                      <span>{money(c.value)}</span>
                    </div>
                    <div className="allocation-comparison">
                      <div>
                        <strong>{formatPercent(c.actual)}</strong>
                        <span>/ {c.target}%</span>
                      </div>
                      <div className="allocation-track">
                        <i style={{ width: `${Math.min(100, c.actual)}%` }} />
                        <b style={{ left: `${Math.min(99, c.target)}%` }} />
                      </div>
                    </div>
                    <div className="allocation-difference">
                      <span
                        className={`allocation-status ${Math.abs(c.actual - c.target) < 1 ? "balanced" : c.actual > c.target ? "over" : "under"}`}
                      >
                        {Math.abs(c.actual - c.target) < 1
                          ? "On target"
                          : `${Math.abs(c.actual - c.target).toFixed(1)}% ${c.actual > c.target ? "over" : "under"}`}
                      </span>
                      <span>
                        {Math.abs(c.gap) < 1
                          ? "Within your target"
                          : `${money(Math.abs(c.gap))} ${c.gap > 0 ? "below" : "above"}`}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="allocation-note">
                  <Target size={19} />
                  <p>
                    Targets use your current total assets. Debt is tracked
                    separately and doesn’t change your allocation percentages.
                  </p>
                </div>
                <button
                  className="button secondary manage-targets"
                  onClick={() => setDialog({ type: "targets" })}
                >
                  <Plus size={18} />
                  Manage categories & targets
                </button>
              </section>
            </div>
          </>
        )}
        {view === "History" && (
          <HistoryView
            portfolio={portfolio}
            hidden={hidden}
            onTakeSnapshot={takeSnapshot}
            onEditHolding={(holding) => setDialog({ type: "holding", holding })}
            initialHoldingId={historyHolding}
          />
        )}
        {view === "Settings" && (
          <div className="settings-layout">
            <section className="panel settings-panel">
              <div className="panel-header">
                <div>
                  <h2>Preferences</h2>
                  <p>Keep things comfortable and familiar.</p>
                </div>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Currency</h3>
                  <p>
                    All balances use this currency. Changing it relabels amounts
                    without converting them.
                  </p>
                </div>
                <select
                  className="form-input currency-select"
                  aria-label="Display currency"
                  value={portfolio.currency}
                  onChange={(e) => {
                    setPortfolio((p) => ({ ...p, currency: e.target.value }));
                    setToast("Currency saved. Amounts are not converted.");
                  }}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Hide balances</h3>
                  <p>
                    Keep monetary values out of view when sharing your screen.
                  </p>
                </div>
                <button
                  className={`toggle ${hidden ? "on" : ""}`}
                  aria-label="Hide monetary values"
                  aria-pressed={hidden}
                  onClick={() => setHidden(!hidden)}
                >
                  <i />
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Categories & targets</h3>
                  <p>Name your categories and set your allocation plan.</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setDialog({ type: "targets" })}
                >
                  Manage
                </button>
              </div>
            </section>
            <section className="panel settings-panel">
              <div className="panel-header">
                <div>
                  <h2>Your data</h2>
                  <p>No account required. You’re in control.</p>
                </div>
                <ShieldCheck size={24} />
              </div>
              <div className="data-note">
                <ShieldCheck size={23} />
                <p>
                  Your data is saved in this browser, on this device. Export a
                  backup before clearing browser data or moving to another
                  device.
                </p>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Export a backup</h3>
                  <p>
                    Includes holdings, targets, snapshots, and per-asset
                    history.
                  </p>
                </div>
                <button className="button secondary" onClick={exportData}>
                  <Download size={18} />
                  Export
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Restore a backup</h3>
                  <p>
                    Replaces this portfolio. Backups from the first version also
                    work.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={18} />
                  Import
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <h3>Start fresh</h3>
                  <p>
                    Clear current holdings and all history. Export a backup
                    first.
                  </p>
                </div>
                <button
                  className="button secondary danger-text"
                  onClick={() => setDialog({ type: "fresh" })}
                >
                  Start fresh
                </button>
              </div>
              {!portfolio.isDemo && !portfolio.holdings.length && (
                <div className="setting-row">
                  <div>
                    <h3>Explore an example</h3>
                    <p>Load a sample portfolio with illustrative history.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setPortfolio(createDemoPortfolio());
                      setToast("Example portfolio loaded");
                    }}
                  >
                    Load example
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
        <footer className="page-footer">
          <span className="footer-brand">
            <Leaf size={18} />A clearer view of your wealth.
          </span>
          <span>
            <ShieldCheck size={16} />
            Private by design <span>·</span> Saved on this device
          </span>
        </footer>
      </main>
      <input
        className="sr-only"
        ref={importRef}
        type="file"
        accept="application/json,.json"
        aria-label="Import SP Net Worth Tracker backup"
        onChange={(e) => importData(e.target.files?.[0])}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={21} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {dialog?.type === "holding" && (
        <HoldingModal
          holding={dialog.holding}
          categories={portfolio.categories}
          currency={portfolio.currency}
          onClose={() => setDialog(null)}
          onSave={saveHolding}
          onDelete={(holding) => {
            update(
              (p) => ({
                ...p,
                holdings: p.holdings.filter((h) => h.id !== holding.id),
              }),
              "Holding deleted",
              holding.name,
            );
            setDialog(null);
          }}
          onManage={() => setDialog({ type: "targets" })}
        />
      )}
      {dialog?.type === "balances" && (
        <BalancesModal
          portfolio={portfolio}
          onClose={() => setDialog(null)}
          onSave={(values) => {
            update(
              (p) => ({
                ...p,
                holdings: p.holdings.map((h) => ({
                  ...h,
                  value: values[h.id] ?? h.value,
                  updatedAt:
                    values[h.id] !== h.value
                      ? new Date().toISOString()
                      : h.updatedAt,
                })),
              }),
              "Balances updated",
              `${portfolio.holdings.length} holdings reviewed`,
            );
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "targets" && (
        <TargetsModal
          portfolio={portfolio}
          onClose={() => setDialog(null)}
          onSave={(cats) => {
            update(
              (p) => ({ ...p, categories: cats }),
              "Allocation targets updated",
              `${cats.length} categories`,
            );
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "fresh" && (
        <Modal
          title="Start a new portfolio?"
          subtitle="Your currency preference will stay. Everything else will be cleared."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <div className="notice">
              <ShieldCheck size={22} />
              <p>
                This removes your current holdings, saved snapshots, and
                activity from this browser. Download a backup if you want to
                keep them.
              </p>
            </div>
            <button className="text-button backup-link" onClick={exportData}>
              <Download size={18} />
              Download a backup first
            </button>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                setPortfolio(createEmptyPortfolio(portfolio.currency));
                setDialog(null);
                setView("Holdings");
                setToast("Your portfolio is ready. Add your first holding.");
              }}
            >
              Start my portfolio <ArrowRight size={18} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
