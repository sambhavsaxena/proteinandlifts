/* Full-screen image viewer. Any `[data-zoom]` element wrapping an <img> opens
   it on click: pinch, scroll or double-tap to zoom, drag to pan, and step
   through the other images in the same `[data-zoom-group]`. Plain DOM, so it
   works for Astro pages and Preact islands alike. */

const MAX_SCALE = 5;
const TAP_SLOP = 6;

const icon = (d: string) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
const control = 'inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-default disabled:opacity-40';

let dialog: HTMLDialogElement;
let stage: HTMLElement;
let picture: HTMLImageElement;
let caption: HTMLElement;
let counter: HTMLElement;
let zoomOut: HTMLButtonElement;
let zoomIn: HTMLButtonElement;
let steppers: HTMLElement[];

let items: Element[] = [];
let index = 0;
let scale = 1;
let x = 0;
let y = 0;
const pointers = new Map<number, { x: number; y: number }>();
let moved = 0;
let downOnBackdrop = false;

function build() {
  dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.className = 'fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-black p-0 text-white backdrop:bg-transparent';
  dialog.innerHTML = `
    <div data-stage class="relative flex h-full w-full cursor-zoom-in touch-none items-center justify-center overflow-hidden select-none">
      <img data-picture alt="" draggable="false" class="max-h-full max-w-full object-contain will-change-transform" />
    </div>
    <div class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <p data-counter class="num pl-1 text-sm text-white/80"></p>
      <div class="pointer-events-auto flex gap-2">
        <button type="button" data-out class="${control}" aria-label="Zoom out">${icon('M5 12h14')}</button>
        <button type="button" data-in class="${control}" aria-label="Zoom in">${icon('M12 5v14M5 12h14')}</button>
        <button type="button" data-close class="${control}" aria-label="Close">${icon('M6 6l12 12M18 6L6 18')}</button>
      </div>
    </div>
    <button type="button" data-step="-1" class="${control} absolute top-1/2 left-3 -translate-y-1/2" aria-label="Previous image">${icon('M15 6l-6 6 6 6')}</button>
    <button type="button" data-step="1" class="${control} absolute top-1/2 right-3 -translate-y-1/2" aria-label="Next image">${icon('M9 6l6 6-6 6')}</button>
    <p data-caption class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-white/90"></p>`;
  document.body.append(dialog);

  const $ = <T extends Element>(selector: string) => dialog.querySelector<T>(selector)!;
  stage = $('[data-stage]');
  picture = $('[data-picture]');
  caption = $('[data-caption]');
  counter = $('[data-counter]');
  zoomOut = $('[data-out]');
  zoomIn = $('[data-in]');
  steppers = [...dialog.querySelectorAll<HTMLElement>('[data-step]')];

  $('[data-close]').addEventListener('click', () => dialog.close());
  zoomOut.addEventListener('click', () => zoomAtCentre(scale / 1.6));
  zoomIn.addEventListener('click', () => zoomAtCentre(scale * 1.6));
  for (const button of steppers) button.addEventListener('click', () => step(Number(button.dataset.step)));
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    picture.removeAttribute('src');
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === '+' || e.key === '=') zoomAtCentre(scale * 1.6);
    else if (e.key === '-') zoomAtCentre(scale / 1.6);
    else if (e.key === '0') reset();
    else return;
    e.preventDefault();
  });

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Trackpad pinches arrive as ctrl+wheel with small deltas.
    zoomAt(scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener('dblclick', (e) => (scale > 1 ? reset() : zoomAt(2.5, e.clientX, e.clientY)));
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      moved = 0;
      downOnBackdrop = e.target === stage;
    }
  });
  stage.addEventListener('pointermove', onPointerMove);
  const release = (e: PointerEvent) => pointers.delete(e.pointerId);
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // A plain tap on the dark area closes, like tapping outside a sheet. Pointer
  // capture retargets the click to the stage, so check where the press began.
  stage.addEventListener('click', () => {
    if (downOnBackdrop && scale === 1 && moved < TAP_SLOP) dialog.close();
  });
  picture.addEventListener('load', apply);
  window.addEventListener('resize', () => dialog.open && apply());
}

function onPointerMove(e: PointerEvent) {
  const last = pointers.get(e.pointerId);
  if (!last) return;
  const before = [...pointers.values()];
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved += Math.hypot(e.clientX - last.x, e.clientY - last.y);

  if (pointers.size === 2) {
    const after = [...pointers.values()];
    const mid = (p: typeof after) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const span = (p: typeof after) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
    const [from, to] = [mid(before), mid(after)];
    x += to.x - from.x;
    y += to.y - from.y;
    zoomAt(scale * (span(after) / span(before)), to.x, to.y);
  } else if (pointers.size === 1 && scale > 1) {
    x += e.clientX - last.x;
    y += e.clientY - last.y;
    apply();
  }
}

/** Scales towards a screen point so the pixel under it stays put. */
function zoomAt(next: number, clientX: number, clientY: number) {
  next = Math.min(MAX_SCALE, Math.max(1, next));
  const box = stage.getBoundingClientRect();
  const px = clientX - box.left - box.width / 2;
  const py = clientY - box.top - box.height / 2;
  x = px - ((px - x) * next) / scale;
  y = py - ((py - y) * next) / scale;
  scale = next;
  apply();
}

function zoomAtCentre(next: number) {
  const box = stage.getBoundingClientRect();
  zoomAt(next, box.left + box.width / 2, box.top + box.height / 2);
}

function reset() {
  scale = 1;
  x = 0;
  y = 0;
  apply();
}

/** Keeps the image covering the screen while panning, then paints. */
function apply() {
  const box = stage.getBoundingClientRect();
  const maxX = Math.max(0, (picture.offsetWidth * scale - box.width) / 2);
  const maxY = Math.max(0, (picture.offsetHeight * scale - box.height) / 2);
  x = Math.min(maxX, Math.max(-maxX, x));
  y = Math.min(maxY, Math.max(-maxY, y));
  picture.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  stage.classList.toggle('cursor-zoom-in', scale === 1);
  stage.classList.toggle('cursor-grab', scale > 1);
  zoomOut.disabled = scale <= 1;
  zoomIn.disabled = scale >= MAX_SCALE;
}

function show(i: number) {
  index = (i + items.length) % items.length;
  const source = items[index].querySelector('img');
  picture.src = source?.currentSrc || source?.src || '';
  picture.alt = source?.alt ?? '';
  caption.textContent = source?.alt ?? '';
  counter.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
  for (const button of steppers) button.hidden = items.length < 2;
  reset();
}

function step(by: number) {
  if (items.length > 1) show(index + by);
}

document.addEventListener('click', (e) => {
  const trigger = (e.target as Element).closest?.('[data-zoom]');
  if (!trigger?.querySelector('img')) return;
  e.preventDefault();
  if (!dialog) build();
  const group = trigger.closest('[data-zoom-group]');
  items = group ? [...group.querySelectorAll('[data-zoom]')] : [trigger];
  show(items.indexOf(trigger));
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
});
