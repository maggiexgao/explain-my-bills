import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedOppsDataIfNeeded } from "@/lib/seedOppsData";

// Seed OPPS data on app startup if needed
seedOppsDataIfNeeded();

createRoot(document.getElementById("root")!).render(<App />);
