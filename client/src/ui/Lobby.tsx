// Экран лобби. Вёрстка и стили — перенос design/lobby.html (Stitch, фаза D1).
import { useState, type FormEvent } from "react";
import { PLAYER_NAME_MAX, ROOM_ID_LENGTH } from "@multialchemy/shared";
import { socket } from "../net/socket";
import { SESSION_NAME_KEY, useGameStore } from "../state/gameStore";
import "./lobby.css";

// Логотип из выгрузки Stitch (design/lobby.html)
const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCpdfpyM8aMW5jVRX3OCVZ-os-u0K1WdtQ6cWfBHpSmnDU_3URz1g906hBf8kzoNm5whKRtUnknKUvb_QmVs2XO7apZ6Yb5zDe-EOrt9LUnAHTYCFdeR8o4Nmw4WbsTvBOIyfeNn79sPsDMXKB903O3tjydhAkvY3NJ54BtYv6r0k8ydD8szwzLoifyToNxpCOIv0vEpA_17WqcZc9-Uqlw9W5Av_prtj0-lK4K7Yyxzh_bf50rfHk8jRBqDUvlbarF3eMElBhfx1I";

export default function Lobby() {
  const { lastError } = useGameStore();
  const [name, setName] = useState(() => sessionStorage.getItem(SESSION_NAME_KEY) ?? "");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function validateName(): string | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Enter your alchemist name first");
      return null;
    }
    setLocalError(null);
    sessionStorage.setItem(SESSION_NAME_KEY, trimmed);
    return trimmed;
  }

  function handleCreate() {
    const playerName = validateName();
    if (!playerName) return;
    socket.emit("room:create", { playerName });
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const playerName = validateName();
    if (!playerName) return;
    const roomId = code.trim().toUpperCase();
    if (roomId.length !== ROOM_ID_LENGTH) {
      setLocalError(`Room code must be ${ROOM_ID_LENGTH} characters`);
      return;
    }
    socket.emit("room:join", { roomId, playerName });
  }

  const errorText =
    localError ??
    (lastError
      ? lastError.code === "NOT_FOUND"
        ? "Room not found. Check the code and try again."
        : "Room is full. Try another one."
      : null);

  return (
    <main className="lobby">
      <div className="lobby-card">
        <div className="lobby-logo">
          <img src={LOGO_URL} alt="" draggable={false} />
        </div>

        <div className="lobby-header">
          <h1 className="lobby-title">Multiplayer Alchemy</h1>
          <p className="lobby-subtitle">Enter the laboratory and begin your transmutation.</p>
        </div>

        <form className="lobby-form" onSubmit={handleJoin}>
          <div className="lobby-field">
            <label className="lobby-label" htmlFor="lobby-name">
              Alchemist Name
            </label>
            <div className="lobby-input-wrap">
              <span className="material-symbols-outlined">magic_button</span>
              <input
                id="lobby-name"
                className="lobby-name-input"
                type="text"
                maxLength={PLAYER_NAME_MAX}
                placeholder="The Great Magus"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <button type="button" className="lobby-create-btn" onClick={handleCreate}>
            <span className="material-symbols-outlined">bolt</span>
            Create Room
          </button>

          <div className="lobby-divider">
            <span className="material-symbols-outlined">auto_awesome</span>
          </div>

          <div className="lobby-join-row">
            <input
              className="lobby-code-input"
              type="text"
              maxLength={ROOM_ID_LENGTH}
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="lobby-join-btn">
              Join
            </button>
          </div>

          {errorText && <p className="lobby-error">{errorText}</p>}
        </form>

        <div className="lobby-footer">
          <span>Multiplayer Alchemy</span>
          <span className="lobby-version">v1.0.4-arcane</span>
        </div>
      </div>
    </main>
  );
}
