import { initializeApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC8tvbCAprMg1rRJcluwd6nvYjzEhqtFlE",
  authDomain: "solucoes-online.firebaseapp.com",
  projectId: "solucoes-online",
  storageBucket: "solucoes-online.firebasestorage.app",
  messagingSenderId: "548326438424",
  appId: "1:548326438424:web:dc673897b2d57a2078756d",
};

export const app = initializeApp(firebaseConfig);

export const VAPID_KEY =
  "BIG4YxBu-_as8AlnCLy9rfGChY4sKitvsXW7oV5hziZ6Q8M-JgqC0-VuCTElQ_SO5rG0Piw5VVgkcgAtfFehgBs";

let _messaging: Messaging | null = null;
export function getMessagingSafe(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
  if (_messaging) return _messaging;
  try {
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}
