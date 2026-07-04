// Самопроверка контента: инварианты elements.json и recipes.json (PLAN.md, фаза P3).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Element, Recipe } from "@multialchemy/shared";

const dir = dirname(fileURLToPath(import.meta.url));
const elements: Element[] = JSON.parse(readFileSync(join(dir, "elements.json"), "utf8"));
const recipes: Recipe[] = JSON.parse(readFileSync(join(dir, "recipes.json"), "utf8"));

const errors: string[] = [];
const elementIds = new Set(elements.map((e) => e.id));

// Уникальность id элементов
if (elementIds.size !== elements.length) {
  errors.push("elements.json: обнаружены дубликаты id элементов");
}

// Ровно 4 базовых элемента с фиксированными id
const baseIds = elements.filter((e) => e.isBase).map((e) => e.id).sort();
const expectedBase = ["air", "earth", "fire", "water"];
if (JSON.stringify(baseIds) !== JSON.stringify(expectedBase)) {
  errors.push(`elements.json: базовые элементы должны быть ${expectedBase.join(", ")}, найдено: ${baseIds.join(", ")}`);
}

const recipeIds = new Set<string>();
for (const r of recipes) {
  const [a, b] = r.ingredients;

  // (1) id = отсортированные ingredients через ":"
  const expectedId = [a, b].slice().sort().join(":");
  if (r.id !== expectedId) {
    errors.push(`recipes.json: рецепт "${r.id}" — id должен быть "${expectedId}"`);
  }

  // (2) ingredients отсортированы по алфавиту
  if (a > b) {
    errors.push(`recipes.json: рецепт "${r.id}" — ingredients не отсортированы: [${a}, ${b}]`);
  }

  // (3) result и ингредиенты существуют в elements.json
  for (const ing of r.ingredients) {
    if (!elementIds.has(ing)) {
      errors.push(`recipes.json: рецепт "${r.id}" — ингредиент "${ing}" отсутствует в elements.json`);
    }
  }
  if (!elementIds.has(r.result)) {
    errors.push(`recipes.json: рецепт "${r.id}" — результат "${r.result}" отсутствует в elements.json`);
  }

  // (6) дубликатов id нет
  if (recipeIds.has(r.id)) {
    errors.push(`recipes.json: дубликат id рецепта "${r.id}"`);
  }
  recipeIds.add(r.id);
}

// (4) каждый небазовый элемент достижим от базовых (BFS по рецептам)
const reachable = new Set(elements.filter((e) => e.isBase).map((e) => e.id));
let grew = true;
while (grew) {
  grew = false;
  for (const r of recipes) {
    if (!reachable.has(r.result) && r.ingredients.every((ing) => reachable.has(ing))) {
      reachable.add(r.result);
      grew = true;
    }
  }
}
for (const e of elements) {
  if (!e.isBase && !reachable.has(e.id)) {
    errors.push(`elements.json: элемент "${e.id}" недостижим от базовых элементов`);
  }
}

if (errors.length > 0) {
  console.error(`Найдено ошибок: ${errors.length}`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`OK: ${elements.length} elements, ${recipes.length} recipes`);
