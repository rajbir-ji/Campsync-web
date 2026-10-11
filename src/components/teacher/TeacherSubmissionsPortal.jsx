import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
// Swapped Firestore imports for Realtime Database
import { ref, get, child, query, orderByChild, equalTo, update, push, set } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";

export default function TeacherSubmissionsPortal() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  
  const [assignment, setAssignment] = useState(null);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Detail View State
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Grading State
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      const dbRef = ref(db);

      // 1. Get Assignment (RTDB)
      const assgnSnap = await get(child(dbRef, `assignments/${assignmentId}`));
      if (!assgnSnap.exists()) {
        setLoading(false);
        return;
      }
      const assgnData = assgnSnap.val();
      setAssignment(assgnData);

      // 2. Get Enrolled Students via Semester
      const semSnap = await get(child(dbRef, `semesters/${assgnData.semesterId}`));
      let studentIds = [];
      if (semSnap.exists()) {
        const sIds = semSnap.val().studentIds || [];
        studentIds = Array.isArray(sIds) ? sIds : Object.keys(sIds);
      }

      const usersQ = query(ref(db, "users"), orderByChild("role"), equalTo("student"));
      const usersSnap = await get(usersQ);
      const enrolledStudents = [];
      
      if (usersSnap.exists()) {
        usersSnap.forEach((snap) => {
          if (studentIds.includes(snap.key)) {
            enrolledStudents.push({ id: snap.key, ...snap.val() });
          }
        });
      }
      setStudents(enrolledStudents);

      // 3. Get Submissions for this assignment
      const subQ = query(ref(db, "submissions"), orderByChild("assignmentId"), equalTo(assignmentId));
      const subSnap = await get(subQ);
      
      const subMap = {};
      if (subSnap.exists()) {
        subSnap.forEach((snap) => {
          const data = snap.val();
          subMap[data.studentId] = { id: snap.key, ...data };
        });
      }
      setSubmissions(subMap);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    const sub = submissions[student.id];
    setMarks(sub?.marks || "");
    setFeedback(sub?.feedback || "");
  };

  const handleSaveGrade = async (e) => {
    e.preventDefault();
    const sub = submissions[selectedStudent.id];
    
    if (!sub) return alert("This student has not submitted yet.");
    if (Number(marks) > assignment.maxMarks) return alert(`Marks cannot exceed ${assignment.maxMarks}`);

    setIsSaving(true);
    try {
      // Update submission with grade (RTDB)
      await update(ref(db, `submissions/${sub.id}`), {
        marks: Number(marks),
        feedback: feedback,
        status: "Checked"
      });

      // ---> NEW DIRECT RTDB NOTIFICATION TRIGGER <---
      const notifRef = push(ref(db, "notifications"));
      await set(notifRef, {
        recipientId: selectedStudent.id,
        title: "Assignment Graded! 🎉",
        message: `Your teacher has graded '${assignment.title}'. You scored ${marks}/${assignment.maxMarks}.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      alert("Grades Saved Successfully!");
      await fetchData(); // Refresh data to show updated tags
    } catch (err) {
      alert("Error saving grades: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="p-10 font-bold text-purple-600 animate-pulse text-xl">Loading Submissions...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Student Roster */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow border-b-4 border-purple-600 mb-2 transition-colors duration-300">
            <h1 className="font-bold text-gray-800 dark:text-white text-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {assignment?.title}
            </h1>
            <button onClick={() => navigate(`/teacher/assignments/${assignment.subjectId}`)} className="text-sm text-purple-600 dark:text-purple-400 font-bold hover:underline">
              ← Back
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow min-h-[500px] transition-colors duration-300">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4">Enrolled Students</h2>
            <div className="space-y-2">
              {students.map(student => {
                const sub = submissions[student.id];
                return (
                  <button 
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className={`w-full text-left p-3 rounded-lg border dark:border-gray-700 transition flex justify-between items-center ${selectedStudent?.id === student.id ? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800"}`}
                  >
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{student.name}</span>
                    
                    {sub ? (
                      sub.status === "Checked" ? 
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-1 rounded border border-blue-400 dark:border-blue-700">Graded</span>
                      : 
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-bold px-2 py-1 rounded border border-green-400 dark:border-green-700">Submitted</span>
                    ) : (
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Pending</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Submission & Grading */}
        <div className="w-full md:w-2/3">
          {selectedStudent ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow border-t-4 border-blue-400 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{selectedStudent.name}'s Submission</h2>
              
              {!submissions[selectedStudent.id] ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-lg border border-yellow-200 dark:border-yellow-700 mt-4 text-yellow-700 dark:text-yellow-500 font-semibold text-center">
                  This student has not submitted the assignment yet.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Submission Content */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-600 transition-colors">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-semibold uppercase tracking-wider">Submitted: {new Date(submissions[selectedStudent.id].submittedAt).toLocaleString()}</p>
                    
                    {submissions[selectedStudent.id].textAnswer && (
                      <div className="mb-4">
                        <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-2">Text Answer:</h4>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-600 whitespace-pre-wrap text-gray-800 dark:text-gray-200 text-sm">
                          {submissions[selectedStudent.id].textAnswer}
                        </div>
                      </div>
                    )}

                    {submissions[selectedStudent.id].fileUrl && (
                      <div>
                        <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-2">Attached File:</h4>
                        <a 
                          href={submissions[selectedStudent.id].fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-400 font-bold px-4 py-2 rounded shadow text-sm border border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
                        >
                          📄 View Document ({submissions[selectedStudent.id].fileName})
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Grading Form */}
                  <form onSubmit={handleSaveGrade} className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800/50 space-y-4 transition-colors">
                    <h3 className="font-bold text-blue-800 dark:text-blue-400 text-lg mb-2">Grade Submission</h3>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Marks (Out of {assignment.maxMarks})</label>
                      <input 
                        type="number" 
                        min="0" 
                        max={assignment.maxMarks}
                        value={marks} 
                        onChange={(e) => setMarks(e.target.value)} 
                        required 
                        className="w-1/3 p-3 border dark:border-gray-600 rounded-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700" 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Feedback</label>
                      <textarea 
                        rows="3" 
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Great job! Keep it up..."
                        className="w-full p-3 border dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className={`w-full text-white p-3 rounded-lg font-bold shadow-md transition ${isSaving ? "bg-gray-400 dark:bg-gray-600" : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"}`}
                    >
                      {isSaving ? "Saving..." : "Save Grades"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-200 dark:bg-gray-800 p-8 rounded-xl shadow-inner text-center h-full flex flex-col justify-center text-gray-500 dark:text-gray-400 min-h-[500px] transition-colors duration-300">
              <span className="text-5xl mb-4">🎓</span>
              <p className="font-bold text-lg">Select a student to view and grade their submission.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}