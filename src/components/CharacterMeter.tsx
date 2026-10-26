interface CharacterMeterProps {
  count: number;
  limit: number;
}

export default function CharacterMeter({ count, limit }: CharacterMeterProps) {
  const remaining = limit - count;
  const progress = Math.min(1, Math.max(0, count / limit));
  const tone = remaining < 0 ? 'over' : remaining <= 20 ? 'warning' : 'normal';
  return (
    <span className="hh-character-meter" data-tone={tone} role="img"
      aria-label={remaining >= 0 ? `${remaining} characters remaining before long cast` : `${-remaining} characters into long cast`}
      title={remaining >= 0 ? `${remaining} characters remaining` : 'Long cast'}>
      <span className="hh-character-meter-number" aria-hidden="true">{remaining >= 0 ? remaining : 'Long cast'}</span>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="hh-character-track" cx="16" cy="16" r="12" fill="none" strokeWidth="3" />
        <circle className="hh-character-progress" cx="16" cy="16" r="12" fill="none" strokeWidth="3"
          pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100}
          strokeLinecap="round" transform="rotate(-90 16 16)" />
      </svg>
    </span>
  );
}
