import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { WORKSPACE_COLORS } from "@/data/crm-mock";

interface WorkspaceColorContextType {
  colorHsl: string;
  setColorHsl: (hsl: string) => void;
  colorName: string;
}

const WorkspaceColorContext = createContext<WorkspaceColorContextType>({
  colorHsl: WORKSPACE_COLORS[0].hsl,
  setColorHsl: () => {},
  colorName: WORKSPACE_COLORS[0].name,
});

export function WorkspaceColorProvider({ children }: { children: ReactNode }) {
  const [colorHsl, setColorHsl] = useState(() =>
    localStorage.getItem("sp_workspace_color") || WORKSPACE_COLORS[0].hsl
  );

  const colorName = WORKSPACE_COLORS.find(c => c.hsl === colorHsl)?.name || "Индиго";

  useEffect(() => {
    localStorage.setItem("sp_workspace_color", colorHsl);
    const root = document.documentElement;
    root.style.setProperty("--primary", colorHsl);
    root.style.setProperty("--ring", colorHsl);
    root.style.setProperty("--sidebar-primary", colorHsl);
    root.style.setProperty("--sidebar-ring", colorHsl);
  }, [colorHsl]);

  return (
    <WorkspaceColorContext.Provider value={{ colorHsl, setColorHsl, colorName }}>
      {children}
    </WorkspaceColorContext.Provider>
  );
}

export const useWorkspaceColor = () => useContext(WorkspaceColorContext);
