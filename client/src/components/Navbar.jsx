import { useContext } from "react";
import { Link } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

function Navbar() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="flame">⚔️</span>
        CodeDuel
      </Link>
      <div className="navbar-actions">
        <Link to="/create" className="btn btn-primary btn-sm">
          + New Battle
        </Link>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
