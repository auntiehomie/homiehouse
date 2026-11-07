'use client';

/** A small, decorative visual cue chosen from the card's subject. */
export function lessonIllustrationTopic(text: string): 'security' | 'ai' | 'community' | 'money' | 'network' | 'ideas' {
  if (/secur|protect|privacy|phish|hack|encrypt|reentran|wallet|key\b/i.test(text)) return 'security';
  if (/\bai\b|artificial intelligence|agent|machine learning|model\b/i.test(text)) return 'ai';
  if (/\bdao\b|communit|creator|social|governance|vot(e|ing)/i.test(text)) return 'community';
  if (/defi|crypto|token|trad(e|ing)|financ|money|ethereum/i.test(text)) return 'money';
  if (/blockchain|decentrali|network|node|storage|rollup/i.test(text)) return 'network';
  return 'ideas';
}

export default function LessonIllustration({ text }: { text: string }) {
  const topic = lessonIllustrationTopic(text);
  const symbols = { security: '🔒', ai: '✦', community: '♥', money: '◈', network: '●', ideas: '✧' };
  return (
    <div aria-hidden="true" className="lesson-illustration">
      <style>{`
        .lesson-illustration { display:flex; justify-content:center; padding:8px 0; }
        .lesson-illustration svg { width:min(190px, 65%); height:auto; animation:lesson-bob 3.6s ease-in-out infinite; }
        @keyframes lesson-bob { 50% { transform:translateY(-6px) } }
        @media (prefers-reduced-motion:reduce) { .lesson-illustration svg { animation:none } }
        @media (max-height:600px) { .lesson-illustration svg { width:min(140px, 50%) } }
      `}</style>
      <svg viewBox="0 0 220 150" focusable="false">
        <circle cx="110" cy="75" r="65" fill="rgba(99,102,241,.12)" />
        <path d="M60 101 Q56 58 75 51 L76 35 L91 48 Q110 43 129 48 L144 35 L145 51 Q164 58 160 101 Q156 124 110 126 Q64 124 60 101Z" fill="#8b83ef" />
        <ellipse cx="91" cy="80" rx="17" ry="20" fill="#f5f3ff" /><ellipse cx="129" cy="80" rx="17" ry="20" fill="#f5f3ff" />
        <circle cx="94" cy="81" r="6" fill="#252053" /><circle cx="126" cy="81" r="6" fill="#252053" />
        <path d="M103 96 L117 96 L110 105Z" fill="#fbbf24" />
        <circle cx="166" cy="43" r="23" fill="#34d399" />
        <text x="166" y="51" textAnchor="middle" fontSize="24" fill="#064e3b">{symbols[topic]}</text>
        <circle cx="48" cy="51" r="3" fill="#a5b4fc" /><circle cx="178" cy="108" r="4" fill="#a5b4fc" />
      </svg>
    </div>
  );
}
