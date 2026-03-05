import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../socket";
import CodeEditor from "../components/CodeEditor";

function BattleRoom() {

  const { id } = useParams();
  const [search] = useSearchParams();

  const role = search.get("role");

  const [player1Code, setPlayer1Code] = useState("");
  const [player2Code, setPlayer2Code] = useState("");

  useEffect(() => {

    socket.emit("joinBattle", id);

    socket.on("codeUpdate", ({ player, code }) => {

      if (player === "player1") {
        setPlayer1Code(code);
      }

      if (player === "player2") {
        setPlayer2Code(code);
      }

    });

    return () => {
      socket.off("codeUpdate");
    };

  }, [id]);

  const updateCode = (value) => {

    if (role === "player1") {

      setPlayer1Code(value);

      socket.emit("codeUpdate", {
        battleId: id,
        player: "player1",
        code: value
      });

    }

    if (role === "player2") {

      setPlayer2Code(value);

      socket.emit("codeUpdate", {
        battleId: id,
        player: "player2",
        code: value
      });

    }

  };

  return (

    <div style={{ padding: 20 }}>

      <h1>Battle Room</h1>
      <p>Your Role: {role}</p>

      {/* PLAYER 1 */}

      {(role === "player1") && (

        <CodeEditor
          code={player1Code}
          setCode={updateCode}
          readOnly={false}
        />

      )}

      {(role === "player2") && (

        <CodeEditor
          code={player2Code}
          setCode={updateCode}
          readOnly={false}
        />

      )}

      {(role === "spectator") && (

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20
          }}
        >

          <div>
            <h3>Player1</h3>

            <CodeEditor
              code={player1Code}
              setCode={() => {}}
              readOnly={true}
            />

          </div>

          <div>

            <h3>Player2</h3>

            <CodeEditor
              code={player2Code}
              setCode={() => {}}
              readOnly={true}
            />

          </div>

        </div>

      )}

    </div>

  );
}

export default BattleRoom;