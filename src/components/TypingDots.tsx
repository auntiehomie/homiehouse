export default function TypingDots({ label = 'Ask Homie is thinking' }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="hh-typing-indicator">
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
    </span>
  );
}
