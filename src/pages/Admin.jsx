import React, { useState, useEffect } from "react";
import {
  collection, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import "./Admin.css";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const isImgBbUrl = (url = "") => /^https?:\/\/(?:i\.)?ibb\.co\//i.test(url) || /imgbb\.com/i.test(url);

function AdminIcon({ name, size = 20 }) {
  const paths = {
    dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    orders:<><path d="M6 3h12l2 5H4l2-5Z"/><path d="M5 8v13h14V8M9 12h6"/></>,
    products:<><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    revenue:<><path d="M12 2v20M17 6.5c0-1.4-2.2-2.5-5-2.5S7 5.1 7 6.5 9.2 9 12 9s5 1.1 5 2.5-2.2 2.5-5 2.5-5 1.1-5 2.5S9.2 19 12 19s5-1.1 5-2.5"/></>,
    profit:<><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    refresh:<><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 11M4 13l2.4 5a7 7 0 0 0 11.5-2"/></>,
    external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/></>,
    logout:<><path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

async function uploadToCloudinary(source, publicId) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again");
  const signatureResponse = await fetch("/api/cloudinary-signature", {
    method:"POST",
    headers:{ "content-type":"application/json", authorization:`Bearer ${token}` },
    body:JSON.stringify({ publicId }),
  });
  const signed = await signatureResponse.json();
  if (!signatureResponse.ok) throw new Error(signed.error || "Cloudinary authorization failed");

  const body = new FormData();
  body.append("file", source);
  body.append("api_key", signed.apiKey);
  body.append("timestamp", String(signed.timestamp));
  body.append("signature", signed.signature);
  body.append("folder", signed.folder);
  body.append("public_id", signed.publicId);
  body.append("overwrite", signed.overwrite);
  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method:"POST", body });
  const uploaded = await uploadResponse.json();
  if (!uploadResponse.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || "Image upload failed");
  return uploaded;
}
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true); setErr("");
    try {
      const result = await signInWithEmailAndPassword(auth, "cchughiefe@gmail.com", pw);
      if (result.user.email?.toLowerCase() !== "cchughiefe@gmail.com") {
        await signOut(auth);
        throw new Error("not-admin");
      }
      onLogin();
    }
    catch { setErr("Email or password is incorrect, or this is not an administrator account."); }
    finally { setBusy(false); }
  };
  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-brand"><span>BA</span><div><b>Bright Accessories</b><small>Commerce command centre</small></div></div>
        <div className="admin-login-copy"><span>ADMIN ACCESS</span><h1>Welcome back.</h1><p>Enter your private password to manage the store.</p></div>
        <label className="admin-password-field"><span>Password</span><input type="password" autoFocus autoComplete="current-password" placeholder="Enter admin password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} /></label>
        {err && <p className="admin-login-error">That password is incorrect. Please try again.</p>}
        <button className="admin-login-button" disabled={busy || !pw} onClick={login}>{busy ? "Checking…" : "Open dashboard"}<span>→</span></button>
        <p className="admin-login-security">Protected administrator access</p>
      </div>
    </div>
  );
}

