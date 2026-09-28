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
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
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
const verificationSettings = {
  url: "https://bright-accessories.vercel.app/account?verified=1",
  handleCodeInApp: false,
};
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
        await sendEmailVerification(result.user, verificationSettings);
        sessionStorage.setItem("bright-verification-notice", "sent");
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

function OrderCard({ order, onCancel, onReorder, busy }) {
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
      <div className="order-actions">
        <button onClick={() => onReorder(order)}>Buy these items again</button>
        {status === "pending" && <button className="danger" disabled={busy} onClick={() => onCancel(order)}>{busy ? "Cancelling…" : "Cancel order"}</button>}
      </div>
    </article>
  );
}

export default function Account() {
  const [user, setUser] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [verificationMessage, setVerificationMessage] = useState(() => sessionStorage.getItem("bright-verification-notice") === "sent" ? "Verification email sent. Check Inbox, Spam and Promotions." : "");

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
        const results = await Promise.allSettled(searches);
        const snapshots = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
        if (!snapshots.length) throw new Error("permission-denied");
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
  const resendVerification = async () => {
    setVerificationMessage("");
    try {
      await sendEmailVerification(user, verificationSettings);
      sessionStorage.setItem("bright-verification-notice", "sent");
      setVerificationSent(true);
      setVerificationMessage("A fresh verification email was sent. Check Inbox, Spam and Promotions.");
    } catch (err) {
      const messages = {
        "auth/too-many-requests": "Too many emails were requested. Wait a few minutes before trying again.",
        "auth/unauthorized-continue-uri": "Add bright-accessories.vercel.app to Firebase Authentication authorized domains.",
      };
      setVerificationMessage(messages[err.code] || "Firebase could not send the email. Please try again shortly.");
    }
  };
  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderRef}?`)) return;
    setBusyOrder(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "cancelled", cancelledAt: serverTimestamp() });
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: "cancelled" } : item));
    } catch {
      setError("This order could not be cancelled. It may already be processing or the updated rules still need to be published.");
    } finally {
      setBusyOrder("");
    }
  };
  const reorder = (order) => {
    const cart = (order.items || []).map((item) => ({
      id: item.productId,
      name: item.name,
      imageUrl: item.imageUrl || "",
      sellingPrice: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    }));
    localStorage.setItem("bright-cart", JSON.stringify(cart));
    window.location.href = "/?cart=1";
  };
  if (user === undefined) return <div className="account-loading">Loading your account…</div>;
  if (!user) return <AuthForm />;

  return (
    <div className="account-page">
      <header className="account-topbar"><a className="account-brand" href="/">BRIGHT <span>ACCESSORIES</span></a><nav><a href="/">Store</a><a href="/admin">Admin login</a><button onClick={() => signOut(auth)}>Sign out</button></nav></header>
      <main className="account-shell">
        <section className="account-heading"><div><p className="eyebrow">MY ACCOUNT</p><h1>Hello, {firstName}.</h1><p>Track purchases from order received to delivery.</p></div><div className="profile-chip"><b>{(user.displayName || user.email || "B").slice(0, 1).toUpperCase()}</b><span>{user.displayName || "Bright customer"}<small>{user.email}</small></span></div></section>
        {!user.emailVerified && <aside className="verification"><div><b>Verify {user.email}</b><p>{verificationMessage || "Open the Firebase email to verify your account and connect older orders."}</p><small>You can still check out while waiting for the email.</small></div><div className="verification-actions"><button disabled={verificationSent} onClick={resendVerification}>{verificationSent ? "Email sent" : "Resend email"}</button>{new URLSearchParams(window.location.search).get("next") === "checkout" && <a href="/?checkout=1">Continue to checkout</a>}</div></aside>}
        <section className="orders-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2>Your orders</h2></div><span>{orders.length} order{orders.length === 1 ? "" : "s"}</span></section>
        {loading ? <div className="orders-empty">Loading your orders…</div> : error && !orders.length ? <div className="orders-empty error">{error}</div> : orders.length ? <><div className="orders-list">{orders.map((order) => <OrderCard order={order} onCancel={cancelOrder} onReorder={reorder} busy={busyOrder === order.id} key={order.id} />)}</div>{error && <p className="account-inline-error">{error}</p>}</> : <div className="orders-empty"><b>No orders here yet</b><p>Orders placed while signed in will appear here automatically.</p><a href="/">Start shopping</a></div>}
      </main>
    </div>
  );
}
