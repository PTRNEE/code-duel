import { createContext, useState } from "react";

export const BattleContext = createContext();

export function BattleProvider({ children }) {

  const [player1Code, setPlayer1Code] = useState("");
  const [player2Code, setPlayer2Code] = useState("");

  return (
    <BattleContext.Provider
      value={{
        player1Code,
        setPlayer1Code,
        player2Code,
        setPlayer2Code
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}