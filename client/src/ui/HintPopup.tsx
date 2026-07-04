// Всплывающая подсказка алхимика: сервер присылает hint:show, когда комната
// минуту не открывала новых элементов. Показывается в углу доски, скрывается
// сама или по крестику. Палитра — как у тостов (design/tokens.md, «Тост»).
import { useEffect, useRef, useState } from "react";
import { socket } from "../net/socket";

const HINT_TTL_MS = 15_000;

const css = `
.ma-hint {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 340px;
  padding: 12px 16px;
  background: rgba(45, 27, 77, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 208, 159, 0.35);
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 171, 64, 0.15);
  animation: ma-hint-in 0.3s ease-out;
  pointer-events: auto;
}
@keyframes ma-hint-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.ma-hint-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: rgba(255, 171, 64, 0.2);
  border: 1px solid rgba(255, 171, 64, 0.5);
  border-radius: 9999px;
  font-size: 16px;
}
.ma-hint-title {
  font-family: Montserrat, sans-serif;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffd09f;
}
.ma-hint-text {
  margin-top: 2px;
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  font-weight: 500;
  font-style: italic;
  line-height: 1.45;
  color: #efe0d4;
}
.ma-hint-subtitle {
  margin-top: 4px;
  font-family: Montserrat, sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  color: #d8c3b0;
  opacity: 0.85;
}
.ma-hint-close {
  flex-shrink: 0;
  padding: 0;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: #d8c3b0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}
.ma-hint-close:hover {
  color: #efe0d4;
}
`;

export default function HintPopup() {
  const [hint, setHint] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onHint = ({ text }: { text: string }) => {
      setHint(text);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setHint(null), HINT_TTL_MS);
    };
    socket.on("hint:show", onHint);
    return () => {
      socket.off("hint:show", onHint);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!hint) return null;

  return (
    <div className="ma-hint" role="status">
      <style>{css}</style>
      <div className="ma-hint-icon">🔮</div>
      <div>
        <div className="ma-hint-title">Подсказка алхимика</div>
        <div className="ma-hint-text">{hint}</div>
        <div className="ma-hint-subtitle">Из того, что уже открыто в комнате…</div>
      </div>
      <button
        type="button"
        className="ma-hint-close"
        onClick={() => setHint(null)}
        title="Скрыть подсказку"
      >
        ×
      </button>
    </div>
  );
}
