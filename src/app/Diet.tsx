import { useEffect, useMemo, useState } from 'preact/hooks';
import { catalogFoodsFor, type CatalogFood } from '../data/food-catalog';
import { DIET_OPTIONS } from '../data/starter';
import { addCatalogFood, caloriesOf, fetchFoods, fetchPlans, FOOD_COLUMNS, itemsFor, proteinOf } from '../lib/diet';
import type { PickerFood } from '../lib/food-search';
import { must, supabase } from '../lib/supabase';
import type { DietPlan, Food, Meal, MealItem } from '../lib/types';
import { Gate, type Ctx } from './Gate';
import { FoodPicker } from './FoodPicker';
import { Card, ConfirmButton, cx, Empty, ErrorNote, Field, g, IconButton, kcal, Loading, NumberInput, Page, Segmented } from './ui';

type Tab = 'Plan' | 'Foods';
const TABS: readonly Tab[] = ['Plan', 'Foods'];
const EVERY_DAY = '';
/** Your foods listed before "Show all". */
const FIRST_FOODS = 10;

function DietScreen({ profile, saveProfile }: Ctx) {
  const [tab, setTab] = useState<Tab>(location.hash === '#foods' ? 'Foods' : 'Plan');
  const [plans, setPlans] = useState<DietPlan[] | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [planId, setPlanId] = useState<string | null>(profile.active_plan_id);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e.message));
  };

  useEffect(() => {
    run(async () => {
      const [p, f] = await Promise.all([fetchPlans(), fetchFoods()]);
      setPlans(p);
      setFoods(f);
      if (!p.some((x) => x.id === planId)) setPlanId(p[0]?.id ?? null);
    });
  }, []);

  // Shared foods that suit the diet and are not in the account's list yet.
  const shared = useMemo(() => catalogFoodsFor(profile.diet_preference, foods.map((f) => f.name)), [profile.diet_preference, foods]);
  const adopt: Adopt = async (food) => {
    const copy = await addCatalogFood(food, foods);
    setFoods((current) => (current.some((f) => f.id === copy.id) ? current : [...current, copy].sort((a, b) => a.name.localeCompare(b.name))));
    return copy;
  };

  if (!plans) return <Page title="Diet">{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const plan = plans.find((p) => p.id === planId) ?? null;
  const setPlan = (next: DietPlan) => setPlans(plans.map((p) => (p.id === next.id ? next : p)));

  const createPlan = () =>
    run(async () => {
      const created = must(await supabase.from('diet_plans').insert({ name: 'New plan' }).select('id,name,variants').single());
      setPlans([...plans, { ...created, meals: [] } as DietPlan]);
      setPlanId(created.id);
      if (!profile.active_plan_id) await saveProfile({ active_plan_id: created.id });
    });

  const deletePlan = () =>
    run(async () => {
      must(await supabase.from('diet_plans').delete().eq('id', plan!.id));
      const rest = plans.filter((p) => p.id !== plan!.id);
      setPlans(rest);
      setPlanId(rest[0]?.id ?? null);
      if (profile.active_plan_id === plan!.id) await saveProfile({ active_plan_id: rest[0]?.id ?? null });
    });

  return (
    <Page
      title="Diet"
      action={
        <Segmented
          label="Section"
          options={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t);
            history.replaceState(null, '', t === 'Foods' ? '#foods' : location.pathname);
          }}
        />
      }
    >
      <ErrorNote error={error} />
      {tab === 'Foods' ? (
        <FoodsTab foods={foods} setFoods={setFoods} shared={shared} adopt={adopt} dietLabel={profile.diet_preference ? DIET_OPTIONS[profile.diet_preference].label : null} run={run} />
      ) : (
        <>
          <Card>
            <div class="flex flex-wrap items-end gap-2">
              <label class="min-w-40 flex-1">
                <span class="label">Plan</span>
                <select class="input" value={planId ?? ''} onChange={(e) => setPlanId(e.currentTarget.value)} disabled={!plans.length}>
                  {!plans.length && <option value="">No plans yet</option>}
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === profile.active_plan_id ? ' (following)' : ''}</option>)}
                </select>
              </label>
              {plan && plan.id !== profile.active_plan_id && (
                <button type="button" class="btn btn-primary" onClick={() => run(() => saveProfile({ active_plan_id: plan.id }))}>Follow this plan</button>
              )}
              <button type="button" class="btn" onClick={createPlan}>New plan</button>
            </div>
          </Card>
          {plan ? (
            <PlanEditor key={plan.id} plan={plan} setPlan={setPlan} foods={foods} shared={shared} adopt={adopt} target={profile.protein_target_g} run={run} onDelete={deletePlan} onNeedFood={() => setTab('Foods')} />
          ) : (
            <Empty>Create a plan to lay out the meals you eat on a normal day.</Empty>
          )}
        </>
      )}
    </Page>
  );
}

