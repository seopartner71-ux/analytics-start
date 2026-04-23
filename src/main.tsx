import { installEdgeProxy } from "./shared/utils/edgeProxy";
import { createRoot } from "react-dom/client";
import "./index.css";

async function bootstrap() {
  await installEdgeProxy();
  await import("./i18n");
  const { default: App } = await import("./App.tsx");

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
