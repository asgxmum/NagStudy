import { useEffect, useRef, useState } from "react";

// Two-frame eye-blink for the coach portraits: shows the open `src`, then briefly
// swaps to the eyes-closed `blink` frame every few seconds so the face feels alive.
// Falls back to the static open image when no blink frame is given, and stays open
// (no animation) when the user prefers reduced motion.
export default function BlinkFace({ src, blink, alt = "", style, className }) {
  const [closed, setClosed] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!blink) return;
    // Respect reduced-motion: keep the eyes open and skip the timer loop.
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    // Preload the blink frame so the first blink doesn't flash an unloaded image.
    const pre = new Image();
    pre.src = blink;

    let alive = true;

    // One blink = eyes shut ~140ms, then open. Optionally chain a quick second
    // blink (double-blink) so it reads as a deliberate, lively motion you can't miss.
    const blinkOnce = (then) => {
      setClosed(true);
      timer.current = setTimeout(() => {
        if (!alive) return;
        setClosed(false);
        timer.current = setTimeout(() => alive && then(), 120);
      }, 140);
    };

    const loop = () => {
      // Next blink in ~1.6–4s — frequent enough to notice, still natural.
      const wait = 1600 + Math.random() * 2400;
      timer.current = setTimeout(() => {
        if (!alive) return;
        // ~30% of the time, blink twice in a row for character.
        if (Math.random() < 0.3) blinkOnce(() => blinkOnce(loop));
        else blinkOnce(loop);
      }, wait);
    };
    loop();

    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [blink]);

  return (
    <img
      src={closed && blink ? blink : src}
      alt={alt}
      style={style}
      className={className}
    />
  );
}
