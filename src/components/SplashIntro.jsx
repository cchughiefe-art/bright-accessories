import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./SplashIntro.css";

export default function SplashIntro() {
  const [phase, setPhase] = useState(() =>
    Capacitor.isNativePlatform() ? "show" : "done",
  );

  useEffect(() => {
    if (phase === "done") return undefined;

    const exitTimer = window.setTimeout(() => setPhase("exit"), 4600);
    const removeTimer = window.setTimeout(() => setPhase("done"), 5250);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`app-intro ${phase === "exit" ? "app-intro-exit" : ""}`}
      aria-label="Opening Bright Accessories"
    >
      <img className="intro-portrait" src="/opening-portrait.jpg" alt="" aria-hidden="true" />
      <div className="intro-shade" />
      <div className="intro-grain" />

      <div className="intro-copy">
        <div className="intro-statement intro-mission">
          <span>MY MISSION</span>
          <strong>Above limitations</strong>
        </div>
        <div className="intro-rule" />
        <div className="intro-statement intro-vision">
          <span>MY VISION</span>
          <strong>Keep moving forward</strong>
        </div>
      </div>

      <div className="intro-brand">
        <img src="/app-icon.png" alt="" className="intro-logo" />
        <div className="intro-wordmark" aria-hidden="true">
          <strong>BRIGHT</strong>
          <span>ACCESSORIES</span>
        </div>
      </div>

      <div className="intro-progress"><i /></div>
    </div>
  );
}
