import { useSankhya } from "@/contexts/sankhya-context.tsx";

import reactLogo from "@/assets/react.svg";
import viteLogo from "@/assets/vite.svg";
import sankhyaLogo from "@/assets/sankhya.svg";
import logo from "@/assets/logo.svg";
import { useState } from "react";

function App() {
  // Get the Sankhya service
  const sankhya = useSankhya();
  const [userInfo, setUserInfo] = useState<string>("");
  const [products, setProducts] = useState<any[]>([]);
  const [showContent, setShowContent] = useState<boolean>(false);

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

  /**
   * Handles the action of consulting the current user info.
   * Checks if the app is running inside the Sankhya environment, then retrieves user info from the global object.
   * If user info is found, sets the local userInfo and shows the content area.
   * If not in Sankhya or info not found, alerts or logs a warning.
   */
  const handleConsultUser = () => {
    const isSankhyaEnv =
      window.parent?.parent?.document?.querySelector(".Taskbar-container");
    if (!isSankhyaEnv) {
      alert("DEV MODE: Not running inside Sankhya environment.");
      return;
    }

    // Get the user info from the global object
    const info = window.sankhyaUserInfo;
    if (info && (info.name || info.id)) {
      // Set the user info in the local state
      setUserInfo(
        `${String(info.name ?? "")}${info.id ? ` (ID: ${info.id})` : ""}`
      );
      // Show the content area
      setShowContent(true);
    } else {
      console.warn("SANKHYA_USER_INFO not available.");
      // Set the user info in the local state
      setUserInfo("");
    }
  };

  /**
   * Handles the action of consulting products in Sankhya.
   * Verifies Sankhya environment, executes a query to get products, updates state with results.
   * If not in Sankhya, alerts the user.
   */
  const handleConsultProducts = async () => {
    const isSankhyaEnv =
      window.parent?.parent?.document?.querySelector(".Taskbar-container");
    // Check if the app is running inside the Sankhya environment
    if (!isSankhyaEnv) {
      alert("DEV MODE: Not running inside Sankhya environment.");
      return;
    }

    // Execute the query to get products
    const products = await sankhya.executeQuery(
      "SELECT TOP 10 CODPROD, DESCRPROD FROM TGFPRO ORDER BY CODPROD ASC"
    );
    // Set the products in the local state
    setProducts(products);
    // Show the content area
    if (products && products.length) setShowContent(true);
  };

  return (
    <>
      {showContent && (
        <div className="welcome-card">
          <h2 className="welcome-title">
            Bem-vindo{userInfo ? ", " : ""}
            {userInfo}
          </h2>
          <p className="welcome-subtitle">
            Explore seus dados do Sankhya abaixo
          </p>
        </div>
      )}
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
        <div className="card-buttons">
          <button onClick={handleLaunchApp}>Launch Fullscreen App</button>
          <button onClick={handleConsultUser}>
            Search User Only In Sankhya
          </button>
          <button onClick={handleConsultProducts}>
            Search Products In Sankhya
          </button>
        </div>
        <p>Click the button to load the main application.</p>
      </div>

      {showContent && products.length > 0 && (
        <div className="table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => (
                <tr key={idx}>
                  <td>{product.CODPROD}</td>
                  <td>{product.DESCRPROD}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="read-the-docs">
        Click on the Vite, React and Sankhya logos to learn more
      </p>
    </>
  );
}

export default App;
