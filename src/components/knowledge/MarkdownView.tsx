import MDEditor from "@uiw/react-md-editor";
import { useTheme } from "@/contexts/ThemeContext";

export function MarkdownView({ source }: { source: string }) {
  const { theme } = useTheme();
  return (
    <div data-color-mode={theme === "dark" ? "dark" : "light"} className="prose-sm max-w-none">
      <MDEditor.Markdown source={source || "_Пусто_"} style={{ background: "transparent" }} />
    </div>
  );
}
