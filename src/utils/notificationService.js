import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export const sendNotification = async (recipientId, title, message) => {
  try {
    await addDoc(collection(db, "notifications"), {
      recipientId: recipientId,
      title: title,
      message: message,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error sending notification: ", error);
  }
};