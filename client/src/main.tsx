import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sala/:roomId" element={<Room />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
