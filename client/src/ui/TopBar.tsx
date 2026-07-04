// Шапка игрового экрана (фаза C3): бейдж кода комнаты (клик — копирование),
// цветные точки игроков с тултипами имён, кнопка «Очистить доску».
// Вёрстка и значения стилей — из design/game.html и design/tokens.md («Шапка (top bar)»).
import { useState } from "react";
import { socket } from "../net/socket";
import { useGameStore } from "../state/gameStore";

const css = `
.ma-glass-pill {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
}
.ma-topbar-code {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffd09f;
}
.ma-topbar-code:hover {
  background: rgba(255, 255, 255, 0.1);
}
.ma-topbar-players {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 24px;
}
.ma-topbar-player {
  position: relative;
  display: flex;
  align-items: center;
}
.ma-topbar-dot {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
}
.ma-topbar-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  background: #302921;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: Montserrat, sans-serif;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  color: #efe0d4;
  z-index: 20;
}
.ma-topbar-player:hover .ma-topbar-tooltip {
  opacity: 1;
}
.ma-topbar-divider {
  height: 16px;
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}
.ma-topbar-count {
  font-family: Montserrat, sans-serif;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  color: #d8c3b0;
}
.ma-topbar-clear {
  padding: 8px 24px;
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: transparent;
  border: 1.5px solid rgba(255, 208, 159, 0.4);
  border-radius: 0.5rem;
  color: #ffd09f;
  cursor: pointer;
  transition: all 0.2s;
}
.ma-topbar-clear:hover {
  background: rgba(255, 208, 159, 0.1);
  border-color: #ffd09f;
}
.ma-topbar-clear:active {
  transform: scale(0.95);
}
`;

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#d8c3b0" aria-hidden="true">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffd09f" aria-hidden="true">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}

export default function TopBar() {
  const { roomState } = useGameStore();
  const [copied, setCopied] = useState(false);

  if (!roomState) return null;
  const players = Object.values(roomState.players);

  const copyCode = () => {
    navigator.clipboard.writeText(roomState.roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <style>{css}</style>
      {/* Слева: бейдж кода комнаты */}
      <div
        className="ma-glass-pill ma-topbar-code"
        onClick={copyCode}
        title="Скопировать код комнаты"
      >
        <span>{roomState.roomId}</span>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </div>
      {/* Центр: индикаторы присутствия игроков */}
      <div className="ma-glass-pill ma-topbar-players">
        {players.map((player) => (
          <div key={player.socketId} className="ma-topbar-player">
            <div
              className="ma-topbar-dot"
              style={{
                background: player.color,
                boxShadow: `0 0 8px ${player.color}cc`,
              }}
            />
            <span className="ma-topbar-tooltip">{player.name}</span>
          </div>
        ))}
        <div className="ma-topbar-divider" />
        <span className="ma-topbar-count">Алхимиков: {players.length}</span>
      </div>
      {/* Справа: очистка доски */}
      <button
        type="button"
        className="ma-topbar-clear"
        onClick={() => socket.emit("board:clear")}
      >
        Очистить доску
      </button>
    </>
  );
}
