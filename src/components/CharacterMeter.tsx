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
      <span className="hh-character-track" aria-hidden="true">
        <span className="hh-character-progress" style={{
          transform: `scaleX(${progress})`,
          backgroundColor: `hsl(${120 * (1 - progress)}, 75%, 48%)`,
        }} />
      </span>
    </span>
  );
}
