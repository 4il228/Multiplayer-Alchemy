// Временная заглушка игрового экрана: заменит C2 (доска) и дополнит C3 (шапка/сайдбар/тосты).
import { useGameStore } from "../state/gameStore";

export default function RoomScreen() {
  const { roomState } = useGameStore();
  return <div>Room code: {roomState?.roomId ?? "..."}</div>;
}
