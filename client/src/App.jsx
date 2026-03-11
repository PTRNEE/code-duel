import { BrowserRouter, Routes, Route } from "react-router-dom";
import BattleList from "./pages/BattleList";
import RoleSelect from "./pages/RoleSelect";
import BattleRoom from "./pages/BattleRoom";
import CreateBattle from "./pages/CreateBattle";
import Navbar from "./components/Navbar";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<BattleList />} />
        <Route path="/create" element={<CreateBattle />} />
        <Route path="/battle/:id" element={<RoleSelect />} />
        <Route path="/battle/:id/room" element={<BattleRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
