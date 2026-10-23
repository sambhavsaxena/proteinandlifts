import { useMemo, useState } from 'preact/hooks';
import { FOOD_CATEGORIES, type CatalogFood, type FoodCategory } from '../data/food-catalog';
import { byCategory, indexFoods, ownPickerFood, queryWords, searchFoods, sharedPickerFood, type PickerFood } from '../lib/food-search';
import type { Food } from '../lib/types';
import { cx, g, kcal } from './ui';

/** Foods shown per section until "Show more" is pressed. */
const PAGE = 10;
const OWN = 'own';

type Section = { key: string; title: string; foods: PickerFood[]; paged: boolean };

type FoodPickerProps = {
  /** The account's foods, listed first. */
  own: Food[];
  /** Shared-list foods, grouped by category. */
  shared: CatalogFood[];
  ownTitle?: string;
  isSelected?: (food: PickerFood) => boolean;
  onPick: (food: PickerFood) => void;
  empty: string;
};

/**
 * Search, category chips, the account's foods and then the shared list by
 * category. Each section shows its first ten foods and grows ten at a time;
 * picking one category lists all of it.
 */
export function FoodPicker({ own, shared, ownTitle = 'Your foods', isSelected, onPick, empty }: FoodPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});

  const ownIndex = useMemo(() => indexFoods(own.map(ownPickerFood)), [own]);
  const sharedIndex = useMemo(() => indexFoods(shared.map(sharedPickerFood)), [shared]);
  const searched = queryWords(query).join(' ');
  const ownMatches = useMemo(() => searchFoods(ownIndex, queryWords(searched)), [ownIndex, searched]);
  const sharedGroups = useMemo(() => byCategory(searchFoods(sharedIndex, queryWords(searched))), [sharedIndex, searched]);

  // Chips for the categories that have matches.
  const categories = useMemo(() => {
    const present = new Set<FoodCategory>(sharedGroups.map((s) => s.category));
    for (const f of ownMatches) if (f.category) present.add(f.category);
    return FOOD_CATEGORIES.filter((c) => present.has(c));
  }, [sharedGroups, ownMatches]);

  const sections: Section[] = (
    category === null
      ? [{ key: OWN, title: ownTitle, foods: ownMatches, paged: true }, ...sharedGroups.map((s) => ({ key: s.category, title: s.category, foods: s.foods, paged: true }))]
      : [
          { key: OWN, title: ownTitle, foods: ownMatches.filter((f) => f.category === category), paged: false },
          { key: category, title: category, foods: sharedGroups.find((s) => s.category === category)?.foods ?? [], paged: false },
        ]
  ).filter((s) => s.foods.length);

  return (
    <div class="flex flex-col gap-3">
      <input
        class="input"
        type="search"
        aria-label="Search foods"
        placeholder="Search, e.g. paneer"
        value={query}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          // A new search starts every section at its first page again.
          setLimits({});
        }}
      />
      {categories.length > 1 && (
        <div role="group" aria-label="Food category" class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...categories].map((c) => (
            <button
              type="button"
              key={c ?? 'all'}
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              class="h-8 shrink-0 cursor-pointer rounded-full border border-hairline px-3 text-[13px] whitespace-nowrap text-body aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-on-primary"
            >
              {c ?? 'All'}
            </button>
          ))}
        </div>
      )}
      <div class="max-h-[28rem] overflow-y-auto pr-1">
        {!sections.length && <p class="py-6 text-center text-sm text-mute">{empty}</p>}
        {sections.map((section) => {
          const limit = section.paged ? (limits[section.key] ?? PAGE) : section.foods.length;
          const left = section.foods.length - limit;
          return (
            <section key={section.key} class="mb-4 last:mb-0">
              <div class="mb-1.5 flex items-baseline justify-between">
                <h3 class="text-xs font-medium text-ink">{section.title}</h3>
                <span class="num text-xs text-mute">{section.foods.length}</span>
              </div>
              <ul class="divide-y divide-hairline rounded-lg border border-hairline">
                {section.foods.slice(0, limit).map((food) => {
                  const selected = isSelected?.(food) ?? false;
                  return (
                    <li key={food.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onPick(food)}
                        class={cx('flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-canvas', selected && 'bg-canvas')}
                      >
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm text-ink">{food.name}</span>
                          <span class="num block truncate text-xs text-mute">
                            {[food.serving, food.calories === null ? null : `${kcal(food.calories)} kcal`, food.is_backup ? 'backup' : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span class="num shrink-0 text-sm text-ink">{g(food.protein_g)} g</span>
                        <span class="w-4 shrink-0 text-accent" aria-hidden="true">{selected ? '✓' : ''}</span>
                      </button>
                    </li>
                  );
                })}
                {left > 0 && (
                  <li>
                    <button type="button" class="w-full cursor-pointer px-3 py-2 text-center text-sm font-medium text-accent hover:bg-canvas" onClick={() => setLimits({ ...limits, [section.key]: limit + PAGE })}>
                      Show {Math.min(PAGE, left)} more · {left} left
                    </button>
                  </li>
                )}
                {section.paged && left <= 0 && limit > PAGE && (
                  <li>
                    <button type="button" class="w-full cursor-pointer px-3 py-2 text-center text-sm font-medium text-accent hover:bg-canvas" onClick={() => setLimits({ ...limits, [section.key]: PAGE })}>
                      Show fewer
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
