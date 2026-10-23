import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Grams with at most one decimal: 124.5, 120, 8. */
export const g = (n: number) => String(Math.round(n * 10) / 10);

/** Whole kcal with thousands separators: "1,240". */
export const kcal = (n: number) => Math.round(n).toLocaleString('en');

export function Page({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:py-8">
      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0">
          {eyebrow && <p class="eyebrow mb-1">{eyebrow}</p>}
          <h1 class="truncate text-2xl tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, action, children, class: className }: { title?: string; action?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={cx('card', className)}>
      {(title || action) && (
        <div class="mb-3 flex min-h-8 items-center justify-between gap-3">
          {title && <h2 class="text-[15px] tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, class: className }: { label: string; hint?: string; children: ComponentChildren; class?: string }) {
  return (
    <label class={cx('block', className)}>
      <span class="label">{label}</span>
      {children}
      {hint && <span class="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly T[] | readonly { readonly value: T; readonly label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div role="group" aria-label={label} class="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-hairline bg-canvas p-0.5">
      {items.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          class="h-8 cursor-pointer rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-mute aria-pressed:bg-elevated aria-pressed:text-ink aria-pressed:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" class="rounded-md border border-bad/40 px-3 py-2 text-sm text-bad">
      {error}
    </p>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div class="flex flex-1 items-center justify-center py-24 text-sm text-mute" role="status">
      {label}…
    </div>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-sm text-mute">{children}</p>;
}

/** Delete button that asks once before acting; reverts if left alone. */
export function ConfirmButton({ label, confirm = 'Confirm delete', onConfirm, class: className }: { label: string; confirm?: string; onConfirm: () => void; class?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" class={cx('btn btn-sm btn-danger', armed && 'border-bad', className)} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirm : label}
    </button>
  );
}

export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ComponentChildren }) {
  return (
    <button type="button" class="btn btn-sm btn-quiet w-8 px-0" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Image that opens full screen and zooms on click (see lib/zoom.ts). Wrap a set in `data-zoom-group` to page through it. */
export function ZoomImage({ src, alt, class: className }: { src: string; alt: string; class?: string }) {
  return (
    <button type="button" data-zoom aria-haspopup="dialog" class="block h-full w-full cursor-zoom-in rounded-lg">
      <img src={src} alt={alt} loading="lazy" class={className} />
    </button>
  );
}

/** Progress ring. Purely visual: the caller renders the number next to it. */
export function Ring({ value, max, size = 132, children }: { value: number; max: number; size?: number; children?: ComponentChildren }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div class="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} class="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 1 ? 'var(--good)' : 'var(--accent)'}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Tracks an element's width so SVG charts can render at real pixel size. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Number input that reports a parsed value on commit and ignores junk. With `onClear`, emptying it is allowed too. */
export function NumberInput({
  value,
  onCommit,
  onClear,
  min = 0,
  step = 'any',
  class: className,
  label,
  placeholder,
}: {
  value: number | null;
  onCommit: (n: number) => void;
  onClear?: () => void;
  min?: number;
  step?: number | 'any';
  class?: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      class={cx('input num', className)}
      aria-label={label}
      min={min}
      step={step}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const n = Number(e.currentTarget.value);
        if (e.currentTarget.value === '' && onClear) onClear();
        else if (e.currentTarget.value !== '' && Number.isFinite(n) && n >= min) onCommit(n);
        else e.currentTarget.value = value === null ? '' : String(value);
      }}
    />
  );
}

export const param = (name: string) => new URLSearchParams(location.search).get(name);
