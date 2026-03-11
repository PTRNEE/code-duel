import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { playerId } from "../socket";

export default function CreateBattle() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const createBattle = async () => {
    if (!title.trim()) return alert("Please enter a battle title.");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, ownerId: playerId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          placeholder="Describe the challenge or rules..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

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
