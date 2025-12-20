import { useParams } from "react-router-dom";

export default function Profile() {
  const { address } = useParams();

  return (
    <section>
      <h2>Profile</h2>
      <p>Address: {address}</p>
      <p>Profile data will be loaded here.</p>
    </section>
  );
}
