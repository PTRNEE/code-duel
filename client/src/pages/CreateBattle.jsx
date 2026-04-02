import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { playerId } from "../socket";

export default function CreateBattle() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);

  const [testCases, setTestCases] = useState([{ input: "", expected: "" }]);

  const addTestCase = () => {
    setTestCases((prev) => [...prev, { input: "", expected: "" }]);
  };

  const removeTestCase = (idx) => {
    setTestCases((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTestCase = (idx, field, value) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc))
    );
  };

  const createBattle = async () => {
    if (!title.trim()) return alert("Please enter a battle title.");
    setLoading(true);
    try {
      // สร้าง battle room
      const res = await fetch(`${import.meta.env.VITE_API_URL}/battle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, ownerId: playerId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const battleId = data.id;

      // บันทึก test cases ที่มี expected value
      const validCases = testCases.filter((tc) => tc.expected.trim() !== "");
      await Promise.all(
        validCases.map((tc) =>
          fetch(`${import.meta.env.VITE_API_URL}/battle/${battleId}/test-cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: tc.input,
              expected: tc.expected,
            }),
          })
        )
      );

      navigate(`/battle/${data.id}/room?role=spectator`);
    } catch (err) {
      alert("Failed to create battle: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-form">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 24 }}>
        ← Back to rooms
      </Link>

      <h1>Create Battle Room</h1>

      {/* Room Name */}
      <div className="form-group">
        <label className="form-label">Room Name *</label>
        <input
          className="form-input"
          placeholder="e.g. Linked List Challenge"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createBattle()}
        />
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          placeholder="Describe the challenge or rules..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Test cases */}
      <div className="form-group">
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <label className="form-label" style={{ margin: 0 }}>
            Test Cases
            <br />
            <span
              style={{
                marginLeft: 8,
                fontSize: "0.7rem",
                color: "var(--text3)",
                fontWeight: 400,
              }}
            >
              (Optional: If there is none, it will automatically win.)
            </span>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={addTestCase}
            style={{ fontSize: "0.78rem", padding: "4px 10px" }}
          >
            + Add case
          </button>
        </div>

        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 32px",
            gap: 8,
            marginBottom: 4,
            padding: "0 2px",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            Input
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            Expected Output *
          </span>
          <span />
        </div>

        {/* Row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {testCases.map((tc, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 32px",
                gap: 8,
                alignItems: "flex-start",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 10px",
              }}
            >
              {/* input */}
              <textarea
                className="form-textarea"
                rows={2}
                placeholder={`Input #${idx + 1}\n(Leave blank if no input is required)`}
                value={tc.input}
                onChange={(e) => updateTestCase(idx, "input", e.target.value)}
              />

              {/* expected */}
              <textarea
                className="form-textarea"
                rows={2}
                placeholder={`Expected #${idx + 1}\ne.g. hello or 42`}
                value={tc.expected}
                onChange={(e) => updateTestCase(idx, "expected", e.target.value)}
              />

              {/* remove button */}
              <button
                type="button"
                onClick={() => removeTestCase(idx)}
                disabled={testCases.length === 1}
                style={{
                  background: "none",
                  border: "none",
                  cursor: testCases.length === 1 ? "not-allowed" : "pointer",
                  color: testCases.length === 1 ? "var(--text3)" : "var(--red, #e55)",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "4px",
                  marginTop: 2,
                  borderRadius: 4,
                  opacity: testCases.length === 1 ? 0.35 : 1,
                  transition: "opacity 0.15s",
                }}
                title="Remove this test case"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Test Case Summary */}
        {testCases.filter((tc) => tc.expected.trim() !== "").length > 0 && (
          <p
            style={{
              marginTop: 8,
              fontSize: "0.75rem",
              color: "var(--green)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ✓ {testCases.filter((tc) => tc.expected.trim() !== "").length} test case
            {testCases.filter((tc) => tc.expected.trim() !== "").length > 1 ? "s" : ""} will be saved
          </p>
        )}

      </div>

      {/* Create Battle Button */}
      <button
        className="btn btn-primary btn-lg"
        onClick={createBattle}
        disabled={loading || !title.trim()}
        style={{ width: "100%" }}
      >
        {loading ? "Creating..." : "⚔️ Create Battle Room"}
      </button>
    </div>
  );
}
