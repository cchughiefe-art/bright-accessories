import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./Download.css";

const fallback = {
  version: "1.0.0",
  apkUrl: "https://github.com/cchughiefe-art/bright-accessories/releases/latest/download/bright-accessories.apk",
  message: "The Bright Accessories Android app is ready.",
  releaseNotes: ["Complete mobile shopping experience", "Customer accounts and order tracking", "Secure admin dashboard"],
};

function Mark({ name }) {
  const paths = {
    android: <><path d="M7 9h10v9H7zM5 10v6M19 10v6M9 18v3M15 18v3"/><path d="m8 6-2-3M16 6l2-3M7 9a5 5 0 0 1 10 0"/><path d="M10 7h.01M14 7h.01"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 20h14"/></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
    update: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 8a7 7 0 0 1 11.4-2L20 12M4 12l2.4 5a7 7 0 0 0 11.4-1"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Download() {
  const [release, setRelease] = useState(fallback);

  useEffect(() => {
    Promise.allSettled([
      fetch("/app-version.json", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      getDoc(doc(db, "settings", "store")).then((snapshot) => snapshot.exists() ? snapshot.data() : null),
    ]).then(([manifestResult, settingsResult]) => {
      const manifest = manifestResult.status === "fulfilled" ? manifestResult.value : null;
      const settings = settingsResult.status === "fulfilled" ? settingsResult.value : null;
      setRelease({
        version: settings?.apkLatestVersion || manifest?.latestVersion || fallback.version,
        apkUrl: settings?.apkDownloadUrl || manifest?.apkUrl || fallback.apkUrl,
        message: settings?.apkUpdateMessage || manifest?.message || fallback.message,
        releaseNotes: String(settings?.apkReleaseNotes || "").split("\n").filter(Boolean).length
          ? String(settings.apkReleaseNotes).split("\n").filter(Boolean)
          : manifest?.releaseNotes || fallback.releaseNotes,
      });
    });
  }, []);

  return <main className="download-page">
    <nav className="download-nav">
      <a className="download-brand" href="/">BRIGHT<span>ACCESSORIES</span></a>
      <div><a href="/">Shop</a><a href="/account">My orders</a></div>
    </nav>

    <section className="download-hero">
      <div className="download-copy">
        <span className="download-kicker">ANDROID APP</span>
        <h1>Bright Accessories,<br/><em>right in your pocket.</em></h1>
        <p>{release.message}</p>
        <div className="download-actions">
          <a className="download-button" href={release.apkUrl}><Mark name="download"/>Download APK</a>
          <small>Version {release.version} · Direct download</small>
        </div>
        <div className="download-trust"><span><Mark name="shield"/>Securely signed</span><span><Mark name="update"/>Update alerts included</span></div>
      </div>
      <div className="download-device" aria-label="Bright Accessories app preview">
        <div className="download-phone">
          <div className="phone-speaker"/>
          <div className="phone-screen">
            <img src="/app-icon.png" alt="Bright Accessories logo"/>
            <span>BRIGHT ACCESSORIES</span>
            <h2>Shop smarter.<br/>Track every order.</h2>
            <div><i/><i/><i/></div>
          </div>
        </div>
      </div>
    </section>

    <section className="download-info">
      <article><span>01</span><h2>Download</h2><p>Tap the download button to get the official Bright Accessories APK.</p></article>
      <article><span>02</span><h2>Install</h2><p>Open the file and allow installation from your browser if Android asks.</p></article>
      <article><span>03</span><h2>Stay updated</h2><p>The app checks for new releases and tells you when an update is ready.</p></article>
    </section>

    <section className="release-card">
      <div><span>WHAT'S INCLUDED</span><h2>Latest release</h2></div>
      <ul>{release.releaseNotes.map((note) => <li key={note}><Mark name="shield"/>{note}</li>)}</ul>
    </section>

    <footer className="download-footer"><p>Only install Bright Accessories from this official page.</p><a href={release.apkUrl}>Download version {release.version} <Mark name="download"/></a></footer>
  </main>;
}
