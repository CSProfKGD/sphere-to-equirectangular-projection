import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProjectionExperience } from "./ProjectionExperience";
import "./globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root element");
}

createRoot(root).render(
  <StrictMode>
    <ProjectionExperience />
  </StrictMode>,
);
