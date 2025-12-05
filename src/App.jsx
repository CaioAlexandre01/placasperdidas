// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import AdminPanel from "./components/AdminPanel";


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"       element={<Home />}      />
        <Route path="/admin"  element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}
