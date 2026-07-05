import type { Element, Recipe } from "@multialchemy/shared";

export interface EditorData {
  elements: Element[];
  recipes: Recipe[];
  hints: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function recipeId(ing1: string, ing2: string): string {
  return [ing1, ing2].sort().join(":");
}

export function normalizeRecipe(recipe: Recipe): Recipe {
  const [a, b] = [...recipe.ingredients].sort() as [string, string];
  return {
    id: recipeId(a, b),
    ingredients: [a, b],
    result: recipe.result,
  };
}

export function validateDatabase(data: EditorData): ValidationResult {
  const errors: string[] = [];
  const { elements, recipes, hints } = data;
  const elementIds = new Set(elements.map((e) => e.id));

  if (elementIds.size !== elements.length) {
    errors.push("elements.json: обнаружены дубликаты id элементов");
  }

  for (const element of elements) {
    if (!/^[a-z][a-z0-9_]*$/.test(element.id)) {
      errors.push(`elements.json: id "${element.id}" — только латиница, цифры и _`);
    }
    if (!element.name.trim()) {
      errors.push(`elements.json: элемент "${element.id}" — пустое имя`);
    }
    if (!element.icon.trim()) {
      errors.push(`elements.json: элемент "${element.id}" — пустая иконка`);
    }
  }

  const baseIds = elements.filter((e) => e.isBase).map((e) => e.id).sort();
  const expectedBase = ["air", "earth", "fire", "water"];
  if (JSON.stringify(baseIds) !== JSON.stringify(expectedBase)) {
    errors.push(
      `elements.json: базовые элементы должны быть ${expectedBase.join(", ")}, найдено: ${baseIds.join(", ")}`,
    );
  }

  const recipeIds = new Set<string>();
  for (const recipe of recipes) {
    const [a, b] = recipe.ingredients;
    const expectedId = recipeId(a, b);

    if (recipe.id !== expectedId) {
      errors.push(`recipes.json: рецепт "${recipe.id}" — id должен быть "${expectedId}"`);
    }
    if (a > b) {
      errors.push(`recipes.json: рецепт "${recipe.id}" — ingredients не отсортированы: [${a}, ${b}]`);
    }
    for (const ing of recipe.ingredients) {
      if (!elementIds.has(ing)) {
        errors.push(`recipes.json: рецепт "${recipe.id}" — ингредиент "${ing}" отсутствует в elements.json`);
      }
    }
    if (!elementIds.has(recipe.result)) {
      errors.push(`recipes.json: рецепт "${recipe.id}" — результат "${recipe.result}" отсутствует в elements.json`);
    }
    if (recipeIds.has(recipe.id)) {
      errors.push(`recipes.json: дубликат id рецепта "${recipe.id}"`);
    }
    recipeIds.add(recipe.id);
  }

  const hintIds = new Set(Object.keys(hints));
  for (const recipe of recipes) {
    if (!hints[recipe.result]?.trim()) {
      errors.push(`hints.json: нет подсказки для результата "${recipe.result}" (рецепт "${recipe.id}")`);
    }
  }
  for (const id of hintIds) {
    if (!recipes.some((r) => r.result === id)) {
      errors.push(`hints.json: подсказка для "${id}" — нет такого результата в recipes.json`);
    }
    if (!elementIds.has(id)) {
      errors.push(`hints.json: подсказка для "${id}" — элемент отсутствует в elements.json`);
    }
  }

  const reachable = new Set(elements.filter((e) => e.isBase).map((e) => e.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const recipe of recipes) {
      if (!reachable.has(recipe.result) && recipe.ingredients.every((ing) => reachable.has(ing))) {
        reachable.add(recipe.result);
        grew = true;
      }
    }
  }
  for (const element of elements) {
    if (!element.isBase && !reachable.has(element.id)) {
      errors.push(`elements.json: элемент "${element.id}" недостижим от базовых элементов`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function elementLabel(elements: Element[], id: string): string {
  const el = elements.find((e) => e.id === id);
  return el ? `${el.icon} ${el.name}` : id;
}
