import { useEffect, useRef, useState } from "react";

// Where each poster sits across the screen, in vw / vh from the center.
const SLOTS = [[-30, -20], [28, -26], [-24, 26], [32, 22], [-6, -34], [8, 34], [-34, 4], [34, -2], [-18, 12], [18, -14], [-12, -8], [14, 10]];
const FALLBACK = Array.from({ length: 12 }, (_, id) => ({ id, title: "", posterUrl: null }));
const COLORS = ["#ff3d81,#5b2bd9", "#ffd23f,#ff3d81", "#2bd9a8,#1b6bd9", "#ff7a3d,#d9265b"];
const SPAN = 2800;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function applyOrientation(e, t) {
  if (e.gamma == null) return;
  t.tx = clamp(e.gamma / 25, -1, 1);
  t.ty = clamp((e.beta - 50) / 25, -1, 1);
}

export default function Tunnel({ posters }) {
  const items = (posters?.length ? posters : FALLBACK).slice(0, SLOTS.length);
  const stage = useRef(null);
  const world = useRef(null);
  const frames = useRef([]);
  const heads = useRef([]);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = tilt.current;
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      t.tx = (e.clientX / innerWidth - 0.5) * 2;
      t.ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    const onOrient = (e) => applyOrientation(e, t);

    if (!reduce) {
      addEventListener("pointermove", onMove);
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === "function") setNeedsPermission(true); // iOS needs a tap
      else if (D) addEventListener("deviceorientation", onOrient);
    }

    let raf;
    const gap = SPAN / items.length;
    const loop = () => {
      const s = stage.current;
      const p = clamp(-s.getBoundingClientRect().top / (s.offsetHeight - innerHeight), 0, 1);
      t.x += (t.tx - t.x) * 0.08; // smooth easing toward the pointer / phone tilt
      t.y += (t.ty - t.y) * 0.08;
      world.current.style.transform = `rotateY(${t.x * 9}deg) rotateX(${-t.y * 7}deg)`;

      frames.current.forEach((el, i) => {
        if (!el) return;
        const [sx, sy] = SLOTS[i];
        const z = ((i * gap + p * SPAN * 1.3) % SPAN) - SPAN + 700;
        const k = 1 + (z < 0 ? 0 : z / 700);
        el.style.transform = `translate3d(${(sx * innerWidth / 100) * k}px,${(sy * innerHeight / 100) * k}px,${z}px) rotateZ(${sx / 8}deg)`;
        el.style.opacity = z > 450 ? Math.max(0, 1 - (z - 450) / 250) : Math.min(1, (z + SPAN) / 900);
      });

      const phase = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
      heads.current.forEach((h, i) => {
        if (!h) return;
        h.style.opacity = i === phase ? 1 : 0;
        h.style.transform = i === phase ? "none" : "translateY(20px) scale(.96)";
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      removeEventListener("deviceorientation", onOrient);
    };
  }, [items.length]);

  const enableTilt = async () => {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === "granted") {
        addEventListener("deviceorientation", (e) => applyOrientation(e, tilt.current));
        setNeedsPermission(false);
      }
    } catch { /* permission denied */ }
  };

  return (
    <div className="stage" id="top" ref={stage}>
      <div className="sticky">
        <div className="world" ref={world}>
          {items.map((it, i) => (
            <figure
              className="frame"
              key={it.id}
              ref={(el) => (frames.current[i] = el)}
              style={it.posterUrl ? undefined : { background: `linear-gradient(135deg,${COLORS[i % COLORS.length]})` }}
            >
              {it.posterUrl ? (
                <img
                  src={it.posterUrl}
                  alt={it.title}
                  draggable="false"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onError={(e) => {
                    if (it.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                      e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(it.posterUrl)}`;
                    } else {
                      e.target.style.display = "none";
                    }
                  }}
                />
              ) : (
                <figcaption>{it.title}</figcaption>
              )}
            </figure>
          ))}
        </div>
        <div className="copy">
          <h1 ref={(el) => (heads.current[0] = el)}>Saw a clip and can’t place it?</h1>
          <h1 ref={(el) => (heads.current[1] = el)} style={{ opacity: 0 }}>Drop it in <em>Mobzilla.</em></h1>
          <h1 ref={(el) => (heads.current[2] = el)} style={{ opacity: 0 }}>Get the movie <em>name.</em></h1>
        </div>

      </div>
    </div>
  );
}
