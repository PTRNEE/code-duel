import Editor from "@monaco-editor/react";
import { useContext, useRef, useEffect } from "react";
import { ThemeContext } from "../context/ThemeContext";

function CodeEditor({ code, setCode, readOnly, onCursorMove, remoteCursor, language = "python" }) {
  const { theme } = useContext(ThemeContext);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((e) => {
      if (onCursorMove) {
        onCursorMove({ line: e.position.lineNumber, column: e.position.column });
      }
    });
  };

  useEffect(() => {
    if (!remoteCursor || !editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(
          remoteCursor.line, remoteCursor.column,
          remoteCursor.line, remoteCursor.column + 1
        ),
        options: {
          className: "remoteCursor",
          afterContentClassName: "remoteCursorLabel",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);
  }, [remoteCursor]);

  const monacoLang = language === "java" ? "java" : "python";

  return (
    <Editor
      height="100%"
      language={monacoLang}
      value={code}
      theme={theme === "dark" ? "vs-dark" : "light"}
      onChange={(val) => { if (!readOnly) setCode(val || ""); }}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "'Space Mono', monospace",
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        overviewRulerLanes: 0,
        renderLineHighlight: readOnly ? "none" : "line",
        cursorBlinking: "smooth",
      }}
    />
  );
}

export default CodeEditor;
