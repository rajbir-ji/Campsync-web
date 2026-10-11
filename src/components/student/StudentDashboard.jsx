import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get, child, query, orderByChild, equalTo, update } from "firebase/database";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import ThemeToggle from "../ThemeToggle";
import * as XLSX from "xlsx";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from "framer-motion";

export default function StudentDashboard() {
  const navigate = useNavigate();
  // Starts on the main app icon grid
  const [activeTab, setActiveTab] = useState("dashboard"); 

  const [studentName, setStudentName] = useState("");
  const [myCollegeCode, setMyCollegeCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");

  const [classes, setClasses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  
  // TIMETABLE STATE
  const [timetable, setTimetable] = useState({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [selectedDay, setSelectedDay] = useState("Monday");

  const [loading, setLoading] = useState(true);

  // SOFT ARCHIVE TOGGLE STATE
  const [viewMode, setViewMode] = useState("active");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await get(child(ref(db), `users/${user.uid}`));
        if (uSnap.exists()) {
          const data = uSnap.val();
          setStudentName(data.name || "Student");
          setMyCollegeCode(data.collegeCode);
          setRollNumber(data.rollNumber);
          fetchStudentData(user.uid, data.collegeCode);
        }
      } else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchStudentData = async (uid, collegeCode) => {
    try {
      const dbRef = ref(db);

      const classQ = query(ref(db, "classes"), orderByChild("collegeCode"), equalTo(collegeCode));
      const classSnap = await get(classQ);
      const allClasses = [];
      if (classSnap.exists()) classSnap.forEach(snap => allClasses.push({ id: snap.key, ...snap.val() }));

      const semQ = query(ref(db, "semesters"), orderByChild("collegeCode"), equalTo(collegeCode));
      const semSnap = await get(semQ);
      const mySemesters = [];
      const mySemIds = [];
      
      if (semSnap.exists()) {
        semSnap.forEach(snap => {
          const semData = snap.val();
          const sIds = semData.studentIds || [];
          const studentArray = Array.isArray(sIds) ? sIds : Object.keys(sIds);
          if (studentArray.includes(uid)) {
            mySemesters.push({ id: snap.key, ...semData });
            mySemIds.push(snap.key);
          }
        });
      }
      setSemesters(mySemesters);

      const myClasses = allClasses.filter(cls => {
        const cSemIds = cls.semesterIds || [];
        const cSemArray = Array.isArray(cSemIds) ? cSemIds : Object.keys(cSemIds);
        return cSemArray.some(id => mySemIds.includes(id));
      });
      setClasses(myClasses);
      
      // Auto-select first class and semester if available
      let currentClassId = null;
      let currentSemId = null;
      if(myClasses.length > 0) {
        currentClassId = myClasses[0].id;
        setSelectedClass(currentClassId);
      }
      if(mySemesters.length > 0) {
        currentSemId = mySemesters[0].id;
        setSelectedSemester(currentSemId);
      }

      // LOAD TIMETABLE DATA IF CLASS AND SEMESTER EXIST
      if (currentClassId && currentSemId) {
        const activeClass = myClasses.find(c => c.id === currentClassId);
        if (activeClass && activeClass.timetables && activeClass.timetables[currentSemId]) {
           setTimetable({
             Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [],
             ...activeClass.timetables[currentSemId]
           });
        }
      }

      const subQ = query(ref(db, "subjects"), orderByChild("collegeCode"), equalTo(collegeCode));
      const subSnap = await get(subQ);
      const mySubjects = [];
      const seenSubjects = new Set(); 

      if (subSnap.exists()) {
        subSnap.forEach(snap => {
          const subData = snap.val();
          const safeName = (subData.name || "").toLowerCase().replace(/\s+/g, "");
          const uniqueKey = `${safeName}_${subData.semesterId}`;

          if (mySemIds.includes(subData.semesterId) && !seenSubjects.has(uniqueKey)) {
            seenSubjects.add(uniqueKey);
            mySubjects.push({ 
              id: snap.key, 
              ...subData,
              isArchived: subData.archivedBy && subData.archivedBy[uid] === true
            });
          }
        });
      }
      setSubjects(mySubjects);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  // Re-fetch timetable if the student switches between semesters or classes
  useEffect(() => {
    if (selectedClass && selectedSemester) {
      const activeClass = classes.find(c => c.id === selectedClass);
      if (activeClass && activeClass.timetables && activeClass.timetables[selectedSemester]) {
         setTimetable({
           Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [],
           ...activeClass.timetables[selectedSemester]
         });
      } else {
         // Reset if no timetable exists for the new semester
         setTimetable({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
      }
    }
  }, [selectedSemester, selectedClass, classes]);

  const handleToggleArchive = async (subjectId, currentStatus) => {
    const user = auth.currentUser;
    if (!user) return;
    const isNowArchived = !currentStatus;
    try {
      await update(ref(db, `subjects/${subjectId}/archivedBy`), { [user.uid]: isNowArchived ? true : null });
      setSubjects(prev => prev.map(sub => sub.id === subjectId ? { ...sub, isArchived: isNowArchived } : sub));
    } catch (error) { alert("Network error. Could not update archive status."); }
  };

  const saveExcelFile = async (workbook, fileName) => {
    try {
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Documents });
        alert(`Saved successfully to your Documents folder: ${fileName}`);
      } else {
        XLSX.writeFile(workbook, fileName);
      }
    } catch (e) { alert("Failed to save file."); }
  };

  const handleDownloadTimetable = () => {
    const data = [];
    daysOfWeek.forEach(day => {
      if (timetable[day] && timetable[day].length > 0) {
        let rowObj = { "Day": day };
        const sortedLectures = [...timetable[day]].sort((a,b) => a.lecNumber.localeCompare(b.lecNumber));
        sortedLectures.forEach((lec) => {
          rowObj[`${lec.lecNumber} Lecture`] = `${lec.subject}\n(${lec.startTime} - ${lec.endTime})\nProf: ${lec.teacherName}`;
        });
        data.push(rowObj);
      }
    });

    if (data.length === 0) return alert("Timetable is empty. No schedule found.");
    const ws = XLSX.utils.json_to_sheet(data); 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable"); 
    
    const activeClassObj = classes.find(c => c.id === selectedClass);
    const className = activeClassObj ? activeClassObj.name : "Class";
    const semesterName = semesters.find(s => s.id === selectedSemester)?.name || "Semester";
    saveExcelFile(wb, `${className}_${semesterName}_Timetable.xlsx`);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      signOut(auth).then(() => navigate("/login"));
    }
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900"><h2 className="text-3xl font-bold text-[#0b3b60] animate-pulse">Loading Portal...</h2></div>;

  const displayedSubjects = subjects.filter(sub => 
    sub.semesterId === selectedSemester && (viewMode === "active" ? !sub.isArchived : sub.isArchived)
  );

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-gray-900 transition-colors duration-300 pb-20 relative">

      {/* APP-STYLE HEADER */}
      <div className="bg-[#0b3b60] text-white p-4 md:p-8 flex flex-col justify-end shadow-md sticky top-0 z-40 rounded-b-[2.5rem] min-h-[140px] overflow-visible">
        
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-[100]">
          <div className="flex gap-4">
            <ThemeToggle />
            <div className="relative z-[999]">
              <NotificationBell direction="down" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogout} 
              className="hidden sm:block px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-8 px-2 flex justify-between items-end">
          <div>
             <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hi, {(studentName || "").split(' ')[0]}</h1>
             <p className="text-blue-200 mt-1 opacity-90 tracking-wide text-xs font-medium uppercase">Roll No: {rollNumber} • Code: {myCollegeCode}</p>
          </div>
          {activeTab !== "dashboard" && (
             <button onClick={() => setActiveTab("dashboard")} className="text-sm font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
               Back
             </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-8 relative z-10">

        {/* --- DASHBOARD MAIN MENU GRID --- */}
        <AnimatePresence mode="wait">
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
             <button onClick={() => setActiveTab("modules")} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-4 hover:border-blue-500 transition-all active:scale-95 group">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">📚</div>
                <h3 className="font-black text-gray-900 dark:text-white text-lg sm:text-xl">My Subjects</h3>
             </button>
             
             <button onClick={() => setActiveTab("timetable")} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-4 hover:border-indigo-500 transition-all active:scale-95 group">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">🗓️</div>
                <h3 className="font-black text-gray-900 dark:text-white text-lg sm:text-xl">Timetable</h3>
             </button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* --- TIMETABLE TAB (Read Only View for Students) --- */}
        {activeTab === "timetable" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
            
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-xl font-black text-[#0b3b60] dark:text-blue-400">Class Timetable</h3>
              <button onClick={handleDownloadTimetable} className="w-full sm:w-auto text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-4 py-2 rounded-lg transition shadow-sm border border-blue-200 dark:border-blue-800">
                 ⬇ Download
              </button>
            </div>

            {/* CLASS & SEMESTER SELECTORS */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Select Class</label>
                {classes.length > 0 ? (
                  <select 
                    value={selectedClass || ""} 
                    onChange={(e) => setSelectedClass(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b3b60]"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 italic py-2">No classes available.</p>
                )}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Select Semester</label>
                {semesters.filter(sem => {
                  const classObj = classes.find(c => c.id === selectedClass);
                  const semIds = classObj?.semesterIds || [];
                  const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                  return semIdsArray.includes(sem.id);
                }).length > 0 ? (
                  <select 
                    value={selectedSemester || ""} 
                    onChange={(e) => setSelectedSemester(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b3b60]"
                  >
                    {semesters.filter(sem => {
                      const classObj = classes.find(c => c.id === selectedClass);
                      const semIds = classObj?.semesterIds || [];
                      const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                      return semIdsArray.includes(sem.id);
                    }).map(sem => (
                      <option key={sem.id} value={sem.id}>{sem.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 italic py-2">No semesters linked to this class.</p>
                )}
              </div>
            </div>

            {/* Day Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 custom-scrollbar px-1">
              {daysOfWeek.map(day => (
                <button 
                  key={day} 
                  onClick={() => setSelectedDay(day)} 
                  className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors shadow-sm ${selectedDay === day ? 'bg-[#0b3b60] text-white border-none' : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300'}`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Schedule Display */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-700 min-h-[300px]">
              <h4 className="font-black text-[#0b3b60] dark:text-blue-400 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 uppercase tracking-wider">{selectedDay}</h4>
              
              {!timetable[selectedDay] || timetable[selectedDay].length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <span className="text-4xl mb-2">🌴</span>
                  <p className="text-sm text-gray-500 italic text-center font-medium">No classes scheduled for today.<br/>Enjoy your free time!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timetable[selectedDay].sort((a, b) => a.lecNumber.localeCompare(b.lecNumber)).map((lec, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#1a2035] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-gray-500 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 bg-gray-900 text-orange-500 rounded-full flex items-center justify-center font-black shadow-inner text-sm">
                          {lec.lecNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white leading-tight truncate">{lec.subject}</h4>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300 font-bold tracking-wider">🕑 {lec.startTime} - {lec.endTime}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <div className="text-xs font-bold text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-1.5">
                           <span className="text-sm">🧑‍🏫</span> Prof. {lec.teacherName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- MODULES VIEWS --- */}
        {activeTab === "modules" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            
            {/* SEMESTER SELECTOR PILLS */}
            {semesters.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-4 mb-2 custom-scrollbar px-2">
                {semesters.map(sem => (
                  <button 
                    key={sem.id} 
                    onClick={() => setSelectedSemester(sem.id)} 
                    className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors shadow-sm ${selectedSemester === sem.id ? 'bg-[#0b3b60] text-white border-none' : 'bg-white text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}
                  >
                    {sem.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Active Modules</h2>
              
              <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-full shadow-inner">
                <button onClick={() => setViewMode("active")} className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${viewMode === "active" ? "bg-white dark:bg-gray-600 text-[#0b3b60] shadow" : "text-gray-500"}`}>Active</button>
                <button onClick={() => setViewMode("archived")} className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${viewMode === "archived" ? "bg-white dark:bg-gray-600 text-red-600 shadow" : "text-gray-500"}`}>Archived</button>
              </div>
            </div>

            {displayedSubjects.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm text-center border border-gray-100 dark:border-gray-700">
                <span className="text-5xl opacity-30 mb-4 block">{viewMode === "active" ? "🎒" : "🗄️"}</span>
                <p className="text-gray-500 font-medium">{viewMode === "active" ? "No active subjects assigned." : "Your archive is empty."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedSubjects.map(sub => (
                  <div key={sub.id} className={`bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border ${viewMode === "archived" ? "border-gray-300 opacity-80" : "border-blue-100 dark:border-gray-700"} flex flex-col relative`}>
                    
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 shrink-0 rounded-[1.25rem] flex items-center justify-center text-xl shadow-inner bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                        📘
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate leading-tight">{sub.name}</h3>
                      </div>
                    </div>

                    {/* Icon Grid for Student Actions */}
                    <div className={`grid grid-cols-2 gap-3 mt-auto ${sub.isArchived ? 'opacity-50 pointer-events-none' : ''}`}>
                      <button onClick={() => navigate(`/student/attendance/${sub.id}`)} className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-100 dark:border-gray-700 active:scale-95">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shadow-inner">
                          <span className="text-lg">📊</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Attendance</span>
                      </button>
                      
                      <button onClick={() => navigate(`/student/assignments/${sub.id}`)} className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-100 dark:border-gray-700 active:scale-95">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shadow-inner">
                          <span className="text-lg">📝</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Tasks</span>
                      </button>
                    </div>

                    {/* Archive Toggle Line */}
                    <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                      <button onClick={() => handleToggleArchive(sub.id, sub.isArchived)} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
                        {sub.isArchived ? "↑ Unarchive Subject" : "↓ Archive Subject"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* APP-STYLE STICKY BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] md:hidden">
        <div className="flex justify-around items-center h-16 px-4">
          <button onClick={() => setActiveTab("dashboard")} className="flex flex-col items-center justify-center w-full h-full text-[#0b3b60] dark:text-blue-400">
            <span className="text-2xl mb-1">🏠</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
          </button>
          
          <div className="flex flex-col items-center justify-center w-full h-full relative -top-3">
             <div className="bg-[#0b3b60] w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-gray-100 dark:border-gray-900 text-white">
                <span className="text-2xl">🎒</span>
             </div>
          </div>

          <button onClick={handleLogout} className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-red-500 transition-colors">
            <span className="text-2xl mb-1">🚪</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Logout</span>
          </button>
        </div>
      </div>

    </div>
  );
}