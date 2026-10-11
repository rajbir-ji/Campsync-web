import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get, child, update, query, orderByChild, equalTo, push, set } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";

export default function TeacherAttendance() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjectAndStudents();
  }, [subjectId]);

  const fetchSubjectAndStudents = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return navigate("/login");

      const dbRef = ref(db);
      
      const subSnap = await get(child(dbRef, `subjects/${subjectId}`));
      if (!subSnap.exists()) return alert("Subject not found.");
      const subData = subSnap.val();
      setSubject(subData);

      const semSnap = await get(child(dbRef, `semesters/${subData.semesterId}`));
      if (!semSnap.exists()) return alert("Semester not found.");
      
      const sIds = semSnap.val().studentIds || [];
      const studentIds = Array.isArray(sIds) ? sIds : Object.keys(sIds);

      const usersQ = query(ref(db, "users"), orderByChild("role"), equalTo("student"));
      const usersSnap = await get(usersQ);
      const studentList = [];
      const defaultAtt = {};

      if (usersSnap.exists()) {
        usersSnap.forEach((snap) => {
          if (studentIds.includes(snap.key)) {
            studentList.push({ id: snap.key, ...snap.val() });
            defaultAtt[snap.key] = "P"; 
          }
        });
      }
      
      setStudents(studentList);
      setAttendance(defaultAtt);
      
      loadAttendanceForDate(date, studentList);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForDate = async (selectedDate, studentList) => {
    const q = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subjectId));
    const snap = await get(q);
    
    let found = false;
    if (snap.exists()) {
      snap.forEach(doc => {
        if (doc.val().date === selectedDate) {
          setAttendance(doc.val().records);
          found = true;
        }
      });
    }

    if (!found) {
      const defaultAtt = {};
      studentList.forEach(s => defaultAtt[s.id] = "P");
      setAttendance(defaultAtt);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    loadAttendanceForDate(newDate, students);
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status) => {
    const newAtt = {};
    students.forEach(s => newAtt[s.id] = status);
    setAttendance(newAtt);
  };

  // FIXED FIREBASE SAVE LOGIC
  const handleSubmit = async () => {
    try {
      const q = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subjectId));
      const snap = await get(q);
      
      let existingRecordId = null;
      if (snap.exists()) {
        snap.forEach(doc => {
          if (doc.val().date === date) existingRecordId = doc.key;
        });
      }

      if (existingRecordId) {
        // Update existing record
        await update(ref(db, `attendance/${existingRecordId}`), { records: attendance });
      } else {
        // Create new record using proper V9 Modular syntax
        const attendanceListRef = ref(db, "attendance");
        const newRecordRef = push(attendanceListRef);
        await set(newRecordRef, {
          subjectId: subjectId,
          date: date,
          records: attendance,
          timestamp: new Date().toISOString()
        });
      }

      alert("Attendance saved successfully!");
    } catch (err) {
      console.error("Save Error: ", err);
      alert("Error saving attendance.");
    }
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="p-10 text-xl font-bold text-blue-600 animate-pulse">Loading Roster...</div></div>;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto">
        
        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-3xl shadow-sm border-b-4 border-blue-600 mb-6 transition-colors flex flex-col items-center sm:items-start sm:flex-row sm:justify-between text-center sm:text-left gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{subject?.name} - Attendance</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Total Enrolled: {students.length}</p>
          </div>
          <button onClick={() => navigate("/teacher-dashboard")} className="text-blue-600 dark:text-blue-400 font-bold hover:underline bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-xl">
            ← Back to Dashboard
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm mb-6 border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-sm">Select Date:</label>
            <input 
              type="date" 
              value={date} 
              onChange={handleDateChange} 
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={() => markAll('P')} className="flex-1 sm:flex-none bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 px-4 py-3 rounded-xl font-bold transition active:scale-95 text-sm">
              All Present
            </button>
            <button onClick={() => markAll('A')} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-4 py-3 rounded-xl font-bold transition active:scale-95 text-sm">
              All Absent
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
          <div className="hidden sm:grid grid-cols-2 bg-gray-100 dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider text-sm">Student Name</div>
            <div className="font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider text-sm text-center">Status</div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {students.length === 0 ? (
              <p className="p-8 text-center text-gray-500 italic">No students in this class.</p>
            ) : (
              students.map(s => (
                <div key={s.id} className="flex flex-col sm:grid sm:grid-cols-2 p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors gap-4 sm:gap-0 items-center">
                  
                  <div className="font-bold text-gray-900 dark:text-white text-lg w-full text-center sm:text-left truncate flex items-center gap-3">
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-sm tracking-wider">{s.rollNumber || "N/A"}</span>
                    {s.name}
                  </div>

                  <div className="flex justify-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => handleStatusChange(s.id, 'P')}
                      className={`flex-1 sm:flex-none w-14 h-12 rounded-xl font-black text-lg transition-transform active:scale-90 ${
                        attendance[s.id] === 'P' 
                        ? 'bg-green-500 text-white shadow-md ring-2 ring-green-300 dark:ring-green-800' 
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                      }`}
                    >
                      P
                    </button>

                    <button 
                      onClick={() => handleStatusChange(s.id, 'A')}
                      className={`flex-1 sm:flex-none w-14 h-12 rounded-xl font-black text-lg transition-transform active:scale-90 ${
                        attendance[s.id] === 'A' 
                        ? 'bg-red-500 text-white shadow-md ring-2 ring-red-300 dark:ring-red-800' 
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      }`}
                    >
                      A
                    </button>

                    <button 
                      onClick={() => handleStatusChange(s.id, 'L')}
                      className={`flex-1 sm:flex-none w-14 h-12 rounded-xl font-black text-lg transition-transform active:scale-90 ${
                        attendance[s.id] === 'L' 
                        ? 'bg-yellow-500 text-white shadow-md ring-2 ring-yellow-300 dark:ring-yellow-800' 
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                      }`}
                    >
                      L
                    </button>

                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <button 
          onClick={handleSubmit} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black text-xl shadow-xl transition-transform active:scale-95"
        >
          Submit Attendance
        </button>

      </div>
    </div>
  );
}