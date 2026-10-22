import { useState } from 'preact/hooks';
import { formatDay, formatShort, fromIso, weekdayOf } from '../lib/dates';
import { g, useWidth } from './ui';

// Hand-rolled SVG charts. Each is a single series in the ink colour, so there
// is no legend: the card title names the series and a tooltip gives the values.

const PAD = { top: 16, right: 8, bottom: 22, left: 34 };
const AXIS = 'var(--mute)';
const GRID = 'var(--hairline)';

type Tip = { x: number; y: number; title: string; value: string } | null;

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  // Flip to the left of the pointer near the right edge so it never overflows.
  const flip = tip.x > width - 130;
  return (
    <div
      class="pointer-events-none absolute z-10 rounded-md border border-hairline bg-elevated px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
      style={{ left: tip.x, top: Math.max(0, tip.y - 8), transform: `translate(${flip ? 'calc(-100% - 10px)' : '10px'}, -100%)` }}
    >
      <p class="text-mute">{tip.title}</p>
      <p class="num font-medium text-ink">{tip.value}</p>
    </div>
  );
}

/** Round an axis maximum up to a tidy number. */
function niceMax(n: number) {
  if (n <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((m) => m >= n) ?? n;
}

export type DayValue = { date: string; value: number };

export function BarChart({ data, target, unit, height = 200 }: { data: DayValue[]; target?: number; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(target ?? 0, ...data.map((d) => d.value)) * 1.05);
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(1, Math.min(28, band - 2));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(data.length / (width < 480 ? 4 : 7));
  const hovered = hover === null ? null : data[hover];

  return (
    <div ref={ref} class="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Bar chart of ${unit} per day`}>
          {[0, max / 2, max].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} />
              <text x={PAD.left - 6} y={y(tick) + 4} text-anchor="end" font-size="11" fill={AXIS} class="num">{g(tick)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = (d.value / max) * innerH;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={d.date}>
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                    fill="var(--accent)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={height - 6} text-anchor="middle" font-size="11" fill={AXIS}>{formatShort(d.date)}</text>
                )}
                <rect x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
          {target !== undefined && (
            <g>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--body)" stroke-dasharray="4 4" />
              <text x={width - PAD.right} y={y(target) - 5} text-anchor="end" font-size="11" fill="var(--body)" class="num">target {g(target)} {unit}</text>
            </g>
          )}
        </svg>
      )}
      {hovered && hover !== null && (
        <Tooltip width={width} tip={{ x: PAD.left + hover * band + band / 2, y: y(hovered.value), title: formatDay(hovered.date), value: `${g(hovered.value)} ${unit}` }} />
      )}
    </div>
  );
}

export function LineChart({ data, unit, height = 200 }: { data: DayValue[]; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const innerW = Math.max(0, width - PAD.left - PAD.right - 8);
  const innerH = height - PAD.top - PAD.bottom;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Zoom the y-axis to the data: a line chart shows change, not magnitude.
  const pad = Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const t0 = fromIso(data[0].date).getTime();
  const span = Math.max(1, fromIso(data[data.length - 1].date).getTime() - t0);
  const x = (date: string) => PAD.left + 4 + (data.length === 1 ? innerW / 2 : ((fromIso(date).getTime() - t0) / span) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const hovered = hover === null ? null : data[hover];

  const nearest = (e: MouseEvent) => {
    const px = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d.date) - px) < Math.abs(x(data[best].date) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <div ref={ref} class="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Line chart of ${unit} over time`} onMouseMove={nearest} onMouseLeave={() => setHover(null)} onClick={nearest}>
          {[min, (min + max) / 2, max].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} />
              <text x={PAD.left - 6} y={y(tick) + 4} text-anchor="end" font-size="11" fill={AXIS} class="num">{g(tick)}</text>
            </g>
          ))}
          {hovered && <line x1={x(hovered.date)} x2={x(hovered.date)} y1={PAD.top} y2={PAD.top + innerH} stroke={AXIS} />}
          <polyline points={data.map((d) => `${x(d.date)},${y(d.value)}`).join(' ')} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          {data.map((d, i) => (
            <circle key={d.date} cx={x(d.date)} cy={y(d.value)} r={hover === i ? 5 : 4} fill="var(--accent)" stroke="var(--elevated)" stroke-width="2" />
          ))}
          <text x={x(data[0].date)} y={height - 6} text-anchor="start" font-size="11" fill={AXIS}>{formatShort(data[0].date)}</text>
          {data.length > 1 && (
            <text x={x(data[data.length - 1].date)} y={height - 6} text-anchor="end" font-size="11" fill={AXIS}>{formatShort(data[data.length - 1].date)}</text>
          )}
        </svg>
      )}
      {hovered && <Tooltip width={width} tip={{ x: x(hovered.date), y: y(hovered.value), title: formatDay(hovered.date), value: `${g(hovered.value)} ${unit}` }} />}
    </div>
  );
}

