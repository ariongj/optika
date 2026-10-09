// Kept for the legacy assembly view; never imported on ordinary page load.
import { useEffect, useRef, useState } from "react";
import { createHero } from "./hero3d.js";
const clamp01 = value => Math.min(1, Math.max(0, value));
export default function LegacyAssemblyScene({ progress, lensMode = false, stages, fallback }) {
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const progressRef = useRef(progress);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return undefined;

    let hero;
    let animationFrame = 0;
    let lastTime = performance.now();
    let easedProgress = progressRef.current;
    let visible = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      hero = createHero({
        host,
        stages,
        brand: lensMode ? "MIFTARI LENS" : "MIFTARI",
        frameColor: lensMode ? "#17262c" : "#28231f",
        laser: lensMode ? "#75e7ff" : "#e6b84a"
      });
    } catch (error) {
      console.error("Unable to initialize the Crafted WebGL hero", error);
      setWebglFailed(true);
      return undefined;
    }

    const sticky = root.closest(".crafted-assembly-sticky");
    const updateTheme = (luminance) => {
      if (!sticky || luminance == null) return;
      const amount = clamp01((luminance - 0.32) / 0.26);
      const mixChannel = (dark, light) => Math.round(light + (dark - light) * amount);
      sticky.style.setProperty("--hero-ink-rgb", `${mixChannel(38, 236)}, ${mixChannel(34, 238)}, ${mixChannel(27, 228)}`);
      sticky.style.setProperty("--hero-panel-rgb", `${mixChannel(246, 20)}, ${mixChannel(242, 18)}, ${mixChannel(233, 15)}`);
    };

    const render = (now) => {
      const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const target = progressRef.current;
      easedProgress = reducedMotion ? target : easedProgress + (target - easedProgress) * (1 - Math.exp(-delta * 5.2));
      if (visible) {
        const frameState = hero.frame(easedProgress, delta);
        updateTheme(frameState?.bgLum);
      }
      animationFrame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => hero.resize());
    resizeObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) hero.resize();
    });
    visibilityObserver.observe(root);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      hero.dispose();
    };
  }, []);

  return (
    <div className="auric-webgl-scene" ref={rootRef} data-testid="crafted-webgl-scene" aria-hidden="true">
      <div className="auric-webgl-host" ref={hostRef} />
      <div className="auric-cinematic-vignette" />
      <div className="auric-film-grain" />
      {webglFailed && <img className="auric-webgl-fallback" src={fallback} alt="" />}
    </div>
  );
}
