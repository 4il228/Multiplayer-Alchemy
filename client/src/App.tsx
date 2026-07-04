import { useEffect } from "react";
import { socket } from "./net/socket";
import { SESSION_NAME_KEY, SESSION_ROOM_KEY, useGameStore } from "./state/gameStore";
import Lobby from "./ui/Lobby";
import RoomScreen from "./ui/RoomScreen";
import "./app.css";

export default function App() {
  const { phase } = useGameStore();

  // Авто-re-join при (ре)коннекте: socket.io переподключается сам,
  // клиент повторяет room:join с сохранёнными roomId и именем (SPEC.md §4.5).
  useEffect(() => {
    const onConnect = () => {
      const roomId = sessionStorage.getItem(SESSION_ROOM_KEY);
      const playerName = sessionStorage.getItem(SESSION_NAME_KEY);
      if (roomId && playerName) {
        socket.emit("room:join", { roomId, playerName });
      }
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  return phase === "lobby" ? <Lobby /> : <RoomScreen />;
}
