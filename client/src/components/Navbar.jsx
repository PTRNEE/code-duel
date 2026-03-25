import { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

function Navbar() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();

  // กด CodeDuel → กลับหน้าแรกเสมอ (เหมือน Back to Rooms)
  const goHome = () => navigate("/");

  return (
    <nav className="navbar">
      <button
        className="navbar-brand"
        onClick={goHome}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span className="flame">⚔️</span>
        CodeDuel
      </button>
      <div className="navbar-actions">
        {/* ซ่อน "+ New Battle" เมื่ออยู่ในหน้า create แล้ว */}
        {location.pathname !== "/create" && (
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/create")}>
            + New Battle
          </button>
        )}
        <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
