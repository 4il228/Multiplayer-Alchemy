// Игровой экран: full-height layout по design/game.html — шапка, доска, сайдбар.
// Слоты шапки/сайдбара/тостов заполнит фаза C3; центр — Pixi-доска (useBoard).
import type { CSSProperties } from "react";
import { useBoard } from "../board/useBoard";

// Значения — из design/tokens.md, секция «Game screen».
const styles: Record<string, CSSProperties> = {
  screen: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: 16,
    gap: 16,
    boxSizing: "border-box",
    overflow: "hidden",
  },
  topBarSlot: {
    // header из game.html: прозрачный фон, элементы разнесены по краям
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexShrink: 0,
  },
  main: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    gap: 16,
  },
  boardSection: {
    // glass-panel + arcane-grid + rounded-3xl
    position: "relative",
    flex: 1,
    minWidth: 0,
    background: "rgba(45, 27, 77, 0.4)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "1.5rem",
    backgroundImage:
      "radial-gradient(circle at 1px 1px, rgba(255, 171, 64, 0.05) 1px, transparent 0)",
    backgroundSize: "40px 40px",
    overflow: "hidden",
  },
  boardHost: {
    position: "absolute",
    inset: 0,
  },
  toastsSlot: {
    // тосты в макете — поверх доски слева внизу
    position: "absolute",
    bottom: 24,
    left: 24,
    zIndex: 10,
    pointerEvents: "none",
  },
  sidebarSlot: {
    width: 320,
    flexShrink: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
};

export default function RoomScreen() {
  const boardRef = useBoard();

  return (
    <div style={styles.screen}>
      {/* Слот шапки — заполнит C3 (<TopBar/>) */}
      <header className="room-topbar-slot" style={styles.topBarSlot} />
      <main style={styles.main}>
        <section style={styles.boardSection}>
          <div ref={boardRef} style={styles.boardHost} />
          {/* Слот тостов — заполнит C3 (<Toasts/>) */}
          <div className="room-toasts-slot" style={styles.toastsSlot} />
        </section>
        {/* Слот сайдбара-библиотеки — заполнит C3 (<Library/>) */}
        <aside className="room-sidebar-slot" style={styles.sidebarSlot} />
      </main>
    </div>
  );
}
