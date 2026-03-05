import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

function Leaderboard() {
  const { id } = useParams();
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:3000/leaderboard/${id}`)
      .then((res) => res.json())
      .then((result) => setData(result));
  }, [id]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>🏆 Leaderboard</h1>

      {data.length === 0 && <p>No submissions yet.</p>}

      {data.map((entry, index) => (
        <div
          key={entry.userId}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>
            #{index + 1} - User: {entry.userId}
          </h3>
          <p>Best Score: {entry._max.score}</p>
        </div>
      ))}
    </div>
  );
}

export default Leaderboard;