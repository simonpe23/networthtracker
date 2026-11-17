import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Clock3,
  History,
  Pencil,
  Wallet,
} from "lucide-react";
import { WealthChart } from "./Charts";
import { formatMoney, formatPercent, getHoldingHistory, totals } from "./model";
import type { Holding, Portfolio, Snapshot, SnapshotHolding } from "./model";

type Props = {
  portfolio: Portfolio;
  hidden: boolean;
  onTakeSnapshot: () => void;
  onEditHolding: (holding: Holding) => void;
  initialHoldingId?: string;
};

type HoldingOption = {
  id: string;
  name: string;
  kind: "asset" | "debt";
  removed: boolean;
};
const stamp = (snapshot: Snapshot) => snapshot.capturedAt || snapshot.date;
function dateObject(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00` : value);
}
function displayDate(value: string, includeTime = false) {
  return dateObject(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime && value.length > 10
      ? { hour: "numeric", minute: "2-digit", second: "2-digit" }
      : {}),
  });
}
function snapshotOrder(a: Snapshot, b: Snapshot) {
  return dateObject(stamp(a)).getTime() - dateObject(stamp(b)).getTime();
}
function rangeCutoff(last: string | undefined, range: string) {
  if (!last || range === "ALL") return -Infinity;
  const date = dateObject(last);
  if (range === "1Y") date.setFullYear(date.getFullYear() - 1);
  else
    date.setMonth(
      date.getMonth() - ({ "1M": 1, "3M": 3, "6M": 6 }[range] || 12),
    );
  return date.getTime();
}

export default function HistoryView({
  portfolio,
  hidden,
  onTakeSnapshot,
  onEditHolding,
  initialHoldingId,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialHoldingId || "portfolio");
  const [mode, setMode] = useState<"balance" | "share">("balance");
  const [range, setRange] = useState("1Y");
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId(initialHoldingId || "portfolio");
    setMode("balance");
  }, [initialHoldingId]);

  const sorted = useMemo(
    () => [...portfolio.snapshots].sort(snapshotOrder),
    [portfolio.snapshots],
  );
  const options = useMemo(() => {
    const map = new Map<string, HoldingOption>();
    for (const snapshot of sorted) {
      for (const holding of snapshot.holdings || []) {
        map.set(holding.id, {
          id: holding.id,
          name: holding.name,
          kind: holding.kind,
          removed: true,
        });
      }
    }
    for (const holding of portfolio.holdings) {
      map.set(holding.id, {
        id: holding.id,
        name: holding.name,
        kind: holding.kind,
        removed: false,
      });
    }
    return [...map.values()].sort(
      (a, b) =>
        Number(a.removed) - Number(b.removed) || a.name.localeCompare(b.name),
    );
  }, [portfolio.holdings, sorted]);

  const selected = options.find((option) => option.id === selectedId);
  const isPortfolio = selectedId === "portfolio" || !selected;
  const currentHolding = portfolio.holdings.find(
    (holding) => holding.id === selectedId,
  );
  const records = useMemo(
    () => (isPortfolio ? [] : getHoldingHistory(portfolio, selectedId)),
    [portfolio, selectedId, isPortfolio],
  );
  const latestRecord = records.at(-1);
  const effectiveMode = selected?.kind === "debt" ? "balance" : mode;
  const last = sorted.at(-1);
  const current = totals(portfolio.holdings);
  const cutoff = rangeCutoff(last ? stamp(last) : undefined, range);
  const shownSnapshots = sorted
    .filter((snapshot) => dateObject(stamp(snapshot)).getTime() >= cutoff)
    .reverse();
  const shownRecords = records
    .filter(
      (record) =>
        dateObject(record.capturedAt || record.date).getTime() >= cutoff,
    )
    .reverse();
  const legacyCount = portfolio.snapshots.filter(
    (snapshot) => !snapshot.holdings,
  ).length;
  const money = (value: number) =>
    hidden ? "••••••" : formatMoney(value, portfolio.currency);
  const chartSnapshots: Snapshot[] = isPortfolio
    ? sorted
    : records.map((record) => ({
        id: record.snapshotId,
        date: record.capturedAt || record.date,
        assets: effectiveMode === "share" ? record.share : record.value,
        debts: 0,
      }));
  const chartName = isPortfolio
    ? "Net worth over time"
    : `${selected?.name} ${effectiveMode === "share" ? "share of assets" : "value"} over time`;

  return (
    <div className="history-view">
      <section className="history-summary" aria-label="Snapshot summary">
        <div className="history-stat">
          <span>
            {isPortfolio ? "Net worth today" : "Latest recorded value"}
          </span>
          <strong>
            {isPortfolio
              ? money(current.netWorth)
              : latestRecord
                ? money(latestRecord.value)
                : "—"}
          </strong>
          <small>
            {isPortfolio
              ? "Your current assets minus debts"
              : latestRecord
                ? `Recorded ${displayDate(latestRecord.capturedAt, true)}`
                : "Take a snapshot to start recording"}
          </small>
        </div>
        <div className="history-stat">
          <span>
            {isPortfolio ? "Saved snapshots" : "Recorded portfolio share"}
          </span>
          <strong>
            {isPortfolio
              ? sorted.filter((snapshot) => snapshot.kind === "manual").length
              : selected?.kind === "debt"
                ? "—"
                : latestRecord
                  ? formatPercent(latestRecord.share)
                  : "—"}
          </strong>
          <small>
            {isPortfolio
              ? `${sorted.length} records including daily updates`
              : selected?.kind === "debt"
                ? "Debt is excluded from asset allocation"
                : "Share of total assets at that point in time"}
          </small>
        </div>
        <div className="history-stat last-snapshot-stat">
          <span>Last recorded</span>
          <strong>{last ? displayDate(stamp(last)) : "Not yet"}</strong>
          <small>
            {last?.capturedAt
              ? dateObject(last.capturedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : last
                ? "Daily balance"
                : "Save your first snapshot below"}
          </small>
        </div>
      </section>

      <section className="panel history-chart-panel">
        <div className="panel-header">
          <div>
            <h2>Balance history</h2>
            <p>See how your portfolio and each holding change over time.</p>
          </div>
          <button className="button primary" onClick={onTakeSnapshot}>
            <Camera size={19} />
            Take snapshot
          </button>
        </div>
        <div className="history-controls">
          <label className="history-select-label" htmlFor="history-for">
            History for
            <select
              id="history-for"
              className="form-input"
              value={isPortfolio ? "portfolio" : selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setMode("balance");
                setExpanded(null);
              }}
            >
              <option value="portfolio">Entire portfolio</option>
              {options.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.name}
                  {option.removed ? " (removed)" : ""}
                </option>
              ))}
            </select>
          </label>
          {!isPortfolio && selected?.kind !== "debt" && (
            <div
              className="segmented-control"
              role="group"
              aria-label="Holding history metric"
            >
              <button
                className={effectiveMode === "balance" ? "active" : ""}
                aria-pressed={effectiveMode === "balance"}
                onClick={() => setMode("balance")}
              >
                Balance
              </button>
              <button
                className={effectiveMode === "share" ? "active" : ""}
                aria-pressed={effectiveMode === "share"}
                onClick={() => setMode("share")}
              >
                Portfolio share
              </button>
            </div>
          )}
          <div
            className="range-tabs"
            role="group"
            aria-label="History date range"
          >
            {["1M", "3M", "6M", "1Y", "ALL"].map((item) => (
              <button
                key={item}
                className={range === item ? "selected" : ""}
                aria-pressed={range === item}
                onClick={() => setRange(item)}
              >
                {item === "ALL" ? "All" : item}
              </button>
            ))}
          </div>
        </div>
        {!isPortfolio && selected?.removed && (
          <p className="notice history-notice">
            This holding has been removed. Its recorded values and portfolio
            shares are still available here.
          </p>
        )}
        {!isPortfolio && legacyCount > 0 && (
          <p className="notice history-notice">
            {legacyCount} older{" "}
            {legacyCount === 1 ? "record contains" : "records contain"}{" "}
            portfolio totals only. Individual holding history begins with the
            first detailed snapshot; earlier values haven’t been estimated.
          </p>
        )}
        {!isPortfolio && !records.length ? (
          <div className="empty-state">
            <History size={32} />
            <h3>No recorded history for this holding yet</h3>
            <p>
              Take a snapshot to save its current value and share of your total
              assets.
            </p>
            <button className="button primary" onClick={onTakeSnapshot}>
              <Camera size={18} />
              Save first snapshot
            </button>
          </div>
        ) : (
          <WealthChart
            snapshots={chartSnapshots}
            currency={portfolio.currency}
            range={range}
            hidden={hidden && effectiveMode !== "share"}
            series={isPortfolio ? "netWorth" : "assets"}
            valueMode={
              !isPortfolio && effectiveMode === "share" ? "percent" : "money"
            }
            label={chartName}
          />
        )}
        <div className="history-chart-note">
          <Clock3 size={17} />
          <span>
            Daily updates track your changes. Saved snapshots preserve an exact
            moment, even after you edit a balance.
          </span>
          {currentHolding && (
            <button
              className="text-button"
              onClick={() => onEditHolding(currentHolding)}
            >
              <Pencil size={16} />
              Edit holding
            </button>
          )}
        </div>
      </section>

      <section className="panel snapshot-history-panel">
        <div className="panel-header">
          <div>
            <h2>Snapshot history</h2>
            <p>
              {isPortfolio
                ? "Open a record to see every holding exactly as it was saved."
                : `Recorded values and allocation for ${selected?.name}.`}
            </p>
          </div>
          <span className="snapshot-record-count">
            {isPortfolio ? shownSnapshots.length : shownRecords.length} records
          </span>
        </div>
        {(isPortfolio ? shownSnapshots.length : shownRecords.length) === 0 ? (
          <div className="empty-state">
            <Wallet size={30} />
            <h3>No snapshots in this period</h3>
            <p>
              {sorted.length
                ? "Choose a longer date range, or save a snapshot today."
                : "Take your first snapshot to save your net worth and the value and allocation of every holding."}
            </p>
            <button className="button secondary" onClick={onTakeSnapshot}>
              <Camera size={18} />
              Take snapshot
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="snapshot-table">
              <thead>
                <tr>
                  <th scope="col">Date & time</th>
                  {isPortfolio ? (
                    <>
                      <th scope="col" className="numeric">
                        Net worth
                      </th>
                      <th scope="col" className="numeric">
                        Assets
                      </th>
                      <th scope="col" className="numeric">
                        Debts
                      </th>
                    </>
                  ) : (
                    <>
                      <th scope="col" className="numeric">
                        Holding value
                      </th>
                      <th scope="col" className="numeric">
                        % of assets
                      </th>
                      <th scope="col">Category</th>
                    </>
                  )}
                  <th scope="col">Record type</th>
                </tr>
              </thead>
              <tbody>
                {isPortfolio
                  ? shownSnapshots.map((snapshot) => (
                      <Fragment key={snapshot.id}>
                        <tr
                          className={
                            expanded === snapshot.id
                              ? "expanded-snapshot-row"
                              : ""
                          }
                        >
                          <td>
                            <button
                              className="snapshot-date-button"
                              aria-label={`View snapshot ${displayDate(stamp(snapshot), true)}`}
                              aria-expanded={expanded === snapshot.id}
                              onClick={() =>
                                setExpanded(
                                  expanded === snapshot.id ? null : snapshot.id,
                                )
                              }
                            >
                              {expanded === snapshot.id ? (
                                <ChevronDown size={19} />
                              ) : (
                                <ChevronRight size={19} />
                              )}
                              <span>
                                <strong>{displayDate(stamp(snapshot))}</strong>
                                <small>
                                  {snapshot.capturedAt
                                    ? dateObject(
                                        snapshot.capturedAt,
                                      ).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        second: "2-digit",
                                      })
                                    : "Daily balance"}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td className="numeric snapshot-net-worth">
                            {money(snapshot.assets - snapshot.debts)}
                          </td>
                          <td className="numeric">{money(snapshot.assets)}</td>
                          <td className="numeric">{money(snapshot.debts)}</td>
                          <td>
                            <span
                              className={`snapshot-kind ${snapshot.kind === "manual" ? "manual" : "daily"}`}
                            >
                              {snapshot.kind === "manual" ? (
                                <Camera size={15} />
                              ) : (
                                <Clock3 size={15} />
                              )}{" "}
                              {snapshot.kind === "manual"
                                ? "Saved snapshot"
                                : "Daily update"}
                            </span>
                          </td>
                        </tr>
                        {expanded === snapshot.id && (
                          <tr className="snapshot-details-row">
                            <td colSpan={5}>
                              <SnapshotBreakdown
                                snapshot={snapshot}
                                money={money}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  : shownRecords.map((record) => (
                      <tr key={record.snapshotId}>
                        <td>
                          <span className="snapshot-record-date">
                            <strong>
                              {displayDate(record.capturedAt || record.date)}
                            </strong>
                            <small>
                              {record.capturedAt.length > 10
                                ? dateObject(
                                    record.capturedAt,
                                  ).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })
                                : "Daily balance"}
                            </small>
                          </span>
                        </td>
                        <td className="numeric snapshot-net-worth">
                          {money(record.value)}
                        </td>
                        <td className="numeric snapshot-share">
                          {selected?.kind === "debt"
                            ? "—"
                            : formatPercent(record.share)}
                        </td>
                        <td>{record.categoryName || "—"}</td>
                        <td>
                          <span
                            className={`snapshot-kind ${record.kind === "manual" ? "manual" : "daily"}`}
                          >
                            {record.kind === "manual" ? (
                              <Camera size={15} />
                            ) : (
                              <Clock3 size={15} />
                            )}{" "}
                            {record.kind === "manual"
                              ? "Saved snapshot"
                              : "Daily update"}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {portfolio.isDemo && (
          <p className="history-demo-note">
            Example portfolio: historical balances and allocations are
            illustrative.
          </p>
        )}
      </section>
    </div>
  );
}

function SnapshotBreakdown({
  snapshot,
  money,
}: {
  snapshot: Snapshot;
  money: (value: number) => string;
}) {
  if (!snapshot.holdings)
    return (
      <div className="snapshot-details">
        <h3>Portfolio totals only</h3>
        <p>
          This older record does not include individual holdings. Your original
          totals have been preserved.
        </p>
      </div>
    );
  if (!snapshot.holdings.length)
    return (
      <div className="snapshot-details">
        <h3>Empty portfolio</h3>
        <p>No holdings were present when this snapshot was captured.</p>
      </div>
    );
  return (
    <div className="snapshot-details">
      <h3>Holdings at this snapshot</h3>
      <p>
        These values and categories are saved with this record and won’t change
        when you update your portfolio.
      </p>
      <div className="snapshot-breakdown-head">
        <span>Holding / category</span>
        <span>Value</span>
        <span>% of assets</span>
      </div>
      {snapshot.holdings.map((holding: SnapshotHolding) => (
        <div className="snapshot-detail-row" key={holding.id}>
          <div>
            <strong>
              <i style={{ background: holding.color }} />
              {holding.name}
            </strong>
            <span>
              {holding.kind === "debt" ? "Debt" : holding.categoryName}
            </span>
          </div>
          <strong>{money(holding.value)}</strong>
          <strong>
            {holding.kind === "debt" ? "—" : formatPercent(holding.share)}
          </strong>
        </div>
      ))}
    </div>
  );
}
