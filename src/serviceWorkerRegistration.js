import { buildApiUrl, getAuthToken } from "./services/apiClient";

const SERVICE_WORKER_URL = `${process.env.PUBLIC_URL || ""}/service-worker.js`;

export function register() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SERVICE_WORKER_URL).catch(() => {});
  });
}

export function unregister() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.ready.then((registration) => registration.unregister()).catch(() => {});
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidPublicKey() {
  try {
    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(buildApiUrl("/api/push/vapid-public-key"), { headers });
    if (!response.ok) return null;
    const data = await response.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

async function sendSubscriptionToServer(subscription) {
  try {
    const token = getAuthToken();
    if (!token) return;
    await fetch(buildApiUrl("/api/push/subscribe"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription }),
    });
  } catch {
    // silently fail
  }
}

export async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await fetchVapidPublicKey();

    if (!vapidPublicKey) {
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    await sendSubscriptionToServer(subscription);
    return true;
  } catch (err) {
    console.warn("[PUSH] Falha ao registrar push notifications:", err.message);
    return false;
  }
}

export async function unsubscribeFromPushNotifications() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      const token = getAuthToken();
      if (token) {
        await fetch(buildApiUrl("/api/push/unsubscribe"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }
  } catch {
    // silently fail
  }
}
