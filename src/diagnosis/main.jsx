import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import DiagnosisPage from "./DiagnosisPage.jsx";
import "../index.css";

createRoot(document.getElementById("root")).render(
  <>
    <DiagnosisPage />
    <Analytics />
  </>
);
