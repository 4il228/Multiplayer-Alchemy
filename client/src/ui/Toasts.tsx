// Тосты (фаза C3): очередь уведомлений с авто-скрытием через 4 с.
// «{discoveredBy} открыл: {элемент}» на craft:success (isNewDiscovery),
// вход/выход игроков на room:player_joined / room:player_left.
// Вёрстка и значения стилей — из design/game.html и design/tokens.md («Тост»).
import { useEffect, useRef, useState } from "react";
import { socket } from "../net/socket";
import { getGameState } from "../state/gameStore";

const TOAST_TTL_MS = 4000;

interface Toast {
  id: number;
  kind: "discovery" | "presence";
  title: string;
  text: string;
  accent?: string; // выделяемая часть текста (имя элемента) цветом primary
}

const css = `
.ma-toasts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ma-toast {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(45, 27, 77, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 4px solid #ffd09f;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: ma-toast-in 0.25s ease-out;
}
@keyframes ma-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ma-toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: #ffab40;
  border-radius: 9999px;
}
.ma-toast-title {
  font-family: Montserrat, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  text-transform: uppercase;
  color: #d8c3b0;
}
.ma-toast-text {
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  color: #efe0d4;
}
.ma-toast-accent {
  color: #ffd09f;
}
`;

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#6e4200" aria-hidden="true">
      <path d="M12 2l1.9 5.7a2 2 0 0 0 1.27 1.27L20.9 10.9a.6.6 0 0 1 0 1.14l-5.73 1.91a2 2 0 0 0-1.27 1.27L12 20.9a.6.6 0 0 1-1.14 0l-1.91-5.68a2 2 0 0 0-1.27-1.27L2 12.04a.6.6 0 0 1 0-1.14l5.68-1.9a2 2 0 0 0 1.27-1.27L10.86 2a.6.6 0 0 1 1.14 0z" />
    </svg>
  );
}

export default function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Имена игроков кэшируем сами: к моменту room:player_left стор уже удалил игрока.
  const names = useRef(new Map<string, string>());

  useEffect(() => {
    const roomState = getGameState().roomState;
    if (roomState) {
      for (const p of Object.values(roomState.players)) {
        names.current.set(p.socketId, p.name);
      }
    }

    const push = (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_TTL_MS);
    };

    const onCraftSuccess = (payload: {
      newInstance: { elementId: string };
      isNewDiscovery: boolean;
      discoveredBy: string;
    }) => {
      if (!payload.isNewDiscovery) return;
      const element = getGameState().elements.get(payload.newInstance.elementId);
      push({
        kind: "discovery",
        title: "Новое открытие",
        text: `${payload.discoveredBy} открыл: `,
        accent: element ? `${element.icon} ${element.name}` : payload.newInstance.elementId,
      });
    };

    const onPlayerJoined = (player: { socketId: string; name: string }) => {
      names.current.set(player.socketId, player.name);
      push({
        kind: "presence",
        title: "Игрок присоединился",
        text: `${player.name} вошёл в комнату`,
      });
    };

    const onPlayerLeft = ({ socketId }: { socketId: string }) => {
      const name = names.current.get(socketId) ?? "Игрок";
      names.current.delete(socketId);
      push({
        kind: "presence",
        title: "Игрок вышел",
        text: `${name} покинул комнату`,
      });
    };

    socket.on("craft:success", onCraftSuccess);
    socket.on("room:player_joined", onPlayerJoined);
    socket.on("room:player_left", onPlayerLeft);
    return () => {
      socket.off("craft:success", onCraftSuccess);
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("room:player_left", onPlayerLeft);
    };
  }, []);

  return (
    <div className="ma-toasts">
      <style>{css}</style>
      {toasts.map((toast) => (
        <div key={toast.id} className="ma-toast">
          <div className="ma-toast-icon">
            <SparkleIcon />
          </div>
          <div>
            <div className="ma-toast-title">{toast.title}</div>
            <div className="ma-toast-text">
              {toast.text}
              {toast.accent && <span className="ma-toast-accent">{toast.accent}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
