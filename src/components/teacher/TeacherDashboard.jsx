import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get, child, query, orderByChild, equalTo, update, push, set, remove } from "firebase/database"; 
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import ThemeToggle from "../ThemeToggle";
import * as XLSX from "xlsx"; 
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from "framer-motion";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard"); 

  const [subjects, setSubjects] = useState([]);
  const [inchargeClasses, setInchargeClasses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  
  const [teacherName, setTeacherName] = useState("");
  const [myCollegeCode, setMyCollegeCode] = useState(""); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState("active");

  // TIMETABLE VIEWER STATES
  const [manageClass, setManageClass] = useState(null);
  const [timetableSemester, setTimetableSemester] = useState(null); 
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [timetable, setTimetable] = useState({});

  // SEND STUDENT / CLASS NOTICE STATES
  const [noticeTarget, setNoticeTarget] = useState(null); 
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeLink, setNoticeLink] = useState("");
  const [noticeMessage, setNoticeMessage] = useState(""); 
  const [isSendingNotice, setIsSendingNotice] = useState(false);

  // MANAGE NOTICES STATES
  const [isManagingNotices, setIsManagingNotices] = useState(false);
  const [mySentNotices, setMySentNotices] = useState([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [noticeReadStats, setNoticeReadStats] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await get(child(ref(db), `users/${user.uid}`));
        if (uSnap.exists()) {
          const data = uSnap.val();
          setTeacherName(data.name || "Teacher"); 
          setMyCollegeCode(data.collegeCode);
          fetchTeacherData(user.uid, data.collegeCode);
        }
      } else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchTeacherData = async (uid, collegeCode) => {
    try {
      const dbRef = ref(db);
      
      const subQ = query(ref(db, "subjects"), orderByChild("teacherId"), equalTo(uid));
      const subSnap = await get(subQ);
      const subjectsData = [];
      const seenSubjects = new Set(); 

      if (subSnap.exists()) {
        for (const [key, subData] of Object.entries(subSnap.val())) {
          const uniqueKey = subData.name.toLowerCase().trim();
          if(subData.collegeCode === collegeCode && !seenSubjects.has(uniqueKey)) { 
            seenSubjects.add(uniqueKey);
            const semSnap = await get(child(dbRef, `semesters/${subData.semesterId}`));
            subjectsData.push({ 
              id: key, 
              ...subData, 
              semesterName: semSnap.exists() ? semSnap.val().name : "Unknown Semester",
              isArchived: subData.archivedBy && subData.archivedBy[uid] === true 
            });
          }
        }
      }
      setSubjects(subjectsData);

      const classQ = query(ref(db, "classes"), orderByChild("inchargeId"), equalTo(uid));
      const classSnap = await get(classQ);
      const classesData = [];
      if (classSnap.exists()) {
        classSnap.forEach(snap => { if(snap.val().collegeCode === collegeCode) classesData.push({ id: snap.key, ...snap.val() }); });
      }
      setInchargeClasses(classesData);

      const semQ = query(ref(db, "semesters"), orderByChild("collegeCode"), equalTo(collegeCode));
      const semListSnap = await get(semQ);
      const sems = [];
      if (semListSnap.exists()) {
         semListSnap.forEach(doc => sems.push({ id: doc.key, ...doc.val() }));
      }
      setSemesters(sems);

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleToggleArchive = async (subjectId, currentStatus) => {
    const user = auth.currentUser;
    if (!user) return;
    const isNowArchived = !currentStatus;
    try {
      await update(ref(db, `subjects/${subjectId}/archivedBy`), {
        [user.uid]: isNowArchived ? true : null
      });
      setSubjects(prev => prev.map(sub => 
        sub.id === subjectId ? { ...sub, isArchived: isNowArchived } : sub
      ));
    } catch (error) {
      alert("Network error. Could not update archive status.");
    }
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

  const openScheduleModal = (cls) => {
    setManageClass(cls);
    const semIds = cls.semesterIds ? (Array.isArray(cls.semesterIds) ? cls.semesterIds : Object.values(cls.semesterIds)) : [];
    if(semIds.length > 0) {
       setTimetableSemester(semIds[0]);
       const tt = cls.timetables?.[semIds[0]] || {};
       setTimetable({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [], ...tt });
    } else {
       setTimetableSemester(null);
       setTimetable({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
    }
  };

  useEffect(() => {
    if (manageClass && timetableSemester) {
       const activeClass = inchargeClasses.find(c => c.id === manageClass.id);
       if (activeClass && activeClass.timetables && activeClass.timetables[timetableSemester]) {
          setTimetable({
            Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [],
            ...activeClass.timetables[timetableSemester]
          });
       } else {
          setTimetable({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
       }
    }
  }, [timetableSemester, manageClass, inchargeClasses]);


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

    if (data.length === 0) return alert("Timetable is empty. Contact HOD.");
    const ws = XLSX.utils.json_to_sheet(data); 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable"); 
    saveExcelFile(wb, `${manageClass.name}_Timetable.xlsx`);
  };

  const handleDownloadSubjectReport = async (subject) => {
    setIsGenerating(true);
    try {
      const semSnap = await get(ref(db, `semesters/${subject.semesterId}`));
      let studentIds = [];
      if (semSnap.exists()) {
        const sIds = semSnap.val().studentIds || [];
        studentIds = Array.isArray(sIds) ? sIds : Object.values(sIds); 
      }
      const usersQ = query(ref(db, "users"), orderByChild("role"), equalTo("student"));
      const usersSnap = await get(usersQ);
      const students = [];
      if (usersSnap.exists()) {
        usersSnap.forEach(snap => { if (studentIds.includes(snap.key)) students.push({ id: snap.key, ...snap.val() }); });
      }

      const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subject.id));
      const attSnap = await get(attQ);
      const stats = {};
      students.forEach(s => stats[s.id] = { roll: s.rollNumber || "N/A", name: s.name, p: 0, a: 0, l: 0 });

      let totalClasses = 0;
      if (attSnap.exists()) {
        attSnap.forEach(attDoc => {
          totalClasses++;
          const records = attDoc.val().records || {};
          students.forEach(s => {
            const status = records[s.id];
            if (status === 'P') stats[s.id].p++;
            if (status === 'A') stats[s.id].a++;
            if (status === 'L') stats[s.id].l++;
          });
        });
      }

      const excelData = students.map(s => {
        const data = stats[s.id];
        const attended = data.p + data.a + data.l;
        const percentage = attended === 0 ? 0 : Math.round((data.p / attended) * 100);
        return { "Roll No": data.roll, "Student Name": data.name, "Total Classes Held": totalClasses, "Present": data.p, "Absent": data.a, "Leave": data.l, "Attendance %": `${percentage}%` }
      });

      const ws = XLSX.utils.json_to_sheet(excelData); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Attendance");
      saveExcelFile(wb, `${subject.name}_Monthly.xlsx`);
    } catch (err) { alert("Error generating report."); } 
    finally { setIsGenerating(false); }
  };

  const handleDownloadClassMaster = async (cls) => {
    setIsGenerating(true);
    try {
      const dbRef = ref(db);
      const semIds = Array.isArray(cls.semesterIds) ? cls.semesterIds : Object.values(cls.semesterIds || {});
      let allStudentIds = [];
      for (let sId of semIds) {
        const sSnap = await get(child(dbRef, `semesters/${sId}`));
        if (sSnap.exists() && sSnap.val().studentIds) {
          const ids = Array.isArray(sSnap.val().studentIds) ? sSnap.val().studentIds : Object.values(sSnap.val().studentIds);
          allStudentIds = [...allStudentIds, ...ids];
        }
      }
      allStudentIds = [...new Set(allStudentIds)];

      const usersQ = query(ref(db, "users"), orderByChild("role"), equalTo("student"));
      const usersSnap = await get(usersQ);
      const students = [];
      if (usersSnap.exists()) {
        usersSnap.forEach(snap => { if (allStudentIds.includes(snap.key)) students.push({ id: snap.key, ...snap.val() }); });
      }

      const allSubjects = [];
      const subSnap = await get(ref(db, "subjects"));
      if (subSnap.exists()) {
        subSnap.forEach(snap => { if (semIds.includes(snap.val().semesterId)) allSubjects.push({ id: snap.key, ...snap.val() }); });
      }

      const stats = {};
      students.forEach(s => stats[s.id] = { roll: s.rollNumber || "N/A", name: s.name, department: s.department || "N/A" });
      
      for (let sub of allSubjects) {
        const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(sub.id));
        const attSnap = await get(attQ);
        let subTotal = 0; const subStats = {};
        students.forEach(s => subStats[s.id] = { p: 0, total: 0 });

        if (attSnap.exists()) {
          attSnap.forEach(snap => {
            subTotal++;
            const records = snap.val().records || {};
            students.forEach(s => {
              if (records[s.id] === 'P') subStats[s.id].p++;
              if (records[s.id] === 'A' || records[s.id] === 'P' || records[s.id] === 'L') subStats[s.id].total++;
            });
          });
        }
        students.forEach(s => {
          const attended = subStats[s.id].p; const total = subStats[s.id].total;
          stats[s.id][`${sub.name} Attendance`] = total === 0 ? "N/A" : `${Math.round((attended / total) * 100)}%`;
        });
      }

      const excelData = Object.values(stats);
      const ws = XLSX.utils.json_to_sheet(excelData); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Class Master");
      saveExcelFile(wb, `${cls.name}_Master.xlsx`);
    } catch (error) { console.error(error); alert("Error generating master report."); } 
    finally { setIsGenerating(false); }
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if(!noticeTitle.trim()) return alert("Please enter a title for the notice.");
    setIsSendingNotice(true);
    
    try {
      let allStudentIds = [];
      
      for (let semId of noticeTarget.targetSemesters) {
        const semSnap = await get(ref(db, `semesters/${semId}`));
        if (semSnap.exists()) {
          const sIds = semSnap.val().studentIds || [];
          const idsArray = Array.isArray(sIds) ? sIds : Object.values(sIds);
          allStudentIds = [...allStudentIds, ...idsArray];
        }
      }
      
      allStudentIds = [...new Set(allStudentIds)];

      if(allStudentIds.length === 0) {
         setIsSendingNotice(false);
         return alert("No students found to receive this broadcast.");
      }

      const noticeRefKey = push(ref(db, "circulars")).key;
      await set(ref(db, `circulars/${noticeRefKey}`), {
        subjectId: noticeTarget.id,
        subjectName: noticeTarget.name,
        teacherId: auth.currentUser.uid,
        teacherName: `Prof. ${teacherName}`,
        title: noticeTitle.trim(),
        message: noticeMessage.trim() || null, 
        link: noticeLink.trim() || null,
        targetAudience: allStudentIds, 
        createdAt: new Date().toISOString(),
        isStaffNotice: false
      });

      const notificationUpdates = {};
      allStudentIds.forEach(studentUid => {
        const notifRefKey = push(ref(db, "notifications")).key;
        
        let bellMessage = `Prof. ${teacherName} posted an update for ${noticeTarget.name}.`;
        if (noticeMessage.trim()) {
           bellMessage += `\n\n"${noticeMessage.trim()}"`;
        }

        notificationUpdates[`notifications/${notifRefKey}`] = {
          recipientId: studentUid,
          title: `Class Alert: ${noticeTitle.trim()}`,
          message: bellMessage,
          read: false,
          createdAt: new Date().toISOString(),
          type: "notice",
          link: noticeLink.trim() || null,
          subjectId: noticeTarget.id,
          circularId: noticeRefKey
        };
      });

      await update(ref(db), notificationUpdates);
      
      alert(`Notice sent successfully to ${allStudentIds.length} students!`);
      setNoticeTarget(null);
      setNoticeTitle("");
      setNoticeLink("");
      setNoticeMessage("");
    } catch (error) {
      console.error(error);
      alert("Failed to send notice.");
    } finally {
      setIsSendingNotice(false);
    }
  };


  const openNoticeManager = async () => {
    setIsManagingNotices(true);
    setIsLoadingNotices(true);
    try {
      const q = query(ref(db, "circulars"), orderByChild("teacherId"), equalTo(auth.currentUser.uid));
      const snap = await get(q);
      const list = [];
      const circularIds = [];
      
      if (snap.exists()) {
        snap.forEach((childSnap) => {
          list.push({ id: childSnap.key, ...childSnap.val() });
          circularIds.push(childSnap.key);
        });
      }
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMySentNotices(list);

      const allNotifSnap = await get(ref(db, "notifications"));
      const readCounts = {};
      circularIds.forEach(id => readCounts[id] = 0);

      if (allNotifSnap.exists()) {
         allNotifSnap.forEach((notifSnap) => {
            const notif = notifSnap.val();
            if (notif.circularId && circularIds.includes(notif.circularId)) {
               if (notif.read === true) {
                  readCounts[notif.circularId] += 1;
               }
            }
         });
      }
      setNoticeReadStats(readCounts);

    } catch (err) {
      console.error(err);
      alert("Error loading notices.");
    } finally {
      setIsLoadingNotices(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if(!window.confirm("Are you sure you want to permanently delete this notice? Recipients will no longer see it.")) return;
    try {
      await remove(ref(db, `circulars/${noticeId}`));
      setMySentNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (err) {
      alert("Failed to delete notice.");
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      signOut(auth).then(() => navigate("/login"));
    }
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900"><h2 className="text-3xl font-bold text-[#0b3b60] animate-pulse">Loading Portal...</h2></div>;

  const displayedSubjects = subjects.filter(sub => 
    viewMode === "active" ? !sub.isArchived : sub.isArchived
  );

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-gray-900 transition-colors duration-300 pb-20 relative">
      
      {/* APP-STYLE HEADER - Reduced z-index so modals cover it */}
      <div className="bg-[#0b3b60] text-white p-4 md:p-8 flex flex-col justify-end shadow-md sticky top-0 z-30 rounded-b-[2.5rem] min-h-[140px] overflow-visible">
        
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hi, Prof. {(teacherName || "").split(' ')[0]}</h1>
            <p className="text-blue-200 mt-1 opacity-90 tracking-wide text-xs font-medium uppercase">Code: {myCollegeCode}</p>
          </div>
          {activeTab !== "dashboard" && (
             <button onClick={() => setActiveTab("dashboard")} className="text-sm font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
               Back
             </button>
          )}
        </div>
      </div>

      {/* WRAPPING CONTAINER FOR MAIN DASHBOARD - We strictly close this before rendering Modals */}
      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-10 relative z-10">

        {/* --- MAIN APP DASHBOARD GRID --- */}
        <AnimatePresence mode="wait">
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
             <button onClick={() => setActiveTab("classes")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-yellow-500 transition-all active:scale-95 group">
                <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">🏫</div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base text-center">My Incharge<br/>Classes</h3>
             </button>
             <button onClick={() => setActiveTab("subjects")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-purple-500 transition-all active:scale-95 group">
                <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">📚</div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base text-center">My Active<br/>Subjects</h3>
             </button>

             <button onClick={openNoticeManager} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-cyan-500 transition-all active:scale-95 group col-span-2 md:col-span-1">
                <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">⚙️</div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base text-center">Manage<br/>Notices</h3>
             </button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* INCHARGE CLASSES VIEW */}
        {activeTab === "classes" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {inchargeClasses.length === 0 ? (
               <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm text-center border border-gray-100 dark:border-gray-700">
                 <p className="text-gray-500 font-medium">You are not the incharge of any classes.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {inchargeClasses.map(cls => (
                  <div key={cls.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🧑‍🏫</div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">{cls.name}</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{cls.department || "Incharge"}</p>
                    </div>
                    <div className="w-full flex gap-2 mt-2">
                       <button onClick={() => openScheduleModal(cls)} className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 rounded-xl text-xs font-bold border border-orange-100 dark:border-orange-800 transition-colors">📅 Timetable</button>
                       <button onClick={() => handleDownloadClassMaster(cls)} disabled={isGenerating} className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-800 transition-colors">📁 Master Excel</button>
                       
                       {/* NEW: CLASS-WIDE BROADCAST BUTTON */}
                       <button onClick={() => setNoticeTarget({ id: cls.id, name: cls.name, type: "class", targetSemesters: Array.isArray(cls.semesterIds) ? cls.semesterIds : Object.values(cls.semesterIds || {}) })} className="flex-1 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-xl text-xs font-bold border border-yellow-100 dark:border-yellow-800 transition-colors">📢 Alert</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* SUBJECTS VIEW */}
        {activeTab === "subjects" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex justify-end mb-4 px-2">
              <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-full shadow-inner">
                <button onClick={() => setViewMode("active")} className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${viewMode === "active" ? "bg-white dark:bg-gray-600 text-[#0b3b60] shadow" : "text-gray-500"}`}>Active</button>
                <button onClick={() => setViewMode("archived")} className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${viewMode === "archived" ? "bg-white dark:bg-gray-600 text-red-600 shadow" : "text-gray-500"}`}>Archive</button>
              </div>
            </div>

            {displayedSubjects.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm text-center border border-gray-100 dark:border-gray-700">
                <span className="text-5xl opacity-30 mb-4 block">📚</span>
                <p className="text-gray-500 font-medium">No subjects found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedSubjects.map(sub => (
                  <div key={sub.id} className={`bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border ${viewMode === "archived" ? "border-gray-300 opacity-80" : "border-blue-100 dark:border-gray-700"} flex flex-col relative overflow-hidden`}>
                    
                    <div className="flex items-start gap-4 mb-5">
                      <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${viewMode === "archived" ? "bg-gray-100 grayscale" : "bg-blue-50 dark:bg-blue-900/30"}`}>
                        {viewMode === "active" ? "📘" : "🗄️"}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate leading-tight">{sub.name}</h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-0.5 truncate">{sub.semesterName}</p>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 gap-3 mt-auto ${sub.isArchived ? 'opacity-50 pointer-events-none' : ''}`}>
                      <button onClick={() => navigate(`/teacher/attendance/${sub.id}`)} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-2xl font-bold text-xs transition-colors border border-green-100 dark:border-green-800">
                        <span className="text-xl">✅</span> Attendance
                      </button>
                      <button onClick={() => navigate(`/teacher/assignments/${sub.id}`)} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded-2xl font-bold text-xs transition-colors border border-purple-100 dark:border-purple-800">
                        <span className="text-xl">📝</span> Tasks
                      </button>
                      <button onClick={() => handleDownloadSubjectReport(sub)} disabled={isGenerating} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-2xl font-bold text-xs transition-colors border border-blue-100 dark:border-blue-800">
                        <span className="text-xl">📊</span> Report
                      </button>
                      
                      <button onClick={() => setNoticeTarget({ id: sub.id, name: sub.name, type: "subject", targetSemesters: [sub.semesterId] })} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-2xl font-bold text-xs transition-colors border border-yellow-100 dark:border-yellow-800">
                        <span className="text-xl">📢</span> Send Notice
                      </button>
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
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
      {/* --- THIS ENDS THE RELATIVE CONTENT WRAPPER --- */}

      {/* --- ALL POPUP MODALS ARE MOVED DOWN HERE SO THEY OVERLAP EVERYTHING --- */}
      
      {/* TIMETABLE MODAL (READ-ONLY VIEW) */}
      {manageClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              
              <div className="flex items-center gap-3">
                <button onClick={() => setManageClass(null)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Schedule: {manageClass.name}</h2>
              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center gap-4">
               {semesters.filter(sem => {
                  const classObj = inchargeClasses.find(c => c.id === manageClass.id);
                  const semIds = classObj?.semesterIds || [];
                  const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                  return semIdsArray.includes(sem.id);
                }).length > 0 ? (
                  <select 
                    value={timetableSemester || ""} 
                    onChange={(e) => setTimetableSemester(e.target.value)} 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 font-bold text-[#0b3b60] dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {semesters.filter(sem => {
                      const classObj = inchargeClasses.find(c => c.id === manageClass.id);
                      const semIds = classObj?.semesterIds || [];
                      const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                      return semIdsArray.includes(sem.id);
                    }).map(sem => (
                      <option key={sem.id} value={sem.id}>{sem.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 italic">No semesters linked to this class.</p>
                )}
                
                <button onClick={handleDownloadTimetable} className="w-full sm:w-auto text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-4 py-2 rounded-lg transition shadow-sm border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                   ⬇ Download
                </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {daysOfWeek.map(day => (
                  <button key={day} onClick={() => setSelectedDay(day)} className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-colors shadow-sm ${selectedDay === day ? 'bg-[#0b3b60] text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {day}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {!timetable[selectedDay] || timetable[selectedDay].length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">No classes scheduled.</p>
                ) : (
                  timetable[selectedDay].sort((a, b) => a.lecNumber.localeCompare(b.lecNumber)).map((lec, idx) => (
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
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED SEND NOTICE MODAL (FOR BOTH CLASS AND SUBJECT) */}
      {noticeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              
              <div className="flex items-center gap-3">
                <button onClick={() => setNoticeTarget(null)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Broadcast to {noticeTarget.type === 'class' ? 'Class' : 'Subject'}</h2>
              </div>
            </div>
            
            <form onSubmit={handleSendNotice} className="p-5 space-y-4">
              <p className="text-xs text-gray-500 mb-2 font-medium leading-relaxed">
                This will send an instant push notification to all students enrolled in <strong>{noticeTarget.name}</strong>.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Notice Title / Subject <span className="text-red-500">*</span></label>
                <input required type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="e.g., Mid-Term Syllabus, Surprise Test Link..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Text Message (Optional)</label>
                <textarea value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} placeholder="Write details here..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none resize-none h-24 custom-scrollbar" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Attached Link (Optional)</label>
                <input type="url" value={noticeLink} onChange={e => setNoticeLink(e.target.value)} placeholder="https://docs.google.com/forms/..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none" />
              </div>
              <button type="submit" disabled={isSendingNotice} className="w-full mt-4 bg-[#0b3b60] hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 disabled:opacity-50">
                {isSendingNotice ? "Sending..." : "🚀 Broadcast to Students"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE PAST NOTICES MODAL */}
      {isManagingNotices && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              
              <div className="flex items-center gap-3">
                <button onClick={() => setIsManagingNotices(false)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Manage Sent Notices</h2>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-gray-100 dark:bg-gray-900/50">
              {isLoadingNotices ? (
                <p className="text-center text-gray-500 animate-pulse">Loading past notices & read receipts...</p>
              ) : mySentNotices.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <span className="text-4xl block mb-2 opacity-30">📭</span>
                  <p>You haven't sent any notices yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mySentNotices.map(notice => (
                    <div key={notice.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-3 relative">
                      <div className="flex justify-between items-start pr-8">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg">{notice.title}</h4>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{new Date(notice.createdAt).toLocaleString()}</span>
                          
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${notice.isStaffNotice ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                             {notice.isStaffNotice ? "To: Teachers" : "To: Students"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                          <span className="text-lg">👁️</span>
                          <span className="font-black text-[#0b3b60] dark:text-blue-400 text-sm">
                             {noticeReadStats[notice.id] || 0}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Reads</span>
                        </div>
                      </div>

                      {notice.message && <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700 whitespace-pre-wrap leading-relaxed">{notice.message}</p>}
                      
                      <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {notice.link ? (
                           <a href={notice.link} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-[#0b3b60] dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
                             🔗 View Attached Link
                           </a>
                        ) : <div></div>}
                        
                        <button 
                          onClick={() => handleDeleteNotice(notice.id)}
                          className="text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
                        >
                          <span>🗑️</span> Delete Permanently
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APP-STYLE STICKY BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] md:hidden">
        <div className="flex justify-around items-center h-16 px-4">
          <button onClick={() => setActiveTab("dashboard")} className="flex flex-col items-center justify-center w-full h-full text-[#0b3b60] dark:text-blue-400">
            <span className="text-2xl mb-1">🏠</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
          </button>
          
          <div className="flex flex-col items-center justify-center w-full h-full relative -top-3">
             <div className="bg-[#0b3b60] w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-gray-100 dark:border-gray-900 text-white">
                <span className="text-2xl">🎓</span>
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