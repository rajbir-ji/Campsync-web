import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function StudentNotices() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // 1. Safely wait for Firebase Auth to confirm the user is logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");

        // 2. Fetch ALL circulars (Bypasses Firebase Indexing requirements)
        const circularsRef = ref(db, "circulars");
        const snap = await get(circularsRef);
        
        const noticeList = [];

        if (snap.exists()) {
          snap.forEach((childSnap) => {
            const data = childSnap.val();
            
            // 3. EXCLUDE Staff Notices (Students should never see these)
            if (data.isStaffNotice === true) return;

            // 4. Check if the notice belongs to this subject OR is a global HOD notice
            if (data.subjectId === subjectId || data.subjectId === "HOD_NOTICE") {
               
               let isTargeted = false;
               
               // 5. Bulletproof Target Audience Check (Prevents Firebase object crashes)
               if (data.targetAudience) {
                 let audienceArray = [];
                 
                 if (Array.isArray(data.targetAudience)) {
                   audienceArray = data.targetAudience;
                 } else if (typeof data.targetAudience === "object") {
                   audienceArray = Object.values(data.targetAudience);
                 } else if (typeof data.targetAudience === "string") {
                   audienceArray = [data.targetAudience]; 
                 }
                 
                 if (audienceArray.includes(user.uid)) {
                    isTargeted = true;
                 }
               }

               // 6. If targeted, add to list
               if (isTargeted) {
                 noticeList.push({ id: childSnap.key, ...data });
               }
            }
          });
        }

        // Sort by newest first
        noticeList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Remove duplicates just in case
        const uniqueNotices = Array.from(new Set(noticeList.map(n => n.id)))
          .map(id => noticeList.find(n => n.id === id));

        setNotices(uniqueNotices);
      } catch (error) {
        console.error("Error fetching notices:", error);
        setErrorMsg(error.message);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup auth listener
    return () => unsubscribe();
  }, [subjectId, navigate]);

  // SAFE LOADING SCREEN (Visible in both Light and Dark mode)
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <span className="text-5xl mb-4 animate-bounce">📢</span>
        <h2 className="text-xl font-black text-[#0b3b60] dark:text-blue-400 animate-pulse tracking-widest uppercase">
          Loading Notices...
        </h2>
      </div>
    );
  }

  // ERROR SCREEN (If Firebase blocks the read)
  if (errorMsg) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8 text-center">
        <span className="text-5xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Failed to load notices</h2>
        <p className="text-gray-500 text-sm max-w-md bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30">{errorMsg}</p>
        <button onClick={() => navigate(-1)} className="mt-6 bg-[#0b3b60] text-white px-6 py-2 rounded-lg font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-[100dvh] bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-[#0b3b60] dark:text-blue-400 font-bold hover:underline transition-transform active:scale-95">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Back to Dashboard
      </button>
      
      <h2 className="text-2xl md:text-3xl font-black mb-6 text-gray-800 dark:text-white flex items-center gap-3 tracking-tight">
        <span className="text-3xl">📢</span> Notices & Links
      </h2>

      {/* BLANK STATE: Shows if no notices exist for this student */}
      {notices.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 p-10 rounded-[2rem] shadow-sm text-center border border-gray-100 dark:border-gray-700 mt-10">
          <span className="text-6xl opacity-30 mb-4 block">📭</span>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Notices Yet</h3>
          <p className="text-gray-500 font-medium">Your teachers haven't posted any updates, tests, or links for this subject.</p>
        </motion.div>
      ) : (
        <div className="grid gap-5">
          {/* POPULATED STATE: Shows the actual notices dynamically */}
          {notices.map(notice => (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={notice.id} className={`bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-sm border ${notice.isHodNotice ? 'border-l-8 border-l-red-500' : 'border-l-8 border-l-yellow-400'} dark:border-gray-700 relative overflow-hidden`}>
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 w-full">
                  
                  <div className="flex items-center flex-wrap gap-2 mb-3">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{notice.title}</h3>
                    {/* Visual Badge for HOD Notices */}
                    {notice.isHodNotice && (
                      <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-md text-[10px] uppercase tracking-widest font-black shrink-0 shadow-sm border border-red-200 dark:border-red-800">
                        HOD Broadcast
                      </span>
                    )}
                  </div>
                  
                  {/* Notice Text Content */}
                  {notice.message && (
                     <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                        {notice.message}
                     </p>
                  )}
                  
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-5 flex items-center gap-2">
                     <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 p-1.5 rounded-full shadow-inner">🧑‍🏫</span> 
                     {notice.teacherName} 
                     <span className="text-gray-300 dark:text-gray-600">•</span> 
                     {new Date(notice.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                
                {/* Notice Attached External Link Button */}
                {notice.link && (
                  <a 
                    href={notice.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`w-full sm:w-auto text-center shrink-0 ${notice.isHodNotice ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-[#0b3b60] hover:bg-blue-800 shadow-blue-200 dark:shadow-none'} text-white px-8 py-4 rounded-2xl font-black text-sm transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 mt-2 sm:mt-0`}
                  >
                    <span className="text-xl">🔗</span> Open Link
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}