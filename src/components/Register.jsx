import { useState } from "react";
import { auth, db } from "../firebase"; // FIXED PATH
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { useNavigate, Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle"; // FIXED PATH

export default function Register() {
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Multi-Tenant Fields
  const [collegeCode, setCollegeCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");

  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Save College Code and conditionally save Roll Number
      await set(ref(db, 'users/' + userCredential.user.uid), {
        name,
        email,
        role,
        collegeCode: collegeCode.toUpperCase().trim(),
        rollNumber: role === "student" ? rollNumber.toUpperCase().trim() : null,
        createdAt: Date.now()
      });

      if (role === "hod") navigate("/hod-dashboard");
      else if (role === "teacher") navigate("/teacher-dashboard");
      else navigate("/student-dashboard");
    } catch (err) {
      setError(err.message || "Failed to register.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <h2 className="text-3xl font-black text-center text-blue-600 dark:text-blue-400 mb-6 tracking-tight">
          CampusPro<span className="text-gray-900 dark:text-white">.</span>
        </h2>

        {/* Role Selection */}
        <div className="flex justify-between mb-6 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
          {["student", "teacher", "hod"].map((r) => (
            <button
              key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 capitalize font-bold py-2 px-2 text-sm rounded-lg transition-all ${role === r
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {r}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-3 rounded">{error}</p>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase">College Code</label>
            <input required type="text" placeholder="e.g., PTU, MIT123"
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              onChange={(e) => setCollegeCode(e.target.value)} />
          </div>

          {role === "student" && (
            <div className="transition-all duration-300">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase mt-4">Roll Number</label>
              <input required type="text" placeholder="Student Roll No."
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => setRollNumber(e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase mt-4">Full Name</label>
            <input required type="text" placeholder="Your Name"
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase mt-4">Email Address</label>
            <input required type="email" placeholder="Email"
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase mt-4">Password</label>
            <input required type="password" placeholder="Password"
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button disabled={isRegistering} className="w-full text-white bg-blue-600 hover:bg-blue-700 p-4 mt-2 rounded-xl font-black text-lg shadow-md active:scale-95 transition-transform">
            {isRegistering ? "Registering..." : `Join ${role.charAt(0).toUpperCase() + role.slice(1)} Portal`}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400 font-medium">
          Already have an account? <Link to="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
