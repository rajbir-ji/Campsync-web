import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get, child, query, orderByChild, equalTo } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // IMPORT EXCEL LIBRARY

export default function StudentAttendanceViewer() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, leave: 0, total: 0, percentage: 0 });

  useEffect(() => {
    fetchAttendanceData();
  }, [subjectId]);

  const fetchAttendanceData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return navigate("/login");

      const dbRef = ref(db);
      const subSnap = await get(child(dbRef, `subjects/${subjectId}`));
      if (subSnap.exists()) setSubject(subSnap.val());

      const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subjectId));
      const snap = await get(attQ);

      let p = 0, a = 0, l = 0;

      if (snap.exists()) {
        snap.forEach((docSnap) => {
          const records = docSnap.val().records || {};
          const status = records[user.uid];
          if (status === 'P') p++;
          else if (status === 'A') a++;
          else if (status === 'L') l++;
        });
      }

      const totalClasses = p + a + l;
      const calcPercentage = totalClasses === 0 ? 0 : Math.round((p / totalClasses) * 100);
      setStats({ present: p, absent: a, leave: l, total: totalClasses, percentage: calcPercentage });
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  // EXCEL DOWNLOAD FUNCTION
  const downloadMyAttendance = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "Subject Name": subject?.name || "Subject",
      "Total Classes Held": stats.total,
      "Classes Attended": stats.present,
      "Classes Missed": stats.absent,
      "Official Leaves": stats.leave,
      "Overall Percentage": `${stats.percentage}%`
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "My Attendance");
    XLSX.writeFile(wb, `${subject?.name || "Subject"}_My_Attendance.xlsx`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="p-10 text-xl font-bold text-blue-600 animate-pulse">Loading Analytics...</div></div>;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.percentage / 100) * circumference;
  const colorClass = stats.percentage >= 75 ? "text-green-500" : stats.percentage >= 60 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-t-xl shadow border-b-4 border-blue-600 mb-6 gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-black text-gray-800 dark:text-white">{subject?.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">Attendance Analytics</p>
          </div>
          <button onClick={() => navigate("/student-dashboard")} className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition">
            ← Back to Dashboard
          </button>
        </div>

        {stats.total === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-10 rounded-xl shadow text-center text-gray-500 font-bold border dark:border-gray-700">
            No attendance records found for this subject yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow flex flex-col items-center justify-center border dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-6">Overall Attendance</h2>
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="transform -rotate-90 w-40 h-40">
                  <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                  <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={`${colorClass} transition-all duration-1000 ease-out`} />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.percentage}%</span>
                </div>
              </div>
              {stats.percentage < 75 && (
                <p className="mt-6 text-red-500 font-semibold text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg w-full text-center">⚠️ Warning: Attendance is below 75%</p>
              )}
            </div>

            <div className="flex flex-col space-y-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow flex justify-between items-center border-l-4 border-blue-500">
                <span className="text-gray-600 dark:text-gray-300 font-bold text-lg">Total Classes</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.total}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow flex justify-between items-center border-l-4 border-green-500">
                <span className="text-gray-600 dark:text-gray-300 font-bold text-lg">Present</span>
                <span className="text-2xl font-black text-green-600 dark:text-green-400">{stats.present}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow flex justify-between items-center border-l-4 border-red-500">
                <span className="text-gray-600 dark:text-gray-300 font-bold text-lg">Absent</span>
                <span className="text-2xl font-black text-red-600 dark:text-red-400">{stats.absent}</span>
              </div>
              
              {/* DOWNLOAD EXCEL BUTTON */}
              <button onClick={downloadMyAttendance} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-black shadow-md transition-transform active:scale-95">
                ⬇ Download Excel Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}