import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <Alert
      severity="warning"
      icon={<WifiOffRoundedIcon fontSize="small" />}
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
        justifyContent: "center",
        py: 0.5,
        fontSize: "0.825rem",
      }}
    >
      Você está offline. Mudanças serão sincronizadas quando a conexão voltar.
    </Alert>
  );
}

export default OfflineBanner;
