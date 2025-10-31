import { useSankhya } from "@/contexts/sankhya-context.tsx";

import reactLogo from "@/assets/react.svg";
import viteLogo from "@/assets/vite.svg";
import sankhyaLogo from "@/assets/sankhya.svg";
import logo from "@/assets/logo.svg";

function App() {
  // Get the Sankhya service
  const sankhya = useSankhya();

  /**
   * This function is called when the button is clicked.
   * It will trigger the 'removeFrame' logic.
   */
  const handleLaunchApp = () => {
    // Check if we are really inside the Sankhya environment
    // by looking for an element unique to it.
    const isSankhyaEnv =
      window.parent.parent.document.querySelector(".Taskbar-container");

    if (isSankhyaEnv) {
      // PRODUCTION: We are inside Sankhya. Call the function.
      // This will replace the widget with a full-screen iframe
      // pointing to 'app.jsp'.
      sankhya.removeFrame({
        instance: "BOILERPLATE_SANKHYA_REACT_VITE", // You can name your instance
        initialPage: "index.jsp",
      });
    } else {
      // DEVELOPMENT: We are on 'localhost'.
      // Calling removeFrame() here would cause an error.
      alert(
        "DEV MODE: This button would launch the full-screen Sankhya app. " +
          "sankhya.removeFrame() was not called."
      );
      console.warn(
        "sankhya.removeFrame() was not called. Not in Sankhya environment."
      );
    }
  };

  return (
    <>
      <div className="header">
        <img src={logo} className="logo-header" alt="Logo" />
        <div className="card-logos">
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
          <a href="https://sankhya.com.br" target="_blank">
            <img
              src={sankhyaLogo}
              className="logo sankhya"
              alt="Sankhya logo"
            />
          </a>
        </div>
      </div>
      <h1>Vite + React + Sankhya</h1>
      <div className="card">
        <button onClick={handleLaunchApp}>Launch Fullscreen App</button>
        <p>Click the button to load the main application.</p>
      </div>
      <p className="read-the-docs">
        Click on the Vite, React and Sankhya logos to learn more
      </p>
    </>
  );
}

export default App;
