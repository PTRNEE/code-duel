import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket";
import { Link } from "react-router-dom";

function RoleSelect() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [room, setRoom] = useState({ player1: false, player2: false, spectators: 0 });
  const [battleTitle, setBattleTitle] = useState("");

  useEffect(() => {
    fetch(`http://localhost:3000/battles/${id}`)
      .then((r) => r.json())
      .then((d) => d && setBattleTitle(d.title));

    socket.emit("joinBattle", { battleId: id, role: "spectator" });

    socket.on("roomUpdate", (data) => setRoom(data));
    socket.on("roleTaken", () => alert("This role is already taken!"));

    return () => {
      socket.off("roomUpdate");
      socket.off("roleTaken");
    };
  }, [id]);

  const join = (role) => navigate(`/battle/${id}/room?role=${role}`);

  return (
    <div className="role-select-page">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 24 }}>
        ← Back to rooms
      </Link>

      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 8 }}>
        {battleTitle || "Battle Room"}
      </h1>
      <p style={{ color: "var(--text2)", marginBottom: 8 }}>Choose your role to enter</p>

      <div className="role-cards">
        <button
          className="role-card p1"
          disabled={!!room.player1}
          onClick={() => join("player1")}
          style={{ border: "2px solid", borderColor: room.player1 ? "var(--border)" : "rgba(74,158,255,0.4)" }}
        >
          {room.player1 && <span className="role-taken-tag">TAKEN</span>}
          <div className="role-card-icon">🔵</div>
          <div className="role-card-name" style={{ color: "var(--p1)" }}>Player 1</div>
          <div className="role-card-count">
            {room.player1 ? "Slot occupied" : "Slot available"}
          </div>
        </button>

        <button
          className="role-card p2"
          disabled={!!room.player2}
          onClick={() => join("player2")}
          style={{ border: "2px solid", borderColor: room.player2 ? "var(--border)" : "rgba(255,107,53,0.4)" }}
        >
          {room.player2 && <span className="role-taken-tag">TAKEN</span>}
          <div className="role-card-icon">🟠</div>
          <div className="role-card-name" style={{ color: "var(--p2)" }}>Player 2</div>
          <div className="role-card-count">
            {room.player2 ? "Slot occupied" : "Slot available"}
          </div>
        </button>
      </div>

      <button
        className="btn btn-ghost"
        onClick={() => join("spectator")}
        style={{ width: "100%", justifyContent: "center", padding: "12px" }}
      >
        👁 Watch as Spectator
        {room.spectators > 0 && (
          <span className="badge badge-spec" style={{ marginLeft: 8 }}>
            {room.spectators} watching
          </span>
        )}
      </button>
    </div>
  );
}

export default RoleSelect;
