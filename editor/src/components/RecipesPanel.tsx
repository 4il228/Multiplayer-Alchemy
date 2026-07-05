import { useMemo, useState } from "react";
import type { Element, Recipe } from "@multialchemy/shared";
import { elementLabel, normalizeRecipe, recipeId } from "../validate";
import Modal from "./Modal";

interface Props {
  elements: Element[];
  recipes: Recipe[];
  hints: Record<string, string>;
  onChange: (recipes: Recipe[]) => void;
  onHintsChange: (hints: Record<string, string>) => void;
}

function emptyRecipe(elements: Element[]): Recipe {
  const sorted = [...elements].sort((a, b) => a.id.localeCompare(b.id));
  const first = sorted[0]?.id ?? "";
  const second = sorted[1]?.id ?? first;
  return {
    id: "",
    ingredients: [first, second],
    result: "",
  };
}

export default function RecipesPanel({
  elements,
  recipes,
  hints,
  onChange,
  onHintsChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const elementOptions = useMemo(
    () => [...elements].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [elements],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((recipe) => {
      const [a, b] = recipe.ingredients;
      return (
        recipe.id.toLowerCase().includes(q) ||
        recipe.result.toLowerCase().includes(q) ||
        a.toLowerCase().includes(q) ||
        b.toLowerCase().includes(q)
      );
    });
  }, [recipes, query]);

  const startCreate = () => {
    if (elements.length < 2) {
      window.alert("Сначала добавьте хотя бы два элемента");
      return;
    }
    setEditingId(null);
    setDraft(emptyRecipe(elements));
  };

  const startEdit = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setDraft({ ...recipe });
  };

  const cancel = () => {
    setDraft(null);
    setEditingId(null);
  };

  const updateDraftIngredients = (index: 0 | 1, value: string) => {
    if (!draft) return;
    const ingredients = [...draft.ingredients] as [string, string];
    ingredients[index] = value;
    setDraft({ ...draft, ingredients });
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.result) {
      window.alert("Выберите результат рецепта");
      return;
    }
    const normalized = normalizeRecipe(draft);
    const duplicate = recipes.some((r) => r.id === normalized.id && r.id !== editingId);
    if (duplicate) {
      window.alert(`Рецепт "${normalized.id}" уже существует`);
      return;
    }

    const next = editingId
      ? recipes.map((r) => (r.id === editingId ? normalized : r))
      : [...recipes, normalized];

    if (!hints[normalized.result]) {
      onHintsChange({ ...hints, [normalized.result]: "" });
    }

    onChange(next);
    cancel();
  };

  const remove = (id: string) => {
    if (!window.confirm(`Удалить рецепт "${id}"?`)) return;
    onChange(recipes.filter((r) => r.id !== id));
    if (editingId === id) cancel();
  };

  return (
    <div>
      <div className="panel-header">
        <h2>Рецепты</h2>
        <span className="badge">{recipes.length}</span>
        <div className="spacer" />
        <input
          className="search"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          + Рецепт
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ингредиент 1</th>
              <th>Ингредиент 2</th>
              <th>Результат</th>
              <th>ID</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((recipe) => (
              <tr key={recipe.id}>
                <td>{elementLabel(elements, recipe.ingredients[0])}</td>
                <td>{elementLabel(elements, recipe.ingredients[1])}</td>
                <td>{elementLabel(elements, recipe.result)}</td>
                <td><code>{recipe.id}</code></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => startEdit(recipe)}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => remove(recipe.id)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">Ничего не найдено</div>}
      </div>

      {draft && (
        <Modal
          title={editingId ? `Редактирование: ${editingId}` : "Новый рецепт"}
          onClose={cancel}
          footer={
            <>
              <button type="button" className="btn btn-primary" onClick={saveDraft}>
                {editingId ? "Сохранить" : "Добавить"}
              </button>
              <button type="button" className="btn" onClick={cancel}>
                Отмена
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Ингредиент 1
              <select
                autoFocus
                value={draft.ingredients[0]}
                onChange={(e) => updateDraftIngredients(0, e.target.value)}
              >
                {elementOptions.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.icon} {el.name} ({el.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ингредиент 2
              <select
                value={draft.ingredients[1]}
                onChange={(e) => updateDraftIngredients(1, e.target.value)}
              >
                {elementOptions.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.icon} {el.name} ({el.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Результат
              <select
                value={draft.result}
                onChange={(e) => setDraft({ ...draft, result: e.target.value })}
              >
                <option value="">— выберите —</option>
                {elementOptions.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.icon} {el.name} ({el.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              ID рецепта (авто)
              <input
                readOnly
                value={draft.result ? recipeId(draft.ingredients[0], draft.ingredients[1]) : ""}
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
