import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Account.css";

const statusSteps = ["pending", "confirmed", "processing", "shipped", "delivered"];
const statusNames = {
  pending: "Order received",
  confirmed: "Confirmed",
  processing: "Preparing your order",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const money = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;
const dateText = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : "Recently";
};

function AuthForm() {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage("Password reset link sent. Check your email.");
      } else if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
        await sendEmailVerification(result.user);
        if (new URLSearchParams(window.location.search).get("next") === "checkout") {
          window.location.replace("/?checkout=1");
          return;
        }
        setMessage("Account created. We sent a verification link to your email.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        if (new URLSearchParams(window.location.search).get("next") === "checkout") {
          window.location.replace("/?checkout=1");
          return;
        }
      }
    } catch (err) {
      const friendly = {
        "auth/email-already-in-use": "An account already uses this email.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/weak-password": "Use a password with at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Please wait and try again.",
      };
      setError(friendly[err.code] || "We could not complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="account-auth">
      <section className="auth-card">
        <a className="account-brand" href="/">BRIGHT <span>ACCESSORIES</span></a>
        <p className="eyebrow">CUSTOMER ACCOUNT</p>
        <h1>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}</h1>
        <p className="subtle">See every order, payment update and delivery status in one place.</p>
        <form onSubmit={submit}>
          {mode === "signup" && <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          {mode !== "reset" && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength="6" required /></label>}
          {error && <p className="account-error">{error}</p>}
          {message && <p className="account-success">{message}</p>}
          <button className="account-primary" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
        </form>
        <div className="auth-switch">
          {mode === "signin" ? <><button onClick={() => setMode("reset")}>Forgot password?</button><button onClick={() => setMode("signup")}>Create an account</button></> : <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Back to sign in</button>}
        </div>
        <a className="back-store" href="/">← Back to store</a>
      </section>
    </main>
  );
}

function OrderCard({ order }) {
  const status = String(order.status || "pending").toLowerCase();
  const activeIndex = statusSteps.indexOf(status);
  return (
    <article className="order-card">
      <header>
        <div><small>ORDER REFERENCE</small><strong>{order.orderRef}</strong></div>
        <span className={`order-status ${status}`}>{statusNames[status] || status}</span>
      </header>
      {status === "cancelled" ? <p className="cancel-note">This order was cancelled. Contact support if you need help.</p> : (
        <ol className="order-progress">
          {statusSteps.map((step, index) => <li className={index <= activeIndex ? "complete" : ""} key={step}><i>{index < activeIndex ? "✓" : index + 1}</i><span>{statusNames[step]}</span></li>)}
        </ol>
      )}
      <div className="order-meta">
        <span><small>Placed</small>{dateText(order.createdAt)}</span>
        <span><small>Payment</small>{String(order.paymentStatus || order.paymentMethod || "Pending").replaceAll("_", " ")}</span>
        <span><small>Total</small>{money(order.total)}</span>
      </div>
      <details>
        <summary>View {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"}</summary>
        <div className="order-items">{order.items?.map((item, index) => <div key={`${item.productId || item.name}-${index}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <i /> }<span><b>{item.name}</b><small>{item.quantity} × {money(item.price)}</small></span></div>)}</div>
      </details>
    </article>
  );
}

export default function Account() {
  const [user, setUser] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const searches = [getDocs(query(collection(db, "orders"), where("userId", "==", user.uid)))];
        if (user.emailVerified && user.email) searches.push(getDocs(query(collection(db, "orders"), where("customer.email", "==", user.email))));
        const snapshots = await Promise.all(searches);
        const merged = new Map();
        snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => merged.set(item.id, { id: item.id, ...item.data() })));
        const sorted = [...merged.values()].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (active) setOrders(sorted);
      } catch {
        if (active) setError("Orders could not load. The customer access rules may still need to be deployed.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user]);

  const firstName = useMemo(() => user?.displayName?.split(" ")[0] || "there", [user]);
  if (user === undefined) return <div className="account-loading">Loading your account…</div>;
  if (!user) return <AuthForm />;

  return (
    <div className="account-page">
      <header className="account-topbar"><a className="account-brand" href="/">BRIGHT <span>ACCESSORIES</span></a><nav><a href="/">Store</a><button onClick={() => signOut(auth)}>Sign out</button></nav></header>
      <main className="account-shell">
        <section className="account-heading"><div><p className="eyebrow">MY ACCOUNT</p><h1>Hello, {firstName}.</h1><p>Track purchases from order received to delivery.</p></div><div className="profile-chip"><b>{(user.displayName || user.email || "B").slice(0, 1).toUpperCase()}</b><span>{user.displayName || "Bright customer"}<small>{user.email}</small></span></div></section>
        {!user.emailVerified && <aside className="verification"><div><b>Verify your email</b><p>Verify it to connect older orders placed with {user.email}.</p></div><button disabled={verificationSent} onClick={async () => { await sendEmailVerification(user); setVerificationSent(true); }}>{verificationSent ? "Email sent" : "Send verification"}</button></aside>}
        <section className="orders-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2>Your orders</h2></div><span>{orders.length} order{orders.length === 1 ? "" : "s"}</span></section>
        {loading ? <div className="orders-empty">Loading your orders…</div> : error ? <div className="orders-empty error">{error}</div> : orders.length ? <div className="orders-list">{orders.map((order) => <OrderCard order={order} key={order.id} />)}</div> : <div className="orders-empty"><b>No orders here yet</b><p>Orders placed while signed in will appear here automatically.</p><a href="/">Start shopping</a></div>}
      </main>
    </div>
  );
}
