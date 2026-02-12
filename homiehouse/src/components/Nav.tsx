import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <span className="nav-sep"> | </span>
      <Link to="/feed">Feed</Link>
      <span className="nav-sep"> | </span>
      <Link to="/compose">Compose</Link>
      <span className="nav-sep"> | </span>
      <Link to="/settings">Settings</Link>
      <span className="nav-sep"> | </span>
      <Link to="/dev">Dev</Link>
    </nav>
  );
}
