import { Link } from "react-router-dom";
import { useState } from "react";

export default function Nav() {
  const [currentTheme, setCurrentTheme] = useState('default');

  const themes = ["default", "Cypherpunk", "Spring", "Summer", "Winter", "Urban"];

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    // Logic to apply the new theme
  };

  return (
    <nav>
      <Link to="/">Home</Link> | <Link to="/feed">Feed</Link> | <Link to="/compose">Compose</Link> | <Link to="/settings">Settings</Link> | <Link to="/dev">Dev</Link>
      <div className="theme-selector">
        <label>Select Theme:</label>
        <select onChange={(e) => handleThemeChange(e.target.value)} value={currentTheme}>
          {themes.map(theme => (
            <option key={theme} value={theme}>{theme}</option>
          ))}
        </select>
      </div>
    </nav>
  );
}