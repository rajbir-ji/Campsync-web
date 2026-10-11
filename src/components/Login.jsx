import { useState, useEffect } from "react";
import { auth, db } from "../firebase"; 
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";
import { useNavigate, Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle"; 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false); 
  const [initialCheck, setInitialCheck] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setInitialCheck(false), 2000);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !isLoggingIn) { 
        try {
          const userSnap = await get(child(ref(db), `users/${user.uid}`));
          if (userSnap.exists()) {
            const role = String(userSnap.val().role).toLowerCase();
            if (role === "student") navigate("/student-dashboard");
            else if (role === "teacher") navigate("/teacher-dashboard");
            else if (role === "hod") navigate("/hod-dashboard");
          } else {
            await signOut(auth);
          }
        } catch (err) {
          console.error("Auto-login error:", err);
          await signOut(auth);
        }
      }
      setInitialCheck(false);
      clearTimeout(timer);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [navigate, isLoggingIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError("");
    setMessage("");

    console.log("1. Button Clicked. Starting Firebase Auth...");

    try {
      // Step 1: Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      console.log("2. Auth Successful! User UID:", uid);

      // Step 2: Database Fetch
      console.log("3. Asking Realtime Database for user role...");
      
      // We manually build a timeout so it doesn't hang forever
      const dbPromise = get(child(ref(db), `users/${uid}`));
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database Request Timed Out after 6 seconds.")), 6000));
      
      const userSnap = await Promise.race([dbPromise, timeoutPromise]);
      
      console.log("4. Database responded! Checking if profile exists...");

      if (userSnap.exists()) {
        const role = String(userSnap.val().role).toLowerCase();
        console.log("5. Profile found! Role is:", role);
        if (role === "student") navigate("/student-dashboard");
        else if (role === "teacher") navigate("/teacher-dashboard");
        else if (role === "hod") navigate("/hod-dashboard");
        else { 
          setError("Unrecognized role on this account."); 
          await signOut(auth); 
        }
      } else {
        console.log("5. ERROR: User is in Auth, but missing from 'users' table in Database!");
        setError("Account exists in Auth, but Profile Data is missing in Database. Please register again.");
        await signOut(auth);
      }
    } catch (err) {
      console.error("Login Error Caught:", err);
      setError(err.message || "Invalid email or password.");
      try { await signOut(auth); } catch(e) { /* ignore */ }
    } finally {
      setIsLoggingIn(false);
      console.log("6. Login attempt finished. Button unlocked.");
    } 
  };

  const handleForgotPassword = async () => {
    setError(""); setMessage("");
    if (!email) { setError("Please enter your email address first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError("Failed to send reset email. " + err.message);
    }
  };

  if (initialCheck) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><h1 className="text-white text-2xl font-bold animate-pulse">Checking Session...</h1></div>;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors p-4 md:p-8 relative">
      <div className="absolute top-4 right-4 z-50"><ThemeToggle /></div>

      <div className="max-w-5xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 bg-blue-700 dark:bg-blue-900 p-8 md:p-12 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">CampusPro<span className="text-blue-300">.</span></h1>
            <p className="text-blue-100 text-sm md:text-lg font-medium tracking-wide mb-6 md:mb-12">Unified Education Portal</p>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">Secure Login</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Enter your credentials to continue</p>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-semibold rounded">{error}</div>}
          {message && <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-400 text-sm font-semibold rounded">{message}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Password</label>
                <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Forgot Password?</button>
              </div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
            
            <button type="submit" disabled={isLoggingIn} className={`w-full py-4 mt-2 text-white font-black text-lg rounded-xl shadow-lg transition-transform active:scale-95 ${isLoggingIn ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
              {isLoggingIn ? "Logging in..." : "Login to Portal"}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400 font-medium">Don't have an account? <Link to="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Register here</Link></p>
        </div>
      </div>
    </div>
  );
}