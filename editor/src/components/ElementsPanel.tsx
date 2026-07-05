import { useMemo, useState } from "react";
import type { Element } from "@multialchemy/shared";
import Modal from "./Modal";

interface Props {
  elements: Element[];
  onChange: (elements: Element[]) => void;
}

const emptyElement = (): Element => ({
  id: "",
  name: "",
  icon: "❔",
  isBase: false,
});

export default function ElementsPanel({ elements, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Element | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.icon.includes(q),
    );
  }, [elements, query]);

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyElement());
  };

  const startEdit = (element: Element) => {
    setEditingId(element.id);
    setDraft({ ...element });
  };

  const cancel = () => {
    setDraft(null);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const id = draft.id.trim();
    if (!id) {
      window.alert("Укажите id элемента");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      window.alert("id: только латиница в нижнем регистре, цифры и _");
      return;
    }
    if (!draft.name.trim()) {
      window.alert("Укажите имя элемента");
      return;
    }

    if (editingId && editingId !== id) {
      window.alert("Изменение id элемента пока не поддерживается — создайте новый и удалите старый");
      return;
    }

    const exists = elements.some((e) => e.id === id);
    const next = exists
      ? elements.map((e) => (e.id === id ? { ...draft, id } : e))
      : [...elements, { ...draft, id }];

    onChange(next);
    cancel();
  };

  const remove = (id: string) => {
    const element = elements.find((e) => e.id === id);
    if (element?.isBase) {
      window.alert("Базовые элементы удалять нельзя");
      return;
    }
    if (!window.confirm(`Удалить элемент "${id}"?`)) return;
    onChange(elements.filter((e) => e.id !== id));
    if (editingId === id) cancel();
  };

  return (
    <div>
      <div className="panel-header">
        <h2>Элементы</h2>
        <span className="badge">{elements.length}</span>
        <div className="spacer" />
        <input
          className="search"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          + Элемент
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Иконка</th>
              <th>ID</th>
              <th>Имя</th>
              <th>Базовый</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((element) => (
              <tr key={element.id}>
                <td>{element.icon}</td>
                <td><code>{element.id}</code></td>
                <td>{element.name}</td>
                <td>{element.isBase ? "да" : "—"}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => startEdit(element)}>
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={element.isBase}
                      onClick={() => remove(element.id)}
                    >
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
          title={editingId ? `Редактирование: ${editingId}` : "Новый элемент"}
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
              ID
              <input
                autoFocus
                value={draft.id}
                disabled={Boolean(editingId)}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                placeholder="например, steam"
              />
            </label>
            <label>
              Иконка
              <input
                value={draft.icon}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                placeholder="эмодзи"
              />
            </label>
            <label className="full">
              Имя
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Отображаемое имя"
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.isBase}
                disabled={Boolean(editingId)}
                onChange={(e) => setDraft({ ...draft, isBase: e.target.checked })}
              />
              Базовый элемент (стартовый)
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