function Dashboard({ products, orders }) {
  const successful = orders.filter(o => ["successful", "delivered"].includes(o.status));
  const pending = orders.filter(o => o.status === "pending");
  const revenue = successful.reduce((s, o) => s + (o.total || 0), 0);
  const cogs = successful.reduce((s, o) => s + ((o.costPrice || 0) * (o.quantity || 1)), 0);
  const delivery = successful.reduce((s, o) => s + ((o.deliveryCost || 0) * (o.quantity || 1)), 0);
  const profit = revenue - cogs - delivery;
  const lowStock = products.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5);
  const outOfStock = products.filter(p => p.availableQuantity <= 0);
  return (
    <div className="admin-dashboard">
      <div className="admin-page-heading"><div><span>OVERVIEW</span><h2>Business dashboard</h2><p>Track sales, orders and inventory from one place.</p></div><small>Live store data</small></div>
      <div className="admin-stat-grid">
        {[
          { label:"Total revenue", value:fmt(revenue), tone:"green", icon:"revenue", note:"Completed orders" },
          { label:"Net profit", value:fmt(profit), tone:profit >= 0 ? "blue" : "red", icon:"profit", note:"After recorded costs" },
          { label:"Pending orders", value:pending.length, tone:"amber", icon:"clock", note:"Waiting for action" },
          { label:"Delivered", value:successful.length, tone:"purple", icon:"check", note:"Successful orders" },
        ].map((stat) => (
          <div className="admin-stat" key={stat.label}>
            <div className={`admin-stat-icon ${stat.tone}`}><AdminIcon name={stat.icon}/></div>
            <p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.note}</small>
          </div>
        ))}
      </div>
      <div className="admin-panels">
        <section><header><div><h3>Inventory health</h3><p>Products that need your attention</p></div><span>{products.length} products</span></header>
          {!lowStock.length && !outOfStock.length ? <div className="admin-all-good"><AdminIcon name="check"/><div><b>Inventory looks good</b><p>No low-stock products right now.</p></div></div> : <div className="admin-stock-list">
            {[...outOfStock,...lowStock].map(p=><div key={p.docId}><span className={p.availableQuantity <= 0 ? "out" : "low"}/><b>{p.name}</b><small>{p.availableQuantity <= 0 ? "Out of stock" : `${p.availableQuantity} left`}</small></div>)}
          </div>}
        </section>
        <section><header><div><h3>Order summary</h3><p>Current fulfilment status</p></div></header><div className="admin-order-summary"><div><span>Pending</span><b>{pending.length}</b></div><div><span>Completed</span><b>{successful.length}</b></div><div><span>All orders</span><b>{orders.length}</b></div></div></section>
      </div>
    </div>
  );
}

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    sellingPrice: initial?.sellingPrice || "",
    costPrice: initial?.costPrice || "",
    deliveryCost: initial?.deliveryCost || "",
    availableQuantity: initial?.availableQuantity || "",
    description: initial?.description || "",
    category: initial?.category || "Accessories",
    imageUrl: initial?.imageUrl || "",
    featured: initial?.featured || false,
  });
  const [imgFile, setImgFile] = useState(null);
  const [preview, setPreview] = useState(initial?.imageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    setPreview(URL.createObjectURL(file));
    setAiResult(null);
  };

  const analyseImage = async () => {
    if (!imgFile) { setErr("Choose a product image first."); return; }
    if (imgFile.size > 12 * 1024 * 1024) { setErr("Please choose an image smaller than 12MB."); return; }
    setAnalysing(true); setErr(""); setAiResult(null);
    try {
      const image = await new Promise((resolve, reject) => {
        const source = new Image();
        source.onload = () => {
          const scale = Math.min(1, 1400 / Math.max(source.width, source.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(source.width * scale));
          canvas.height = Math.max(1, Math.round(source.height * scale));
          canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
          URL.revokeObjectURL(source.src);
        };
        source.onerror = reject;
        source.src = URL.createObjectURL(imgFile);
      });
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/product-ai", { method:"POST", headers:{ "content-type":"application/json", authorization:`Bearer ${token}` }, body:JSON.stringify({ image }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI analysis failed");
      setForm(current => ({ ...current, name:data.name || current.name, description:data.description || current.description, category:data.category || current.category }));
      setAiResult(data);
    } catch (error) { setErr(error.message); }
    finally { setAnalysing(false); }
  };

  const uploadImage = async () => {
    if (!imgFile) return form.imageUrl || "";
    setUploading(true);
    try {
      const publicId = `${form.name || "product"}-${Date.now()}`;
      const data = await uploadToCloudinary(imgFile, publicId);
      setUploading(false);
      return data.secure_url;
    } catch (e) {
      setUploading(false);
      throw e;
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sellingPrice) { setErr("Name and Selling Price are required."); return; }
    const sellingPrice = Number(form.sellingPrice), costPrice = Number(form.costPrice || 0), deliveryCost = Number(form.deliveryCost || 0), stock = Number(form.availableQuantity || 0);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0 || !Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(deliveryCost) || deliveryCost < 0 || !Number.isInteger(stock) || stock < 0) {
      setErr("Enter a positive selling price and valid non-negative costs and whole-number stock."); return;
    }
    setSaving(true); setErr("");
    try {
      const imageUrl = await uploadImage();
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Accessories",
        active: initial?.active !== false,
        imageUrl,
        featured: form.featured,
        sellingPrice, costPrice, deliveryCost, availableQuantity: stock,
      });
    } catch (e) { setErr("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="modal admin-product-form" style={{ maxWidth:"100%" }}>
      <div className="admin-product-form-head"><span>{initial?.docId ? "EDIT PRODUCT" : "NEW PRODUCT"}</span><h3>{initial?.docId ? "Update product" : "Create product listing"}</h3><p>Upload an image and let the AI helper draft the name, category and description.</p></div>
      <div className="admin-ai-panel">
        <div className="admin-ai-title"><span>✦</span><div><b>AI product helper</b><small>Start with one clear product photo</small></div></div>
        <div className="admin-ai-row">
          <label className="admin-ai-image">
            {preview ? <img src={preview} alt="Product preview" /> : <><b>+</b><span>Choose image</span></>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImagePick}/>
          </label>
          <div><button type="button" className="admin-ai-action" onClick={analyseImage} disabled={!imgFile || analysing}>{analysing ? "Looking at product…" : "✦ Write listing from image"}</button><small>The result is a draft. You can edit everything below.</small></div>
        </div>
        {aiResult && <div className="admin-ai-result"><b>Draft added · {aiResult.confidence}% confidence</b><span>{aiResult.notes}</span></div>}
      </div>
      {[
        { k:"name", label:"Product Name *", ph:"e.g. iPhone 17 Case" },
        { k:"sellingPrice", label:"Selling Price (N) *", ph:"e.g. 5000", type:"number" },
        { k:"costPrice", label:"Cost Price (N)", ph:"e.g. 2500", type:"number" },
        { k:"deliveryCost", label:"Delivery Cost (N)", ph:"e.g. 500", type:"number" },
        { k:"availableQuantity", label:"Stock Quantity", ph:"e.g. 20", type:"number" },
      ].map(({ k, label, ph, type="text" }) => (
        <div key={k} style={{ marginBottom:12 }}>
          <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:5 }}>{label}</label>
          <input className="input-field" type={type} placeholder={ph}
            value={form[k]} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:5 }}>Description</label>
        <textarea className="input-field" rows={2} placeholder="Short product description"
          value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:5 }}>Category</label>
        <input className="input-field" placeholder="e.g. Chargers, Cases, Audio"
          value={form.category} onChange={(e) => set("category", e.target.value)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)}
            style={{ width:18, height:18, accentColor:"var(--gold)" }} />
          <span style={{ fontSize:14, fontWeight:600 }}>Mark as Featured (shows at top)</span>
        </label>
      </div>
      {uploading && <p style={{ fontSize:12, color:"var(--gold)", marginTop:6, fontWeight:600 }}>Uploading image...</p>}
      {err && <p style={{ color:"var(--red)", fontSize:13, marginBottom:12 }}>{err}</p>}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn-outline" onClick={onCancel} style={{ flex:1 }}>Cancel</button>
        <button className="btn-gold" onClick={handleSave} disabled={saving || uploading} style={{ flex:2 }}>
          {uploading ? "Uploading..." : saving ? "Saving..." : "Save Product"}
        </button>
      </div>
    </div>
  );
}

