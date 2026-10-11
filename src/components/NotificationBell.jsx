import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { ref, query, orderByChild, equalTo, onValue, update } from "firebase/database";
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useNavigate } from "react-router-dom";

export default function NotificationBell({ direction = "down" }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate(); 
  
  const isInitialLoad = useRef(true);
  const seenNotifIds = useRef(new Set());

  useEffect(() => {
    const setupNativeNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }

          // Native Android Channel with High Importance (5) for sound and banners
          await LocalNotifications.createChannel({
            id: 'campus_alerts_v3',
            name: 'Campus Alerts',
            description: 'High priority alerts with sound and vibration',
            importance: 5,
            visibility: 1,
            vibration: true,
            sound: 'default'
          });
        } catch (e) {
          console.warn("Local Notifications not supported or permission denied", e);
        }
      }
    };
    setupNativeNotifications();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const notifRef = query(ref(db, "notifications"), orderByChild("recipientId"), equalTo(user.uid));
    
    const unsubscribe = onValue(notifRef, async (snapshot) => {
      const data = [];
      let unread = 0;
      let newlyAdded = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
          const notif = { id: childSnap.key, ...childSnap.val() };
          data.push(notif);
          if (!notif.read) unread++;

          if (!isInitialLoad.current && !seenNotifIds.current.has(notif.id) && !notif.read) {
            newlyAdded.push(notif);
          }
          seenNotifIds.current.add(notif.id);
        });
      }
      
      if (newlyAdded.length > 0 && Capacitor.isNativePlatform()) {
        try {
          const nativeAlerts = newlyAdded.map((notif, index) => ({
            id: Math.floor(Math.random() * 100000) + index, 
            title: notif.title || "CampusPro Alert",
            body: notif.message,
            channelId: 'campus_alerts_v3',
            schedule: { at: new Date(Date.now() + 100) },
            smallIcon: "ic_stat_icon_config_sample"
          }));
          await LocalNotifications.schedule({ notifications: nativeAlerts });
        } catch (error) {
          console.error("Failed to trigger native Android notification:", error);
        }
      }

      isInitialLoad.current = false;
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(data);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = async () => {
    setIsOpen(!isOpen);
    
    if (!isOpen && unreadCount > 0) {
      const updates = {};
      notifications.forEach(notif => {
        if (!notif.read) updates[`notifications/${notif.id}/read`] = true;
      });
      try {
        await update(ref(db), updates);
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  const handleDeleteNotification = async (e, notifId) => {
    e.stopPropagation(); 
    try {
      await update(ref(db), { [`notifications/${notifId}`]: null });
    } catch (err) {
      console.error("Failed to delete notification", err);
      alert("Failed to delete notification.");
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await update(ref(db, `notifications/${notif.id}`), { read: true });
    }

    setIsOpen(false); 

    if (notif.type === "notice") {
      if (notif.link && notif.link.trim() !== "") {
        window.open(notif.link, "_blank", "noopener,noreferrer");
      } else if (notif.subjectId) {
        navigate(`/student/notices/${notif.subjectId}`);
      }
    } else if (notif.type === "assignment" && notif.subjectId) {
      navigate(`/student/assignments/${notif.subjectId}`);
    }
  };

  return (
    <div ref={dropdownRef}>
      <button 
        onClick={handleToggle} 
        className="relative p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed top-24 left-1/2 transform -translate-x-1/2 w-[92vw] max-w-[360px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[999999]"
        >
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-wider">Notifications</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold text-lg">✕</button>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-40">
                <span className="text-4xl block mb-3 opacity-50">📭</span>
                <p className="text-sm font-medium">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${!notif.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""} relative group text-left block w-full`}
                  >
                    <button 
                      onClick={(e) => handleDeleteNotification(e, notif.id)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-red-900/30 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 z-10"
                      title="Delete Notification"
                    >
                      ✕
                    </button>

                    <h4 className="text-sm font-bold text-gray-900 dark:text-white pr-6">{notif.title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed pr-2">{notif.message}</p>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block mt-2">
                      {new Date(notif.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}