'use client';

// Select a concrete scene only when the card describes its subject.
export function lessonIllustrationTopic(text: string): 'reentrancy' | 'restaurant' | 'multisig' | 'seed' | 'flash-loan' | 'agent-loop' | 'trader' | 'menu' | null {
  if (/restaurant menu|menu with|page menu/i.test(text)) return 'menu';
  if (/trader/i.test(text) && /market|price/i.test(text)) return 'trader';
  if (/perceive.decide.act|agent/i.test(text) && /observ|perceiv/i.test(text) && /decid|evaluat/i.test(text) && /execut|act/i.test(text)) return 'agent-loop';
  if (/waiter|restaurant/i.test(text) && /bill/i.test(text)) return 'restaurant';
  if (/flash[ -]?loan/i.test(text)) return 'flash-loan';
  if (/multisig|multi.signature|multiple approvals/i.test(text)) return 'multisig';
  if (/seed phrase|recovery phrase/i.test(text)) return 'seed';
  if (/reentran|repeatedly calling the withdraw/i.test(text)) return 'reentrancy';
  return null;
}

export default function LessonIllustration({ text }: { text: string }) {
  const scene = lessonIllustrationTopic(text);
  if (!scene) return null;
  return (
    <div className="lesson-scene" aria-hidden="true">
      <style>{`
        .lesson-scene { display:flex; justify-content:center; padding:10px 0; }
        .lesson-scene svg { width:min(280px, 95%); height:auto; }
        .lesson-scene .moving { animation:lesson-scene-move 2s ease-in-out infinite alternate; }
        .lesson-scene .owl { animation:lesson-owl-bob 2.8s ease-in-out infinite alternate; transform-origin:center; }
        @keyframes lesson-owl-bob { to { transform:translateY(-5px) } }
        @keyframes lesson-scene-move { to { transform:translateX(10px) } }
        @media (prefers-reduced-motion:reduce) { .lesson-scene .moving, .lesson-scene .owl { animation:none } }
        @media (max-height:600px) { .lesson-scene svg { width:min(210px, 75%) } }
      `}</style>
      <svg viewBox="0 0 300 150" focusable="false">
        <rect x="4" y="7" width="292" height="136" rx="24" fill="rgba(99,102,241,.10)" />
        <g className="owl" transform="translate(7 7)">
          <path d="M7 22 Q8 8 17 10 L18 4 L25 10 Q32 8 39 10 L45 4 L46 10 Q56 13 56 26 Q54 43 32 43 Q9 43 7 29Z" fill="#8b83ef" />
          <circle cx="23" cy="23" r="8" fill="white"/><circle cx="40" cy="23" r="8" fill="white"/>
          <circle cx="25" cy="23" r="3" fill="#252053"/><circle cx="38" cy="23" r="3" fill="#252053"/>
          <path d="M28 29h7l-3.5 5Z" fill="#fbbf24" />
        </g>
        {(scene === 'agent-loop' || scene === 'trader') && <>
          <rect x="14" y="51" width="79" height="45" rx="10" fill="#8176e8" />
          <text x="54" y="70" textAnchor="middle" fill="white" fontSize="10">{scene === 'trader' ? 'MARKET' : 'OBSERVE'}</text>
          <text x="54" y="85" textAnchor="middle" fill="white" fontSize="9">{scene === 'trader' ? 'PRICES' : 'CHAIN DATA'}</text>
          <rect x="111" y="51" width="78" height="45" rx="10" fill="#34d399" />
          <text x="150" y="77" textAnchor="middle" fill="#064e3b" fontSize="11">DECIDE</text>
          <rect x="207" y="51" width="79" height="45" rx="10" fill="#8176e8" />
          <text x="246" y="70" textAnchor="middle" fill="white" fontSize="10">{scene === 'trader' ? 'TRADE' : 'ACT'}</text>
          <text x="246" y="85" textAnchor="middle" fill="white" fontSize="9">{scene === 'trader' ? 'BUY / SELL' : 'TRANSACT'}</text>
          <g className="moving" fill="none" stroke="#ddd6fe" strokeWidth="3"><path d="M95 73h13m-5-5 5 5-5 5M191 73h13m-5-5 5 5-5 5" /></g>
          <text x="150" y="123" textAnchor="middle" fill="#d5d2fc" fontSize="10">{scene === 'trader' ? 'Watch prices, decide, trade' : 'Observe, decide, then act'}</text>
        </>}
        {scene === 'menu' && <>
          <rect x="54" y="48" width="66" height="57" rx="6" fill="#34d399" />
          <path d="M65 62h44M65 73h35M65 84h41" stroke="#064e3b" strokeWidth="3" />
          <rect x="180" y="34" width="66" height="78" rx="6" fill="#8176e8" />
          <path d="M190 47h46M190 57h46M190 67h46M190 77h46M190 87h46M190 97h46" stroke="#eeeaff" strokeWidth="3" />
          <text x="87" y="126" textAnchor="middle" fill="#d5d2fc" fontSize="10">Simple menu</text>
          <text x="213" y="126" textAnchor="middle" fill="#d5d2fc" fontSize="10">Complex menu</text>
          <path className="moving" d="M128 75h37m-7-7 7 7-7 7" fill="none" stroke="#ddd6fe" strokeWidth="3" />
        </>}
        {(scene === 'reentrancy' || scene === 'restaurant') && <>
          <rect x="25" y="44" width="76" height="58" rx="12" fill="#8176e8" />
          <text x="63" y="70" textAnchor="middle" fill="white" fontSize="12">{scene === 'restaurant' ? 'BILL' : 'CONTRACT'}</text>
          <path d="M37 81h50" stroke="#dcd8ff" strokeWidth="3" />
          <circle cx="233" cy="73" r="30" fill="#34d399" />
          <text x="233" y="80" textAnchor="middle" fill="#064e3b" fontSize="22">$</text>
          <g className="moving" fill="none" stroke="#b5afff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M113 57h69m-9-8 9 8-9 8" /><path d="M182 93h-69m9-8-9 8 9 8" />
          </g>
          <text x="150" y="125" textAnchor="middle" fill="#d5d2fc" fontSize="11">{scene === 'restaurant' ? 'Paid before the bill is final' : 'Withdraw called again'}</text>
        </>}
        {scene === 'flash-loan' && <>
          <rect x="16" y="49" width="71" height="49" rx="10" fill="#8176e8" /><text x="51" y="78" textAnchor="middle" fill="white" fontSize="12">BORROW</text>
          <rect x="114" y="49" width="71" height="49" rx="10" fill="#34d399" /><text x="149" y="78" textAnchor="middle" fill="#064e3b" fontSize="12">SWAP</text>
          <rect x="212" y="49" width="71" height="49" rx="10" fill="#8176e8" /><text x="247" y="78" textAnchor="middle" fill="white" fontSize="12">REPAY</text>
          <g className="moving" fill="none" stroke="#d5d2fc" strokeWidth="3"><path d="M89 73h20m-6-6 6 6-6 6M187 73h20m-6-6 6 6-6 6" /></g>
          <text x="150" y="122" textAnchor="middle" fill="#d5d2fc" fontSize="11">All in one transaction</text>
        </>}
        {(scene === 'multisig' || scene === 'seed') && <>
          <rect x="108" y="35" width="84" height="78" rx="12" fill="#8176e8" />
          <path d="M130 68V60a20 20 0 0 1 40 0v8" fill="none" stroke="#fff" strokeWidth="5" /><rect x="126" y="68" width="48" height="31" rx="6" fill="#34d399" />
          {scene === 'multisig' ? <>
            {[44, 70, 230, 256].map((x) => <g key={x}><circle cx={x} cy="75" r="10" fill="#34d399" /><path d={`M${x-4} 75l3 3 6-6`} fill="none" stroke="#064e3b" strokeWidth="2" /></g>)}
            <text x="150" y="130" textAnchor="middle" fill="#d5d2fc" fontSize="11">Multiple approvals protect a transaction</text>
          </> : <>
            <rect x="29" y="47" width="53" height="48" rx="5" fill="#f5f3ff" /><path d="M39 60h32M39 70h32M39 80h24" stroke="#8176e8" strokeWidth="3" />
            <text x="150" y="130" textAnchor="middle" fill="#d5d2fc" fontSize="11">Keep the recovery phrase offline</text>
          </>}
        </>}
      </svg>
    </div>
  );
}
