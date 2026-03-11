import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { socket, playerId } from "../socket";
import CodeEditor from "../components/CodeEditor";

function BattleRoom() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const role = search.get("role") || "spectator";

  const [owner, setOwner] = useState(null);
  const [battleTitle, setBattleTitle] = useState("");
  const isOwner = playerId === owner;

  const [player1Code, setPlayer1Code] = useState("# Player 1 code\n");
  const [player2Code, setPlayer2Code] = useState("# Player 2 code\n");

  const [language, setLanguage] = useState("python");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [outputError, setOutputError] = useState(false);
  const [running, setRunning] = useState(false);

  const [p1Output, setP1Output] = useState(null);
  const [p2Output, setP2Output] = useState(null);

  const [finished, setFinished] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [timeUp, setTimeUp] = useState(false);

  const [timeLeft, setTimeLeft] = useState(null);
  const [battleStarted, setBattleStarted] = useState(false);

  // Owner controls
  const [duration, setDuration] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  const [remoteCursor, setRemoteCursor] = useState(null);
  const [notif, setNotif] = useState(null);
  const notifTimer = useRef(null);

  const showNotif = (msg, type = "info") => {
    setNotif({ msg, type });
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(null), 3000);
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "∞";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getTimerClass = () => {
    if (timeLeft === null) return "no-limit";
    if (timeLeft <= 10) return "danger";
    if (timeLeft <= 30) return "warning";
    return "";
  };

  useEffect(() => {
    fetch(`http://localhost:3000/battles/${id}`)
      .then((r) => r.json())
      .then((d) => d && setBattleTitle(d.title));

    socket.emit("joinBattle", { battleId: id, role });

    socket.on("ownerUpdate", (ownerId) => setOwner(ownerId));

    socket.on("roomUpdate", (room) => {
      // keep track of room state if needed
    });

    socket.on("codeUpdate", ({ player, code }) => {
      if (player === "player1") setPlayer1Code(code);
      if (player === "player2") setPlayer2Code(code);
    });

    socket.on("runResult", ({ player, input: inp, output: out }) => {
      if (player === "player1") setP1Output({ input: inp, output: out });
      if (player === "player2") setP2Output({ input: inp, output: out });
    });

    socket.on("cursorMove", ({ player, position }) => {
      if (player !== role) setRemoteCursor(position);
    });

    socket.on("battleStarted", (time) => {
      setBattleStarted(true);
      setTimerRunning(true);
      if (time !== null) setTimeLeft(time);
      showNotif("⚔️ Battle has started!", "info");
    });

    socket.on("timerUpdate", (time) => setTimeLeft(time));

    socket.on("timerStopped", () => {
      setTimerRunning(false);
      showNotif("⏸ Timer paused", "info");
    });

    socket.on("timerReset", (time) => {
      setTimeLeft(time);
      setTimerRunning(false);
      setFinished(false);
      setSubmitted(false);
      showNotif("🔄 Timer reset", "info");
    });

    socket.on("battleEnded", () => {
      setFinished(true);
      setTimeUp(true);
      setTimerRunning(false);
    });

    socket.on("battleFinished", (winnerRole) => {
      setFinished(true);
      setWinner(winnerRole);
      setTimerRunning(false);
    });

    socket.on("battleNotFound", () => {
      alert("Battle not found!");
      navigate("/");
    });

    return () => {
      socket.off("ownerUpdate");
      socket.off("roomUpdate");
      socket.off("codeUpdate");
      socket.off("runResult");
      socket.off("cursorMove");
      socket.off("battleStarted");
      socket.off("timerUpdate");
      socket.off("timerStopped");
      socket.off("timerReset");
      socket.off("battleEnded");
      socket.off("battleFinished");
      socket.off("battleNotFound");
    };
  }, [id, role]);

  const updateCode = (value) => {
    if (role === "player1") {
      setPlayer1Code(value);
      socket.emit("codeUpdate", { battleId: id, player: "player1", code: value });
    } else if (role === "player2") {
      setPlayer2Code(value);
      socket.emit("codeUpdate", { battleId: id, player: "player2", code: value });
    }
  };

  const sendCursor = (position) => {
    socket.emit("cursorMove", { battleId: id, player: role, position });
  };

  const runCode = async () => {
    if (role === "spectator") return;
    const code = role === "player1" ? player1Code : player2Code;
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("http://localhost:3000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input, language }),
      });
      const data = await res.json();
      const out = data.output || "";
      setOutput(out);
      setOutputError(out.startsWith("ERROR") || out.startsWith("COMPILE"));
      // Broadcast run result to spectators
      socket.emit("runResult", { battleId: id, player: role, input, output: out });
    } catch {
      setOutput("Failed to reach server.");
      setOutputError(true);
    } finally {
      setRunning(false);
    }
  };

  const finishBattle = () => {
    if (role === "spectator" || finished) return;
    socket.emit("finishBattle", { battleId: id, player: role });
    setSubmitted(true);
    setFinished(true);
  };

  // Owner controls
  const startBattle = () => {
    socket.emit("startBattle", { battleId: id, duration: duration || null });
  };

  const stopTimer = () => {
    socket.emit("stopTimer", { battleId: id });
  };

  const resetTimer = () => {
    socket.emit("resetTimer", { battleId: id, duration: duration || null });
  };

  const myCode = role === "player1" ? player1Code : player2Code;
  const isPlayer = role === "player1" || role === "player2";

  return (
    <div className="battle-room">
      {/* Header */}
      <div className="room-header">
        <div className="room-header-left">
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {battleTitle || "Battle Room"}
          </span>
          <div className={`timer-display ${getTimerClass()}`}>
            {formatTime(timeLeft)}
          </div>
          {!battleStarted && (
            <span style={{ fontSize: "0.75rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              Waiting to start...
            </span>
          )}
          {battleStarted && timerRunning && (
            <span style={{ fontSize: "0.75rem", color: "var(--green)", fontFamily: "var(--font-mono)" }}>
              ● LIVE
            </span>
          )}
        </div>

        <div className="room-header-right">
          {isPlayer && (
            <select
              className="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={submitted}
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          )}

          <span className={`role-badge ${role}`}>
            {role === "player1" ? "🔵 Player 1" : role === "player2" ? "🟠 Player 2" : "👁 Spectator"}
          </span>

          {isPlayer && !submitted && battleStarted && (
            <>
              <button
                className="btn btn-blue btn-sm"
                onClick={runCode}
                disabled={running}
              >
                {running ? "Running..." : "▶ Run"}
              </button>
              <button
                className="btn btn-green btn-sm"
                onClick={finishBattle}
                disabled={finished}
              >
                ✓ Submit
              </button>
            </>
          )}

          {submitted && (
            <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700 }}>
              ✓ Submitted
            </span>
          )}
        </div>
      </div>

      {/* Owner Controls */}
      {isOwner && (
        <div className="owner-controls">
          <span className="owner-label">👑 Owner</span>
          <input
            type="number"
            className="duration-input"
            value={duration}
            min={0}
            onChange={(e) => setDuration(Number(e.target.value))}
            placeholder="Seconds (0 = ∞)"
          />
          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>seconds</span>
          {!battleStarted ? (
            <button className="btn btn-primary btn-sm" onClick={startBattle}>
              ▶ Start Battle
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={timerRunning ? stopTimer : startBattle}
              >
                {timerRunning ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetTimer}>
                🔄 Reset
              </button>
            </>
          )}
        </div>
      )}

      {/* Editor Area */}
      {role === "spectator" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="editor-area spectator-view" style={{ flex: 1, overflow: "hidden" }}>
            <div className="editor-panel">
              <div className="editor-panel-header p1">
                🔵 Player 1
                {p1Output && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· ran code</span>}
              </div>
              <div className="editor-wrapper">
                <CodeEditor
                  code={player1Code}
                  setCode={() => {}}
                  readOnly={true}
                  language={language}
                />
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-header p2">
                🟠 Player 2
                {p2Output && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· ran code</span>}
              </div>
              <div className="editor-wrapper">
                <CodeEditor
                  code={player2Code}
                  setCode={() => {}}
                  readOnly={true}
                  language={language}
                />
              </div>
            </div>
          </div>

          {/* Spectator IO */}
          <div className="spectator-io-grid" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
            <div className="spectator-io-panel">
              <div className="spectator-io-title p1">🔵 Player 1 Output</div>
              {p1Output ? (
                <>
                  {p1Output.input && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>INPUT:</div>
                      <pre className="spectator-io-content">{p1Output.input}</pre>
                    </div>
                  )}
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>OUTPUT:</div>
                  <pre className="spectator-io-content" style={{ color: p1Output.output?.startsWith("ERROR") ? "var(--red)" : "var(--green)" }}>
                    {p1Output.output}
                  </pre>
                </>
              ) : (
                <p style={{ color: "var(--text3)", fontSize: "0.8rem" }}>Waiting for Player 1 to run code...</p>
              )}
            </div>
            <div className="spectator-io-panel">
              <div className="spectator-io-title p2">🟠 Player 2 Output</div>
              {p2Output ? (
                <>
                  {p2Output.input && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>INPUT:</div>
                      <pre className="spectator-io-content">{p2Output.input}</pre>
                    </div>
                  )}
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>OUTPUT:</div>
                  <pre className="spectator-io-content" style={{ color: p2Output.output?.startsWith("ERROR") ? "var(--red)" : "var(--green)" }}>
                    {p2Output.output}
                  </pre>
                </>
              ) : (
                <p style={{ color: "var(--text3)", fontSize: "0.8rem" }}>Waiting for Player 2 to run code...</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Player View */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!battleStarted ? (
            <div className="waiting-screen">
              <div className="waiting-spinner"></div>
              <p>Waiting for the battle to start...</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
                {isOwner ? "You can start the battle using the controls above." : "The owner will start the battle soon."}
              </p>
            </div>
          ) : (
            <>
              <div className="editor-wrapper" style={{ flex: 1, position: "relative" }}>
                {submitted && (
                  <div className="submitted-overlay">
                    <span>✓</span> Code Submitted
                  </div>
                )}
                <CodeEditor
                  code={myCode}
                  setCode={updateCode}
                  readOnly={submitted || finished}
                  onCursorMove={sendCursor}
                  remoteCursor={remoteCursor}
                  language={language}
                />
              </div>

              <div className="bottom-panel">
                <div className="bottom-content">
                  <div className="io-section">
                    <div className="io-label">
                      <span>Input</span>
                    </div>
                    <textarea
                      className="io-textarea"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Enter input here..."
                      disabled={submitted}
                    />
                  </div>

                  <div className="io-section">
                    <div className="io-label">
                      <span>Output</span>
                      {running && <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>running...</span>}
                    </div>
                    {output ? (
                      <div className={`io-output ${outputError ? "error" : ""}`}>
                        {output}
                      </div>
                    ) : (
                      <div style={{ flex: 1, padding: "10px 12px", color: "var(--text3)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                        Output will appear here after running...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Finish/Time-up Modal */}
      {(winner || timeUp) && (
        <div className="status-overlay">
          <div className="status-modal">
            <div className="winner-badge">
              {timeUp && !winner ? "⏰" : winner === role ? "🏆" : "💀"}
            </div>
            <h2>
              {timeUp && !winner
                ? "Time's Up!"
                : winner === role
                ? "You Won!"
                : winner
                ? `${winner === "player1" ? "Player 1" : "Player 2"} Won!`
                : "Battle Over"}
            </h2>
            <p>
              {timeUp && !winner
                ? "The battle has ended due to time limit."
                : winner === role
                ? "Congratulations! You submitted first."
                : `${winner === "player1" ? "Player 1" : "Player 2"} finished first.`}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => navigate("/")}>
                Back to Rooms
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setWinner(null); setTimeUp(false); }}
              >
                Keep Watching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div className={`notif ${notif.type}`}>
          {notif.msg}
        </div>
      )}
    </div>
  );
}

export default BattleRoom;
