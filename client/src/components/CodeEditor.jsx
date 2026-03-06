import Editor from "@monaco-editor/react";
import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

function CodeEditor({ code, setCode, readOnly }) {
  const { theme } = useContext(ThemeContext);

  const handleChange = (value) => {
    if (!readOnly) {
      setCode(value || "");
    }
  };

  return (
    <Editor
      height="400px"
      language="javascript"
      value={code}
      theme={theme === "dark" ? "vs-dark" : "light"}
      onChange={handleChange}
      options={{
        readOnly: readOnly,
        minimap: { enabled: false },
        fontSize: 14
      }}
    />
  );
}

export default CodeEditor;