type Run = (fn: () => Promise<void>) => void;
type Adopt = (food: CatalogFood) => Promise<Food>;

type PlanProps = {
  plan: DietPlan;
  setPlan: (plan: DietPlan) => void;
  foods: Food[];
  shared: CatalogFood[];
  adopt: Adopt;
  target: number;
  run: Run;
  onDelete: () => void;
  onNeedFood: () => void;
};

function PlanEditor({ plan, setPlan, foods, shared, adopt, target, run, onDelete, onNeedFood }: PlanProps) {
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const setMeal = (meal: Meal) => setPlan({ ...plan, meals: plan.meals.map((m) => (m.id === meal.id ? meal : m)) });
  // A plan without variants still has one implicit "every day" column.
  const columns: (string | null)[] = plan.variants.length ? plan.variants : [null];

  const rename = (name: string) =>
    run(async () => {
      must(await supabase.from('diet_plans').update({ name }).eq('id', plan.id));
      setPlan({ ...plan, name });
    });

  // Variants are free text. Same count = renames (items follow the new names);
  // otherwise items tagged with a variant that no longer exists become "every day".
  const saveVariants = (raw: string) =>
    run(async () => {
      const next = [...new Set(raw.split(',').map((v) => v.trim()).filter(Boolean))];
      const renames = new Map<string, string | null>();
      plan.variants.forEach((old, i) => {
        if (next.includes(old)) return;
        renames.set(old, next.length === plan.variants.length ? next[i] : null);
      });
      must(await supabase.from('diet_plans').update({ variants: next }).eq('id', plan.id));
      const mealIds = plan.meals.map((m) => m.id);
      for (const [from, to] of renames) {
        if (mealIds.length) must(await supabase.from('meal_items').update({ variant: to }).in('meal_id', mealIds).eq('variant', from));
      }
      setPlan({
        ...plan,
        variants: next,
        meals: plan.meals.map((m) => ({ ...m, meal_items: m.meal_items.map((i) => (i.variant !== null && renames.has(i.variant) ? { ...i, variant: renames.get(i.variant)! } : i)) })),
      });
    });

  const addMeal = () =>
    run(async () => {
      const position = plan.meals.length ? Math.max(...plan.meals.map((m) => m.position)) + 1 : 0;
      const created = must(await supabase.from('meals').insert({ plan_id: plan.id, name: 'New meal', position }).select('id,plan_id,name,position').single());
      setPlan({ ...plan, meals: [...plan.meals, { ...created, meal_items: [] } as Meal] });
    });

  const moveMeal = (index: number, by: -1 | 1) =>
    run(async () => {
      const next = [...plan.meals];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      const renumbered = next.map((m, position) => ({ ...m, position }));
      await Promise.all(renumbered.filter((m, i) => m.position !== next[i].position).map((m) => supabase.from('meals').update({ position: m.position }).eq('id', m.id).then(must)));
      setPlan({ ...plan, meals: renumbered });
    });

  const deleteMeal = (meal: Meal) =>
    run(async () => {
      must(await supabase.from('meals').delete().eq('id', meal.id));
      setPlan({ ...plan, meals: plan.meals.filter((m) => m.id !== meal.id) });
    });

  return (
    <>
      <Card>
        <div class="grid gap-4 sm:grid-cols-2">
          <Field label="Plan name">
            <input class="input" value={plan.name} onChange={(e) => e.currentTarget.value.trim() && rename(e.currentTarget.value.trim())} />
          </Field>
          <Field label="Day variants" hint="Comma separated, e.g. Egg day, No-egg day. Leave empty for one fixed day.">
            <input class="input" value={plan.variants.join(', ')} onChange={(e) => saveVariants(e.currentTarget.value)} />
          </Field>
        </div>
        <dl class="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-hairline pt-4">
          {columns.map((variant) => {
            const dayItems = plan.meals.flatMap((m) => itemsFor(m, variant));
            const total = proteinOf(dayItems, foodMap);
            return (
              <div key={variant ?? 'all'}>
                <dt class="text-xs text-mute">{variant ?? 'Daily total'}</dt>
                <dd class="num text-lg font-semibold tracking-tight text-ink">
                  {g(total)} g <span class="text-sm font-normal text-mute">· {kcal(caloriesOf(dayItems, foodMap))} kcal</span>{' '}
                  <span class={cx('text-sm font-normal', total >= target ? 'text-good' : 'text-warn')}>{total >= target ? `target ${g(target)} g met` : `${g(target - total)} g under target`}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {plan.meals.map((meal, index) => (
        <MealCard
          key={meal.id}
          meal={meal}
          setMeal={setMeal}
          variants={plan.variants}
          columns={columns}
          foods={foods}
          shared={shared}
          adopt={adopt}
          foodMap={foodMap}
          run={run}
          onMove={(by) => moveMeal(index, by)}
          canMoveUp={index > 0}
          canMoveDown={index < plan.meals.length - 1}
          onDelete={() => deleteMeal(meal)}
          onNeedFood={onNeedFood}
        />
      ))}

      <div class="flex items-center justify-between gap-3">
        <ConfirmButton label="Delete plan" onConfirm={onDelete} />
        <button type="button" class="btn" onClick={addMeal}>Add meal</button>
      </div>
    </>
  );
}

type MealProps = {
  meal: Meal;
  setMeal: (meal: Meal) => void;
  variants: string[];
  columns: (string | null)[];
  foods: Food[];
  shared: CatalogFood[];
  adopt: Adopt;
  foodMap: Map<string, Food>;
  run: Run;
  onMove: (by: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
  onNeedFood: () => void;
};

function MealCard({ meal, setMeal, variants, columns, foods, shared, adopt, foodMap, run, onMove, canMoveUp, canMoveDown, onDelete, onNeedFood }: MealProps) {
  const [adding, setAdding] = useState(false);

  const rename = (name: string) =>
    run(async () => {
      must(await supabase.from('meals').update({ name }).eq('id', meal.id));
      setMeal({ ...meal, name });
    });

  const patchItem = (item: MealItem, patch: Partial<MealItem>) =>
    run(async () => {
      must(await supabase.from('meal_items').update(patch).eq('id', item.id));
      setMeal({ ...meal, meal_items: meal.meal_items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) });
    });

  const removeItem = (item: MealItem) =>
    run(async () => {
      must(await supabase.from('meal_items').delete().eq('id', item.id));
      setMeal({ ...meal, meal_items: meal.meal_items.filter((i) => i.id !== item.id) });
    });

  const addItem = (picked: PickerFood) =>
    run(async () => {
      const foodId = picked.shared ? (await adopt(picked.shared)).id : picked.id;
      const position = meal.meal_items.length ? Math.max(...meal.meal_items.map((i) => i.position)) + 1 : 0;
      const created = must(await supabase.from('meal_items').insert({ meal_id: meal.id, food_id: foodId, qty: 1, position }).select('id,meal_id,food_id,qty,variant,position').single());
      setMeal({ ...meal, meal_items: [...meal.meal_items, created as MealItem] });
      setAdding(false);
    });

  return (
    <Card>
      <div class="flex items-center gap-1">
        <input class="input flex-1 font-medium" aria-label="Meal name" value={meal.name} onChange={(e) => e.currentTarget.value.trim() && rename(e.currentTarget.value.trim())} />
        <IconButton label="Move meal up" onClick={() => onMove(-1)} disabled={!canMoveUp}>↑</IconButton>
        <IconButton label="Move meal down" onClick={() => onMove(1)} disabled={!canMoveDown}>↓</IconButton>
      </div>

      <ul class="mt-3 divide-y divide-hairline">
        {meal.meal_items.map((item) => {
          const food = foodMap.get(item.food_id);
          return (
            <li key={item.id} class="flex flex-wrap items-center gap-2 py-2.5">
              <div class="w-full sm:w-auto sm:min-w-32 sm:flex-1">
                <p class="truncate text-sm font-medium text-ink">{food?.name ?? 'Deleted food'}</p>
                <p class="num truncate text-xs text-mute">
                  {food ? `${food.serving} · ${g(food.protein_g)} g${food.calories === null ? '' : ` · ${kcal(food.calories)} kcal`} each` : ''}
                </p>
              </div>
              <NumberInput label="Servings" class="w-16" value={item.qty} onCommit={(qty) => patchItem(item, { qty })} />
              {variants.length > 0 && (
                <select class="input w-32 flex-1 sm:flex-none" aria-label="Eaten on" value={item.variant ?? EVERY_DAY} onChange={(e) => patchItem(item, { variant: e.currentTarget.value || null })}>
                  <option value={EVERY_DAY}>Every day</option>
                  {variants.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              <span class="num w-20 text-right text-sm text-ink">
                {g(item.qty * (food?.protein_g ?? 0))} g
                {food?.calories !== null && food?.calories !== undefined && <span class="block text-xs text-mute">{kcal(item.qty * food.calories)} kcal</span>}
              </span>
              <IconButton label={`Remove ${food?.name ?? 'item'}`} onClick={() => removeItem(item)}>×</IconButton>
            </li>
          );
        })}
      </ul>

      {adding && (
        <div class="mt-2 border-t border-hairline pt-3">
          <FoodPicker own={foods} shared={shared} onPick={addItem} empty="No matching foods. Create it as your own food instead." />
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-sm btn-quiet" onClick={onNeedFood}>Create your own food</button>
            <button type="button" class="btn btn-sm" onClick={() => setAdding(false)}>Done</button>
          </div>
        </div>
      )}

      <div class="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        {!adding && <button type="button" class="btn btn-sm" onClick={() => setAdding(true)}>Add a food</button>}
        <p class="num text-sm text-ink">
          {columns.map((v) => `${v ? `${v}: ` : ''}${g(proteinOf(itemsFor(meal, v), foodMap))} g, ${kcal(caloriesOf(itemsFor(meal, v), foodMap))} kcal`).join('  ·  ')}
        </p>
        <ConfirmButton label="Delete meal" onConfirm={onDelete} />
      </div>
    </Card>
  );
}

type FoodsProps = { foods: Food[]; setFoods: (foods: Food[]) => void; shared: CatalogFood[]; adopt: Adopt; dietLabel: string | null; run: Run };

function FoodsTab({ foods, setFoods, shared, adopt, dietLabel, run }: FoodsProps) {
  const [name, setName] = useState('');
  const [serving, setServing] = useState('');
  const [protein, setProtein] = useState('');
  const [calories, setCalories] = useState('');
  const [all, setAll] = useState(false);

  const add = (e: Event) => {
    e.preventDefault();
    run(async () => {
      // Calories are optional: left empty, the food has none.
      const kcalValue = calories === '' ? null : Math.round(Number(calories)) || 0;
      const created = must(
        await supabase
          .from('foods')
          .insert({ name: name.trim(), serving: serving.trim() || '1 serving', protein_g: Number(protein) || 0, calories: kcalValue })
          .select(FOOD_COLUMNS)
          .single(),
      ) as Food;
      setFoods([...foods, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setServing('');
      setProtein('');
      setCalories('');
    });
  };

  const patch = (food: Food, change: Partial<Food>) =>
    run(async () => {
      must(await supabase.from('foods').update(change).eq('id', food.id));
      setFoods(foods.map((f) => (f.id === food.id ? { ...f, ...change } : f)));
    });

  const remove = (food: Food) =>
    run(async () => {
      must(await supabase.from('foods').delete().eq('id', food.id));
      setFoods(foods.filter((f) => f.id !== food.id));
    });

  const addShared = (picked: PickerFood) => {
    if (picked.shared) run(async () => void (await adopt(picked.shared!)));
  };

  return (
    <>
      <Card title="Add from the shared list">
        <p class="mb-3 text-sm">
          Everyday foods common in India and elsewhere{dietLabel ? `, filtered for a ${dietLabel.toLowerCase()} diet` : ''}. Adding one copies it into your foods, where you can change its numbers for
          yourself; the shared list stays as it is.
        </p>
        <FoodPicker own={[]} shared={shared} onPick={addShared} empty={shared.length ? 'No matching foods.' : 'Every shared food is already in your list.'} />
      </Card>

      <Card title="Add your own food">
        <p class="mb-3 text-sm">Not in the shared list? Foods you add here are yours alone.</p>
        <form onSubmit={add} class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_6rem_7rem_auto]">
          <input class="input col-span-2 sm:col-span-1" aria-label="Food name" placeholder="Food, e.g. Greek yoghurt" required value={name} onInput={(e) => setName(e.currentTarget.value)} />
          <input class="input" aria-label="Serving size" placeholder="Serving, e.g. 100 g" value={serving} onInput={(e) => setServing(e.currentTarget.value)} />
          <input class="input num" type="number" inputMode="decimal" min="0" step="any" aria-label="Protein per serving in grams" placeholder="Protein g" required value={protein} onInput={(e) => setProtein(e.currentTarget.value)} />
          <input class="input num" type="number" inputMode="decimal" min="0" step="1" aria-label="Calories per serving, optional" placeholder="kcal (optional)" value={calories} onInput={(e) => setCalories(e.currentTarget.value)} />
          <button type="submit" class="btn btn-primary">Add food</button>
        </form>
      </Card>

      <Card title={`Your foods (${foods.length})`}>
        {foods.length === 0 && <Empty>Nothing here yet. Pick foods from the shared list or add your own, with protein per serving.</Empty>}
        <ul class="divide-y divide-hairline">
          {(all ? foods : foods.slice(0, FIRST_FOODS)).map((food) => (
            <li key={food.id} class="grid grid-cols-[1fr_5.5rem_5.5rem_2rem] items-center gap-2 py-2.5 sm:grid-cols-[1fr_9rem_5.5rem_5.5rem_auto_2rem]">
              <input class="input" aria-label="Food name" value={food.name} onChange={(e) => e.currentTarget.value.trim() && patch(food, { name: e.currentTarget.value.trim() })} />
              <input class="input order-4 sm:order-none" aria-label={`Serving size of ${food.name}`} value={food.serving} onChange={(e) => patch(food, { serving: e.currentTarget.value.trim() || '1 serving' })} />
              <div class="relative">
                <NumberInput label={`Protein per serving of ${food.name}`} class="pr-6" value={food.protein_g} onCommit={(protein_g) => patch(food, { protein_g })} />
                <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-mute">g</span>
              </div>
              <div class="relative">
                <NumberInput
                  label={`Calories per serving of ${food.name}, optional`}
                  class="pr-9"
                  step={1}
                  value={food.calories}
                  onCommit={(n) => patch(food, { calories: Math.round(n) })}
                  onClear={() => patch(food, { calories: null })}
                />
                <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-mute">kcal</span>
              </div>
              <label class="order-5 col-span-3 flex items-center gap-2 text-xs text-body sm:order-none sm:col-span-1" title="Offered as a one-tap top-up when you end the day short">
                <input type="checkbox" checked={food.is_backup} onChange={(e) => patch(food, { is_backup: e.currentTarget.checked })} />
                Backup
              </label>
              <IconButton label={`Delete ${food.name}`} onClick={() => remove(food)}>×</IconButton>
            </li>
          ))}
        </ul>
        {foods.length > FIRST_FOODS && (
          <button type="button" class="btn btn-sm btn-quiet mt-2" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show all ${foods.length} foods`}
          </button>
        )}
      </Card>
    </>
  );
}

export default function Diet() {
  return <Gate>{(ctx) => <DietScreen {...ctx} />}</Gate>;
}
