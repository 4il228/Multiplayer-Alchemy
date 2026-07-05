import { useCallback, useEffect, useMemo, useState } from "react";
import { loadData, saveData } from "./api";
import ElementsPanel from "./components/ElementsPanel";
import HintsPanel from "./components/HintsPanel";
import RecipesPanel from "./components/RecipesPanel";
import ValidationPanel from "./components/ValidationPanel";
import type { EditorData } from "./validate";
import { validateDatabase } from "./validate";

type Tab = "elements" | "recipes" | "hints" | "validate";

export default function App() {
  const [tab, setTab] = useState<Tab>("elements");
  const [data, setData] = useState<EditorData | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const loaded = await loadData();
      setData(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const validation = useMemo(
    () => (data ? validateDatabase(data) : { ok: false, errors: ["Данные не загружены"] }),
    [data],
  );

  const dirty = data ? JSON.stringify(data) !== savedSnapshot : false;

  const update = (patch: Partial<EditorData>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
    setMessage("");
  };

  const save = async () => {
    if (!data) return;
    const check = validateDatabase(data);
    if (!check.ok) {
      setTab("validate");
      setMessage(`Сохранение отменено: ${check.errors.length} ошибок`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveData(data);
      setSavedSnapshot(JSON.stringify(data));
      setMessage("Сохранено в server/src/data/");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    if (dirty && !window.confirm("Есть несохранённые изменения. Перезагрузить с диска?")) return;
    await load();
  };

  if (loading || !data) {
    return (
      <div className="app">
        <div className="topbar">
          <h1>MultiAlchemy — редактор базы</h1>
        </div>
        <div className="content">{message || "Загрузка…"}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>MultiAlchemy — редактор базы</h1>
        <div className="spacer" />
        <span className="status">
          {dirty ? "Есть несохранённые изменения" : "Синхронизировано с диском"}
          {message ? ` · ${message}` : ""}
        </span>
        <button type="button" className="btn" onClick={() => void reload()} disabled={saving}>
          Перезагрузить
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? "Сохранение…" : "Сохранить на диск"}
        </button>
      </header>

      <div className="layout">
        <nav className="sidebar">
          <button
            type="button"
            className={`tab-btn ${tab === "elements" ? "active" : ""}`}
            onClick={() => setTab("elements")}
          >
            Элементы
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === "recipes" ? "active" : ""}`}
            onClick={() => setTab("recipes")}
          >
            Рецепты
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === "hints" ? "active" : ""}`}
            onClick={() => setTab("hints")}
          >
            Подсказки
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === "validate" ? "active" : ""}`}
            onClick={() => setTab("validate")}
          >
            Проверка
            {!validation.ok && <span className="badge" style={{ marginLeft: 8 }}>!</span>}
          </button>
        </nav>

        <main className="content">
          {tab === "elements" && (
            <ElementsPanel elements={data.elements} onChange={(elements) => update({ elements })} />
          )}
          {tab === "recipes" && (
            <RecipesPanel
              elements={data.elements}
              recipes={data.recipes}
              hints={data.hints}
              onChange={(recipes) => update({ recipes })}
              onHintsChange={(hints) => update({ hints })}
            />
          )}
          {tab === "hints" && (
            <HintsPanel
              elements={data.elements}
              recipes={data.recipes}
              hints={data.hints}
              onChange={(hints) => update({ hints })}
            />
          )}
          {tab === "validate" && <ValidationPanel result={validation} />}
        </main>
      </div>
    </div>
  );
}
