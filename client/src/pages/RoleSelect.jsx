import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket";

function RoleSelect() {

  const navigate = useNavigate();
  const { id } = useParams();

  const [room, setRoom] = useState({
    player1: false,
    player2: false
  });

  useEffect(() => {

    socket.emit("joinBattle", { battleId: id, role: "spectator" });

    socket.on("roomUpdate", (data) => {
      setRoom(data);
    });

    socket.on("roleTaken", () => {
      alert("This role is already taken!");
    });

    return () => {
      socket.off("roomUpdate");
      socket.off("roleTaken");
    };

  }, [id]);

  return (
    <div style={{textAlign:"center", marginTop:"100px"}}>

      <h1>Select Role</h1>

      <button
        disabled={room.player1}
        onClick={() => navigate(`/battle/${id}/room?role=player1`)}
      >
      Player1
      </button>

      <button
      disabled={room.player2}
      onClick={() => navigate(`/battle/${id}/room?role=player2`)}
      >
      Player2
      </button>

      <button
      onClick={() => navigate(`/battle/${id}/room?role=spectator`)}
      >
      Spectator
      </button>

    </div>
  );
}

export default RoleSelect;