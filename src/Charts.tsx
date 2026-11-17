import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Category, Snapshot } from "./model";
import "./charts.css";

const money = (value: number, currency: string, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 2,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value);

function dateValue(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).getTime();
}

function curve(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, p, index) => {
    const previous = points[index];
    const middle = (previous.x + p.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${p.y}, ${p.x} ${p.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function niceCeiling(n: number) {
  const scale = Math.pow(10, Math.floor(Math.log10(n)));
  return (
    ([1, 2, 2.5, 5, 10].find((candidate) => candidate * scale >= n) ?? 10) *
    scale
  );
}

export function WealthChart({
  snapshots,
  currency,
  range,
  hidden = false,
  series = "netWorth",
  valueMode = "money",
  label,
}: {
  snapshots: Snapshot[];
  currency: string;
  range: string;
  hidden?: boolean;
  series?: "netWorth" | "assets" | "debts";
  valueMode?: "money" | "percent";
  label?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const data = useMemo(() => {
    const sorted = snapshots
      .map((snapshot) => ({
        ...snapshot,
        date: snapshot.capturedAt || snapshot.date,
      }))
      .filter(
        (s) =>
          Number.isFinite(dateValue(s.date)) &&
          Number.isFinite(s.assets) &&
          Number.isFinite(s.debts),
      )
      .slice()
      .sort((a, b) => dateValue(a.date) - dateValue(b.date));
    if (!sorted.length || range === "ALL") return sorted;
    const cutoff = new Date(dateValue(sorted[sorted.length - 1].date));
    if (range === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);
    else
      cutoff.setMonth(
        cutoff.getMonth() - ({ "1M": 1, "3M": 3, "6M": 6 }[range] ?? 12),
      );
    return sorted.filter((s) => dateValue(s.date) >= cutoff.getTime());
  }, [snapshots, range]);
  useEffect(() => setActive(null), [range, series, valueMode]);

  const seriesLabel =
    label ??
    (series === "assets"
      ? "Total assets"
      : series === "debts"
        ? "Total debts"
        : "Net worth");
  const values = data.map((s) =>
    series === "assets"
      ? s.assets
      : series === "debts"
        ? s.debts
        : s.assets - s.debts,
  );
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const span = maxValue - minValue;
  const padding = Math.max(
    Math.abs(maxValue) * 0.1,
    valueMode === "percent" ? 2 : 100,
  );
  const lower =
    minValue >= 0
      ? Math.max(0, minValue - (span ? span * 0.15 : padding / 2))
      : minValue - (span ? span * 0.15 : padding / 2);
  const upper = maxValue + (span ? span * 0.12 : padding / 2);
  let niceStep = niceCeiling((upper - lower) / 3);
  let min = Math.floor(lower / niceStep) * niceStep;
  while (min + niceStep * 3 < upper) {
    niceStep = niceCeiling(niceStep * 1.01);
    min = Math.floor(lower / niceStep) * niceStep;
  }
  const max = min + niceStep * 3;
  const compactUnit =
    Math.abs(max) >= 1e6 ? 1e6 : Math.abs(max) >= 1000 ? 1000 : 1;
  const axisFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(
      6,
      Math.max(1, Math.ceil(Math.log10(compactUnit / niceStep))),
    ),
  });
  const percentFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.min(
      4,
      Math.max(1, Math.ceil(-Math.log10(niceStep))),
    ),
  });
  const displayValue = (value: number) =>
    hidden
      ? "••••••"
      : valueMode === "percent"
        ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`
        : money(value, currency);
  const axisValue = (value: number) =>
    hidden
      ? "••••"
      : valueMode === "percent"
        ? `${percentFormatter.format(value)}%`
        : axisFormatter.format(value);

  // Match viewBox units to the measured container width so 14px labels stay
  // 14px on a phone, instead of shrinking with a desktop-sized SVG.
  const mobile = width < 560;
  const height = mobile ? 310 : 340;
  const tickValues = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  const left = Math.min(
    mobile ? 106 : 120,
    Math.max(
      64,
      ...tickValues.map((value) => axisValue(value).length * 8 + 18),
    ),
  );
  const right = mobile ? 20 : 30;
  const top = 32;
  const bottom = 48;
  const chartWidth = Math.max(1, width - left - right);
  const chartHeight = height - top - bottom;
  const yFor = (value: number) =>
    top + (1 - (value - min) / (max - min)) * chartHeight;
  const firstTime = data.length ? dateValue(data[0].date) : 0;
  const lastTime = data.length ? dateValue(data[data.length - 1].date) : 0;
  const sameDay =
    data.length > 1 &&
    new Date(firstTime).toDateString() === new Date(lastTime).toDateString();
  const repeatedTimes =
    new Set(data.map((s) => dateValue(s.date))).size < data.length;
  const points = data.map((s, i) => ({
    x:
      data.length === 1
        ? left + chartWidth / 2
        : left +
          (repeatedTimes
            ? i / (data.length - 1)
            : (dateValue(s.date) - firstTime) / (lastTime - firstTime || 1)) *
            chartWidth,
    y: yFor(values[i]),
  }));
  const line = curve(points);
  const selected = active !== null && data[active] ? active : null;
  const tickCount = mobile ? (chartWidth < 230 ? 2 : 3) : 5;
  const labels = [
    ...new Set(
      Array.from({ length: tickCount }, (_, i) =>
        Math.round(((data.length - 1) * i) / (tickCount - 1)),
      ),
    ),
  ].filter((i) => i >= 0);
  const dateLabel = (i: number) => {
    if (sameDay && repeatedTimes) return `Update ${i + 1}`;
    const date = new Date(dateValue(data[i].date));
    return sameDay
      ? date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          ...(lastTime - firstTime < 3600000
            ? { second: "2-digit" as const }
            : {}),
        })
      : date.toLocaleDateString("en-US", {
          month: "short",
          ...(data.length <= 5 || lastTime - firstTime < 90 * 86400000
            ? { day: "numeric" as const }
            : {}),
        });
  };

  return (
    <div
      className="wealth-chart"
      ref={containerRef}
      onMouseLeave={() => setActive(null)}
    >
      {!data.length ? (
        <div className="wealth-chart-empty">
          <svg width="72" height="46" viewBox="0 0 62 40" aria-hidden="true">
            <path
              d="M3 35 L16 27 L29 30 L43 14 L59 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="59" cy="5" r="3" fill="currentColor" />
          </svg>
          <strong>Your story starts here.</strong>
          <span>Add your first balance to start tracking your progress.</span>
        </div>
      ) : (
        <>
          {selected !== null && (
            <div
              className="wealth-chart-tooltip"
              style={{
                left: Math.max(
                  Math.min(108, width / 2),
                  Math.min(
                    width - Math.min(108, width / 2),
                    points[selected].x,
                  ),
                ),
              }}
              role="status"
            >
              <span>
                {new Date(dateValue(data[selected].date)).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )}
                {data[selected].date.length > 10
                  ? ` · ${new Date(dateValue(data[selected].date)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
                  : repeatedTimes
                    ? ` · Update ${selected + 1}`
                    : ""}
              </span>
              <strong>{displayValue(values[selected])}</strong>
            </div>
          )}
          <svg
            className="wealth-chart-svg"
            style={{ height }}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={label ?? `${seriesLabel} over time`}
          >
            <title>{label ?? `${seriesLabel} over time`}</title>
            <desc>
              {data.length === 1
                ? "One balance recorded. Update balances over time to build your history."
                : `${data.length} recorded balances. Focus or tap a point to inspect its date and ${seriesLabel.toLowerCase()}.${repeatedTimes ? " Same-time updates are shown in update order." : ""}`}
            </desc>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-accent, #536575)"
                  stopOpacity="0.17"
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-accent, #536575)"
                  stopOpacity="0.015"
                />
              </linearGradient>
            </defs>
            {tickValues.map((value, i) => (
              <g key={i}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={yFor(value)}
                  y2={yFor(value)}
                  stroke="var(--rule, #dfe7e2)"
                  strokeDasharray="4 5"
                />
                <text
                  x={left - 14}
                  y={yFor(value) + 5}
                  textAnchor="end"
                  className="wealth-chart-label"
                >
                  {axisValue(value)}
                </text>
              </g>
            ))}
            {points.length > 1 && (
              <path
                d={`${line} L ${points[points.length - 1].x} ${top + chartHeight} L ${points[0].x} ${top + chartHeight} Z`}
                fill={`url(#${gradientId})`}
              />
            )}
            {points.length > 1 && (
              <path
                d={line}
                fill="none"
                stroke="var(--chart-line, #536575)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {selected !== null && (
              <line
                x1={points[selected].x}
                x2={points[selected].x}
                y1={top}
                y2={top + chartHeight}
                stroke="var(--chart-accent, #6a9a87)"
                strokeDasharray="4 4"
              />
            )}
            {points.map((p, i) => (
              <g key={`${data[i].id}-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={selected === i || points.length === 1 ? 6 : 4}
                  fill="var(--chart-line, #536575)"
                  stroke="#fff"
                  strokeWidth="2.5"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="18"
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${new Date(dateValue(data[i].date)).toLocaleString("en-US")}, update ${i + 1}: ${displayValue(values[i])}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(selected === i ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActive(selected === i ? null : i);
                    }
                  }}
                  className="wealth-chart-point"
                />
              </g>
            ))}
            {labels.map((i, index) => (
              <text
                key={i}
                x={points[i].x}
                y={height - 13}
                textAnchor={
                  index === 0 && labels.length > 1
                    ? "start"
                    : index === labels.length - 1 && labels.length > 1
                      ? "end"
                      : "middle"
                }
                className="wealth-chart-label"
              >
                {dateLabel(i)}
              </text>
            ))}
          </svg>
          {data.length === 1 && (
            <div className="wealth-chart-single">
              Your first snapshot. Keep updating to see your journey unfold.
            </div>
          )}
          {sameDay && repeatedTimes && (
            <div className="wealth-chart-single">
              {new Date(firstTime).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}{" "}
              · Same-day updates shown in order.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AllocationChart({
  items,
  total,
  currency,
  hidden = false,
}: {
  items: Array<Category & { value: number; actual: number }>;
  total: number;
  currency: string;
  hidden?: boolean;
}) {
  const positive = items.filter((item) => item.value > 0);
  const circumference = 2 * Math.PI * 72;
  let progress = 0;
  return (
    <div className="allocation-chart">
      <div className="allocation-donut-wrap">
        <svg
          viewBox="0 0 200 200"
          className="allocation-donut"
          role="img"
          aria-label={
            total > 0 ? "Asset allocation by category" : "No assets to show yet"
          }
        >
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="#e7eeea"
            strokeWidth="18"
          />
          {positive.map((item) => {
            const share = total > 0 ? item.value / total : 0;
            const start = progress;
            progress += share;
            const gap =
              positive.length > 1
                ? Math.min(5, circumference * share * 0.3)
                : 0;
            return (
              <circle
                key={item.id}
                cx="100"
                cy="100"
                r="72"
                fill="none"
                stroke={item.color}
                strokeWidth="18"
                strokeDasharray={`${Math.max(0, circumference * share - gap)} ${circumference}`}
                strokeDashoffset={-circumference * start - gap / 2}
                transform="rotate(-90 100 100)"
              >
                <title>
                  {item.name}: {(share * 100).toFixed(1)}%
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="allocation-donut-center">
          <span>TOTAL ASSETS</span>
          <strong>
            {hidden ? "••••••" : money(total, currency, total >= 1000000)}
          </strong>
          <small>
            {positive.length}{" "}
            {positive.length === 1 ? "asset class" : "asset classes"}
          </small>
        </div>
      </div>
      <div className="allocation-chart-legend">
        {items.map((item) => (
          <div className="allocation-chart-legend-row" key={item.id}>
            <span
              className="allocation-chart-dot"
              style={{ background: item.color }}
            />
            <span className="allocation-chart-name">{item.name}</span>
            <strong>
              {Number.isFinite(item.actual) ? item.actual.toFixed(1) : "0.0"}
              <span>%</span>
            </strong>
          </div>
        ))}
        {!items.length && (
          <p className="allocation-chart-no-data">
            Create a category to organize your assets.
          </p>
        )}
      </div>
    </div>
  );
}
