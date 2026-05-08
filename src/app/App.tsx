import React from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { MainContent } from "./components/MainContent";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col font-sans selection:bg-[#00a19c]/30">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6">
        <Sidebar />
        <MainContent />
      </main>
    </div>
  );
}
