interface CharacterMeterProps {
  count: number;
  limit: number;
  unit?: string;
  overflowLabel?: string;
}

export default function CharacterMeter({ count, limit, unit = 'characters', overflowLabel = 'Long cast' }: CharacterMeterProps) {
  const remaining = limit - count;
  const progress = Math.min(1, Math.max(0, count / limit));
  const tone = remaining < 0 ? 'over' : remaining <= 20 ? 'warning' : 'normal';
  return (
    <span className="hh-character-meter" data-tone={tone} role="img"
      aria-label={remaining >= 0 ? `${remaining} ${unit} remaining before ${overflowLabel}` : `${-remaining} ${unit} beyond the single-post limit`}
      title={remaining >= 0 ? `${remaining} ${unit} remaining` : overflowLabel}>
      <span className="hh-character-meter-number" aria-hidden="true">{remaining >= 0 ? remaining : overflowLabel}</span>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="hh-character-track" cx="16" cy="16" r="12" fill="none" strokeWidth="3" />
        <circle className="hh-character-progress" cx="16" cy="16" r="12" fill="none" strokeWidth="3"
          pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100}
          strokeLinecap="round" transform="rotate(-90 16 16)" />
      </svg>
    </span>
  );
}
