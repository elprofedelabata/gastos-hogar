import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HouseholdApp } from "@/app/household-app";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HouseholdApp />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
