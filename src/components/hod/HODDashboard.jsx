import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { ref, get, push, set, query, orderByChild, equalTo, update, child, remove } from "firebase/database";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import ThemeToggle from "../ThemeToggle";
import * as XLSX from "xlsx";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from "framer-motion";

export default function HODDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard"); 

  const [myCollegeCode, setMyCollegeCode] = useState("");
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  // Form States
  const [semName, setSemName] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [className, setClassName] = useState("");
  const [selectedSemesters, setSelectedSemesters] = useState([]);
  const [selectedIncharge, setSelectedIncharge] = useState("");
  const [subName, setSubName] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedSemesterForSub, setSelectedSemesterForSub] = useState("");
  const [deptName, setDeptName] = useState("");
  const [myDepartment, setMyDepartment] = useState("");
  const [selectedClassesForDept, setSelectedClassesForDept] = useState([]);
  
  // Notice States
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeLink, setNoticeLink] = useState("");
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [teacherNoticeTitle, setTeacherNoticeTitle] = useState("");
  const [teacherNoticeMessage, setTeacherNoticeMessage] = useState("");
  const [teacherNoticeLink, setTeacherNoticeLink] = useState("");
  const [isSendingTeacherNotice, setIsSendingTeacherNotice] = useState(false);
  const [isManagingNotices, setIsManagingNotices] = useState(false);
  const [mySentNotices, setMySentNotices] = useState([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [noticeReadStats, setNoticeReadStats] = useState({});

  // Flush & Timetable States
  const [reportSelectedClass, setReportSelectedClass] = useState(null);
  const [reportSelectedSemester, setReportSelectedSemester] = useState(null);
  const [flushSelectedClass, setFlushSelectedClass] = useState(null);
  const [flushSelectedSemester, setFlushSelectedSemester] = useState(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [importSemesterId, setImportSemesterId] = useState("");
  const [timetableClass, setTimetableClass] = useState(null);
  const [timetableSemester, setTimetableSemester] = useState(null); 
  const [timetable, setTimetable] = useState({});
  const [newLecture, setNewLecture] = useState({ lecNumber: "", startTime: "", endTime: "", subject: "", teacherId: "" });
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  
  // CUSTOM DYNAMIC DAYS
  const [customDayInput, setCustomDayInput] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  // Search States
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [formStudentSearch, setFormStudentSearch] = useState("");
  const [inchargeSearchTerm, setInchargeSearchTerm] = useState("");
  const [subjectTeacherSearchTerm, setSubjectTeacherSearchTerm] = useState("");
  const [timetableFacultySearch, setTimetableFacultySearch] = useState("");
  const [directoryViewMode, setDirectoryViewMode] = useState("active");

  const [loading, setLoading] = useState(true);
  const [hodName, setHodName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await get(child(ref(db), `users/${user.uid}`));
        if (uSnap.exists()) {
          const data = uSnap.val();
          setHodName(data.name || "HOD");
          setMyDepartment(data.department || "General");
          const code = data.collegeCode;
          if (code) {
            setMyCollegeCode(code);
            fetchAllIsolatedData(code);
          } else alert("No College Code found on your profile.");
        }
      } else navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllIsolatedData = async (code) => {
    const usersQ = query(ref(db, "users"), orderByChild("collegeCode"), equalTo(code));
    const uSnap = await get(usersQ);
    const sList = [], tList = [];
    if (uSnap.exists()) {
      uSnap.forEach(snap => {
        const data = snap.val();
        if (data.role === "student" || data.originalRole === "student") sList.push({ id: snap.key, ...data });
        if (data.role === "teacher" || data.originalRole === "teacher") tList.push({ id: snap.key, ...data });
      });
    }
    setStudents(sList); setTeachers(tList);

    const semQ = query(ref(db, "semesters"), orderByChild("collegeCode"), equalTo(code));
    const semSnap = await get(semQ);
    const semList = [];
    if (semSnap.exists()) semSnap.forEach(doc => semList.push({ id: doc.key, ...doc.val() }));
    setSemesters(semList);

    const classQ = query(ref(db, "classes"), orderByChild("collegeCode"), equalTo(code));
    const classSnap = await get(classQ);
    const classList = [];
    if (classSnap.exists()) classSnap.forEach(doc => classList.push({ id: doc.key, ...doc.val() }));
    setClasses(classList);

    const subQ = query(ref(db, "subjects"), orderByChild("collegeCode"), equalTo(code));
    const subSnap = await get(subQ);
    const subList = [];
    const seenSubjects = new Set();
    if (subSnap.exists()) {
      subSnap.forEach(doc => {
        const subData = doc.val();
        const uniqueKey = subData.name.toLowerCase().trim() + "_" + subData.semesterId;
        if (!seenSubjects.has(uniqueKey)) {
          seenSubjects.add(uniqueKey);
          subList.push({ id: doc.key, ...subData });
        }
      });
    }
    setSubjectsList(subList);
    setLoading(false);
  };

  const getStudentCount = (studentIds) => {
    if (!studentIds) return 0;
    if (Array.isArray(studentIds)) return studentIds.length;
    return Object.keys(studentIds).length;
  };

  const handleImportStudents = (semId) => {
    setImportSemesterId(semId);
    if (!semId) return setSelectedStudents([]);
    const sem = semesters.find(s => s.id === semId);
    if (sem && sem.studentIds) {
      setSelectedStudents(Array.isArray(sem.studentIds) ? sem.studentIds : Object.keys(sem.studentIds));
    } else setSelectedStudents([]);
  };

  // FIXED: Auto-Update & Merge Existing Semesters
  const handleCreateSemester = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) return alert("Select at least one student.");
    
    const existingSem = semesters.find(s => s.name.toLowerCase().trim() === semName.toLowerCase().trim());
    
    if (existingSem) {
       let existingSet = new Set();
       if (existingSem.studentIds) {
          if (Array.isArray(existingSem.studentIds)) {
             existingSem.studentIds.forEach(id => existingSet.add(id));
          } else {
             Object.entries(existingSem.studentIds).forEach(([k, v]) => {
                if (typeof v === "string") existingSet.add(v);
                else if (v === true) existingSet.add(k);
             });
          }
       }
       selectedStudents.forEach(id => existingSet.add(id));
       const mergedIds = Array.from(existingSet);
       
       await update(ref(db, `semesters/${existingSem.id}`), { studentIds: mergedIds });
       alert(`Updated '${existingSem.name}'! Total students in this semester is now ${mergedIds.length}.`);
    } else {
       await set(push(ref(db, "semesters")), { name: semName.trim(), studentIds: selectedStudents, collegeCode: myCollegeCode });
       alert("Semester Created successfully!");
    }
    
    setSemName(""); setSelectedStudents([]); setImportSemesterId(""); setFormStudentSearch("");
    fetchAllIsolatedData(myCollegeCode); 
  };

  // FIXED: Auto-Update & Merge Existing Classes
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (selectedSemesters.length === 0) return alert("Select at least one semester.");
    if (!selectedIncharge) return alert("Select an incharge teacher.");
    
    const existingClass = classes.find(c => c.name.toLowerCase().trim() === className.toLowerCase().trim());
    
    if (existingClass) {
       let existingSemSet = new Set();
       if (existingClass.semesterIds) {
           if (Array.isArray(existingClass.semesterIds)) existingClass.semesterIds.forEach(id => existingSemSet.add(id));
           else Object.values(existingClass.semesterIds).forEach(id => existingSemSet.add(id));
       }
       selectedSemesters.forEach(id => existingSemSet.add(id));
       
       await update(ref(db, `classes/${existingClass.id}`), {
          semesterIds: Array.from(existingSemSet),
          inchargeId: selectedIncharge 
       });
       alert(`Updated Class '${existingClass.name}' with new semesters and/or incharge!`);
    } else {
       await set(push(ref(db, "classes")), { name: className.trim(), semesterIds: selectedSemesters, inchargeId: selectedIncharge, collegeCode: myCollegeCode });
       alert("Class Created successfully!");
    }
    setClassName(""); setSelectedSemesters([]); setSelectedIncharge(""); setInchargeSearchTerm("");
    fetchAllIsolatedData(myCollegeCode); 
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!selectedTeacher || !selectedSemesterForSub) return alert("Select a teacher and semester.");
    await set(push(ref(db, "subjects")), { name: subName, teacherId: selectedTeacher, semesterId: selectedSemesterForSub, collegeCode: myCollegeCode });
    setSubName(""); setSelectedTeacher(""); setSelectedSemesterForSub(""); setSubjectTeacherSearchTerm("");
    fetchAllIsolatedData(myCollegeCode); alert("Subject Assigned!");
  };

  const handleAssignDepartment = async (e) => {
    e.preventDefault();
    if (selectedClassesForDept.length === 0) return alert("Select at least one Class.");
    if (!deptName.trim()) return alert("Enter a department name.");
    try {
      const updates = {};
      selectedClassesForDept.forEach(classId => {
        updates[`classes/${classId}/department`] = deptName;
        const cls = classes.find(c => c.id === classId);
        if (cls && cls.semesterIds) {
          const semIds = Array.isArray(cls.semesterIds) ? cls.semesterIds : Object.keys(cls.semesterIds);
          semIds.forEach(semId => {
            const sem = semesters.find(s => s.id === semId);
            if (sem && sem.studentIds) {
              const sIds = Array.isArray(sem.studentIds) ? sem.studentIds : Object.keys(sem.studentIds);
              sIds.forEach(studentId => { updates[`users/${studentId}/department`] = deptName; });
            }
          });
        }
      });
      teachers.forEach(t => { if (selectedIncharge === t.id) updates[`users/${t.id}/department`] = deptName; });
      await update(ref(db), updates);
      setDeptName(""); setSelectedClassesForDept([]);
      fetchAllIsolatedData(myCollegeCode); alert("Departments Assigned Successfully!");
    } catch (error) { alert("Failed to assign department."); }
  };

  const loadSemesterTimetable = (semId) => {
    setTimetableSemester(semId);
    const tt = timetableClass.timetables?.[semId] || {};
    setTimetable(tt);
    const existingDays = Object.keys(tt);
    setSelectedDay(existingDays.length > 0 ? existingDays[0] : "");
  };

  const handleAddCustomDay = () => {
    if (!customDayInput.trim()) return alert("Enter a day name.");
    const dayFormat = customDayInput.trim();
    if (!timetable[dayFormat]) {
       setTimetable(prev => ({ ...prev, [dayFormat]: [] }));
    }
    setSelectedDay(dayFormat);
    setCustomDayInput("");
  };

  const handleAddLecture = async () => {
    if (!selectedDay) return alert("Please create or select a Day first.");
    if (!newLecture.lecNumber || !newLecture.subject || !newLecture.startTime || !newLecture.endTime || !newLecture.teacherId) {
       return alert("Enter all details including Lecture Period and Teacher.");
    }

    const teacherData = teachers.find(t => t.id === newLecture.teacherId);
    const lectureWithTeacher = { ...newLecture, teacherName: teacherData ? teacherData.name : "Unknown" };
    
    const currentDayLectures = timetable[selectedDay] || [];
    const updatedDay = [...currentDayLectures, lectureWithTeacher];
    const updatedTimetable = { ...timetable, [selectedDay]: updatedDay };
    
    try {
      await update(ref(db, `classes/${timetableClass.id}/timetables/${timetableSemester}`), updatedTimetable);
      setTimetable(updatedTimetable); 
      setTimetableClass(prev => ({ ...prev, timetables: { ...(prev.timetables || {}), [timetableSemester]: updatedTimetable } }));
      setNewLecture({ ...newLecture, lecNumber: "", startTime: "", endTime: "", subject: "", teacherId: "" });
      setTimetableFacultySearch(""); 
    } catch(err) { alert("Failed to save lecture."); }
  };

  const handleRemoveLecture = async (day, index) => {
    const updatedDay = timetable[day].filter((_, i) => i !== index);
    const updatedTimetable = { ...timetable, [day]: updatedDay };
    try {
      await update(ref(db, `classes/${timetableClass.id}/timetables/${timetableSemester}`), updatedTimetable);
      setTimetable(updatedTimetable);
      setTimetableClass(prev => ({ ...prev, timetables: { ...(prev.timetables || {}), [timetableSemester]: updatedTimetable } }));
    } catch(err) { alert("Failed to remove lecture."); }
  };

  const saveExcelFile = async (workbook, fileName) => {
    try {
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Documents });
        alert(`Saved successfully to your Documents folder: ${fileName}`);
      } else XLSX.writeFile(workbook, fileName);
    } catch (e) { alert("Failed to save file."); }
  };

  const handleDownloadTimetable = () => {
    const data = [];
    Object.keys(timetable).forEach(day => {
      if (timetable[day] && timetable[day].length > 0) {
        let rowObj = { "Day": day };
        const sortedLectures = [...timetable[day]].sort((a,b) => a.lecNumber.localeCompare(b.lecNumber));
        sortedLectures.forEach((lec) => {
          rowObj[`${lec.lecNumber} Lecture`] = `${lec.subject}\n(${lec.startTime} - ${lec.endTime})\nProf: ${lec.teacherName}`;
        });
        data.push(rowObj);
      }
    });

    if (data.length === 0) return alert("Timetable is empty.");
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable"); 
    const semesterName = semesters.find(s => s.id === timetableSemester)?.name || "Semester";
    saveExcelFile(wb, `${timetableClass.name}_${semesterName}_Timetable.xlsx`);
  };

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayReason) return alert("Enter date and reason.");
    try {
      const existingHolidays = timetableClass.holidays || {};
      existingHolidays[holidayDate] = holidayReason;
      await update(ref(db, `classes/${timetableClass.id}`), { holidays: existingHolidays });
      setTimetableClass({...timetableClass, holidays: existingHolidays}); setHolidayDate(""); setHolidayReason("");
      alert("Holiday declared successfully!");
    } catch (err) { alert("Failed to add holiday."); }
  };

  const handleRemoveHoliday = async (date) => {
    try {
      const existingHolidays = {...timetableClass.holidays};
      delete existingHolidays[date];
      await update(ref(db, `classes/${timetableClass.id}`), { holidays: existingHolidays });
      setTimetableClass({...timetableClass, holidays: existingHolidays});
    } catch (err) { alert("Failed to remove."); }
  };

  const calculateLectures = (startDate, endDate) => {
    let start = new Date(startDate); const end = new Date(endDate); let count = 0;
    const hDays = Object.keys(timetableClass?.holidays || {});
    while (start <= end) {
      const day = start.getDay(); const dateStr = start.toISOString().split('T')[0];
      if (day !== 0 && !hDays.includes(dateStr)) count++; 
      start.setDate(start.getDate() + 1);
    }
    alert(`Expected working lecture days: ${count}`);
  };

  const handleFlushSemester = async () => {
    if (!flushSelectedSemester) return;
    if (!window.confirm("WARNING: This will instantly archive and delete all active data. Proceed?")) return;
    setIsFlushing(true);
    try {
      const subQ = query(ref(db, "subjects"), orderByChild("semesterId"), equalTo(flushSelectedSemester));
      const subSnap = await get(subQ);
      const subjectsData = subSnap.val() || {};
      const subjectIds = Object.keys(subjectsData);
      if (subjectIds.length === 0) { setIsFlushing(false); return alert("This semester is empty."); }

      const attendanceData = {}; const assignmentsData = {}; const submissionsData = {};
      for (const subId of subjectIds) {
        const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subId));
        const attSnap = await get(attQ);
        if (attSnap.exists()) Object.assign(attendanceData, attSnap.val());
        const assignQ = query(ref(db, "assignments"), orderByChild("subjectId"), equalTo(subId));
        const assignSnap = await get(assignQ);
        if (assignSnap.exists()) {
          const assigns = assignSnap.val(); Object.assign(assignmentsData, assigns);
          for (const assignId of Object.keys(assigns)) {
             const subMQ = query(ref(db, "submissions"), orderByChild("assignmentId"), equalTo(assignId));
             const subMSnap = await get(subMQ);
             if (subMSnap.exists()) Object.assign(submissionsData, subMSnap.val());
          }
        }
      }
      await set(push(ref(db, "archives")), { semesterId: flushSelectedSemester, classId: flushSelectedClass, collegeCode: myCollegeCode, archivedAt: new Date().toISOString(), data: { subjects: subjectsData, attendance: attendanceData, assignments: assignmentsData, submissions: submissionsData } });
      const updates = {};
      subjectIds.forEach(id => updates[`subjects/${id}`] = null);
      Object.keys(attendanceData).forEach(id => updates[`attendance/${id}`] = null);
      Object.keys(assignmentsData).forEach(id => updates[`assignments/${id}`] = null);
      Object.keys(submissionsData).forEach(id => updates[`submissions/${id}`] = null);
      await update(ref(db), updates);
      setFlushSelectedClass(null); setFlushSelectedSemester(null); fetchAllIsolatedData(myCollegeCode);
      alert("Semester successfully flushed and archived.");
    } catch (error) { alert("Error flushing semester."); }
    finally { setIsFlushing(false); }
  };

  const handleRemoveUser = async (userId, name, role, isRestoring = false) => {
    const actionStr = isRestoring ? "RESTORE" : "REMOVE";
    if (!window.confirm(`${actionStr} ${role.toUpperCase()}: ${name}?`)) return;
    try {
      const updates = {};
      if (isRestoring) updates[`users/${userId}/role`] = updates[`users/${userId}/originalRole`] || "student"; 
      else { updates[`users/${userId}/originalRole`] = role; updates[`users/${userId}/role`] = "disabled"; }
      await update(ref(db), updates); fetchAllIsolatedData(myCollegeCode); 
      alert(`User successfully ${isRestoring ? "restored" : "removed"}.`);
    } catch (error) { alert("Failed to update user status."); }
  };

  const handleDeleteArchivedSubject = async (subjectId, subjectName) => {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to permanently delete "${subjectName}"?\n\nThis will instantly destroy the subject and ALL associated attendance, assignments, and submissions from the database forever.`)) return;
    try {
      const updates = {};
      updates[`subjects/${subjectId}`] = null;
      const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subjectId));
      const attSnap = await get(attQ);
      if (attSnap.exists()) {
        Object.keys(attSnap.val()).forEach(id => updates[`attendance/${id}`] = null);
      }
      const assignQ = query(ref(db, "assignments"), orderByChild("subjectId"), equalTo(subjectId));
      const assignSnap = await get(assignQ);
      if (assignSnap.exists()) {
        const assigns = assignSnap.val();
        for (const assignId of Object.keys(assigns)) {
           updates[`assignments/${assignId}`] = null;
           const subQ = query(ref(db, "submissions"), orderByChild("assignmentId"), equalTo(assignId));
           const subSnap = await get(subQ);
           if (subSnap.exists()) {
              Object.keys(subSnap.val()).forEach(subId => updates[`submissions/${subId}`] = null);
           }
        }
      }
      await update(ref(db), updates);
      setSubjectsList(prev => prev.filter(sub => sub.id !== subjectId));
      alert(`"${subjectName}" has been completely erased from the database.`);
    } catch (error) {
      console.error(error); alert("Failed to permanently delete the subject.");
    }
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if(!noticeTitle.trim()) return alert("Please enter a title for the notice.");
    setIsSendingNotice(true);
    try {
      let studentIds = students.filter(s => s.role !== "disabled").map(s => s.id);
      if(studentIds.length === 0) {
        setIsSendingNotice(false);
        return alert("No students found to send a notice to.");
      }
      const noticeRefKey = push(ref(db, "circulars")).key;
      await set(ref(db, `circulars/${noticeRefKey}`), {
        subjectId: "HOD_NOTICE", subjectName: "Department General", teacherId: auth.currentUser.uid,
        teacherName: `HOD ${hodName}`, title: noticeTitle.trim(), message: noticeMessage.trim() || null, 
        link: noticeLink.trim() || null, targetAudience: studentIds, createdAt: new Date().toISOString(),
        isHodNotice: true
      });
      const notificationUpdates = {};
      studentIds.forEach(studentUid => {
        const notifRefKey = push(ref(db, "notifications")).key;
        notificationUpdates[`notifications/${notifRefKey}`] = {
          recipientId: studentUid, title: `HOD Alert: ${noticeTitle.trim()}`, message: `The HOD posted a new link/notice.`,
          read: false, createdAt: new Date().toISOString(), type: "notice", link: noticeLink.trim() || null, circularId: noticeRefKey 
        };
      });
      await update(ref(db), notificationUpdates);
      alert(`Notice sent successfully to ${studentIds.length} students!`);
      setActiveTab("dashboard"); setNoticeTitle(""); setNoticeLink(""); setNoticeMessage("");
    } catch (error) { alert("Failed to send notice."); } 
    finally { setIsSendingNotice(false); }
  };

  const handleSendTeacherNotice = async (e) => {
    e.preventDefault();
    if(!teacherNoticeTitle.trim()) return alert("Please enter a title for the staff notice.");
    setIsSendingTeacherNotice(true);
    try {
      const targetTeachers = teachers.filter(t => t.role !== "disabled" && (myDepartment === "General" || t.department === myDepartment));
      const targetTeacherIds = targetTeachers.map(t => t.id);
      if(targetTeacherIds.length === 0) {
        setIsSendingTeacherNotice(false);
        return alert("No teachers found in your department to send a notice to.");
      }
      const noticeRefKey = push(ref(db, "circulars")).key;
      await set(ref(db, `circulars/${noticeRefKey}`), {
        subjectId: "STAFF_NOTICE", subjectName: `${myDepartment} Staff`, teacherId: auth.currentUser.uid,
        teacherName: `HOD ${hodName}`, title: teacherNoticeTitle.trim(), message: teacherNoticeMessage.trim() || null, 
        link: teacherNoticeLink.trim() || null, targetAudience: targetTeacherIds, createdAt: new Date().toISOString(),
        isHodNotice: true, isStaffNotice: true
      });
      const notificationUpdates = {};
      targetTeacherIds.forEach(teacherUid => {
        const notifRefKey = push(ref(db, "notifications")).key;
        notificationUpdates[`notifications/${notifRefKey}`] = {
          recipientId: teacherUid, title: `HOD Staff Alert: ${teacherNoticeTitle.trim()}`, message: `The HOD posted a new staff notice/link.`,
          read: false, createdAt: new Date().toISOString(), type: "notice", link: teacherNoticeLink.trim() || null, circularId: noticeRefKey 
        };
      });
      await update(ref(db), notificationUpdates);
      alert(`Staff Notice sent successfully to ${targetTeacherIds.length} teachers!`);
      setActiveTab("dashboard"); setTeacherNoticeTitle(""); setTeacherNoticeLink(""); setTeacherNoticeMessage("");
    } catch (error) { alert("Failed to send staff notice."); } 
    finally { setIsSendingTeacherNotice(false); }
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
               if (notif.read === true) readCounts[notif.circularId] += 1;
            }
         });
      }
      setNoticeReadStats(readCounts);
    } catch (err) { alert("Error loading notices."); } 
    finally { setIsLoadingNotices(false); }
  };

  const handleDeleteNotice = async (noticeId) => {
    if(!window.confirm("Are you sure you want to permanently delete this notice?")) return;
    try {
      await remove(ref(db, `circulars/${noticeId}`));
      setMySentNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (err) { alert("Failed to delete notice."); }
  };

  const toggleSelection = (id, list, setList) => { list.includes(id) ? setList(list.filter(item => item !== id)) : setList([...list, id]); };
  const renderDepartment = (dept) => dept && dept.trim() !== "" ? `(${dept})` : "";
  const handleLogout = () => { signOut(auth).then(() => navigate("/login")); };

  const formFilteredStudents = students.filter(s => s.role !== "disabled" && (s.name?.toLowerCase().includes(formStudentSearch.toLowerCase()) || s.email?.toLowerCase().includes(formStudentSearch.toLowerCase()) || s.rollNumber?.toLowerCase().includes(formStudentSearch.toLowerCase())));
  const formFilteredIncharges = teachers.filter(t => t.role !== "disabled" && (t.name?.toLowerCase().includes(inchargeSearchTerm.toLowerCase()) || t.email?.toLowerCase().includes(inchargeSearchTerm.toLowerCase()) || t.department?.toLowerCase().includes(inchargeSearchTerm.toLowerCase())));
  const formFilteredSubjectTeachers = teachers.filter(t => t.role !== "disabled" && (t.name?.toLowerCase().includes(subjectTeacherSearchTerm.toLowerCase()) || t.email?.toLowerCase().includes(subjectTeacherSearchTerm.toLowerCase()) || t.department?.toLowerCase().includes(subjectTeacherSearchTerm.toLowerCase())));
  const timetableFilteredTeachers = teachers.filter(t => t.role !== "disabled" && (t.name?.toLowerCase().includes(timetableFacultySearch.toLowerCase()) || t.department?.toLowerCase().includes(timetableFacultySearch.toLowerCase())));

  const directoryFilteredStudents = students.filter(s => 
    (directoryViewMode === "active" ? s.role !== "disabled" : s.role === "disabled") &&
    (s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.rollNumber?.toLowerCase().includes(studentSearchTerm.toLowerCase()))
  );
  
  const directoryFilteredTeachers = teachers.filter(t => 
    (directoryViewMode === "active" ? t.role !== "disabled" : t.role === "disabled") &&
    (t.name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) || t.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) || t.department?.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
  );

  const downloadAttendanceExcel = async (subject) => {
    const semSnap = await get(child(ref(db), `semesters/${subject.semesterId}`));
    const sIds = semSnap.exists() ? (semSnap.val().studentIds || []) : [];
    const studentIdsArray = Array.isArray(sIds) ? sIds : Object.keys(sIds);
    
    const studentsList = students.filter(s => studentIdsArray.includes(s.id) && s.role !== "disabled");
    const attQ = query(ref(db, "attendance"), orderByChild("subjectId"), equalTo(subject.id));
    const attSnap = await get(attQ);
    const stats = {};
    studentsList.forEach(s => stats[s.id] = { roll: s.rollNumber || "N/A", name: s.name, dept: s.department || "N/A", p: 0, a: 0, l: 0 });
    let totalClasses = 0;
    if (attSnap.exists()) {
      attSnap.forEach(snap => {
        totalClasses++;
        const records = snap.val().records || {};
        studentsList.forEach(s => {
          if (records[s.id] === 'P') stats[s.id].p++;
          if (records[s.id] === 'A') stats[s.id].a++;
          if (records[s.id] === 'L') stats[s.id].l++;
        });
      });
    }
    const excelData = studentsList.map(s => {
      const d = stats[s.id];
      const attended = d.p + d.a + d.l;
      const perc = attended === 0 ? 0 : Math.round((d.p / attended) * 100);
      return { "Roll No": d.roll, "Student Name": d.name, "Department": d.dept, "Total Classes": totalClasses, "Present": d.p, "Absent": d.a, "Leave": d.l, "Attendance %": `${perc}%` };
    });
    const ws = XLSX.utils.json_to_sheet(excelData); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance"); saveExcelFile(wb, `${myCollegeCode}_${subject.name}_Attendance.xlsx`);
  };

  const downloadMarksExcel = async (subject) => {
    const semSnap = await get(child(ref(db), `semesters/${subject.semesterId}`));
    const sIds = semSnap.exists() ? (semSnap.val().studentIds || []) : [];
    const studentIdsArray = Array.isArray(sIds) ? sIds : Object.keys(sIds);
    
    const studentsList = students.filter(s => studentIdsArray.includes(s.id) && s.role !== "disabled");
    const assignQ = query(ref(db, "assignments"), orderByChild("subjectId"), equalTo(subject.id));
    const assignSnap = await get(assignQ);
    const assignments = [];
    if (assignSnap.exists()) assignSnap.forEach(snap => assignments.push({ id: snap.key, ...snap.val() }));
    if (assignments.length === 0) return alert("No assignments found for this subject.");
    const submissions = [];
    for (let a of assignments) {
      const subQ = query(ref(db, "submissions"), orderByChild("assignmentId"), equalTo(a.id));
      const subSnap = await get(subQ);
      if (subSnap.exists()) subSnap.forEach(snap => submissions.push({ id: snap.key, ...snap.val() }));
    }
    const excelData = studentsList.map(s => {
      const row = { "Roll No": s.rollNumber || "N/A", "Student Name": s.name, "Department": s.department || "N/A" };
      assignments.forEach(a => {
        const sub = submissions.find(x => x.studentId === s.id && x.assignmentId === a.id);
        row[`${a.title} (/${a.maxMarks})`] = sub ? (sub.marks !== undefined ? sub.marks : "Not Graded") : "Not Submitted";
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(excelData); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks"); saveExcelFile(wb, `${myCollegeCode}_${subject.name}_Marks.xlsx`);
  };


  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><h2 className="text-3xl font-bold text-[#0b3b60] animate-pulse">Loading Portal...</h2></div>;

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-gray-900 transition-colors duration-300 pb-20 relative">

      {/* HEADER */}
      <div className="bg-[#0b3b60] text-white p-4 md:p-8 flex flex-col justify-end shadow-md sticky top-0 z-30 rounded-b-[2.5rem] min-h-[140px] overflow-visible">
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-[100]">
          <div className="flex gap-4"><ThemeToggle /></div>
          <button onClick={handleLogout} className="hidden sm:block px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm">Logout</button>
        </div>
        <div className="mt-8 px-2 flex justify-between items-end">
          <div>
             <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">HOD {hodName.split(' ')[0]}</h1>
             <p className="text-blue-200 mt-1 opacity-90 text-xs font-medium uppercase">Code: {myCollegeCode}</p>
          </div>
          {activeTab !== "dashboard" && (
             <button onClick={() => setActiveTab("dashboard")} className="text-sm font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg> Back
             </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-8 relative z-10">
        
        {/* --- DASHBOARD MAIN MENU GRID --- */}
        <AnimatePresence mode="wait">
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
             <button onClick={() => setActiveTab("departments")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-blue-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-2xl shadow-inner">🏢</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Departments</h3>
             </button>
             <button onClick={() => setActiveTab("semesters")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-green-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center text-2xl shadow-inner">📅</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Semesters</h3>
             </button>
             <button onClick={() => setActiveTab("classes")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-yellow-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center text-2xl shadow-inner">🏫</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Classes</h3>
             </button>
             <button onClick={() => setActiveTab("subjects")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-purple-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center text-2xl shadow-inner">📚</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Subjects</h3>
             </button>
             <button onClick={() => setActiveTab("timetables")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-2xl shadow-inner">🗓️</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Timetables</h3>
             </button>
             <button onClick={() => setActiveTab("reports")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-cyan-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 rounded-full flex items-center justify-center text-2xl shadow-inner">📊</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Reports</h3>
             </button>
             <button onClick={() => setActiveTab("manageUsers")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-red-500 transition-all active:scale-95 col-span-1 md:col-span-1 lg:col-span-1">
                <div className="w-14 h-14 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center text-2xl shadow-inner">👥</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Directory</h3>
             </button>
             
             {/* CENTRAL ARCHIVE VIEWER */}
             <button onClick={() => setActiveTab("archives")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-teal-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-teal-50 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center text-2xl shadow-inner">🗄️</div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Archives</h3>
             </button>

             <button onClick={() => setActiveTab("flush")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-orange-500 transition-all active:scale-95 col-span-2 lg:col-span-4">
                <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center text-2xl shadow-inner">🗑️</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base text-center">Archive Semester</h3>
             </button>

             {/* NOTICES BUTTONS */}
             <button onClick={() => setActiveTab("sendNotice")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-yellow-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center text-2xl shadow-inner">📢</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Student Notice</h3>
             </button>
             <button onClick={() => setActiveTab("sendTeacherNotice")} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-3 hover:border-pink-500 transition-all active:scale-95">
                <div className="w-14 h-14 bg-pink-50 dark:bg-pink-900/30 text-pink-600 rounded-full flex items-center justify-center text-2xl shadow-inner">👨‍🏫</div><h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">Staff Notice</h3>
             </button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* --- CENTRAL ARCHIVE VIEWER TAB --- */}
        {activeTab === "archives" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-2xl font-black mb-2 text-[#0b3b60] dark:text-blue-400">Master Archive Viewer</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">View all subjects hidden/archived by students and teachers, organized by semester.</p>

              {semesters.length === 0 ? (
                <p className="text-center text-gray-500 italic py-10">No semesters found in the system.</p>
              ) : (
                <div className="space-y-8">
                  {semesters.map(sem => {
                    // Find all subjects belonging to this semester that have at least one user in archivedBy
                    const archivedSubjectsInSem = subjectsList.filter(sub => 
                      sub.semesterId === sem.id && sub.archivedBy && Object.keys(sub.archivedBy).length > 0
                    );

                    if (archivedSubjectsInSem.length === 0) return null;

                    return (
                      <div key={sem.id} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-200 dark:border-gray-700">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span>📅</span> {sem.name}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {archivedSubjectsInSem.map(sub => {
                            const archivedUsers = Object.keys(sub.archivedBy).map(uid => {
                               const student = students.find(s => s.id === uid);
                               if (student) return { name: student.name, role: 'Student', roll: student.rollNumber };
                               const teacher = teachers.find(t => t.id === uid);
                               if (teacher) return { name: teacher.name, role: 'Teacher' };
                               return { name: "Unknown User", role: "N/A" };
                            });

                            return (
                              <div key={sub.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                                <h5 className="font-bold text-lg text-[#0b3b60] dark:text-blue-400 mb-3">{sub.name}</h5>
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Archived By:</p>
                                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                  {archivedUsers.map((user, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
                                      <span className="font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${user.role === 'Teacher' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'}`}>
                                        {user.role} {user.roll ? `(${user.roll})` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* PERMANENT DELETE BUTTON */}
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                                  <button 
                                    onClick={() => handleDeleteArchivedSubject(sub.id, sub.name)} 
                                    className="text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center w-full gap-2"
                                  >
                                    <span>🗑️</span> Delete Permanently from Database
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Fallback if no subjects are archived across all semesters */}
                  {semesters.every(sem => subjectsList.filter(sub => sub.semesterId === sem.id && sub.archivedBy && Object.keys(sub.archivedBy).length > 0).length === 0) && (
                     <div className="text-center text-gray-500 py-10 flex flex-col items-center">
                        <span className="text-4xl mb-3 opacity-50">✨</span>
                        <p>No students or teachers have archived any subjects yet.</p>
                     </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- DEPARTMENTS TAB --- */}
        {activeTab === "departments" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black mb-6 text-[#0b3b60] dark:text-blue-400">Assign Departments</h3>
            <form onSubmit={handleAssignDepartment} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Department Name</label>
                <input type="text" placeholder="e.g., Information Technology (IT)" required value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Select Classes</label>
                <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                  {classes.length === 0 ? <p className="text-sm text-gray-500 italic">No classes created yet.</p> : classes.map(c => (
                    <label key={c.id} className="flex items-center space-x-3 mb-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                      <input type="checkbox" checked={selectedClassesForDept.includes(c.id)} onChange={() => toggleSelection(c.id, selectedClassesForDept, setSelectedClassesForDept)} className="w-5 h-5 text-[#0b3b60] rounded" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium text-lg">{c.name} <span className="text-blue-600 dark:text-blue-400 ml-2 font-bold">{renderDepartment(c.department)}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-[#0b3b60] hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-transform active:scale-95">Assign Department</button>
            </form>
          </motion.div>
        )}

        {/* --- SEMESTERS TAB --- */}
        {activeTab === "semesters" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black mb-6 text-[#0b3b60] dark:text-blue-400">Semester Setup</h3>
            <form onSubmit={handleCreateSemester} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Semester Name</label>
                <input type="text" placeholder="e.g., Semester 2 (2027)" required value={semName} onChange={(e) => setSemName(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Quick Clone</label>
                <select value={importSemesterId} onChange={(e) => handleImportStudents(e.target.value)} className="w-full p-4 border border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 font-bold outline-none focus:ring-2 focus:ring-[#0b3b60] transition">
                  <option value="">-- Clone Students from a Previous Semester --</option>
                  {semesters.map(sem => <option key={sem.id} value={sem.id}>Clone from {sem.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Select Students</label>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {selectedStudents.length} Selected / {students.length} Total
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="🔍 Search Student by Name, Roll No, or Email..."
                  value={formStudentSearch}
                  onChange={(e) => setFormStudentSearch(e.target.value)}
                  className="w-full mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] text-sm dark:text-white"
                />

                <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                  {formFilteredStudents.length === 0 ? <p className="text-sm text-gray-500 italic">No matching students.</p> : formFilteredStudents.map(s => (
                    <label key={s.id} className="flex items-center space-x-3 mb-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                      <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleSelection(s.id, selectedStudents, setSelectedStudents)} className="w-5 h-5 text-[#0b3b60] rounded" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium flex items-center flex-wrap gap-2">
                        <strong className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-sm tracking-widest">{s.rollNumber || "N/A"}</strong>
                        {s.name} <span className="text-gray-500 text-xs opacity-70 w-full sm:w-auto mt-1 sm:mt-0">({s.email})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-[#0b3b60] hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-transform active:scale-95">Create Semester</button>
            </form>
          </motion.div>
        )}

        {/* --- CLASSES TAB --- */}
        {activeTab === "classes" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black mb-6 text-[#0b3b60] dark:text-blue-400">Class Setup</h3>
            <form onSubmit={handleCreateClass} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Class Name</label>
                <input type="text" placeholder="e.g., BCA Batch 2026" required value={className} onChange={(e) => setClassName(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Class Incharge</label>
                <input 
                  type="text" 
                  placeholder="🔍 Search Teacher by Name, Email, or Dept..." 
                  value={inchargeSearchTerm}
                  onChange={(e) => setInchargeSearchTerm(e.target.value)}
                  className="w-full mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] text-sm dark:text-white"
                />
                <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                  {formFilteredIncharges.length === 0 ? <p className="text-sm text-gray-500 italic">No matching teachers.</p> : formFilteredIncharges.map(t => (
                    <label key={t.id} className="flex items-center space-x-3 mb-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                      <input type="radio" name="incharge" checked={selectedIncharge === t.id} onChange={() => setSelectedIncharge(t.id)} className="w-5 h-5 text-[#0b3b60] rounded-full" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium flex items-center flex-wrap gap-2">
                        {t.name} <span className="text-gray-500 text-xs opacity-70 w-full sm:w-auto mt-1 sm:mt-0">({t.email})</span>
                        {t.department && t.department.trim() !== "" && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-xs uppercase tracking-wider">{t.department}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Link Semesters</label>
                <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                  {semesters.length === 0 ? <p className="text-sm text-gray-500 italic">Create a semester first.</p> : semesters.map(sem => (
                    <label key={sem.id} className="flex items-center space-x-3 mb-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                      <input type="checkbox" checked={selectedSemesters.includes(sem.id)} onChange={() => toggleSelection(sem.id, selectedSemesters, setSelectedSemesters)} className="w-5 h-5 text-[#0b3b60] rounded" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{sem.name} <span className="text-gray-500 text-sm ml-1">({getStudentCount(sem.studentIds)} students)</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-[#0b3b60] hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-transform active:scale-95">Create Class</button>
            </form>
          </motion.div>
        )}

        {/* --- SUBJECTS TAB --- */}
        {activeTab === "subjects" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-black mb-6 text-[#0b3b60] dark:text-blue-400">Subject Setup</h3>
            <form onSubmit={handleCreateSubject} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Subject Name</label>
                <input type="text" placeholder="e.g., Cloud Computing" required value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Target Semester</label>
                <select required value={selectedSemesterForSub} onChange={(e) => setSelectedSemesterForSub(e.target.value)} className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-[#0b3b60] transition">
                  <option value="">-- Select Semester --</option>
                  {semesters.map(sem => <option key={sem.id} value={sem.id}>{sem.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Assign Teacher</label>
                <input 
                  type="text" 
                  placeholder="🔍 Search Teacher by Name, Email, or Dept..." 
                  value={subjectTeacherSearchTerm}
                  onChange={(e) => setSubjectTeacherSearchTerm(e.target.value)}
                  className="w-full mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] text-sm dark:text-white"
                />
                <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                  {formFilteredSubjectTeachers.length === 0 ? <p className="text-sm text-gray-500 italic">No matching teachers.</p> : formFilteredSubjectTeachers.map(t => (
                    <label key={t.id} className="flex items-center space-x-3 mb-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                      <input type="radio" name="subjectTeacher" checked={selectedTeacher === t.id} onChange={() => setSelectedTeacher(t.id)} className="w-5 h-5 text-[#0b3b60] rounded-full" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium flex items-center flex-wrap gap-2">
                        {t.name} <span className="text-gray-500 text-xs opacity-70 w-full sm:w-auto mt-1 sm:mt-0">({t.email})</span>
                        {t.department && t.department.trim() !== "" && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-xs uppercase tracking-wider">{t.department}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full md:w-auto bg-[#0b3b60] hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-transform active:scale-95">Assign Subject</button>
            </form>
          </motion.div>
        )}

        {/* --- TIMETABLES TAB --- */}
        {activeTab === "timetables" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 space-y-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-[#0b3b60] transition-colors">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">1. Select Class</h2>
                {classes.length === 0 ? <p className="text-sm text-gray-500">No classes exist.</p> : (
                  <div className="space-y-3">
                    {classes.map(cls => (
                      <button key={cls.id} onClick={() => { setTimetableClass(cls); setTimetableSemester(null); }}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${timetableClass?.id === cls.id ? "bg-[#0b3b60] text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {cls.name} <span className="block text-xs mt-1 opacity-80">{renderDepartment(cls.department)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {timetableClass && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-[#0b3b60] transition-colors">
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">2. Select Semester</h2>
                  <div className="space-y-3">
                    {semesters.filter(sem => {
                      const classObj = classes.find(c => c.id === timetableClass.id);
                      const semIds = classObj?.semesterIds || [];
                      const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                      return semIdsArray.includes(sem.id);
                    }).map(sem => (
                      <button key={sem.id} onClick={() => loadSemesterTimetable(sem.id)}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${timetableSemester === sem.id ? "bg-[#0b3b60] text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {sem.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full lg:w-2/3">
              {timetableClass && timetableSemester ? (
                <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm transition-colors border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b-2 border-[#0b3b60] pb-4 gap-4">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white text-center sm:text-left">
                      Timetable: {timetableClass.name} <span className="text-[#0b3b60] dark:text-blue-400 text-lg block sm:inline">({semesters.find(s => s.id === timetableSemester)?.name})</span>
                    </h3>
                    <button onClick={handleDownloadTimetable} className="w-full sm:w-auto text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-4 py-2 rounded-lg transition shadow-sm">
                      ⬇ Excel Download
                    </button>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-8">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wide text-sm">Add New Lecture</h4>
                    
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/30 mb-6 flex flex-col gap-5">
                      
                      {/* CUSTOM DYNAMIC DAYS */}
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                         <div className="flex-1 w-full">
                           <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Create / Select Day</label>
                           <div className="flex gap-2">
                             <input type="text" placeholder="e.g. Monday, Mid-Term Day 1" value={customDayInput} onChange={(e) => setCustomDayInput(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] dark:text-white" />
                             <button onClick={handleAddCustomDay} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-4 rounded-xl font-bold hover:bg-blue-200 transition-colors">Add</button>
                           </div>
                         </div>
                      </div>

                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                         {Object.keys(timetable).length === 0 ? <p className="text-sm text-gray-400 italic">No days added yet.</p> : 
                           Object.keys(timetable).map(d => {
                              const isWeekend = d.toLowerCase() === "saturday" || d.toLowerCase() === "sunday";
                              return (
                               <button 
                                 key={d} 
                                 onClick={() => setSelectedDay(d)} 
                                 className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-colors shadow-sm ${selectedDay === d ? (isWeekend ? 'bg-red-600 text-white' : 'bg-[#0b3b60] text-white') : (isWeekend ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300')}`}
                               >
                                 {d}
                               </button>
                              )
                           })
                         }
                      </div>

                      <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          {/* CUSTOMIZED LECTURE INPUT */}
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Lecture Period</label>
                          <input type="text" placeholder="e.g., 1st Lec, Lab 2, Seminar" value={newLecture.lecNumber} onChange={e => setNewLecture({...newLecture, lecNumber: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] dark:text-white"/>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Subject Title</label>
                          <input type="text" placeholder="e.g., Data Structures" value={newLecture.subject} onChange={e => setNewLecture({...newLecture, subject: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] dark:text-white"/>
                        </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Time Slot</label>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
                            <input type="time" title="Start Time" value={newLecture.startTime} onChange={e => setNewLecture({...newLecture, startTime: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] dark:text-white cursor-pointer"/>
                            <span className="hidden sm:inline font-black text-gray-400 text-lg text-center">-</span>
                            <input type="time" title="End Time" value={newLecture.endTime} onChange={e => setNewLecture({...newLecture, endTime: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] dark:text-white cursor-pointer"/>
                          </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Assign Faculty</label>
                        <input 
                          type="text" 
                          placeholder="🔍 Search Teacher Name or Department..." 
                          value={timetableFacultySearch}
                          onChange={(e) => setTimetableFacultySearch(e.target.value)}
                          className="w-full mb-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#0b3b60] text-sm dark:text-white transition-all"
                        />
                        <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-xl max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar shadow-inner">
                          {timetableFilteredTeachers.length === 0 ? <p className="text-sm text-gray-500 italic p-2">No matching faculty found.</p> : timetableFilteredTeachers.map(t => (
                            <label key={t.id} className="flex items-center space-x-3 mb-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                              <input type="radio" name="timetableTeacher" checked={newLecture.teacherId === t.id} onChange={() => setNewLecture({...newLecture, teacherId: t.id})} className="w-4 h-4 text-[#0b3b60] rounded-full flex-shrink-0" />
                              <span className="text-gray-800 dark:text-gray-200 font-medium text-sm flex items-center flex-wrap gap-2">
                                {t.name}
                                {t.department && t.department.trim() !== "" && <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">{t.department}</span>}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button onClick={handleAddLecture} className="w-full mt-2 bg-[#0b3b60] hover:bg-blue-800 text-white font-black text-lg px-8 py-4 rounded-xl shadow-lg active:scale-95 transition-transform">
                        + Add Lecture to Schedule
                      </button>
                    </div>

                    <div className="space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                      {Object.keys(timetable).map(day => (
                        timetable[day] && timetable[day].length > 0 && (
                          <div key={day} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border ${(day.toLowerCase() === 'saturday' || day.toLowerCase() === 'sunday') ? 'border-red-200 dark:border-red-900/30' : 'border-gray-100 dark:border-gray-700'}`}>
                            <h4 className={`font-black mb-3 border-b pb-2 uppercase tracking-wider ${(day.toLowerCase() === 'saturday' || day.toLowerCase() === 'sunday') ? 'text-red-600 border-red-200 dark:border-red-900/50' : 'text-[#0b3b60] dark:text-blue-400 border-gray-100 dark:border-gray-700'}`}>{day}</h4>
                            <div className="space-y-2">
                              {timetable[day].sort((a,b) => a.lecNumber.localeCompare(b.lecNumber)).map((lec, index) => (
                                <div key={index} className="bg-white dark:bg-[#1a2035] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="h-12 shrink-0 bg-gray-900 text-orange-500 rounded-lg px-3 flex items-center justify-center font-black shadow-inner text-sm whitespace-nowrap min-w-[3rem]">
                                      {lec.lecNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-gray-900 dark:text-white leading-tight truncate">{lec.subject}</h4>
                                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300 font-bold tracking-wider">🕑 {lec.startTime} - {lec.endTime}</span>
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 self-start sm:self-auto">
                                    <div className="text-xs font-bold text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-1.5">
                                      <span className="text-sm">🧑‍🏫</span> Prof. {lec.teacherName}
                                    </div>
                                    <button onClick={() => handleRemoveLecture(day, index)} className="text-red-500 text-xs font-bold hover:underline bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-md transition-colors">Remove</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                      {Object.values(timetable).every(arr => !arr || arr.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-10 opacity-50">
                          <span className="text-4xl mb-2">🌴</span>
                          <p className="text-sm text-gray-500 italic text-center font-medium">No classes scheduled.<br/>Use the form above to build the timetable.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/30">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-4 border-b border-red-200 pb-2">Declare Holidays</h3>
                      <div className="flex flex-col gap-3 mb-4">
                        <input type="date" value={holidayDate} onChange={(e)=>setHolidayDate(e.target.value)} className="p-3 bg-white dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 dark:text-white cursor-pointer"/>
                        <input type="text" placeholder="Reason (e.g., Festival)" value={holidayReason} onChange={(e)=>setHolidayReason(e.target.value)} className="p-3 bg-white dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 dark:text-white"/>
                        <button onClick={handleAddHoliday} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md transition-transform active:scale-95">Add Holiday</button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                        {!timetableClass.holidays || Object.keys(timetableClass.holidays).length === 0 ? <p className="text-sm text-red-400 italic">No holidays declared.</p> : 
                          Object.entries(timetableClass.holidays).map(([d, reason]) => (
                            <div key={d} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded shadow-sm border text-sm">
                              <span className="font-bold text-gray-800 dark:text-gray-200">{d} <span className="text-gray-500 font-normal">({reason})</span></span>
                              <button onClick={() => handleRemoveHoliday(d)} className="text-red-500 font-bold hover:underline">Remove</button>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-3 border-b border-blue-200 pb-2">Lecture Predictor</h3>
                      <p className="text-xs text-gray-500 mb-4">Calculates working days excluding Sundays and Holidays.</p>
                      <form onSubmit={(e) => { e.preventDefault(); calculateLectures(e.target.start.value, e.target.end.value); }} className="flex flex-col gap-3">
                        <input name="start" required type="date" className="p-3 bg-white dark:bg-gray-800 border rounded-xl outline-none dark:text-white cursor-pointer"/>
                        <span className="self-center text-gray-400 font-bold">TO</span>
                        <input name="end" required type="date" className="p-3 bg-white dark:bg-gray-800 border rounded-xl outline-none dark:text-white cursor-pointer"/>
                        <button type="submit" className="bg-[#0b3b60] hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-md mt-2 transition-transform active:scale-95">Calculate Total Days</button>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm text-center h-full flex flex-col justify-center items-center min-h-[400px] border border-gray-100 dark:border-gray-700 transition-colors">
                  <span className="text-6xl mb-4 opacity-50">📅</span>
                  <p className="font-bold text-lg text-gray-600 dark:text-gray-400">
                    {!timetableClass ? "Select a Class to manage its timetables." : "Select a Semester to build its Timetable."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- REPORTS TAB --- */}
        {activeTab === "reports" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 space-y-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-[#0b3b60] transition-colors">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">1. Select Class</h2>
                {classes.length === 0 ? <p className="text-sm text-gray-500">No classes exist.</p> : (
                  <div className="space-y-3">
                    {classes.map(cls => (
                      <button key={cls.id} onClick={() => { setReportSelectedClass(cls.id); setReportSelectedSemester(null); }}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${reportSelectedClass === cls.id ? "bg-[#0b3b60] text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {cls.name} <span className="block text-xs mt-1 opacity-80">{renderDepartment(cls.department)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reportSelectedClass && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-[#0b3b60] transition-colors">
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">2. Select Semester</h2>
                  <div className="space-y-3">
                    {semesters.filter(sem => {
                      const classObj = classes.find(c => c.id === reportSelectedClass);
                      const semIds = classObj?.semesterIds || [];
                      const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                      return semIdsArray.includes(sem.id);
                    }).map(sem => (
                      <button key={sem.id} onClick={() => setReportSelectedSemester(sem.id)}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${reportSelectedSemester === sem.id ? "bg-[#0b3b60] text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {sem.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="w-full lg:w-2/3">
              {reportSelectedSemester ? (
                <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm transition-colors border border-gray-100 dark:border-gray-700">
                  <h3 className="text-2xl font-black mb-2 text-[#0b3b60] dark:text-blue-400">Academic Reports</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">Download detailed Excel spreadsheets.</p>
                  {subjectsList.filter(sub => sub.semesterId === reportSelectedSemester).length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-xl text-center border border-dashed border-gray-300 dark:border-gray-700">
                      <p className="text-gray-500 font-medium">No subjects found for this semester.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {subjectsList.filter(sub => sub.semesterId === reportSelectedSemester).map(sub => (
                        <div key={sub.id} className="p-6 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 transition flex flex-col justify-between items-center text-center">
                          <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{sub.name}</h4>
                          <div className="flex flex-row justify-center gap-6 w-full mt-4">
                            <div className="flex flex-col items-center">
                              <button onClick={() => downloadAttendanceExcel(sub)} className="flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full border border-green-300 dark:border-green-700 shadow-sm active:scale-95 transition-transform"><span className="text-2xl">📊</span></button>
                            </div>
                            <div className="flex flex-col items-center">
                              <button onClick={() => downloadMarksExcel(sub)} className="flex items-center justify-center w-14 h-14 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full border border-purple-300 dark:border-purple-700 shadow-sm active:scale-95 transition-transform"><span className="text-2xl">📝</span></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm text-center h-full flex flex-col justify-center items-center min-h-[300px] border border-gray-100 dark:border-gray-700 transition-colors">
                  <span className="text-6xl mb-4 opacity-50">📱</span>
                  <p className="font-bold text-lg text-gray-600 dark:text-gray-400">Select a Class and Semester <br/> to view downloadable reports.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- FLUSH SEMESTER TAB --- */}
        {activeTab === "flush" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 space-y-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-orange-500 transition-colors">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">1. Select Class</h2>
                {classes.length === 0 ? <p className="text-sm text-gray-500">No classes exist.</p> : (
                  <div className="space-y-3">
                    {classes.map(cls => (
                      <button key={cls.id} onClick={() => { setFlushSelectedClass(cls.id); setFlushSelectedSemester(null); }}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${flushSelectedClass === cls.id ? "bg-orange-500 text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {cls.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {flushSelectedClass && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-t-4 border-red-500 transition-colors">
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4 uppercase tracking-wide">2. Select Semester</h2>
                  <div className="space-y-3">
                    {semesters.filter(sem => {
                      const classObj = classes.find(c => c.id === flushSelectedClass);
                      const semIds = classObj?.semesterIds || [];
                      const semIdsArray = Array.isArray(semIds) ? semIds : Object.keys(semIds);
                      return semIdsArray.includes(sem.id);
                    }).map(sem => (
                      <button key={sem.id} onClick={() => setFlushSelectedSemester(sem.id)}
                        className={`w-full text-left p-4 rounded-xl font-bold transition-all shadow-sm ${flushSelectedSemester === sem.id ? "bg-red-500 text-white" : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"}`}>
                        {sem.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="w-full lg:w-2/3">
              {flushSelectedSemester ? (
                <div className="bg-red-50 dark:bg-red-900/10 p-8 md:p-12 rounded-[2rem] shadow-sm border-2 border-red-200 dark:border-red-900 transition-colors text-center flex flex-col justify-center items-center min-h-[300px]">
                  <span className="text-6xl mb-4">⚠</span>
                  <h3 className="text-3xl font-black mb-4 text-red-600 dark:text-red-500 tracking-tight">Archive Semester</h3>
                  <p className="text-red-800 dark:text-red-200 text-lg mb-8 max-w-lg mx-auto font-medium leading-relaxed">
                    Flushing this semester will permanently delete all active Subjects, Assignments, Submissions, and Attendance for this term.
                  </p>
                  <button onClick={handleFlushSemester} disabled={isFlushing} className={`w-full max-w-sm bg-red-600 text-white px-8 py-5 rounded-2xl font-black text-xl hover:bg-red-700 shadow-xl transition-transform active:scale-95 uppercase tracking-wider ${isFlushing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isFlushing ? "Archiving Data..." : "Archive Semester"}
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm text-center h-full flex flex-col justify-center items-center min-h-[300px] border border-gray-100 dark:border-gray-700 transition-colors">
                  <span className="text-6xl mb-4 opacity-50">📱</span>
                  <p className="font-bold text-lg text-gray-600 dark:text-gray-400">Select a Class and Semester <br/> to initiate a reset.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- DIRECTORY TAB --- */}
        {activeTab === "manageUsers" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <h3 className="text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">User Directory</h3>
              
              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl shadow-inner w-full sm:w-auto">
                <button 
                  onClick={() => setDirectoryViewMode("active")}
                  className={`flex-1 sm:flex-none px-6 py-2 text-sm font-black rounded-lg transition-all ${directoryViewMode === "active" ? "bg-white dark:bg-gray-700 text-[#0b3b60] dark:text-blue-400 shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                  🟢 Active
                </button>
                <button 
                  onClick={() => setDirectoryViewMode("disabled")}
                  className={`flex-1 sm:flex-none px-6 py-2 text-sm font-black rounded-lg transition-all ${directoryViewMode === "disabled" ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                  🗄️ Removed
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              
              {/* STUDENTS COLUMN */}
              <div>
                <h4 className="text-lg font-bold mb-4 text-gray-900 dark:text-white uppercase tracking-wide">Students</h4>
                <input type="text" placeholder="Search Student Name, Roll, Email..." value={studentSearchTerm} onChange={(e) => setStudentSearchTerm(e.target.value)} className="w-full mb-4 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {directoryFilteredStudents.length === 0 ? <p className="text-sm text-gray-500 italic">No matching students found.</p> : directoryFilteredStudents.map(s => (
                    <div key={s.id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 gap-3 ${s.role === "disabled" ? "bg-red-50 dark:bg-red-900/10 opacity-80" : "bg-gray-50 dark:bg-gray-900"}`}>
                      <div className="overflow-hidden flex items-center gap-3">
                        <div className={`font-black px-3 py-2 rounded-lg text-sm tracking-wider ${s.role === "disabled" ? "bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200" : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"}`}>{s.rollNumber || "N/A"}</div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.email}</p>
                        </div>
                      </div>
                      
                      {s.role === "disabled" ? (
                        <button onClick={() => handleRemoveUser(s.id, s.name, s.role, true)} className="text-green-600 dark:text-green-400 font-bold text-sm bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg active:scale-95 transition-transform whitespace-nowrap border border-green-200 dark:border-green-800">
                          ↩ Restore
                        </button>
                      ) : (
                        <button onClick={() => handleRemoveUser(s.id, s.name, 'student')} className="text-red-600 dark:text-red-400 font-bold text-sm bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-lg active:scale-95 transition-transform whitespace-nowrap">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* TEACHERS COLUMN */}
              <div>
                <h4 className="text-lg font-bold mb-4 text-gray-900 dark:text-white uppercase tracking-wide">Teachers</h4>
                <input type="text" placeholder="Search Teacher Name, Dept, Email..." value={teacherSearchTerm} onChange={(e) => setTeacherSearchTerm(e.target.value)} className="w-full mb-4 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b3b60] outline-none transition" />
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {directoryFilteredTeachers.length === 0 ? <p className="text-sm text-gray-500 italic">No matching teachers found.</p> : directoryFilteredTeachers.map(t => (
                    <div key={t.id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 gap-3 ${t.role === "disabled" ? "bg-red-50 dark:bg-red-900/10 opacity-80" : "bg-gray-50 dark:bg-gray-900"}`}>
                      <div className="overflow-hidden flex items-center gap-3">
                        {t.department && t.department.trim() !== "" && <div className={`font-bold px-3 py-2 rounded-lg text-xs uppercase tracking-wider ${t.role === "disabled" ? "bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200" : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"}`}>{t.department}</div>}
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.email}</p>
                        </div>
                      </div>

                      {t.role === "disabled" ? (
                        <button onClick={() => handleRemoveUser(t.id, t.name, t.role, true)} className="text-green-600 dark:text-green-400 font-bold text-sm bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg active:scale-95 transition-transform whitespace-nowrap border border-green-200 dark:border-green-800">
                          ↩ Restore
                        </button>
                      ) : (
                        <button onClick={() => handleRemoveUser(t.id, t.name, 'teacher')} className="text-red-600 dark:text-red-400 font-bold text-sm bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-lg active:scale-95 transition-transform whitespace-nowrap">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}

      </div>
      {/* --- END RELATIVE WRAPPER --- */}

      {/* --- ALL POPUP MODALS ARE MOVED DOWN HERE SO THEY OVERLAP EVERYTHING --- */}
      
      {/* SEND STUDENT NOTICE MODAL */}
      {activeTab === "sendNotice" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab("dashboard")} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Broadcast to Students</h2>
              </div>
            </div>

            <form onSubmit={handleSendNotice} className="p-5 space-y-4">
              <p className="text-xs text-gray-500 mb-2 font-medium leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                 Note: This will instantly send a push notification to <strong>every student</strong> in your department.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Notice Title <span className="text-red-500">*</span></label>
                <input required type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="e.g., Exam Schedule..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Text Information (Optional)</label>
                <textarea value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} placeholder="Write details here..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none resize-none h-32 custom-scrollbar" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Attached Link (Optional)</label>
                <input type="url" value={noticeLink} onChange={e => setNoticeLink(e.target.value)} placeholder="https://docs.google.com/forms/..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3b60] outline-none" />
              </div>
              <button type="submit" disabled={isSendingNotice} className="w-full mt-4 bg-[#0b3b60] hover:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50">
                {isSendingNotice ? "Sending..." : "🚀 Broadcast to All Students"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW: SEND TEACHER/STAFF NOTICE TAB */}
      {activeTab === "sendTeacherNotice" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab("dashboard")} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Broadcast to Staff</h2>
              </div>
            </div>

            <form onSubmit={handleSendTeacherNotice} className="p-5 space-y-4">
              <p className="text-xs text-gray-500 mb-2 font-medium leading-relaxed bg-pink-50 dark:bg-pink-900/10 p-3 rounded-lg border border-pink-100 dark:border-pink-900/30">
                 Note: This will instantly send a push notification to <strong>all teachers</strong> in your department. Students will not see this.
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Notice Title <span className="text-red-500">*</span></label>
                <input required type="text" value={teacherNoticeTitle} onChange={e => setTeacherNoticeTitle(e.target.value)} placeholder="e.g., Department Meeting Link..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Text Information (Optional)</label>
                <textarea value={teacherNoticeMessage} onChange={e => setTeacherNoticeMessage(e.target.value)} placeholder="Write details here..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none h-32 custom-scrollbar" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Attached Link (Optional)</label>
                <input type="url" value={teacherNoticeLink} onChange={e => setTeacherNoticeLink(e.target.value)} placeholder="https://docs.google.com/forms/..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <button type="submit" disabled={isSendingTeacherNotice} className="w-full md:w-auto bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-transform active:scale-95 disabled:opacity-50">
                {isSendingTeacherNotice ? "Sending..." : "🚀 Broadcast to Staff"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE PAST NOTICES MODAL (WITH READ COUNTS) */}
      {isManagingNotices && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              
              <div className="flex items-center gap-3">
                <button onClick={() => setIsManagingNotices(false)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-bold flex items-center gap-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Back
                </button>
                <h2 className="text-lg font-black text-gray-800 dark:text-white truncate">Manage Broadcasted Notices</h2>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-gray-100 dark:bg-gray-900/50">
              {isLoadingNotices ? (
                <p className="text-center text-gray-500 animate-pulse">Loading notices & read receipts...</p>
              ) : mySentNotices.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <span className="text-4xl block mb-2 opacity-30">📭</span>
                  <p>You haven't broadcasted any notices yet.</p>
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