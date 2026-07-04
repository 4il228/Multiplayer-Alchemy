// Сайдбар-библиотека «Гримуар» (фаза C3): поиск, сетка открытых элементов
// (draggable — спавн на доску через HTML5 DnD), счётчик прогресса комнаты.
// Вёрстка и значения стилей — из design/game.html и design/tokens.md («Сайдбар (библиотека)»).
import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useGameStore } from "../state/gameStore";

const css = `
.ma-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 24px;
  background: rgba(45, 27, 77, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  box-sizing: border-box;
}
.ma-library-title {
  font-family: "Playfair Display", serif;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  color: #ffd09f;
}
.ma-library-subtitle {
  font-family: Montserrat, sans-serif;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #d8c3b0;
}
.ma-library-search-wrap {
  position: relative;
  margin: 24px 0;
  flex-shrink: 0;
}
.ma-library-search {
  width: 100%;
  box-sizing: border-box;
  background: #211a13;
  border: none;
  border-radius: 0.75rem;
  padding: 16px 16px 16px 48px;
  font-family: Inter, sans-serif;
  font-size: 16px;
  color: #efe0d4;
  outline: none;
}
.ma-library-search::placeholder {
  color: rgba(216, 195, 176, 0.4);
}
.ma-library-search:focus {
  box-shadow: 0 0 0 2px #ffd09f;
}
.ma-library-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.ma-library-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
}
.ma-library-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.ma-library-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.75rem;
  cursor: grab;
  transition: background 0.2s;
  user-select: none;
}
.ma-library-card:hover {
  background: rgba(255, 255, 255, 0.1);
}
.ma-library-card-icon {
  font-size: 24px;
  line-height: 1;
}
.ma-library-card-name {
  font-family: Montserrat, sans-serif;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  text-align: center;
  color: #efe0d4;
}
.ma-library-empty {
  grid-column: 1 / -1;
  padding: 16px;
  text-align: center;
  font-family: Inter, sans-serif;
  font-size: 14px;
  color: rgba(216, 195, 176, 0.6);
}
.ma-library-progress {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}
.ma-library-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ma-library-progress-label {
  color: #d8c3b0;
}
.ma-library-progress-count {
  color: #ffd09f;
}
.ma-library-progress-track {
  position: relative;
  width: 100%;
  height: 8px;
  background: #302921;
  border-radius: 9999px;
  overflow: hidden;
}
.ma-library-progress-track::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: ma-shimmer 2s infinite;
}
@keyframes ma-shimmer {
  100% { left: 100%; }
}
.ma-library-progress-fill {
  height: 100%;
  background: #ffab40;
  border-radius: 9999px;
  transition: width 0.4s ease;
}
`;

function SearchIcon() {
  return (
    <svg
      className="ma-library-search-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="#d8c3b0"
      aria-hidden="true"
    >
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

export default function Library() {
  const { roomState, elements, totalElements } = useGameStore();
  const [query, setQuery] = useState("");

  const unlocked = useMemo(() => {
    if (!roomState) return [];
    const list = roomState.unlockedElements
      .map((id) => elements.get(id))
      .filter((el): el is NonNullable<typeof el> => el !== undefined);
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((el) => el.name.toLowerCase().includes(q)) : list;
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [roomState, elements, query]);

  if (!roomState) return null;

  const unlockedCount = roomState.unlockedElements.length;
  const progressPct = totalElements > 0 ? (unlockedCount / totalElements) * 100 : 0;

  const onDragStart = (event: DragEvent<HTMLDivElement>, elementId: string) => {
    event.dataTransfer.setData("application/x-element-id", elementId);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="ma-library">
      <style>{css}</style>
      <div>
        <div className="ma-library-title">Гримуар</div>
        <div className="ma-library-subtitle">Журнал синтеза</div>
      </div>
      <div className="ma-library-search-wrap">
        <input
          type="text"
          className="ma-library-search"
          placeholder="Поиск элементов..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SearchIcon />
      </div>
      <div className="ma-library-grid-wrap">
        <div className="ma-library-grid">
          {unlocked.map((el) => (
            <div
              key={el.id}
              className="ma-library-card"
              draggable
              onDragStart={(event) => onDragStart(event, el.id)}
              title={el.name}
            >
              <span className="ma-library-card-icon">{el.icon}</span>
              <span className="ma-library-card-name">{el.name}</span>
            </div>
          ))}
          {unlocked.length === 0 && (
            <div className="ma-library-empty">Ничего не найдено</div>
          )}
        </div>
      </div>
      <div className="ma-library-progress">
        <div className="ma-library-progress-row">
          <span className="ma-library-progress-label">Прогресс</span>
          <span className="ma-library-progress-count">
            {unlockedCount} / {totalElements}
          </span>
        </div>
        <div className="ma-library-progress-track">
          <div className="ma-library-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  );
}
