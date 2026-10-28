import { useState } from "react";

const Settings = () => {
  const [currentTheme, setCurrentTheme] = useState('default');

  const themes = ["default", "Cypherpunk", "Spring", "Summer", "Winter", "Urban"];

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    // Logic to apply the theme to the application
  };

  return (
    <section>
      <h2>Settings</h2>
      <p>App settings and preferences.</p>
      <div className="theme-selector">
        <label htmlFor="theme-selector">Select Theme:</label>
        <select id="theme-selector" onChange={(e) => handleThemeChange(e.target.value)} value={currentTheme}>
          {themes.map(theme => (
            <option key={theme} value={theme}>{theme}</option>
          ))}
        </select>
      </div>
    </section>
  );
};

export default Settings;