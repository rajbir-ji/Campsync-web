import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function SyncAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState("user");
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Hi! I'm SyncAI. How can I help you with CampusPro today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch user role on load so the AI knows who it is talking to
  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) setRole(userDoc.data().role);
      }
    };
    fetchRole();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);
    setInput("");
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key is missing in .env file.");

      // System Instructions based on role
      const systemPrompt = `You are SyncAI, the official AI assistant for the CampusPro College Management Platform. 
      The person talking to you is a ${role}. 
      Keep answers short, professional, and directly related to the CampusPro app (attendance, assignments, dashboards). 
      Do not invent database data or student records. If asked to modify data, explain that you are just a guide and they must use the dashboard buttons.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }]
        })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error.message);

      const aiResponse = data.candidates[0].content.parts[0].text;

      setMessages(prev => [...prev, { sender: "ai", text: aiResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: "ai", text: `⚠️ Error: ${error.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-200 mb-4 flex flex-col h-[500px] overflow-hidden transform transition-all">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white shadow-md">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h3 className="font-bold">SyncAI</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 text-xl font-bold">✕</button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`p-3 rounded-xl max-w-[85%] text-sm ${msg.sender === "user" ? "bg-blue-600 text-white rounded-br-none shadow" : "bg-white border text-gray-800 rounded-bl-none shadow-sm"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="p-3 bg-white border text-gray-500 rounded-xl rounded-bl-none shadow-sm text-sm flex space-x-1">
                  <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask SyncAI..."
                className="flex-1 p-2 bg-gray-100 border-transparent rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              <button
                type="submit"
                disabled={isTyping}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                ↑
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white w-14 h-14 flex items-center justify-center rounded-full shadow-2xl hover:scale-110 transition-transform transform border-4 border-white"
        >
          <span className="text-3xl">🤖</span>
        </button>
      )}
    </div>
  );
}