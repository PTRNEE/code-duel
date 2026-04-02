import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { socket, playerId } from "../socket";
import CodeEditor from "../components/CodeEditor";

const DEFAULT_CODE = {
  python: "# Write your code here\n",
  java: "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n",
};

function BattleRoom() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const role = search.get("role") || "spectator";

  const [owner, setOwner] = useState(null);
  const [battleTitle, setBattleTitle] = useState("");
  const [battleDescription, setBattleDescription] = useState("");
  const [testCaseCount, setTestCaseCount] = useState(null);

  const [showInfo, setShowInfo] = useState(false);
  
  const isOwner = playerId === owner;

  const [player1Code, setPlayer1Code] = useState(DEFAULT_CODE.python);
  const [player2Code, setPlayer2Code] = useState(DEFAULT_CODE.python);

  const [language, setLanguage] = useState("python");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [outputError, setOutputError] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [p1Output, setP1Output] = useState(null);
  const [p2Output, setP2Output] = useState(null);

  const [finished, setFinished] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [timeUp, setTimeUp] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [timeLeft, setTimeLeft] = useState(null);
  const [battleStarted, setBattleStarted] = useState(false);
  const [duration, setDuration] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  const [remoteCursor, setRemoteCursor] = useState(null);
  const [notif, setNotif] = useState(null);
  const notifTimer = useRef(null);

  const showNotif = (msg, type = "info") => {
    setNotif({ msg, type });
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(null), 4000);
  };

  const resetLocalState = () => {
    setPlayer1Code(DEFAULT_CODE.python);
    setPlayer2Code(DEFAULT_CODE.python);
    setLanguage("python");
    setInput("");
    setOutput("");
    setOutputError(false);
    setRunning(false);
    setSubmitting(false);
    setP1Output(null);
    setP2Output(null);
    setFinished(false);
    setSubmitted(false);
    setWinner(null);
    setTimeUp(false);
    setSubmitResult(null);
    setTimeLeft(null);
    setBattleStarted(false);
    setTimerRunning(false);
    setRemoteCursor(null);
  };

  // navigate ออกจากห้อง พร้อม emit leaveBattle ให้ server อัปเดต counts ทันที
  const leaveRoom = (destination = "/") => {
    socket.emit("leaveBattle", { battleId: id });
    navigate(destination);
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
    fetch(`${import.meta.env.VITE_API_URL}/battles/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d) return;
        setBattleTitle(d.title);
        setBattleDescription(d.description || "");
        setTestCaseCount(d.testCase ? d.testCase.length : 0);
      });

    socket.emit("joinBattle", { battleId: id, role });

    socket.on("ownerUpdate", (ownerId) => setOwner(ownerId));

    socket.on("codeUpdate", ({ player, code }) => {
      if (player === "player1") setPlayer1Code(code || DEFAULT_CODE.python);
      if (player === "player2") setPlayer2Code(code || DEFAULT_CODE.python);
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
      setSubmitResult(null);
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

    socket.on("submitResult", ({ passed, total, success }) => {
      setSubmitting(false);
      if (success) {
        setSubmitted(true);
        showNotif(`✅ ผ่านทุก test case (${passed}/${total}) — คุณชนะ!`, "success");
      } else {
        setSubmitResult({ passed, total, success: false });
        showNotif(`❌ ผ่าน ${passed}/${total} test cases — ลองแก้โค้ดใหม่`, "error");
      }
    });

    socket.on("roomReset", () => {
      resetLocalState();
      showNotif("🔄 Room has been reset — ready for a new battle!", "info");
    });

    socket.on("battleNotFound", () => {
      alert("Battle not found!");
      navigate("/");
    });

    // cleanup
    return () => {
      socket.off("ownerUpdate");
      socket.off("codeUpdate");
      socket.off("runResult");
      socket.off("cursorMove");
      socket.off("battleStarted");
      socket.off("timerUpdate");
      socket.off("timerStopped");
      socket.off("timerReset");
      socket.off("battleEnded");
      socket.off("battleFinished");
      socket.off("submitResult");
      socket.off("roomReset");
      socket.off("battleNotFound");
    };
  }, [id, role]);

  // เมื่อ component unmount (ปิด tab, navigate ออก) → บอก server ทันที
  useEffect(() => {
    return () => {
      socket.emit("leaveBattle", { battleId: id });
    };
  }, [id]);

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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input, language }),
      });
      const data = await res.json();
      const out = data.output || "";
      setOutput(out);
      setOutputError(out.startsWith("ERROR") || out.startsWith("COMPILE") || out.startsWith("RUNTIME"));
      socket.emit("runResult", { battleId: id, player: role, input, output: out });
    } catch {
      setOutput("Failed to reach server.");
      setOutputError(true);
    } finally {
      setRunning(false);
    }
  };

  const submitCode = () => {
    if (role === "spectator" || finished || submitting) return;
    const code = role === "player1" ? player1Code : player2Code;
    setSubmitting(true);
    setSubmitResult(null);
    socket.emit("submitCode", { battleId: id, player: role, code, language, userId: playerId });
  };

  const reBattle = () => {
    if (isOwner) {
      socket.emit("resetRoom", { battleId: id });
    } else {
      resetLocalState();
    }
    setWinner(null);
    setTimeUp(false);
  };

  const startBattle = () => socket.emit("startBattle", { battleId: id, duration: duration || null });
  const stopTimer = () => socket.emit("stopTimer", { battleId: id });
  const resetTimer = () => socket.emit("resetTimer", { battleId: id, duration: duration || null });

  const myCode = role === "player1" ? player1Code : player2Code;
  const isPlayer = role === "player1" || role === "player2";

  const getWinnerMessage = () => {
    if (timeUp && !winner) return { icon: "⏰", title: "Time's Up!", sub: "The battle has ended — no winner this round." };
    if (winner === role) return { icon: "🏆", title: "You Won!", sub: "Excellent work! Your code passed all test cases." };
    const winnerLabel = winner === "player1" ? "Player 1" : "Player 2";
    if (role === "spectator") return { icon: "🏆", title: `${winnerLabel} Wins!`, sub: `${winnerLabel} cracked the challenge. Great duel!` };
    return { icon: "💀", title: `${winnerLabel} Wins!`, sub: "Better luck next time — challenge them to a rematch!" };
  };

  const modalInfo = (winner || timeUp) ? getWinnerMessage() : null;

  return (
    <div className="battle-room">
      {/* Header */}
      <div className="room-header">
        <div className="room-header-left">
          <button
            className="btn btn-ghost"
            onClick={() => setShowInfo((v) => !v)}
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title={showInfo ? "Hide details" : "Show details"}
          >
            {battleTitle || "Battle Room"}
            <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{showInfo ? "▲" : "▼"}</span>
          </button>
          
          <div className={`timer-display ${getTimerClass()}`}>{formatTime(timeLeft)}</div>
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
              <button className="btn btn-blue btn-sm" onClick={runCode} disabled={running}>
                {running ? "Running..." : "▶ Run"}
              </button>
              <button className="btn btn-green btn-sm" onClick={submitCode} disabled={finished || submitting}>
                {submitting ? "Checking..." : "✓ Submit"}
              </button>
            </>
          )}
          {submitted && (
            <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700 }}>✓ Submitted</span>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div
          style={{
            padding: "10px 20px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* description */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text3)",
                minWidth: 90,
                paddingTop: 1,
              }}
            >
              Description
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>
              {battleDescription
                ? battleDescription
                : <span style={{ color: "var(--text3)", fontStyle: "italic" }}>No description provided</span>
              }
            </span>
          </div>

          {/* test case count */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text3)",
                minWidth: 90,
              }}
            >
              Test Cases
            </span>
            {testCaseCount === null ? (
              <span style={{ fontSize: "0.8rem", color: "var(--text3)" }}>Loading...</span>
            ) : testCaseCount === 0 ? (
              <span
                style={{
                  fontSize: "0.78rem",
                  background: "rgba(255,200,0,0.12)",
                  color: "var(--yellow, #c8a000)",
                  border: "1px solid rgba(255,200,0,0.25)",
                  borderRadius: 5,
                  padding: "1px 8px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ⚠ No test cases - auto win on submit
              </span>
            ) : (
              <span
                style={{
                  fontSize: "0.78rem",
                  background: "rgba(0,200,100,0.1)",
                  color: "var(--green)",
                  border: "1px solid rgba(0,200,100,0.2)",
                  borderRadius: 5,
                  padding: "1px 8px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ✓ {testCaseCount} test case{testCaseCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Submit result bar */}
      {submitResult && !submitResult.success && (
        <div style={{ padding: "8px 20px", background: "rgba(255,77,106,0.1)", borderBottom: "1px solid rgba(255,77,106,0.3)", display: "flex", alignItems: "center", gap: 12, fontSize: "0.85rem" }}>
          <span style={{ color: "var(--red)", fontWeight: 700 }}>❌ Failed {submitResult.passed}/{submitResult.total} test cases</span>
          <span style={{ color: "var(--text2)" }}>- Fix your code and try submitting again</span>
        </div>
      )}

      {/* Owner Controls */}
      {isOwner && (
        <div className="owner-controls">
          <span className="owner-label">👑 Owner</span>
          <input 
            type="number" 
            className="duration-input" 
            value={duration} min={0} 
            onChange={(e) => setDuration(Number(e.target.value))} 
            placeholder="Seconds (0 = ∞)" 
          />
          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>seconds</span>
          {!battleStarted ? (
            <button className="btn btn-primary btn-sm" onClick={startBattle}>▶ Start Battle</button>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={timerRunning ? stopTimer : startBattle}>
                {timerRunning ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetTimer}>🔄 Reset Timer</button>
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
                🔵 Player 1 {p1Output && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· ran code</span>}
              </div>
              <div className="editor-wrapper">
                <CodeEditor code={player1Code} setCode={() => {}} readOnly={true} language={language} />
              </div>
            </div>
            <div className="editor-panel">
              <div className="editor-panel-header p2">
                🟠 Player 2 {p2Output && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· ran code</span>}
              </div>
              <div className="editor-wrapper">
                <CodeEditor code={player2Code} setCode={() => {}} readOnly={true} language={language} />
              </div>
            </div>
          </div>

          <div className="spectator-io-grid" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
            <div className="spectator-io-panel">
              <div className="spectator-io-title p1">🔵 Player 1 Output</div>
              {p1Output ? (
                <>
                  {p1Output.input && <><div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>INPUT:</div><pre className="spectator-io-content">{p1Output.input}</pre></>}
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>OUTPUT:</div>
                  <pre className="spectator-io-content" style={{ color: p1Output.output?.startsWith("ERROR") ? "var(--red)" : "var(--green)" }}>{p1Output.output}</pre>
                </>
              ) : <p style={{ color: "var(--text3)", fontSize: "0.8rem" }}>Waiting for Player 1 to run code...</p>}
            </div>
            <div className="spectator-io-panel">
              <div className="spectator-io-title p2">🟠 Player 2 Output</div>
              {p2Output ? (
                <>
                  {p2Output.input && <><div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>INPUT:</div><pre className="spectator-io-content">{p2Output.input}</pre></>}
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>OUTPUT:</div>
                  <pre className="spectator-io-content" style={{ color: p2Output.output?.startsWith("ERROR") ? "var(--red)" : "var(--green)" }}>{p2Output.output}</pre>
                </>
              ) : <p style={{ color: "var(--text3)", fontSize: "0.8rem" }}>Waiting for Player 2 to run code...</p>}
            </div>
          </div>
        </div>
      ) : (
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
                  <div className="submitted-overlay"><span>✓</span> Code Submitted & Accepted</div>
                )}
                <CodeEditor code={myCode} setCode={updateCode} readOnly={submitted || finished} onCursorMove={sendCursor} remoteCursor={remoteCursor} language={language} />
              </div>
              <div className="bottom-panel">
                <div className="bottom-content">
                  <div className="io-section">
                    <div className="io-label"><span>Input</span></div>
                    <textarea className="io-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter input here..." disabled={submitted} />
                  </div>
                  <div className="io-section">
                    <div className="io-label">
                      <span>Output</span>
                      {running && <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>running...</span>}
                    </div>
                    {output ? (
                      <div className={`io-output ${outputError ? "error" : ""}`}>{output}</div>
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

      {/* Winner / Time-up Modal */}
      {modalInfo && (
        <div className="status-overlay">
          <div className="status-modal">
            <div className="winner-badge">{modalInfo.icon}</div>
            <h2>{modalInfo.title}</h2>
            <p>{modalInfo.sub}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => leaveRoom("/")}>← Back to Rooms</button>
              <button className="btn btn-ghost" onClick={reBattle}>🔄 Re-Battle</button>
            </div>
            {!isOwner && winner && (
              <p style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--text3)" }}>
                * Re-Battle จะเริ่มได้เมื่อ Owner กด Re-Battle
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notification */}
      {notif && <div className={`notif ${notif.type}`}>{notif.msg}</div>}
    </div>
  );
}

export default BattleRoom;
