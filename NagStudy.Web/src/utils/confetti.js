// Lightweight canvas confetti — zero dependencies.
// Call fireConfetti() to rain a burst of colourful pieces, then it cleans itself up.

const COLORS = ["#FF7A3D", "#FFD23F", "#3DDC84", "#FF6FA5", "#4EA8FF", "#B57EFF", "#35E0D0"];

export function fireConfetti() {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W, H;
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  resize();
  window.addEventListener("resize", resize);

  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.4,
    w: 7 + Math.random() * 7,
    h: 10 + Math.random() * 8,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    vx: (Math.random() - 0.5) * 2.2,
    vy: 2.5 + Math.random() * 3.5,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    sway: Math.random() * Math.PI * 2,
    life: 1,
  }));

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      p.vy += 0.03; // gravity
      p.rot += p.vr;
      if (p.y > H * 0.72) p.life -= 0.012; // fade near the bottom
      if (p.life <= 0) { pieces.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (pieces.length) {
      requestAnimationFrame(tick);
    } else {
      window.removeEventListener("resize", resize);
      canvas.remove(); // done — clean up
    }
  }
  tick();
}
