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