function OrderCard({ o, onAction, fmt }) {
  const items = o.items || [{ name:o.productName, imageUrl:o.productImage, price:o.sellingPrice, quantity:o.quantity }];
  const customer = o.customer || { name:o.customerName, phone:o.customerPhone, address:o.deliveryAddress };
  const active = ["pending", "confirmed", "processing", "shipped"].includes(o.status);
  const nextLabel = o.status === "pending" ? "Confirm Order" : o.status === "confirmed" ? "Start Processing" : o.status === "processing" ? "Mark Shipped" : "Mark Delivered";
  return (
    <article className="v2-order-card">
      <div className="v2-order-head">
        {items[0]?.imageUrl ? (
          <img src={items[0].imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="v2-order-placeholder">📱</div>
        )}
        <div className="v2-order-title">
          <span>{o.orderRef || "ORDER"}</span>
          <h3>{customer.name || "Customer order"}</h3>
          <p>{items.map(i => i.name + " × " + i.quantity).join(", ")}</p>
        </div>
        <div className="v2-order-total"><small>Total</small><strong>{fmt(o.total)}</strong><span className={`v2-status ${o.status || "pending"}`}>{o.status || "pending"}</span></div>
      </div>
      <div className="v2-order-details">
        <div><small>PHONE</small><b>{customer.phone || "Not provided"}</b></div>
        <div><small>PAYMENT</small><b>{o.paymentMethod === "transfer" ? "Bank transfer" : "Cash on delivery"}</b></div>
        <div className="address"><small>DELIVERY ADDRESS</small><b>{customer.address || "Not provided"}</b></div>
        {o.receiptUrl && <a href={o.receiptUrl} target="_blank" rel="noreferrer">View payment receipt ↗</a>}
      </div>
      {active && (
        <div className="v2-order-actions">
          <button className="danger" onClick={() => onAction(o, "cancelled")}>Cancel order</button>
          <button className="primary" onClick={() => onAction(o, "advance")}>{nextLabel} →</button>
        </div>
      )}
    </article>
  );
}

function StoreSettings({ value, onSaved }) {
  const [form, setForm] = useState({
    bankName:value.bankName || "", accountNumber:value.accountNumber || "",
    accountName:value.accountName || "", whatsapp:value.whatsapp || "234",
    announcement:value.announcement || "Lagos delivery and nationwide shipping",
    mainland:value.deliveryZones?.find(z=>z.id==="mainland")?.fee || 2500,
    island:value.deliveryZones?.find(z=>z.id==="island")?.fee || 3500,
    nationwide:value.deliveryZones?.find(z=>z.id==="nationwide")?.fee || 5000,
    apkLatestVersion:value.apkLatestVersion || "1.0.0",
    apkMinimumVersion:value.apkMinimumVersion || "1.0.0",
    apkDownloadUrl:value.apkDownloadUrl || "https://github.com/cchughiefe-art/bright-accessories/releases/latest/download/bright-accessories.apk",
    apkUpdateMessage:value.apkUpdateMessage || "A newer, improved version of Bright Accessories is ready.",
    apkReleaseNotes:value.apkReleaseNotes || "Performance improvements\nBug fixes and security improvements",
    apkUpdateRequired:Boolean(value.apkUpdateRequired),
  });
  const [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    setBusy(true);setMessage("");
    try {
      const data={bankName:form.bankName.trim(),accountNumber:form.accountNumber.trim(),accountName:form.accountName.trim(),whatsapp:form.whatsapp.replace(/\D/g,""),announcement:form.announcement.trim(),apkLatestVersion:form.apkLatestVersion.trim(),apkMinimumVersion:form.apkMinimumVersion.trim(),apkDownloadUrl:form.apkDownloadUrl.trim(),apkUpdateMessage:form.apkUpdateMessage.trim(),apkReleaseNotes:form.apkReleaseNotes.trim(),apkUpdateRequired:form.apkUpdateRequired,deliveryZones:[
        {id:"mainland",name:"Lagos Mainland",fee:Number(form.mainland)},
        {id:"island",name:"Lagos Island",fee:Number(form.island)},
        {id:"nationwide",name:"Outside Lagos",fee:Number(form.nationwide)}
      ],updatedAt:serverTimestamp()};
      await setDoc(doc(db,"settings","store"),data,{merge:true}); onSaved(data); setMessage("Store settings saved. Website and APK will use them immediately.");
    } catch(e){setMessage("Could not save: "+e.message)} finally{setBusy(false)}
  };
  return <div className="admin-settings-card">
    <section className="admin-settings-section"><div className="admin-settings-title"><span>01</span><div><h3>Bank transfer account</h3><p>Account customers see during checkout.</p></div></div>
    <div className="admin-settings-grid two">
      <label>Bank name<input className="input-field" value={form.bankName} onChange={e=>set("bankName",e.target.value)}/></label>
      <label>Account number<input className="input-field" inputMode="numeric" value={form.accountNumber} onChange={e=>set("accountNumber",e.target.value)}/></label>
    </div>
    <label>Account name<input className="input-field" value={form.accountName} onChange={e=>set("accountName",e.target.value)}/></label></section>
    <section className="admin-settings-section"><div className="admin-settings-title"><span>02</span><div><h3>Store contact</h3><p>Support number and storefront message.</p></div></div>
    <label>WhatsApp number <small>(country code, no +)</small><input className="input-field" value={form.whatsapp} onChange={e=>set("whatsapp",e.target.value)}/></label>
    <label>Store announcement<input className="input-field" value={form.announcement} onChange={e=>set("announcement",e.target.value)} placeholder="Shown above the website header"/></label></section>
    <section className="admin-settings-section"><div className="admin-settings-title"><span>03</span><div><h3>Delivery charges</h3><p>Fees calculated automatically at checkout.</p></div></div>
    <div className="admin-settings-grid three">
      <label>Lagos Mainland<input className="input-field" type="number" value={form.mainland} onChange={e=>set("mainland",e.target.value)}/></label>
      <label>Lagos Island<input className="input-field" type="number" value={form.island} onChange={e=>set("island",e.target.value)}/></label>
      <label>Outside Lagos<input className="input-field" type="number" value={form.nationwide} onChange={e=>set("nationwide",e.target.value)}/></label>
    </div></section>
    <section className="admin-settings-section"><div className="admin-settings-title"><span>04</span><div><h3>Android app updates</h3><p>Control update notices shown inside installed APKs.</p></div></div>
    <div className="admin-settings-grid two">
      <label>Latest APK version<input className="input-field" value={form.apkLatestVersion} onChange={e=>set("apkLatestVersion",e.target.value)} placeholder="1.1.0"/></label>
      <label>Minimum allowed version<input className="input-field" value={form.apkMinimumVersion} onChange={e=>set("apkMinimumVersion",e.target.value)} placeholder="1.0.0"/></label>
    </div>
    <label>Direct APK URL<input className="input-field" value={form.apkDownloadUrl} onChange={e=>set("apkDownloadUrl",e.target.value)}/></label>
    <label>Update message<input className="input-field" value={form.apkUpdateMessage} onChange={e=>set("apkUpdateMessage",e.target.value)}/></label>
    <label>Release notes <small>(one per line)</small><textarea className="input-field" rows="4" value={form.apkReleaseNotes} onChange={e=>set("apkReleaseNotes",e.target.value)}/></label>
    <label style={{display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={form.apkUpdateRequired} onChange={e=>set("apkUpdateRequired",e.target.checked)}/> Make this update compulsory</label></section>
    {message&&<p style={{margin:"14px 0",fontSize:13,color:message.startsWith("Could")?"var(--red)":"var(--green)"}}>{message}</p>}
    <div className="admin-settings-save"><button className="btn-gold" disabled={busy||!form.bankName||!form.accountNumber||!form.accountName} onClick={save}>{busy?"Saving…":"Save store settings"}</button></div>
  </div>;
}

export default function Admin() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [settings, setSettings] = useState({});
  const [migration, setMigration] = useState({ running:false, done:0, total:0, error:"" });

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [pSnap, oSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "orders")),
        getDoc(doc(db, "settings", "store")),
      ]);
      const prods = pSnap.docs.map((d) => ({ docId:d.id, ...d.data() }));
      const ords = oSnap.docs.map((d) => ({ docId:d.id, ...d.data() }));
      ords.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProducts(prods);
      setOrders(ords);
      if (settingsSnap.exists()) setSettings(settingsSnap.data());
    } catch (e) { setError("Failed to load: " + e.message); }
    setLoading(false);
  };

  useEffect(() => onAuthStateChanged(auth, (user) => setAuthed(user?.email?.toLowerCase() === "cchughiefe@gmail.com")), []);
  useEffect(() => { if (authed) loadData(); }, [authed]);

  const handleSaveProduct = async (data) => {
    try {
      if (editing?.docId) {
        await updateDoc(doc(db, "products", editing.docId), data);
      } else {
        await addDoc(collection(db, "products"), { ...data, createdAt:serverTimestamp() });
      }
      setShowForm(false); setEditing(null);
      await loadData();
    } catch (e) { alert("Failed to save: " + e.message); }
  };

  const handleDeleteProduct = async (product) => {
    try {
      await deleteDoc(doc(db, "products", product.docId));
      setConfirmDelete(null);
      await loadData();
    } catch (e) { alert("Failed to delete: " + e.message); }
  };

  const migrateImgBbImages = async () => {
    const pending = products.filter((product) => isImgBbUrl(product.imageUrl));
    if (!pending.length) {
      setMigration({ running:false, done:0, total:0, error:"All product images are already on Cloudinary." });
      return;
    }
    setMigration({ running:true, done:0, total:pending.length, error:"" });
    let done = 0;
    try {
      for (const product of pending) {
        const uploaded = await uploadToCloudinary(product.imageUrl, `product-${product.docId}`);
        await updateDoc(doc(db, "products", product.docId), {
          imageUrl:uploaded.secure_url,
          imagePublicId:uploaded.public_id,
          imageProvider:"cloudinary",
          legacyImageUrl:product.imageUrl,
          imageMigratedAt:serverTimestamp(),
        });
        done += 1;
        setMigration({ running:true, done, total:pending.length, error:"" });
      }
      await loadData();
      setMigration({ running:false, done, total:pending.length, error:"Migration complete. All product images now use Cloudinary." });
    } catch (error) {
      await loadData();
      setMigration({ running:false, done, total:pending.length, error:`Stopped after ${done} image${done === 1 ? "" : "s"}: ${error.message}` });
    }
  };

  const handleOrderAction = async (order, action) => {
    try {
      const next = action === "cancelled" ? "cancelled" :
        order.status === "pending" ? "confirmed" :
        order.status === "confirmed" ? "processing" :
        order.status === "processing" ? "shipped" : "delivered";
      const response = await fetch("/api/order-status", {
        method:"POST",
        headers:{ "Content-Type":"application/json", authorization:`Bearer ${await auth.currentUser.getIdToken()}` },
        body:JSON.stringify({ orderId:order.docId, action:next === "cancelled" ? "cancelled" : "advance" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      await loadData();
    } catch (e) { alert("Action failed: " + e.message); }
  };

  if (authed === null) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center"}}>Loading…</div>;
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pastOrders = orders.filter((o) => o.status !== "pending");
  const filteredOrders = orderSearch.trim()
    ? orders.filter(o =>
        (o.customerName || o.customer?.name)?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.customerPhone || o.customer?.phone)?.includes(orderSearch) ||
        (o.productName || o.orderRef || o.items?.map(i=>i.name).join(" "))?.toLowerCase().includes(orderSearch.toLowerCase())
      )
    : null;

  const exportOrders = () => {
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Reference","Date","Customer","Phone","Email","Items","Payment","Status","Subtotal","Delivery","Total"]];
    orders.forEach((order) => rows.push([
      order.orderRef,
      order.createdAt?.toDate?.().toISOString() || "",
      order.customer?.name || order.customerName || "",
      order.customer?.phone || order.customerPhone || "",
      order.customer?.email || "",
      order.items?.map((item) => `${item.name} x${item.quantity}`).join("; ") || order.productName || "",
      order.paymentMethod || "",
      order.status || "",
      order.subtotal || "",
      order.deliveryFee || "",
      order.total || "",
    ]));
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bright-orders-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"dashboard" },
    { id:"orders", label:"Orders", icon:"orders", count:pendingOrders.length },
    { id:"products", label:"Products", icon:"products", count:products.length },
    { id:"settings", label:"Store settings", icon:"settings" },
  ];

  return (
    <div className="admin-shell admin-v2">
      <aside className="admin-sidebar">
        <div className="admin-logo"><span className="admin-logo-mark">B</span><div><strong>Bright Admin</strong><small>Store management</small></div></div>
        <nav className="admin-nav">{tabs.map(t=><button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><AdminIcon name={t.icon}/><span>{t.label}</span>{t.count>0&&<b>{t.count}</b>}</button>)}</nav>
        <div className="admin-sidebar-foot"><a href="/" target="_blank" rel="noreferrer"><AdminIcon name="external" size={18}/>View storefront</a><button onClick={()=>signOut(auth)}><AdminIcon name="logout" size={18}/>Sign out</button></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar"><div><h1>{tabs.find(t=>t.id===tab)?.label}</h1><p>Manage Bright Accessories</p></div><div className="admin-topbar-actions"><button onClick={loadData}><AdminIcon name="refresh" size={17}/><span>Refresh data</span></button><a className="admin-avatar" href="/" title="Open store">BA</a></div></header>
        <div className="admin-content">
        {error && (
          <div className="admin-error"><span>{error}</span><button onClick={loadData}>Retry</button></div>
        )}
        {loading ? (
          <div className="admin-loading"><AdminIcon name="refresh" size={28}/><p>Loading store data…</p></div>
        ) : tab === "dashboard" ? (
          <Dashboard products={products} orders={orders} />
        ) : tab === "orders" ? (
          <>
            <div className="admin-page-heading"><div><span>FULFILMENT</span><h2>Customer orders</h2><p>Review payments and move orders through delivery.</p></div><button className="btn-outline" onClick={exportOrders}>Export CSV</button></div>
            <div className="v2-searchbar">
              <input className="input-field" placeholder="Search by name, phone or product..."
                value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>
            {filteredOrders ? (
              <>
                <h2 className="v2-section-heading">Search results <span>{filteredOrders.length}</span></h2>
                {filteredOrders.length === 0 ? (
                  <p style={{ color:"#888", textAlign:"center", padding:20 }}>No orders found</p>
                ) : filteredOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
              </>
            ) : (
              <>
                <h2 className="v2-section-heading">Needs attention <span>{pendingOrders.length}</span></h2>
                {pendingOrders.length === 0 ? (
                  <div style={{ textAlign:"center", padding:40, color:"#888" }}><p>No pending orders</p></div>
                ) : pendingOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
                {pastOrders.length > 0 && (
                  <>
                    <h2 className="v2-section-heading past">Order history <span>{pastOrders.length}</span></h2>
                    {pastOrders.map((o) => <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />)}
                  </>
                )}
              </>
            )}
          </>
        ) : tab === "settings" ? (
          <><div className="admin-page-heading"><div><span>CONFIGURATION</span><h2>Store settings</h2><p>Payment, support and delivery details.</p></div></div><StoreSettings value={settings} onSaved={setSettings} /></>
        ) : (
          <>
            <div className="admin-page-heading"><div><span>CATALOGUE</span><h2>Products</h2><p>Manage inventory, pricing and product photos.</p></div></div>
            <div className="v2-catalogue-tools">
              <button className="v2-secondary" disabled={migration.running} onClick={migrateImgBbImages}>{migration.running ? `Moving ${migration.done}/${migration.total}…` : `Move legacy images · ${products.filter((p) => isImgBbUrl(p.imageUrl)).length}`}</button>
              <button className="v2-primary" onClick={() => { setEditing(null); setShowForm(true); }}>＋ Add new product</button>
            </div>
            {migration.error && <div style={{background:migration.error.startsWith("Stopped")?"#FEE2E2":"#D1FAE5",color:migration.error.startsWith("Stopped")?"var(--red)":"var(--green)",padding:12,borderRadius:9,marginBottom:14,fontSize:13}}>{migration.error}</div>}
            {showForm && (
              <div className="overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
                <div className="v2-product-modal"
                  onClick={(e) => e.stopPropagation()}>
                  <ProductForm initial={editing} onSave={handleSaveProduct}
                    onCancel={() => { setShowForm(false); setEditing(null); }} />
                </div>
              </div>
            )}
            {confirmDelete && (
              <div className="overlay" onClick={() => setConfirmDelete(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign:"center", maxWidth:340 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
                  <h3 style={{ marginBottom:8 }}>Delete Product?</h3>
                  <p style={{ color:"#666", fontSize:14, marginBottom:20 }}>
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
                  </p>
                  <div style={{ display:"flex", gap:10 }}>
                    <button className="btn-outline" onClick={() => setConfirmDelete(null)} style={{ flex:1 }}>Cancel</button>
                    <button onClick={() => handleDeleteProduct(confirmDelete)}
                      style={{ flex:1, padding:"12px 0", border:"none", background:"var(--red)", color:"white", borderRadius:8, fontWeight:600, fontSize:14, cursor:"pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            {products.length === 0 ? (
              <div style={{ textAlign:"center", color:"#888", padding:40 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📦</div>
                <p>No products yet. Add your first product!</p>
              </div>
            ) : <div className="v2-product-grid">{products.map((p) => (
              <article key={p.docId} className="v2-product-card">
                <div className="v2-product-photo">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="v2-no-photo">📱</div>
                  )}
                  {p.featured && <span className="v2-featured">Featured</span>}
                </div>
                <div className="v2-product-copy"><small>{p.category || "Accessories"}</small><h3>{p.name}</h3><strong>{fmt(p.sellingPrice)}</strong><p className={p.availableQuantity <= 0 ? "out" : p.availableQuantity < 5 ? "low" : ""}>{p.availableQuantity <= 0 ? "Out of stock" : `${p.availableQuantity} units in stock`}</p></div>
                <div className="v2-product-actions"><button onClick={() => { setEditing(p); setShowForm(true); }}>Edit</button><button onClick={() => setConfirmDelete(p)}>Delete</button></div>
              </article>
            ))}</div>}
          </>
        )}
        </div>
      </main>
      <nav className="admin-mobile-nav">{tabs.map(t=><button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><AdminIcon name={t.icon}/><span>{t.label}</span></button>)}</nav>
    </div>
  );
}
