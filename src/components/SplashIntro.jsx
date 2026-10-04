import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./SplashIntro.css";

const readProducts = () => {
  try {
    return JSON.parse(localStorage.getItem("bright-products-cache") || "[]")
      .filter((product) => product.imageUrl)
      .slice(0, 5);
  } catch {
    return [];
  }
};

const mission = ["Above", "limitations"];
const vision = ["Keep", "moving", "forward"];
const fallbackProducts = ["Chargers", "Earphones", "Power banks", "Cables", "Cases"];

function Words({ words }) {
  return words.map((word, index) => (
    <span key={word} style={{ "--word": index }}>{word}</span>
  ));
}

export default function SplashIntro() {
  const [phase, setPhase] = useState(() =>
    Capacitor.isNativePlatform() ? "show" : "done",
  );
  const [products, setProducts] = useState(readProducts);

  useEffect(() => {
    if (phase === "done") return undefined;
    if (phase === "exit") {
      const removeTimer = window.setTimeout(() => setPhase("done"), 650);
      return () => window.clearTimeout(removeTimer);
    }

    let attempts = 0;
    const productTimer = window.setInterval(() => {
      attempts += 1;
      const cached = readProducts();
      if (cached.length) setProducts(cached);
      if (cached.length >= 5 || attempts >= 8) window.clearInterval(productTimer);
    }, 350);
    const exitTimer = window.setTimeout(() => setPhase("exit"), 6900);

    return () => {
      window.clearInterval(productTimer);
      window.clearTimeout(exitTimer);
    };
  }, [phase]);

  if (phase === "done") return null;

  const productSlots = Array.from({ length: 5 }, (_, index) => products[index]);

  return (
    <div
      className={`app-intro ${phase === "exit" ? "app-intro-exit" : ""}`}
      aria-label="Opening Bright Accessories"
      onClick={() => setPhase("exit")}
    >
      <img className="intro-portrait" src="/opening-portrait.jpg" alt="" aria-hidden="true" />
      <div className="intro-shade" />
      <div className="intro-grain" />

      <div className="intro-copy">
        <section className="intro-statement intro-mission">
          <small>MY MISSION</small>
          <strong><Words words={mission} /></strong>
        </section>
        <section className="intro-statement intro-vision">
          <small>MY VISION</small>
          <strong><Words words={vision} /></strong>
        </section>
      </div>

      <div className="intro-products" aria-hidden="true">
        {productSlots.map((product, index) => (
          <div className={`intro-product intro-product-${index + 1}`} key={product?.id || index}>
            {product?.imageUrl ? (
              <img src={product.imageUrl} alt="" />
            ) : (
              <div className="intro-product-fallback"><i />{fallbackProducts[index]}</div>
            )}
          </div>
        ))}
      </div>

      <div className="intro-brand">
        <img src="/app-icon.png" alt="" className="intro-logo" />
        <div className="intro-wordmark" aria-hidden="true">
          <strong>BRIGHT</strong>
          <span>ACCESSORIES</span>
        </div>
        <p>Everything your phone needs.</p>
      </div>

      <div className="intro-progress"><i /></div>
      <button className="intro-skip" type="button" onClick={(event) => { event.stopPropagation(); setPhase("exit"); }}>Tap to skip</button>
    </div>
  );
}
