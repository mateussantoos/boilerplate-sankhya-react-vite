import { useState } from "react";

import reactLogo from "@/assets/react.svg";
import viteLogo from "@/assets/vite.svg";
import sankhyaLogo from "@/assets/sankhya.svg";
import logo from "@/assets/logo.svg";

function App() {
  const [count, setCount] = useState(0);

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
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/app/app.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite, React and Sankhya logos to learn more
      </p>
    </>
  );
}

export default App;
