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

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  
  const [finished, setFinished] = useState(false);

  useEffect(() => {

    socket.emit("joinBattle", {
      battleId: id,
      role: role
    });

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

  }, [id, role]);

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

  const handleCodeChange = (newCode) => {

    socket.emit("codeChange", {
      battleId: id,
      role: role,
      code: newCode
    });
  };

  const runCode = async () => {

    try{
      let code = "";

      if(role === "player1") code = player1Code;
      if(role === "player2") code = player2Code;

      console.log("Running code:", code);

      const res = await fetch("http://localhost:3000/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code,
          input
        })
      });

      const data = await res.json();

      console.log("Run result:", data);

      setOutput(data.output);
    } catch (err) {
      console.error(err);

      setOutput("ERROR RUNNING CODE");
    }
    
  };

  const toggleFinish = () => {
    setFinished(!finished);
  };

  return (

    <div style={{ padding: 20 }}>

      <h1>Battle Room</h1>
      <p>Your Role: {role}</p>

      {(role === "player1") && (

        <CodeEditor
          code={player1Code}
          setCode={updateCode}
          readOnly={finished}
        />

      )}

      {(role === "player2") && (

        <CodeEditor
          code={player2Code}
          setCode={updateCode}
          readOnly={finished}
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

      <div style={{marginTop:20}}>

        <h3>Input</h3>

        <textarea
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          rows={5}
          style={{
            width:"90%",
            border:"1px solid gray",
            fontFamily:"monospace",
            padding:10,
            background: "transparent",
            color: "inherit"
          }}
        />

        <br></br>

        <button onClick={runCode}>
        Run
        </button>

        <button onClick={toggleFinish}>
        {finished ? "Cancel Finish" : "Finish"}
        </button>

      </div>

      <h3>Output</h3>

      {output && (

        <div style={{
          marginTop:20,
          border:"1px solid gray",
          padding:10
        }}>

        <pre>{output}</pre>

        </div>

      )}

    </div>

  );

}

export default BattleRoom;