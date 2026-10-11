import { useState, useEffect } from "react";

export default function ThemeToggle() {
  // Check local storage first, otherwise default to "system"
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "system";
    }
    return "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Check if we should apply dark mode (either forced "dark", or "system" while OS is dark)
    const isDark = 
      theme === "dark" || 
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Save preference
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="flex items-center space-x-1 bg-gray-900/50 p-1 rounded-lg border border-gray-700/50 shadow-inner mr-2">
      <button 
        onClick={() => setTheme("light")} 
        title="Light Mode"
        className={`p-1.5 rounded-md transition-all ${theme === "light" ? "bg-gray-700 shadow border border-gray-600" : "opacity-50 hover:opacity-100"}`}
      >
        ☀️
      </button>
      <button 
        onClick={() => setTheme("system")} 
        title="System Preference"
        className={`p-1.5 rounded-md transition-all ${theme === "system" ? "bg-gray-700 shadow border border-gray-600" : "opacity-50 hover:opacity-100"}`}
      >
        💻
      </button>
      <button 
        onClick={() => setTheme("dark")} 
        title="Dark Mode"
        className={`p-1.5 rounded-md transition-all ${theme === "dark" ? "bg-gray-700 shadow border border-gray-600" : "opacity-50 hover:opacity-100"}`}
      >
        🌙
      </button>
    </div>
  );
}