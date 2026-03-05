import Editor from "@monaco-editor/react";
import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

function CodeEditor({ code, setCode, readOnly }) {
  const { theme } = useContext(ThemeContext);

  return (
    <Editor
      height="400px"
      language="javascript"
      value={code}
      theme={theme === "dark" ? "vs-dark" : "light"}
      onChange={(value) => setCode(value)}
      options={{
        readOnly: readOnly 
      }}
    />
  );
}

export default CodeEditor;