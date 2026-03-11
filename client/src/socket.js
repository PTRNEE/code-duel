import { io } from "socket.io-client";

const playerId = (() => {
  let id = localStorage.getItem("playerId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("playerId", id);
  }
  return id;
})();

export const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  auth: { playerId },
});

export { playerId };
