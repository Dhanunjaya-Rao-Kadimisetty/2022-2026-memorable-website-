self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Birthday Alert!', body: 'Someone in the batch has a birthday today!' };

  const options = {
    body: data.body,
    icon: '/favicon.ico', // Update with a better icon if available
    badge: '/favicon.ico',
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
