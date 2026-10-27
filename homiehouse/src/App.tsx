import { sdk } from "@farcaster/frame-sdk";
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Compose from "./pages/Compose";
import Settings from "./pages/Settings";
import Dev from "./pages/Dev";

function App() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="feed" element={<Feed />} />
        <Route path="profile/:address" element={<Profile />} />
        <Route path="compose" element={<Compose />} />
        <Route path="settings" element={<Settings />} />
        <Route path="dev" element={<Dev />} />
      </Route>
    </Routes>
  );
}

export default App;
