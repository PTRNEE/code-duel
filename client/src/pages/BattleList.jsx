import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function BattleList() {
  const [battles, setBattles] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/battles")
      .then((res) => res.json())
      .then((data) => setBattles(data));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>CodeDuel 🔥</h1>
      <h2>Available Battles</h2>

      {battles.map((battle) => (
        <div
          key={battle.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{battle.title}</h3>
          <p>{battle.description}</p>

          <Link to={`/battle/${battle.id}`}>
            <button>Enter Battle</button>
          </Link>
        </div>
      ))}
    </div>
  );
}

export default BattleList;