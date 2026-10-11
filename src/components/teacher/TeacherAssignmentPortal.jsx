import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
// Swapped Firestore for Realtime Database
import { ref, get, child, query, orderByChild, equalTo, push, set } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";

export default function TeacherAssignmentPortal() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishedAssignments, setPublishedAssignments] = useState([]);

  // Form State
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [questions, setQuestions] = useState([""]); 

  useEffect(() => {
    fetchSubjectAndAssignments();
  }, [subjectId]);

  const fetchSubjectAndAssignments = async () => {
    try {
      const dbRef = ref(db);
      
      // 1. Get Subject details (RTDB)
      const subSnap = await get(child(dbRef, `subjects/${subjectId}`));
      if (subSnap.exists()) setSubject(subSnap.val());

      // 2. Fetch existing assignments (RTDB)
      const q = query(ref(db, "assignments"), orderByChild("subjectId"), equalTo(subjectId));
      const snap = await get(q);
      
      const assignmentsList = [];
      if (snap.exists()) {
        snap.forEach((childSnap) => {
          assignmentsList.push({ id: childSnap.key, ...childSnap.val() });
        });
      }
      
      // Sort locally by creation date (newest first)
      assignmentsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPublishedAssignments(assignmentsList);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const addQuestionField = () => setQuestions([...questions, ""]);
  
  const removeQuestionField = (index) => {
    if (questions.length === 1) return; 
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const handlePublishAssignment = async (e) => {
    e.preventDefault();
    
    const cleanQuestions = questions.filter(q => q.trim() !== "");
    if (cleanQuestions.length === 0) return alert("Please add at least one valid question.");
    if (!title || !dueDate || !maxMarks) return alert("Please fill all metadata fields.");

    try {
      // 3. Save to Realtime Database
      const newAssignRef = push(ref(db, "assignments"));
      await set(newAssignRef, {
        subjectId: subjectId,
        semesterId: subject.semesterId,
        teacherId: auth.currentUser.uid,
        title: title,
        dueDate: dueDate,
        maxMarks: Number(maxMarks),
        questions: cleanQuestions,
        createdAt: new Date().toISOString()
      });

      alert("Assignment Published Successfully!");
      setTitle(""); setDueDate(""); setMaxMarks(""); setQuestions([""]);
      fetchSubjectAndAssignments();
    } catch (err) {
      alert("Error saving assignment: " + err.message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="p-10 text-xl font-bold text-blue-600 animate-pulse">Loading Portal...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Form */}
        <div className="w-full md:w-2/3">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-t-xl shadow border-b-4 border-purple-600 mb-6 transition-colors duration-300">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{subject?.name}</h1>
              <p className="text-gray-500 dark:text-gray-400">Create New Assignment</p>
            </div>
            <button onClick={() => navigate("/teacher-dashboard")} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
              ← Back
            </button>
          </div>

          <form onSubmit={handlePublishAssignment} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow space-y-6 transition-colors duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Assignment Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Unit 1 Questions" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Max Marks</label>
                <input type="number" min="1" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} required placeholder="e.g., 20" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </div>

            <hr className="my-6 border-gray-200 dark:border-gray-700" />

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Questions</h3>
                <button type="button" onClick={addQuestionField} className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded font-bold hover:bg-purple-200 dark:hover:bg-purple-800/50 text-sm transition">
                  + Add Question
                </button>
              </div>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="font-bold text-gray-500 dark:text-gray-400 mt-3 w-6">{index + 1}.</span>
                    <textarea 
                      rows="2" 
                      value={q}
                      onChange={(e) => handleQuestionChange(index, e.target.value)}
                      placeholder="Enter question text here..."
                      className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestionField(index)} className="mt-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2 font-bold">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-purple-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-md transition">
              Publish Assignment
            </button>
          </form>
        </div>

        {/* Right Column: Published History */}
        <div className="w-full md:w-1/3">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow h-full border-t-4 border-gray-400 dark:border-gray-600 transition-colors duration-300">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Published History</h2>
            
            {publishedAssignments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No assignments published yet.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
                {publishedAssignments.map(assgn => (
                  <div key={assgn.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 flex flex-col transition">
                    <h3 className="font-bold text-purple-700 dark:text-purple-400 text-sm">{assgn.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Due: {new Date(assgn.dueDate).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">Marks: {assgn.maxMarks} | Qs: {assgn.questions.length}</p>
                    <button 
                      onClick={() => navigate(`/teacher/submissions/${assgn.id}`)}
                      className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold px-3 py-2 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800/50 text-center w-full transition"
                    >
                      View Submissions & Grade
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}