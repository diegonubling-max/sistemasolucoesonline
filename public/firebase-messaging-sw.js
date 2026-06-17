importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC8tvbCAprMg1rRJcluwd6nvYjzEhqtFlE",
  authDomain: "solucoes-online.firebaseapp.com",
  projectId: "solucoes-online",
  storageBucket: "solucoes-online.firebasestorage.app",
  messagingSenderId: "548326438424",
  appId: "1:548326438424:web:dc673897b2d57a2078756d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'Notificação';
  const body = payload?.notification?.body || payload?.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
  });
});
