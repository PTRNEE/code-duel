import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { socket, playerId } from "../socket";

function BattleList() {
  const [battles, setBattles] = useState([]);
  const [roomCounts, setRoomCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchBattles = () => {
    fetch(`${import.meta.env.VITE_API_URL}/battles`)
      .then((res) => res.json())
      .then((data) => {
        setBattles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchBattles();

    // รับ room counts แบบ realtime
    socket.on("allRoomCounts", (counts) => {
      setRoomCounts(counts);
    });

    // รับ battle list update แบบ realtime (สร้าง/ลบห้อง)
    socket.on("battleListUpdate", (updatedBattles) => {
      setBattles(updatedBattles);
    });

    return () => {
      socket.off("allRoomCounts");
      socket.off("battleListUpdate");
    };
  }, []);

  const deleteBattle = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this battle room?")) return;
    await fetch(`${import.meta.env.VITE_API_URL}/battle/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: playerId }),
    });
    // ไม่ต้อง setBattles เพราะ server จะ broadcast battleListUpdate มาเอง
  };

  const counts = (id) => roomCounts[id] || battles.find(b => b.id === id)?.counts || { player1: 0, player2: 0, spectators: 0 };
  const totalOnline = (id) => {
    const c = counts(id);
    return c.player1 + c.player2 + c.spectators;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⚔️ Battle Rooms</h1>
        <Link to="/create" className="btn btn-primary">
          + Create Room
        </Link>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="waiting-spinner" style={{ margin: "0 auto 12px" }}></div>
          <p>Loading rooms...</p>
        </div>
      ) : battles.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏜️</div>
          <p>No battle rooms yet. Create the first one!</p>
        </div>
      ) : (
        <div className="battle-grid">
          {battles.map((battle) => {
            const c = counts(battle.id);
            const isOwner = battle.ownerId === playerId;
            const online = totalOnline(battle.id);

            return (
              <div key={battle.id} className="battle-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <h3 className="battle-card-title">{battle.title}</h3>
                  {isOwner && <span className="badge badge-owner">👑 Owner</span>}
                </div>

                <p className="battle-card-desc">
                  {battle.description || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>No description</span>}
                </p>

                <div className="battle-card-meta">
                  <span className="badge badge-p1">
                    🎮 P1 {c.player1 ? "●" : "○"}
                  </span>
                  <span className="badge badge-p2">
                    🎮 P2 {c.player2 ? "●" : "○"}
                  </span>
                  <span className="badge badge-spec">
                    👁 {c.spectators}
                  </span>
                  {online > 0 && (
                    <span className="badge badge-online">
                      ● {online} online
                    </span>
                  )}
                </div>

                <div className="battle-card-actions">
                  <Link to={`/battle/${battle.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                    Join →
                  </Link>
                  {isOwner && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => deleteBattle(battle.id, e)}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BattleList;
