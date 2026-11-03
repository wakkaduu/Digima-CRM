import { useEffect, useRef, useState } from 'react';
import { peso } from '../../lib/format';
import { dayShort, niceTicks } from './overview';

const HEIGHT = 208;
const PAD = { top: 8, right: 4, bottom: 26, left: 64 };
const MIN_LABEL_GAP = 56; // px between x labels, so "Oct 26" never touches its neighbour
const money = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

/** Width of the element, so the SVG is drawn at 1:1 and its text never scales. */
function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One series of money per day as square columns in the accent: 4 faint gridlines, round ticks with the top one above the
 * largest bar, no y-axis line, a heavier baseline, x labels on one step that lands on the last day. Days with nothing
 * are missing bars, not stubs. Amounts are in centavos. `day` may be the start of a week or month: pass `tickLabel` to
 * name it, and `step` to label every n-th period instead of every 3rd or 4th.
 */
export function DailyBars({
  days,
  label,
  tickLabel = dayShort,
  step: everyN,
}: {
  days: { day: string; cents: number }[];
  label: string;
  tickLabel?: (day: string) => string;
  step?: number;
}) {
  const [ref, width] = useWidth();
  const maxC = Math.max(0, ...days.map((d) => d.cents));
  const ticks = niceTicks(maxC / 100); // pesos
  const top = ticks[ticks.length - 1] ?? 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = days.length ? plotW / days.length : 0;
  const barW = Math.max(2, Math.min(band * 0.64, 40));
  const y = (pesos: number) => PAD.top + plotH - (pesos / top) * plotH;
  // Labels every `step` periods, counted back from the last one, and never closer than a label's width ("Oct 26").
  const step = Math.max(everyN ?? (width < 420 ? 4 : 3), band > 0 ? Math.ceil(MIN_LABEL_GAP / band) : 1);
  const peak = days.reduce((a, b) => (b.cents > a.cents ? b : a), days[0] ?? { day: '', cents: 0 });

  const summary =
    maxC === 0
      ? `${label}: nothing approved from ${tickLabel(days[0]?.day ?? '')} to ${tickLabel(days.at(-1)?.day ?? '')}.`
      : `${label}, ${tickLabel(days[0]!.day)} to ${tickLabel(days.at(-1)!.day)}. Highest ${tickLabel(peak.day)}, ${peso(peak.cents / 100)}.`;

  return (
    <div ref={ref} className="w-full">
      <svg role="img" aria-label={summary} width={width} height={HEIGHT} className="block overflow-visible">
        {ticks.length > 1 &&
          ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-border-strong' : 'stroke-border'} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-text-muted text-micro tabular-nums">
                {t === 0 ? '₱0' : `₱${money.format(t)}`}
              </text>
            </g>
          ))}
        {ticks.length <= 1 && (
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="stroke-border-strong" strokeWidth={1.5} />
        )}
        {days.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const h = (d.cents / 100 / top) * plotH;
          return (
            <g key={d.day}>
              {d.cents > 0 && (
                <rect x={cx - barW / 2} y={y(0) - h} width={barW} height={h} className="fill-accent">
                  <title>{`${tickLabel(d.day)}: ${peso(d.cents / 100)}`}</title>
                </rect>
              )}
              {(days.length - 1 - i) % step === 0 && (
                <text x={cx} y={HEIGHT - 6} textAnchor="middle" className="fill-text-muted text-micro">
                  {tickLabel(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
