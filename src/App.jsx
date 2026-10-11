import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";

import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";
import HODDashboard from "./components/hod/HODDashboard";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import StudentDashboard from "./components/student/StudentDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

import AttendancePortal from "./components/teacher/AttendancePortal";
import StudentAttendanceViewer from "./components/student/StudentAttendanceViewer";
import TeacherAssignmentPortal from "./components/teacher/TeacherAssignmentPortal";
import StudentAssignmentPortal from "./components/student/StudentAssignmentPortal";
import TeacherSubmissionsPortal from "./components/teacher/TeacherSubmissionsPortal";

// ONE-TIME LOGIN ROUTER: Automatically sends users to their dashboard if logged in
function RootRoute() {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState("/login");

  useEffect(() => {
    // 5-SECOND FAILSAFE: If database hangs, force redirect to login
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        get(child(ref(db), `users/${user.uid}`))
          .then((snap) => {
            if (snap.exists()) {
              const role = String(snap.val().role).toLowerCase(); // Handle capitalization issues
              if (role === "hod") setRedirectPath("/hod-dashboard");
              else if (role === "teacher") setRedirectPath("/teacher-dashboard");
              else if (role === "student") setRedirectPath("/student-dashboard");
              else setRedirectPath("/login");
            } else {
              signOut(auth); // User deleted from DB but stuck in Auth
              setRedirectPath("/login");
            }
          })
          .catch((err) => {
            console.error("Firebase fetch error:", err);
            signOut(auth);
            setRedirectPath("/login");
          })
          .finally(() => {
            clearTimeout(timer);
            setLoading(false);
          });
      } else {
        clearTimeout(timer);
        setRedirectPath("/login");
        setLoading(false);
      }
    });
    
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (loading) return <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><h1 className="text-blue-600 text-2xl font-bold animate-pulse">Loading CampusPro...</h1></div>;
  return <Navigate to={redirectPath} />;
}

export default function App() {
  // Instantly applies the saved theme globally on website load
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "system";
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route path="/hod-dashboard" element={<ProtectedRoute allowedRoles={["hod"]}><HODDashboard /></ProtectedRoute>} />
        
        <Route path="/teacher-dashboard" element={<ProtectedRoute allowedRoles={["teacher"]}><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/attendance/:subjectId" element={<ProtectedRoute allowedRoles={["teacher"]}><AttendancePortal /></ProtectedRoute>} />
        <Route path="/teacher/assignments/:subjectId" element={<ProtectedRoute allowedRoles={["teacher"]}><TeacherAssignmentPortal /></ProtectedRoute>} />
        <Route path="/teacher/submissions/:assignmentId" element={<ProtectedRoute allowedRoles={["teacher"]}><TeacherSubmissionsPortal /></ProtectedRoute>} />
        
        <Route path="/student-dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/attendance/:subjectId" element={<ProtectedRoute allowedRoles={["student"]}><StudentAttendanceViewer /></ProtectedRoute>} />
        <Route path="/student/assignments/:subjectId" element={<ProtectedRoute allowedRoles={["student"]}><StudentAssignmentPortal /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}