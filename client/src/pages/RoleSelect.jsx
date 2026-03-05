import { useNavigate, useParams } from "react-router-dom";

function RoleSelect() {

  const navigate = useNavigate();
  const { id } = useParams();

  const chooseRole = (role) => {
    navigate(`/battle/${id}/room?role=${role}`);
  };

  return (
    <div style={{textAlign:"center", marginTop:"100px"}}>

      <h1>Select Role</h1>

      <button
        onClick={() => navigate(`/battle/${id}/room?role=player1`)}
      >
      Player1
      </button>

      <button
        onClick={() => navigate(`/battle/${id}/room?role=player2`)}
      >
      Player2
      </button>

      <button
        onClick={() => navigate(`/battle/${id}/room?role=spectator`)}
      >
      Spectator
      </button>

    </div>
  );
}

export default RoleSelect;