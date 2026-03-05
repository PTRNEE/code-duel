import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import CodeEditor from "../components/CodeEditor";
import { socket } from "../socket";

function BattleDetail() {
  const { id } = useParams();

  const [player1Code, setPlayer1Code] = useState("");
  const [player2Code, setPlayer2Code] = useState("");
  const [player, setPlayer] = useState("");

  useEffect(() => {
    socket.emit("joinBattle", id);

    socket.on("assignPlayer", (role) => {
      setPlayer(role);
    });

    socket.on("opponentCodeUpdate", ({ player, code }) => {
      if (player === "player1") {
        setPlayer1Code(code);
      }else{
        setPlayer2Code(code);
      }
    });

    return () => {
      socket.off("assignPlayer");
      socket.off("opponentCodeUpdate");
    };
  }, [id]);

  const updatePlayer1 = (value) => {
    setPlayer1Code(value);

    socket.emit("codeUpdate", {
      battleId: id,
      player: "player1",
      code: value,
    });
  };

  const updatePlayer2 = (value) => {
    setPlayer2Code(value);

    socket.emit("codeUpdate", {
      battleId: id,
      player: "player2",
      code: value,
    });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>⚔️ Battle Room {id}</h1>

      <p>Your Role: <b>{player}</b></p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div>
          <h2>Player 1</h2>
          <CodeEditor 
            code={player1Code} 
            setCode={player === "player1" ? updatePlayer1 : () => {}} />
        </div>

        <div>
          <h2>Player 2</h2>
          <CodeEditor 
            code={player2Code} 
            setCode={player === "player2" ? updatePlayer2 : () => {}} />
        </div>
      </div>
    </div>
  );
}

export default BattleDetail;