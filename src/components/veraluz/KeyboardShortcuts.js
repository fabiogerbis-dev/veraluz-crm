import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function KeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
      if (!event.ctrlKey && !event.metaKey) return;

      switch (event.key.toLowerCase()) {
        case "n":
          event.preventDefault();
          navigate("/leads/new");
          break;
        case "k":
          event.preventDefault();
          navigate("/pipeline");
          break;
        case "b":
          event.preventDefault();
          navigate("/inbox");
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return null;
}

export default KeyboardShortcuts;
