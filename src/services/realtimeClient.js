import { buildApiUrl, getAuthToken } from "services/apiClient";

function resolveStreamUrl(path) {
  const streamUrl = buildApiUrl(path);

  if (/^https?:\/\//i.test(streamUrl)) {
    return new URL(streamUrl);
  }

  return new URL(streamUrl, window.location.origin);
}

export function createRealtimeConnection({ onUpdate, onOpen, onError } = {}) {
  if (typeof window === "undefined" || !("EventSource" in window)) {
    return null;
  }

  const token = getAuthToken();

  if (!token) {
    return null;
  }

  const streamUrl = resolveStreamUrl("/api/realtime/stream");
  streamUrl.searchParams.set("token", token);

  const eventSource = new window.EventSource(streamUrl.toString());

  const handleOpen = () => {
    if (typeof onOpen === "function") {
      onOpen();
    }
  };

  const handleUpdate = (event) => {
    if (typeof onUpdate !== "function") {
      return;
    }

    try {
      onUpdate(JSON.parse(event.data));
    } catch (error) {
      onUpdate(null);
    }
  };

  const handleError = (event) => {
    if (typeof onError === "function") {
      onError(event);
    }
  };

  eventSource.addEventListener("open", handleOpen);
  eventSource.addEventListener("crm:update", handleUpdate);
  eventSource.addEventListener("error", handleError);

  return {
    close() {
      eventSource.removeEventListener("open", handleOpen);
      eventSource.removeEventListener("crm:update", handleUpdate);
      eventSource.removeEventListener("error", handleError);
      eventSource.close();
    },
  };
}
