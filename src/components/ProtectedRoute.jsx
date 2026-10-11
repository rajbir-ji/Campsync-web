import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase"; 
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";

export default function ProtectedRoute({ children, allowedRoles }) {
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    // 5-SECOND FAILSAFE
    const timer = setTimeout(() => {
      setIsAuthorized(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        clearTimeout(timer);
        setIsAuthorized(false);
        return;
      }

      get(child(ref(db), `users/${user.uid}`))
        .then((snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const role = String(userData.role).toLowerCase(); // Prevent case-sensitivity bugs
            
            if (allowedRoles && !allowedRoles.includes(role)) {
              setIsAuthorized(false);
            } else {
              setIsAuthorized(true);
            }
          } else {
            signOut(auth);
            setIsAuthorized(false);
          }
        })
        .catch((error) => {
          console.error("Auth Error:", error);
          signOut(auth);
          setIsAuthorized(false);
        })
        .finally(() => {
          clearTimeout(timer);
        });
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [allowedRoles]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <h2 className="text-2xl font-bold text-blue-500 animate-pulse">Loading CampusPro...</h2>
      </div>
    );
  }

  return isAuthorized ? children : <Navigate to="/login" />;
}