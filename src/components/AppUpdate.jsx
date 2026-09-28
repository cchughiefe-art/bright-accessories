import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./AppUpdate.css";

const parts = (version = "0") => String(version).split(".").map((value) => Number.parseInt(value, 10) || 0);
const newerThan = (latest, installed) => {
  const next = parts(latest);
  const current = parts(installed);
  for (let index = 0; index < Math.max(next.length, current.length); index += 1) {
    if ((next[index] || 0) > (current[index] || 0)) return true;
    if ((next[index] || 0) < (current[index] || 0)) return false;
  }
  return false;
};

export default function AppUpdate() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    Promise.all([
      CapacitorApp.getInfo(),
      fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("Update information unavailable");
        return response.json();
      }),
      getDoc(doc(db, "settings", "store")).catch(() => null),
    ]).then(([app, fallback, settingsSnapshot]) => {
      const settings = settingsSnapshot?.exists?.() ? settingsSnapshot.data() : {};
      const release = {
        ...fallback,
        latestVersion: settings.apkLatestVersion || fallback.latestVersion,
        minimumVersion: settings.apkMinimumVersion || fallback.minimumVersion,
        required: settings.apkUpdateRequired ?? fallback.required,
        apkUrl: settings.apkDownloadUrl || fallback.apkUrl,
        message: settings.apkUpdateMessage || fallback.message,
        releaseNotes: settings.apkReleaseNotes ? String(settings.apkReleaseNotes).split("\n").filter(Boolean) : fallback.releaseNotes,
      };
      const dismissed = localStorage.getItem("bright-dismissed-update");
      const required = release.required || newerThan(release.minimumVersion, app.version);
      if (active && newerThan(release.latestVersion, app.version) && (required || dismissed !== release.latestVersion)) {
        setUpdate({ ...release, required, installedVersion: app.version });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!update) return null;
  const install = () => Browser.open({ url: update.apkUrl });
  const later = () => {
    localStorage.setItem("bright-dismissed-update", update.latestVersion);
    setUpdate(null);
  };

  return (
    <div className="update-scrim" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <section className="update-card">
        <img src="/app-icon.png" alt="" />
        <small>NEW VERSION AVAILABLE</small>
        <h2 id="update-title">Update Bright Accessories</h2>
        <p>{update.message || "A newer, improved version of the app is ready to install."}</p>
        <div className="update-versions"><span>Installed: {update.installedVersion}</span><span>New: {update.latestVersion}</span></div>
        {update.releaseNotes?.length > 0 && <ul>{update.releaseNotes.map((note) => <li key={note}>{note}</li>)}</ul>}
        <button className="update-now" onClick={install}>Download update</button>
        {!update.required && <button className="update-later" onClick={later}>Maybe later</button>}
        <p className="update-help">After downloading, open the APK and tap Update. Your account and orders will remain safe.</p>
      </section>
    </div>
  );
}