export type HeatDay = { date: string; ratio: number; trained: boolean; label: string };

const CELL = 14;
const GAP = 3;
const STEPS = [0.08, 0.3, 0.55, 0.8, 1];

/** Calendar grid: one column per week, shade = share of the protein target, dot = trained. */
export function Heatmap({ days }: { days: HeatDay[] }) {
  const [tip, setTip] = useState<HeatDay | null>(null);
  if (!days.length) return null;
  const offset = weekdayOf(days[0].date);
  const weeks = Math.ceil((days.length + offset) / 7);
  const step = CELL + GAP;
  const shade = (ratio: number) => (ratio <= 0 ? STEPS[0] : ratio < 0.5 ? STEPS[1] : ratio < 0.8 ? STEPS[2] : ratio < 1 ? STEPS[3] : STEPS[4]);

  return (
    <div>
      <div class="overflow-x-auto pb-1">
        <svg width={weeks * step + 30} height={7 * step} role="img" aria-label="Calendar of protein intake and training days" onMouseLeave={() => setTip(null)}>
          {['Mon', 'Wed', 'Fri', 'Sun'].map((d, i) => (
            <text key={d} x={0} y={i * 2 * step + CELL - 3} font-size="10" fill={AXIS}>{d}</text>
          ))}
          {days.map((d, i) => {
            const col = Math.floor((i + offset) / 7);
            const row = (i + offset) % 7;
            const x = 30 + col * step;
            const y = row * step;
            const filled = shade(d.ratio) > 0.5;
            return (
              <g key={d.date} onMouseEnter={() => setTip(d)} onClick={() => setTip(d)}>
                <rect x={x} y={y} width={CELL} height={CELL} rx="3" fill="var(--accent)" opacity={shade(d.ratio)} />
                {d.trained && <circle cx={x + CELL / 2} cy={y + CELL / 2} r="2.5" fill={filled ? 'var(--inverse)' : 'var(--accent)'} />}
              </g>
            );
          })}
        </svg>
      </div>
      <div class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-mute">
        <p class="num min-h-4 text-body">{tip ? `${formatDay(tip.date)} · ${tip.label}` : 'Hover or tap a day for details'}</p>
        <p class="flex items-center gap-1.5">
          <span>0 g</span>
          {STEPS.map((s) => <span key={s} class="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent" style={{ opacity: s }} />)}
          <span>target</span>
          <span class="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          <span>trained</span>
        </p>
      </div>
    </div>
  );
}

/** Least-squares slope of value against days; null when it can't be estimated. */
export function slopePerDay(data: DayValue[]): number | null {
  if (data.length < 2) return null;
  const t0 = fromIso(data[0].date).getTime();
  const xs = data.map((d) => Math.round((fromIso(d.date).getTime() - t0) / 86_400_000));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = data.reduce((a, d) => a + d.value, 0) / data.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return xs.reduce((a, x, i) => a + (x - mx) * (data[i].value - my), 0) / den;
}
