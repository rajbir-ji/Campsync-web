import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../firebase"; 
import { ref, get, child, query, orderByChild, equalTo, push, set } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentAssignmentPortal() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  
  // Submission States
  const [submissionText, setSubmissionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  // Tab & Drawing States
  const [activeTab, setActiveTab] = useState("text"); 
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const draftCanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const draftCtxRef = useRef(null);
  
  // Professional Canvas Dimension & Zoom State
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 1600 });
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#000000"); 
  const [brushSize, setBrushSize] = useState(3);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  // --- ADVANCED DRAGGABLE TEXT BOX STATES ---
  const [activeText, setActiveText] = useState(null); 
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const textInputRef = useRef(null);
  
  // --- DYNAMIC GRAPH DATA STATE ---
  const [graphData, setGraphData] = useState([20, 60, 40, 90, 30]);

  // Professional Drawing Modes
  const [drawingMode, setDrawingMode] = useState("pencil"); 
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // UNDO / REDO HISTORY STATES
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    fetchAssignmentsAndUser();
  }, [subjectId]);

  // Setup Canvas
  useEffect(() => {
    if (selectedAssignment && canvasRef.current && draftCanvasRef.current) {
      const canvas = canvasRef.current;
      const draftCanvas = draftCanvasRef.current;
      
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      draftCanvas.width = canvasSize.width;
      draftCanvas.height = canvasSize.height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const draftCtx = draftCanvas.getContext("2d", { willReadFrequently: true });

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draftCtx.lineCap = "round";
      draftCtx.lineJoin = "round";

      ctxRef.current = ctx;
      draftCtxRef.current = draftCtx;
      
      if (history.length === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveHistoryState();
      } else {
        restoreCanvasFromDataUrl(history[historyStep]);
      }
    }
  }, [selectedAssignment, canvasSize]);

  useEffect(() => {
    if (ctxRef.current && draftCtxRef.current) {
      ctxRef.current.strokeStyle = drawingMode === 'eraser' ? '#ffffff' : brushColor;
      ctxRef.current.lineWidth = drawingMode === 'eraser' ? brushSize * 4 : brushSize;
      draftCtxRef.current.strokeStyle = drawingMode === 'eraser' ? '#ffffff' : brushColor;
      draftCtxRef.current.lineWidth = drawingMode === 'eraser' ? brushSize * 4 : brushSize;
    }
  }, [brushColor, brushSize, drawingMode]);

  useEffect(() => {
    if (activeText && textInputRef.current && !isDraggingText && !isResizingText) {
      textInputRef.current.focus();
    }
  }, [activeText, isDraggingText, isResizingText]);

  const fetchAssignmentsAndUser = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return navigate("/login");
      const dbRef = ref(db);
      const userSnap = await get(child(dbRef, `users/${user.uid}`));
      if (userSnap.exists()) setStudentName(userSnap.val().name);

      const q = query(ref(db, "assignments"), orderByChild("subjectId"), equalTo(subjectId));
      const snap = await get(q);
      const assignList = [];
      if (snap.exists()) {
        snap.forEach((childSnap) => {
          assignList.push({ id: childSnap.key, ...childSnap.val() });
        });
      }
      assignList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAssignments(assignList);
    } catch (error) { console.error("Error fetching data:", error); } 
    finally { setLoading(false); }
  };

  // --- ZOOM LOGIC ---
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.4));
  const handleZoomReset = () => setZoomLevel(1);

  // --- DRAWING LOGIC ---
  const getCoordinates = (e) => {
    const canvas = draftCanvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      offsetX: (clientX - rect.left) / zoomLevel,
      offsetY: (clientY - rect.top) / zoomLevel
    };
  };

  const stampActiveText = () => {
    if (activeText && activeText.value.trim() !== "") {
      const ctx = ctxRef.current;
      const lines = activeText.value.split('\n');
      ctx.font = `${activeText.fontSize}px Arial`;
      ctx.fillStyle = brushColor;
      ctx.textBaseline = "top";
      
      lines.forEach((line, index) => {
         ctx.fillText(line, activeText.x + 5, activeText.y + 5 + (index * (activeText.fontSize * 1.2))); 
      });

      saveHistoryState();
      setHasDrawn(true);
    }
    setActiveText(null);
  };

  const handleTextContainerPointerDown = (e, action) => {
    e.stopPropagation(); 
    const { offsetX, offsetY } = getCoordinates(e.nativeEvent);
    
    if (action === 'drag') {
       setIsDraggingText(true);
       setDragOffset({ x: offsetX - activeText.x, y: offsetY - activeText.y });
    } else if (action === 'resize') {
       setIsResizingText(true);
       setStartPos({ x: offsetX, y: offsetY });
    }
  };

  // --- FLOOD FILL ALGORITHM ---
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 } : { r: 0, g: 0, b: 0, a: 255 };
  };

  const floodFill = (ctx, startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const x = Math.round(startX);
    const y = Math.round(startY);
    
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

    const targetPos = (y * canvas.width + x) * 4;
    const targetColor = { r: data[targetPos], g: data[targetPos + 1], b: data[targetPos + 2], a: data[targetPos + 3] };

    if (targetColor.r === fillColor.r && targetColor.g === fillColor.g && targetColor.b === fillColor.b && targetColor.a === fillColor.a) return; 

    const colorMatch = (pos) => {
       const tolerance = 50; 
       return Math.abs(data[pos] - targetColor.r) <= tolerance && Math.abs(data[pos + 1] - targetColor.g) <= tolerance && Math.abs(data[pos + 2] - targetColor.b) <= tolerance && Math.abs(data[pos + 3] - targetColor.a) <= tolerance;
    };

    const pixelsToCheck = [x, y];
    while (pixelsToCheck.length > 0) {
      const currentY = pixelsToCheck.pop();
      const currentX = pixelsToCheck.pop();
      const currentPos = (currentY * canvas.width + currentX) * 4;

      if (colorMatch(currentPos)) {
        data[currentPos] = fillColor.r; data[currentPos + 1] = fillColor.g; data[currentPos + 2] = fillColor.b; data[currentPos + 3] = fillColor.a;
        if (currentX > 0) pixelsToCheck.push(currentX - 1, currentY);
        if (currentX < canvas.width - 1) pixelsToCheck.push(currentX + 1, currentY);
        if (currentY > 0) pixelsToCheck.push(currentX, currentY - 1);
        if (currentY < canvas.height - 1) pixelsToCheck.push(currentX, currentY + 1);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const startDrawing = (e) => {
    if (e.touches && e.touches.length === 1 && drawingMode !== 'text') e.preventDefault(); 
    
    const { offsetX, offsetY } = getCoordinates(e.nativeEvent || e);

    if (activeText && !isDraggingText && !isResizingText) {
      stampActiveText();
      return; 
    }

    if (drawingMode === "text") {
      setActiveText({ x: offsetX, y: offsetY, value: "", width: 200, height: 100, fontSize: Math.max(16, brushSize * 4) });
      return;
    }

    if (drawingMode === "fill") {
       floodFill(ctxRef.current, offsetX, offsetY, hexToRgb(brushColor));
       saveHistoryState();
       setHasDrawn(true);
       return;
    }

    setStartPos({ x: offsetX, y: offsetY });
    setIsDrawing(true);
    setHasDrawn(true);

    if (drawingMode === "pencil" || drawingMode === "eraser") {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX, offsetY);
    }
  };

  const drawShape = (ctx, startX, startY, endX, endY, mode) => {
    const width = endX - startX;
    const height = endY - startY;

    if (mode === "line") {
      ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    } else if (mode === "rect") {
      ctx.rect(startX, startY, width, height);
    } else if (mode === "circle") {
      const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    } else if (mode === "triangle") {
      ctx.moveTo(startX + width / 2, startY); ctx.lineTo(endX, endY); ctx.lineTo(startX, endY); ctx.closePath();
    } else if (mode === "diamond") {
      ctx.moveTo(startX + width / 2, startY); ctx.lineTo(endX, startY + height / 2); ctx.lineTo(startX + width / 2, endY); ctx.lineTo(startX, startY + height / 2); ctx.closePath();
    } else if (mode === "parallelogram") {
      const skew = width * 0.25;
      ctx.moveTo(startX + skew, startY); ctx.lineTo(endX, startY); ctx.lineTo(endX - skew, endY); ctx.lineTo(startX, endY); ctx.closePath();
    } else if (mode === "arrow") {
      const headlen = Math.max(15, brushSize * 3);
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
      ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
    } 
    // --- DYNAMIC GRAPH DRAWING SYSTEM ---
    else if (mode === "histogram") {
      const maxVal = Math.max(...graphData, 1);
      const numBars = graphData.length;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX, endY); // Y-Axis
      ctx.lineTo(endX, endY);   // X-Axis
      ctx.stroke();

      const availableWidth = Math.abs(width) * 0.9;
      const startOffsetX = Math.min(startX, endX) + (Math.abs(width) * 0.05);
      const actualEndY = Math.max(startY, endY);
      const actualHeight = Math.abs(height);
      
      const barSpacing = availableWidth / numBars;
      const barWidth = barSpacing * 0.7; 
      
      ctx.fillStyle = brushColor;
      
      graphData.forEach((val, i) => {
         const barHeight = (val / maxVal) * (actualHeight * 0.85); 
         const x = startOffsetX + (i * barSpacing) + (barSpacing * 0.15);
         const y = actualEndY - barHeight;
         
         ctx.fillRect(x, y, barWidth, barHeight);
      });
    }
    // --- NEW: DYNAMIC PIE CHART SYSTEM ---
    else if (mode === "pie") {
      const total = graphData.reduce((acc, val) => acc + val, 0);
      if (total === 0) return;

      const centerX = startX + width / 2;
      const centerY = startY + height / 2;
      const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
      
      // Professional Color Palette matching the brush color as primary
      const colors = [brushColor, '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#EA4335', '#34A853']; 
      
      let currentAngle = -0.5 * Math.PI; // Start at the top (12 o'clock)
      
      graphData.forEach((val, i) => {
        const sliceAngle = (val / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.stroke(); 
        
        currentAngle += sliceAngle;
      });
    }
  };

  const draw = (e) => {
    if (e.touches && e.touches.length === 1) e.preventDefault();
    const { offsetX, offsetY } = getCoordinates(e.nativeEvent || e);

    if (activeText && isDraggingText) {
       setActiveText({ ...activeText, x: offsetX - dragOffset.x, y: offsetY - dragOffset.y });
       return;
    }
    if (activeText && isResizingText) {
       setActiveText({ 
          ...activeText, 
          width: Math.max(100, activeText.width + (offsetX - startPos.x)), 
          height: Math.max(50, activeText.height + (offsetY - startPos.y))
       });
       setStartPos({ x: offsetX, y: offsetY });
       return;
    }

    if (!isDrawing) return;

    if (drawingMode === "pencil" || drawingMode === "eraser") {
      ctxRef.current.lineTo(offsetX, offsetY);
      ctxRef.current.stroke();
    } else if (drawingMode !== "text" && drawingMode !== "fill") {
      const draftCtx = draftCtxRef.current;
      draftCtx.clearRect(0, 0, draftCanvasRef.current.width, draftCanvasRef.current.height);
      draftCtx.beginPath();
      drawShape(draftCtx, startPos.x, startPos.y, offsetX, offsetY, drawingMode);
      draftCtx.stroke();
    }
  };

  const stopDrawing = (e) => {
    if (isDraggingText || isResizingText) {
       setIsDraggingText(false); setIsResizingText(false); return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawingMode === "pencil" || drawingMode === "eraser") {
      ctxRef.current.closePath();
    } else if (drawingMode !== "text" && drawingMode !== "fill") {
      const { offsetX, offsetY } = getCoordinates(e.changedTouches ? e.changedTouches[0] : e.nativeEvent || e);
      const ctx = ctxRef.current;
      ctx.beginPath();
      drawShape(ctx, startPos.x, startPos.y, offsetX, offsetY, drawingMode);
      ctx.stroke();
      draftCtxRef.current.clearRect(0, 0, draftCanvasRef.current.width, draftCanvasRef.current.height);
    }
    
    if (drawingMode !== "text" && drawingMode !== "fill") saveHistoryState();
  };

  const saveHistoryState = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreCanvasFromDataUrl = (dataUrl) => {
    if (!canvasRef.current || !ctxRef.current) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (dataUrl) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0); };
      img.src = dataUrl;
    }
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      stampActiveText(); 
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      restoreCanvasFromDataUrl(history[newStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      stampActiveText();
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      restoreCanvasFromDataUrl(history[newStep]);
    }
  };

  const clearCanvas = () => {
    if(window.confirm("Clear entire drawing? This cannot be undone easily.")) {
        if (!ctxRef.current || !canvasRef.current) return;
        ctxRef.current.fillStyle = "#ffffff";
        ctxRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasDrawn(false);
        setActiveText(null);
        saveHistoryState();
    }
  };

  const handleAddSheet = () => {
    stampActiveText();
    const currentDrawing = canvasRef.current.toDataURL();
    setCanvasSize(prev => ({ ...prev, height: prev.height + 800 }));
    setTimeout(() => { restoreCanvasFromDataUrl(currentDrawing); }, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    stampActiveText(); 

    if (!submissionText.trim() && !hasDrawn) {
      return alert("Please type an answer or draw a diagram before submitting.");
    }
    
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const drawingData = hasDrawn ? canvasRef.current.toDataURL("image/png", 0.8) : null; 
      
      const newSubRef = push(ref(db, "submissions"));
      await set(newSubRef, {
        assignmentId: selectedAssignment.id,
        assignmentTitle: selectedAssignment.title,
        subjectId: subjectId,
        studentId: user.uid,
        studentName: studentName || "Student", 
        textAnswer: submissionText.trim() || "No text provided.",
        drawingImage: drawingData,
        status: "Pending",
        submittedAt: new Date().toISOString()
      });

      const notifRef = push(ref(db, "notifications"));
      await set(notifRef, {
        recipientId: selectedAssignment.teacherId, 
        title: "New Submission! 📝",
        message: `${studentName || "A student"} submitted an answer for '${selectedAssignment.title}'.`,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      alert("Assignment submitted successfully!");
      setSubmissionText("");
      setHasDrawn(false);
      setSelectedAssignment(null);
      setActiveTab("text");
    } catch (error) {
      alert("Error submitting assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DUE DATE LOGIC ---
  const getDaysRemaining = (dueDateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="p-10 text-xl font-bold text-[#0b3b60] animate-pulse">Loading Tasks...</div></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-[100dvh] bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      
      <div className="flex items-center gap-3 mb-8">
         <button onClick={() => navigate(-1)} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-[#0b3b60] dark:text-blue-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
         </button>
         <h2 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white tracking-tight">Assignment Portal</h2>
      </div>

      <div className="grid gap-6">
        {assignments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-sm text-center border border-gray-100 dark:border-gray-700">
             <span className="text-5xl opacity-30 mb-4 block">🎉</span>
             <p className="text-gray-500 font-medium">No pending assignments! You're all caught up.</p>
          </div>
        ) : (
          assignments.map(assign => {
            const daysLeft = getDaysRemaining(assign.dueDate);
            const isOverdue = daysLeft < 0;

            return (
              <motion.div whileHover={{ scale: 1.01 }} key={assign.id} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-l-8 border-[#0b3b60] dark:border-blue-600 transition-colors">
                <div className="flex justify-between items-start mb-3">
                   <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{assign.title}</h3>
                   <span className="bg-blue-50 text-[#0b3b60] dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold shrink-0">{assign.maxMarks} Pts</span>
                </div>
                
                <div className="text-gray-600 dark:text-gray-300 mt-4 bg-gray-50 dark:bg-gray-700/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-600">
                  <p className="font-bold text-xs mb-3 text-gray-400 uppercase tracking-widest">Questions to answer</p>
                  {assign.questions && assign.questions.length > 0 ? (
                    <ul className="list-decimal pl-5 space-y-2 text-sm font-medium">
                      {assign.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-gray-400">No specific questions provided. Check attachment.</p>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold flex items-center gap-1 ${isOverdue ? 'text-red-500' : daysLeft <= 2 ? 'text-yellow-600' : 'text-gray-500 dark:text-gray-400'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      {isOverdue ? 'Overdue' : daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft} days`} 
                      <span className="text-xs font-normal opacity-70 ml-1">({new Date(assign.dueDate).toLocaleDateString()})</span>
                    </span>
                  </div>
                  
                  {/* LOCK MECHANISM ENFORCED HERE */}
                  <button 
                    onClick={() => {
                       if(isOverdue) {
                          alert("You are late! The submission date has passed and this assignment is now locked.");
                       } else {
                          setSelectedAssignment(assign);
                       }
                    }}
                    className={`${isOverdue ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0b3b60] hover:bg-blue-800'} text-white px-8 py-3 rounded-xl font-bold transition-transform active:scale-95 w-full sm:w-auto text-center shadow-md flex justify-center items-center gap-2`}
                  >
                    <span>{isOverdue ? "🔒" : "✍️"}</span> {isOverdue ? "Locked" : "Open Canvas"}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* --- FULLSCREEN DRAWING / SUBMISSION MODAL --- */}
      <AnimatePresence>
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 z-[9999]">
          <motion.div 
             initial={{ y: 50, opacity: 0 }} 
             animate={{ y: 0, opacity: 1 }} 
             exit={{ y: 50, opacity: 0 }}
             className="bg-gray-100 dark:bg-gray-900 sm:rounded-[2rem] w-full max-w-[1400px] shadow-2xl flex flex-col overflow-hidden h-[100dvh] sm:h-[95vh] border border-gray-200 dark:border-gray-800 relative"
          >
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-950 shrink-0 shadow-sm z-20">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white truncate tracking-tight">{selectedAssignment.title}</h3>
              </div>
              <button onClick={() => { stampActiveText(); setSelectedAssignment(null); }} className="bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 w-10 h-10 rounded-full font-bold transition-colors flex shrink-0 items-center justify-center text-xl">✕</button>
            </div>

            <div className="p-3 bg-white dark:bg-gray-950 shrink-0 z-20 border-b border-gray-200 dark:border-gray-800 flex justify-center">
               <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full max-w-md shadow-inner">
                  <button 
                     onClick={() => { stampActiveText(); setActiveTab("text"); }} 
                     className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "text" ? "bg-white dark:bg-gray-600 text-[#0b3b60] dark:text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                  >
                     📝 Text Answer
                  </button>
                  <button 
                     onClick={() => setActiveTab("draw")} 
                     className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "draw" ? "bg-white dark:bg-gray-600 text-[#0b3b60] dark:text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
                  >
                     🎨 Drawing Sheet
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col relative bg-gray-200 dark:bg-gray-950">
              
              {/* TAB 1: TEXT EDITOR */}
              <div className={`${activeTab === "text" ? "flex" : "hidden"} h-full flex-col p-4 sm:p-6 overflow-y-auto`}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Answer Box</span>
                  </div>
                  <textarea
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    onPaste={(e) => { e.preventDefault(); alert("Pasting is strictly prohibited!"); }}
                    placeholder="Type your complete answer here..."
                    className="w-full h-full p-6 bg-transparent text-gray-900 dark:text-white outline-none resize-none text-base sm:text-lg custom-scrollbar leading-relaxed"
                  ></textarea>
                </div>
              </div>

              {/* TAB 2: PRO DRAWING TOOLKIT */}
              <div className={`${activeTab === "draw" ? "flex" : "hidden"} h-full w-full relative overflow-hidden flex-col sm:flex-row`}>
                
                {/* RESPONSIVE PRO TOOLBAR - Horizonatal on Mobile (Top), Vertical on Desktop (Left) */}
                <div className="flex sm:flex-col gap-2 p-2 sm:p-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl sm:shadow-2xl border-b sm:border-r border-gray-200 dark:border-gray-700 z-50 items-center overflow-x-auto sm:overflow-y-auto custom-scrollbar w-full sm:w-[85px] sm:h-full shrink-0">
                  
                  {/* Tool Toggles */}
                  <div className="flex sm:flex-col gap-1.5 w-auto sm:w-full items-center shrink-0">
                     <button onClick={() => {stampActiveText(); setDrawingMode("pencil"); setBrushColor(brushColor === "#ffffff" ? "#000000" : brushColor);}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "pencil" ? "bg-[#0b3b60] text-white shadow-md scale-105" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Pen">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("eraser"); setBrushColor("#ffffff");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "eraser" ? "bg-red-500 text-white shadow-md scale-105" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Eraser">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("fill");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all text-xl ${drawingMode === "fill" ? "bg-green-600 text-white shadow-md scale-105" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Fill Color (Paint Bucket)">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 11.725l-5.075-5.075q-.275-.275-.7-.275t-.7.275l-7.225 7.225q-.275.275-.275.7t.275.7l5.075 5.075q.275.275.7.275t.7-.275l7.225-7.225q.275-.275.275-.7t-.275-.7zm-7.9 4.375l-2.15-2.15l4.35-4.35l2.15 2.15l-4.35 4.35zm-8.45 4.9q-.425 0-.712-.287T2 19.999q0-.2.075-.412t.225-.387l1.7-1.7l1.425 1.425L4.4 20h12.775l-4-4h2.825l4 4q.425 0 .713.288T21 21q0 .425-.288.713T20 22H3z"/></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("text");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center font-black transition-all text-xl ${drawingMode === "text" ? "bg-[#0b3b60] text-white shadow-md scale-105" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Interactive Text Box">T</button>
                  </div>

                  <div className="w-px h-8 sm:w-12 sm:h-px bg-gray-200 dark:bg-gray-700 shrink-0 my-1"></div>

                  {/* Shapes Menu */}
                  <div className="flex sm:flex-col gap-1.5 w-auto sm:w-full items-center shrink-0">
                     <button onClick={() => {stampActiveText(); setDrawingMode("line");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "line" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Line">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("arrow");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "arrow" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Arrow">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("rect");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "rect" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Rectangle">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 4h16v16H4z"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("circle");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "circle" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Circle">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="2"></circle></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("triangle");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "triangle" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Triangle">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4L4 20h16L12 4z"></path></svg>
                     </button>
                     <button onClick={() => {stampActiveText(); setDrawingMode("parallelogram");}} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center font-black transition-all text-lg ${drawingMode === "parallelogram" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Parallelogram">▱</button>
                     
                     {/* HISTOGRAM GRAPH TRIGGER */}
                     <button onClick={() => {
                        stampActiveText(); 
                        const input = prompt("Enter graph values separated by commas (e.g. 20, 50, 30, 90):", graphData.join(", "));
                        if(input) {
                           const parsed = input.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                           if(parsed.length > 0) setGraphData(parsed);
                        }
                        setDrawingMode("histogram");
                     }} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "histogram" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Custom Histogram Graph">📊</button>
                     
                     {/* NEW: PIE CHART TRIGGER */}
                     <button onClick={() => {
                        stampActiveText(); 
                        const input = prompt("Enter pie chart slice values separated by commas (e.g. 30, 50, 20):", graphData.join(", "));
                        if(input) {
                           const parsed = input.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                           if(parsed.length > 0) setGraphData(parsed);
                        }
                        setDrawingMode("pie");
                     }} className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${drawingMode === "pie" ? "bg-gray-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Custom Pie Chart">🥧</button>
                  </div>

                  <div className="w-px h-8 sm:w-12 sm:h-px bg-gray-200 dark:bg-gray-700 shrink-0 my-1"></div>

                  {/* Colors & Size */}
                  <div className="flex sm:flex-col gap-3 w-auto sm:w-full items-center shrink-0">
                     <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300 shadow-sm relative shrink-0">
                        <input type="color" value={drawingMode === 'eraser' ? '#ffffff' : brushColor} onChange={(e) => { stampActiveText(); setBrushColor(e.target.value); if(drawingMode === "eraser") setDrawingMode("pencil"); }} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
                     </div>
                     <div className="flex sm:flex-col gap-1.5 items-center bg-gray-100 dark:bg-gray-900 p-1.5 rounded-xl shrink-0">
                        <button onClick={() => setBrushSize(2)} className={`w-8 h-8 flex items-center justify-center rounded-md ${brushSize === 2 ? "bg-gray-300 dark:bg-gray-700 shadow-sm" : ""}`}><div className="w-1 h-1 bg-black dark:bg-white rounded-full"></div></button>
                        <button onClick={() => setBrushSize(5)} className={`w-8 h-8 flex items-center justify-center rounded-md ${brushSize === 5 ? "bg-gray-300 dark:bg-gray-700 shadow-sm" : ""}`}><div className="w-2h-2 sm:w-2.5 sm:h-2.5 bg-black dark:bg-white rounded-full"></div></button>
                        <button onClick={() => setBrushSize(10)} className={`w-8 h-8 flex items-center justify-center rounded-md ${brushSize === 10 ? "bg-gray-300 dark:bg-gray-700 shadow-sm" : ""}`}><div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-black dark:bg-white rounded-full"></div></button>
                     </div>
                  </div>

                  <div className="w-px h-8 sm:w-12 sm:h-px bg-gray-200 dark:bg-gray-700 shrink-0 my-1"></div>

                  {/* Actions & Zoom */}
                  <div className="flex sm:flex-col gap-1.5 w-auto sm:w-full items-center shrink-0">
                     <button onClick={() => {stampActiveText(); handleUndo();}} disabled={historyStep <= 0} className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 flex justify-center items-center"><svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg></button>
                     
                     <div className="flex sm:flex-col bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden shadow-inner shrink-0">
                        <button onClick={handleZoomIn} className="w-8 h-10 sm:w-full sm:h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold">+</button>
                        <button onClick={handleZoomReset} className="w-10 h-10 sm:w-full sm:h-6 flex items-center justify-center text-[10px] font-black text-[#0b3b60] dark:text-blue-400">{Math.round(zoomLevel * 100)}%</button>
                        <button onClick={handleZoomOut} className="w-8 h-10 sm:w-full sm:h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold">-</button>
                     </div>
                     
                     <button onClick={() => {stampActiveText(); clearCanvas();}} className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 sm:mt-1 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex justify-center items-center"><svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                  </div>
                </div>

                {/* THE PROFESSIONAL WORKSPACE (Handles Panning via Scrollbars) */}
                <div 
                  ref={canvasContainerRef} 
                  className="relative w-full flex-1 overflow-auto bg-[#e5e7eb] dark:bg-[#0a0a0a] shadow-inner custom-scrollbar p-4 sm:p-10 flex justify-center items-start"
                  onPointerDown={(e) => {
                    if(e.target === canvasContainerRef.current) stampActiveText();
                  }}
                >
                  
                  {/* Floating Expand Canvas Button */}
                  <div className="absolute top-6 right-6 z-40">
                    <button onClick={handleAddSheet} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl p-3 sm:p-4 rounded-full transition-transform active:scale-95 flex items-center justify-center" title="Expand Sheet Downwards">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                    </button>
                  </div>

                  {/* The Drawing Paper */}
                  <div 
                    className="relative bg-white shadow-2xl transition-all border border-gray-300" 
                    style={{ 
                      width: `${canvasSize.width * zoomLevel}px`, 
                      height: `${canvasSize.height * zoomLevel}px`,
                      minWidth: `${canvasSize.width * zoomLevel}px`, 
                      minHeight: `${canvasSize.height * zoomLevel}px`
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <canvas
                      ref={draftCanvasRef}
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerOut={stopDrawing}
                      className={`absolute inset-0 z-10 w-full h-full touch-none ${drawingMode === 'text' ? 'cursor-text' : drawingMode === 'fill' ? 'cursor-alias' : drawingMode === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
                    />
                    
                    {/* INTERACTIVE DRAGGABLE & RESIZABLE TEXT BOX OVERLAY */}
                    {activeText && (
                       <div 
                         className="absolute z-50 border-2 border-blue-500 border-dashed bg-white/20 backdrop-blur-sm shadow-lg flex flex-col"
                         style={{
                             left: `${activeText.x * zoomLevel}px`,
                             top: `${activeText.y * zoomLevel}px`,
                             width: `${activeText.width * zoomLevel}px`,
                             height: `${activeText.height * zoomLevel}px`,
                         }}
                         onPointerDown={(e) => handleTextContainerPointerDown(e, 'drag')}
                       >
                         {/* Header Bar for Dragging */}
                         <div className="w-full h-4 bg-blue-500 flex justify-center items-center cursor-move rounded-t-sm">
                            <span className="text-[8px] text-white font-black uppercase tracking-widest">Drag</span>
                         </div>
                         
                         <textarea
                           ref={textInputRef}
                           value={activeText.value}
                           onChange={(e) => setActiveText({ ...activeText, value: e.target.value })}
                           placeholder="Type text here..."
                           className="flex-1 w-full bg-transparent outline-none p-1 resize-none overflow-hidden"
                           style={{
                             color: brushColor,
                             fontSize: `${activeText.fontSize * zoomLevel}px`,
                             fontFamily: "Arial",
                             lineHeight: 1.2
                           }}
                           onPointerDown={(e) => e.stopPropagation()} 
                         />
                         
                         {/* Resize Handle */}
                         <div 
                           className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 cursor-nwse-resize rounded-tl-full flex items-end justify-end p-0.5"
                           onPointerDown={(e) => handleTextContainerPointerDown(e, 'resize')}
                         >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                         </div>
                         
                         {/* Stamp Button */}
                         <button 
                            onClick={(e) => { e.stopPropagation(); stampActiveText(); }}
                            className="absolute -top-10 right-0 bg-green-500 text-white px-2 py-1 rounded shadow-md text-xs font-bold hover:bg-green-600"
                         >
                            Confirm (Stamp)
                         </button>
                       </div>
                    )}

                    {!hasDrawn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                        <span className="text-6xl mb-6">🎨</span>
                        <span className="text-gray-500 font-black text-3xl tracking-widest uppercase">Canvas Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Submit Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-white dark:bg-gray-950 shrink-0 z-20">
              <button onClick={() => { stampActiveText(); setSelectedAssignment(null); }} className="px-6 py-4 sm:py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors w-full sm:w-auto">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-4 sm:py-3 bg-[#0b3b60] hover:bg-blue-800 text-white font-black rounded-xl shadow-lg disabled:opacity-50 transition-transform active:scale-95 w-full sm:w-auto text-lg flex justify-center items-center gap-2">
                {isSubmitting ? "Uploading..." : "🚀 Submit Work"}
              </button>
            </div>

          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}