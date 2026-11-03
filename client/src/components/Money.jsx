import { useEffect, useRef, useState } from 'react';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Eases the shown value from the previous one to `target` over 600 ms.
function useCountUp(target, enabled) {
  const animated = enabled && !reduceMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!animated) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (now) => {
      const p = Math.min((now - start) / 600, 1);
      const v = a + (target - a) * (1 - (1 - p) ** 3);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animated]);
  return animated ? shown : target;
}

// A peso amount set like a price tag: small ₱, bold pesos, small centavos.
// Display only: `cents` is the stored integer; the shown value is rounded back to whole centavos.
export default function Money({ cents, sign = '', animate = false, className = '' }) {
  const value = Math.round(useCountUp(cents, animate));
  const abs = Math.abs(value);
  return (
    <span className={`money ${className}`}>
      {sign || (value < 0 ? '−' : '')}
      <span className="cur">₱</span>
      {Math.floor(abs / 100).toLocaleString('en-PH')}
      <span className="cents">.{String(abs % 100).padStart(2, '0')}</span>
    </span>
  );
}
