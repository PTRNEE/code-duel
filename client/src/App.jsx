import { BrowserRouter, Routes, Route } from "react-router-dom";
import BattleList from "./pages/BattleList";
import BattleDetail from "./pages/BattleDetail";
import RoleSelect from "./pages/RoleSelect";
import BattleRoom from "./pages/BattleRoom";
import Leaderboard from "./pages/Leaderboard";
import ThemeToggle from "./components/ThemeToggle";

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />

      <Routes>
        <Route path="/" element={<BattleList />} />
        {/* <Route path="/battle/:id" element={<BattleDetail />} /> */}
        
        <Route path="/battle/:id" element={<RoleSelect />} />
        <Route path="/battle/:id/room" element={<BattleRoom />} />
        <Route path="/leaderboard/:id" element={<Leaderboard />} />
      </Routes>

    </BrowserRouter>
  );
}

export default App;