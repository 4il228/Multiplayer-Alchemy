import { useMemo, useState } from "react";
import type { Element, Recipe } from "@multialchemy/shared";
import { elementLabel } from "../validate";

interface Props {
  elements: Element[];
  recipes: Recipe[];
  hints: Record<string, string>;
  onChange: (hints: Record<string, string>) => void;
}

export default function HintsPanel({ elements, recipes, hints, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const resultIds = useMemo(() => {
    const ids = [...new Set(recipes.map((r) => r.result))].sort((a, b) => a.localeCompare(b));
    return ids;
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resultIds.filter((id) => {
      if (onlyMissing && hints[id]?.trim()) return false;
      if (!q) return true;
      const label = elementLabel(elements, id).toLowerCase();
      return id.toLowerCase().includes(q) || label.includes(q) || (hints[id] ?? "").toLowerCase().includes(q);
    });
  }, [resultIds, query, onlyMissing, hints, elements]);

  const updateHint = (id: string, text: string) => {
    onChange({ ...hints, [id]: text });
  };

  const missingCount = resultIds.filter((id) => !hints[id]?.trim()).length;

  return (
    <div>
      <div className="panel-header">
        <h2>Подсказки</h2>
        <span className="badge">{resultIds.length}</span>
        {missingCount > 0 && <span className="muted">без текста: {missingCount}</span>}
        <div className="spacer" />
        <label className="checkbox-row muted">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Только пустые
        </label>
        <input
          className="search"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <p className="muted">
        Косвенные намёки на создание каждого элемента-результата рецепта. Показываются игрокам при застое.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 220 }}>Элемент</th>
              <th>Подсказка</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((id) => (
              <tr key={id}>
                <td>
                  <div>{elementLabel(elements, id)}</div>
                  <code className="muted">{id}</code>
                </td>
                <td>
                  <textarea
                    className="hint-textarea"
                    value={hints[id] ?? ""}
                    onChange={(e) => updateHint(id, e.target.value)}
                    placeholder="Косвенный намёк, без прямого рецепта…"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">Ничего не найдено</div>}
      </div>
    </div>
  );
}
