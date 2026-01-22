/* eslint-disable no-undef */
// firebase-app-compat expects window; define shim for SW scope
self.window = self;
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyATg9dObVyjoVMMOe6oo5SD3qMy0hL9w44',
  authDomain: 'kooli-haldus.firebaseapp.com',
  projectId: 'kooli-haldus',
  storageBucket: 'kooli-haldus.firebasestorage.app',
  messagingSenderId: '791386011340',
  appId: '1:791386011340:web:3561727f8bb02441503469',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Teavitus';
  const options = {
    body: payload.notification?.body || '',
    data: payload.data || {},
    icon: '/icons/icon-192.webp',
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.ticket_id ? `/my-tickets?ticket=${data.ticket_id}` : '/work';
  event.waitUntil(clients.openWindow(url));
});
