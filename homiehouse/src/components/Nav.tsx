import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav>
      <Link to="/">Home</Link> | <Link to="/feed">Feed</Link> | <Link to="/compose">Compose</Link> | <Link to="/settings">Settings</Link> | <Link to="/dev">Dev</Link>
    </nav>
  );
}
