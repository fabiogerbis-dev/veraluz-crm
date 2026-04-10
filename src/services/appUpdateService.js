const MANIFEST_URL = `${process.env.PUBLIC_URL || ""}/asset-manifest.json`;
const CHECK_INTERVAL_MS = 60000;

function getManifestUrl() {
  const manifestUrl = new URL(MANIFEST_URL, window.location.origin);
  manifestUrl.searchParams.set("t", Date.now().toString());
  return manifestUrl.toString();
}

async function readBuildKey() {
  const response = await fetch(getManifestUrl(), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível verificar a versão publicada.");
  }

  const manifest = await response.json();
  const files = manifest?.files || {};

  return JSON.stringify({
    mainJs: files["main.js"] || "",
    mainCss: files["main.css"] || "",
  });
}

export function startAppVersionMonitor() {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined") {
    return () => {};
  }

  let disposed = false;
  let currentBuildKey = "";
  let intervalId = null;

  const checkForUpdates = async () => {
    if (disposed) {
      return;
    }

    try {
      const nextBuildKey = await readBuildKey();

      if (!currentBuildKey) {
        currentBuildKey = nextBuildKey;
        return;
      }

      if (currentBuildKey !== nextBuildKey) {
        window.location.reload();
      }
    } catch (error) {
      // Ignore transient connectivity issues while checking for a new build.
    }
  };

  checkForUpdates();
  intervalId = window.setInterval(checkForUpdates, CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", checkForUpdates);

  return () => {
    disposed = true;

    if (intervalId) {
      window.clearInterval(intervalId);
    }

    document.removeEventListener("visibilitychange", checkForUpdates);
  };
}
