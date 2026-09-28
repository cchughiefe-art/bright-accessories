import React, { useState, useEffect } from "react";
import {
  collection, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth } from "../firebase";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const isImgBbUrl = (url = "") => /^https?:\/\/(?:i\.)?ibb\.co\//i.test(url) || /imgbb\.com/i.test(url);

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
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true); setErr("");
    try { await signInWithEmailAndPassword(auth, email.trim(), pw); onLogin(); }
    catch { setErr("Email or password is incorrect."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight:"100vh", background:"#1A1A1A", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"white", borderRadius:16, padding:32, width:"100%", maxWidth:360, textAlign:"center" }}>
        <h1 style={{ color:"var(--gold)", marginBottom:6, fontSize:24 }}>Bright Admin</h1>
        <p style={{ color:"#888", fontSize:13, marginBottom:24 }}>Sign in with your protected administrator account</p>
        <input className="input-field" type="email" placeholder="Admin email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ marginBottom:12 }} />
        <input className="input-field" type="password" placeholder="Admin Password"
          value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          style={{ marginBottom:12 }} />
        {err && <p style={{ color:"var(--red)", fontSize:13, marginBottom:10 }}>{err}</p>}
        <button className="btn-gold" style={{ width:"100%" }}
          disabled={busy || !email || !pw} onClick={login}>
          {busy ? "Signing in..." : "Login"}
        </button>
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
    <div style={{ marginBottom:24 }}>
      <h2 style={{ fontSize:17, marginBottom:14 }}>Dashboard</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {[
          { label:"Total Revenue", value:fmt(revenue), color:"var(--green)", icon:"💰" },
          { label:"Net Profit", value:fmt(profit), color:profit >= 0 ? "var(--green)" : "var(--red)", icon:"📈" },
          { label:"Pending Orders", value:pending.length, color:"var(--orange)", icon:"⏳" },
          { label:"Delivered", value:successful.length, color:"var(--green)", icon:"✅" },
        ].map((stat) => (
          <div key={stat.label} style={{ background:"white", borderRadius:12, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.07)" }}>
            <p style={{ fontSize:20, marginBottom:4 }}>{stat.icon}</p>
            <p style={{ fontSize:18, fontWeight:700, color:stat.color }}>{stat.value}</p>
            <p style={{ fontSize:11, color:"#888", marginTop:2 }}>{stat.label}</p>
          </div>
        ))}
      </div>
      {lowStock.length > 0 && (
        <div style={{ background:"#FEF3C7", borderRadius:12, padding:14, marginBottom:12 }}>
          <p style={{ fontWeight:700, color:"var(--orange)", fontSize:14, marginBottom:8 }}>
            Low Stock Alert ({lowStock.length} products)
          </p>
          {lowStock.map(p => (
            <p key={p.docId} style={{ fontSize:13, color:"#555", marginBottom:4 }}>
              - {p.name} - {p.availableQuantity} units left
            </p>
          ))}
        </div>
      )}
      {outOfStock.length > 0 && (
        <div style={{ background:"#FEE2E2", borderRadius:12, padding:14 }}>
          <p style={{ fontWeight:700, color:"var(--red)", fontSize:14, marginBottom:8 }}>
            Out of Stock ({outOfStock.length} products)
          </p>
          {outOfStock.map(p => (
            <p key={p.docId} style={{ fontSize:13, color:"#555", marginBottom:4 }}>- {p.name}</p>
          ))}
        </div>
      )}
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
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    setPreview(URL.createObjectURL(file));
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
    setSaving(true); setErr("");
    try {
      const imageUrl = await uploadImage();
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Accessories",
        active: true,
        imageUrl,
        featured: form.featured,
        sellingPrice: Number(form.sellingPrice),
        costPrice: Number(form.costPrice || 0),
        deliveryCost: Number(form.deliveryCost || 0),
        availableQuantity: Number(form.availableQuantity || 0),
      });
    } catch (e) { setErr("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="modal" style={{ maxWidth:"100%" }}>
      <h3 style={{ marginBottom:18 }}>{initial?.docId ? "Edit Product" : "Add New Product"}</h3>
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
      <div style={{ marginBottom:18 }}>
        <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:5 }}>Product Image</label>
        {preview && (
          <img src={preview} alt="preview"
            style={{ width:100, height:100, objectFit:"cover", borderRadius:8, marginBottom:8, display:"block" }} />
        )}
        <input type="file" accept="image/*" onChange={handleImagePick} style={{ fontSize:13, display:"block" }} />
        {uploading && <p style={{ fontSize:12, color:"var(--gold)", marginTop:6, fontWeight:600 }}>Uploading image...</p>}
      </div>
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
    <div className="card" style={{ marginBottom:14, padding:16 }}>
      <div style={{ display:"flex", gap:12, marginBottom:12 }}>
        {items[0]?.imageUrl ? (
          <img src={items[0].imageUrl} alt="" loading="lazy"
            style={{ width:56, height:56, objectFit:"cover", borderRadius:8, flexShrink:0 }} />
        ) : (
          <div style={{ width:56, height:56, background:"#f0ece8", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>📱</div>
        )}
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:700, fontSize:15 }}>{o.orderRef || items[0]?.name}</p>
          <p style={{ fontSize:13, color:"#555" }}>{items.map(i => i.name + " × " + i.quantity).join(", ")}</p>
          <p style={{ color:"var(--gold)", fontWeight:700, fontSize:16 }}>Total: {fmt(o.total)}</p>
        </div>
      </div>
      <div style={{ background:"#f9f5f0", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#444", lineHeight:1.8, marginBottom:14 }}>
        <p>Name: {customer.name}</p>
        <p>Phone: {customer.phone}</p>
        <p>Address: {customer.address}</p>
        <p>Payment: {o.paymentMethod === "transfer" ? "Bank transfer" : "Cash on delivery"} · {o.paymentStatus || "pending"}</p>
        {o.receiptUrl && <p><a href={o.receiptUrl} target="_blank" rel="noreferrer" style={{color:"var(--gold)",fontWeight:700}}>View receipt</a></p>}
        {o.notes && <p>Notes: {o.notes}</p>}
      </div>
      {active && (
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => onAction(o, "cancelled")}
            style={{ flex:1, padding:"10px 0", border:"1.5px solid var(--red)", background:"transparent", color:"var(--red)", borderRadius:8, fontWeight:600, fontSize:14, cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={() => onAction(o, "advance")}
            style={{ flex:2, padding:"10px 0", border:"none", background:"var(--green)", color:"white", borderRadius:8, fontWeight:600, fontSize:14, cursor:"pointer" }}>
            {nextLabel}
          </button>
        </div>
      )}
      {!active && (
        <span style={{
          fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:20,
          background: ["successful","delivered"].includes(o.status) ? "#D1FAE5" : "#FEE2E2",
          color: ["successful","delivered"].includes(o.status) ? "var(--green)" : "var(--red)"
        }}>{o.status}</span>
      )}
    </div>
  );
}

function StoreSettings({ value, onSaved }) {
  const [form, setForm] = useState({
    bankName:value.bankName || "", accountNumber:value.accountNumber || "",
    accountName:value.accountName || "", whatsapp:value.whatsapp || "234",
    mainland:value.deliveryZones?.find(z=>z.id==="mainland")?.fee || 2500,
    island:value.deliveryZones?.find(z=>z.id==="island")?.fee || 3500,
    nationwide:value.deliveryZones?.find(z=>z.id==="nationwide")?.fee || 5000,
  });
  const [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    setBusy(true);setMessage("");
    try {
      const data={bankName:form.bankName.trim(),accountNumber:form.accountNumber.trim(),accountName:form.accountName.trim(),whatsapp:form.whatsapp.replace(/\D/g,""),deliveryZones:[
        {id:"mainland",name:"Lagos Mainland",fee:Number(form.mainland)},
        {id:"island",name:"Lagos Island",fee:Number(form.island)},
        {id:"nationwide",name:"Outside Lagos",fee:Number(form.nationwide)}
      ],updatedAt:serverTimestamp()};
      await setDoc(doc(db,"settings","store"),data,{merge:true}); onSaved(data); setMessage("Store settings saved. Website and APK will use them immediately.");
    } catch(e){setMessage("Could not save: "+e.message)} finally{setBusy(false)}
  };
  return <div className="card" style={{padding:20,maxWidth:680,margin:"0 auto"}}><h2 style={{marginBottom:5}}>Store Settings</h2><p style={{color:"#777",fontSize:13,marginBottom:22}}>Update payment, support and delivery details without changing code.</p>
    <h3 style={{fontSize:15,marginBottom:12}}>Bank transfer account</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <label>Bank name<input className="input-field" value={form.bankName} onChange={e=>set("bankName",e.target.value)}/></label>
      <label>Account number<input className="input-field" inputMode="numeric" value={form.accountNumber} onChange={e=>set("accountNumber",e.target.value)}/></label>
    </div>
    <label style={{display:"block",marginTop:12}}>Account name<input className="input-field" value={form.accountName} onChange={e=>set("accountName",e.target.value)}/></label>
    <label style={{display:"block",marginTop:12}}>WhatsApp number <small style={{color:"#888"}}>(country code, no +)</small><input className="input-field" value={form.whatsapp} onChange={e=>set("whatsapp",e.target.value)}/></label>
    <h3 style={{fontSize:15,margin:"24px 0 12px"}}>Delivery charges</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
      <label>Lagos Mainland<input className="input-field" type="number" value={form.mainland} onChange={e=>set("mainland",e.target.value)}/></label>
      <label>Lagos Island<input className="input-field" type="number" value={form.island} onChange={e=>set("island",e.target.value)}/></label>
      <label>Outside Lagos<input className="input-field" type="number" value={form.nationwide} onChange={e=>set("nationwide",e.target.value)}/></label>
    </div>
    {message&&<p style={{margin:"14px 0",fontSize:13,color:message.startsWith("Could")?"var(--red)":"var(--green)"}}>{message}</p>}
    <button className="btn-gold" disabled={busy||!form.bankName||!form.accountNumber||!form.accountName} onClick={save} style={{width:"100%",marginTop:20}}>{busy?"Saving…":"Save Store Settings"}</button>
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

  useEffect(() => onAuthStateChanged(auth, (user) => setAuthed(Boolean(user))), []);
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
      await updateDoc(doc(db, "orders", order.docId), {
        status:next,
        paymentStatus: order.paymentMethod === "transfer" && next === "confirmed" ? "verified" : (order.paymentStatus || "pay_on_delivery")
      });
      if (order.orderRef) await updateDoc(doc(db, "publicOrders", order.orderRef), {
        status:next, updatedAt:serverTimestamp()
      });
      if (next === "delivered") {
        const items = order.items || [{ productId:order.productId, quantity:order.quantity }];
        for (const item of items) await updateDoc(doc(db, "products", item.productId), {
          availableQuantity: increment(-Number(item.quantity || 1)),
        });
      }
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

  const tabs = [
    { id:"dashboard", label:"Dashboard" },
    { id:"orders", label:"Orders" + (pendingOrders.length ? " (" + pendingOrders.length + ")" : "") },
    { id:"products", label:"Products (" + products.length + ")" },
    { id:"settings", label:"Store Settings" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--light)" }}>
      <header style={{ background:"var(--dark)", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ color:"var(--gold)", fontSize:20 }}>Bright Admin</h1>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <button onClick={loadData}
            style={{ background:"transparent", border:"1px solid #555", color:"#aaa", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer" }}>
            Refresh
          </button>
          <a href="/" style={{ color:"#aaa", fontSize:13, textDecoration:"none" }}>Store</a>
          <button onClick={() => signOut(auth)}
            style={{ background:"transparent", border:"1px solid #555", color:"#aaa", borderRadius:6, padding:"6px 12px", fontSize:12 }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display:"flex", background:"white", borderBottom:"1.5px solid var(--border)", overflowX:"auto" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex:1, padding:"13px 8px", border:"none", background:"transparent",
              fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap",
              color: tab === t.id ? "var(--gold)" : "#888",
              borderBottom: tab === t.id ? "3px solid var(--gold)" : "3px solid transparent",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding:16 }}>
        {error && (
          <div style={{ background:"#FEE2E2", color:"var(--red)", padding:14, borderRadius:10, marginBottom:16, fontSize:13 }}>
            {error}
            <button onClick={loadData} style={{ marginLeft:10, fontWeight:700, background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>Retry</button>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
            <p style={{ color:"var(--gold)", fontWeight:600 }}>Loading...</p>
          </div>
        ) : tab === "dashboard" ? (
          <Dashboard products={products} orders={orders} />
        ) : tab === "orders" ? (
          <>
            <div style={{ marginBottom:16 }}>
              <input className="input-field" placeholder="Search by name, phone or product..."
                value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>
            {filteredOrders ? (
              <>
                <h2 style={{ marginBottom:14, fontSize:16 }}>Results ({filteredOrders.length})</h2>
                {filteredOrders.length === 0 ? (
                  <p style={{ color:"#888", textAlign:"center", padding:20 }}>No orders found</p>
                ) : filteredOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
              </>
            ) : (
              <>
                <h2 style={{ marginBottom:14, fontSize:18 }}>Pending Orders ({pendingOrders.length})</h2>
                {pendingOrders.length === 0 ? (
                  <div style={{ textAlign:"center", padding:40, color:"#888" }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                    <p>No pending orders</p>
                  </div>
                ) : pendingOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
                {pastOrders.length > 0 && (
                  <>
                    <h2 style={{ margin:"24px 0 12px", fontSize:16, color:"#888" }}>Past Orders ({pastOrders.length})</h2>
                    {pastOrders.map((o) => (
                      <div key={o.docId} style={{ background:"white", borderRadius:12, padding:14, marginBottom:10, border:"1px solid var(--border)" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                          <span style={{ fontSize:14, fontWeight:600 }}>{o.orderRef || o.productName || o.items?.map(i=>i.name).join(", ")}</span>
                          <span style={{
                            fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20,
                            background: o.status === "successful" ? "#D1FAE5" : "#FEE2E2",
                            color: o.status === "successful" ? "var(--green)" : "var(--red)"
                          }}>{o.status}</span>
                        </div>
                        <p style={{ fontSize:13, color:"#666" }}>{o.customerName || o.customer?.name} - {o.customerPhone || o.customer?.phone}</p>
                        <p style={{ fontSize:13, color:"var(--gold)", fontWeight:600 }}>{fmt(o.total)}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        ) : tab === "settings" ? (
          <StoreSettings value={settings} onSaved={setSettings} />
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <h2 style={{ fontSize:18 }}>Products ({products.length})</h2>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-outline" style={{ padding:"10px 14px", fontSize:13 }} disabled={migration.running}
                  onClick={migrateImgBbImages}>
                  {migration.running ? `Moving ${migration.done}/${migration.total}…` : `Move ImgBB images (${products.filter((p) => isImgBbUrl(p.imageUrl)).length})`}
                </button>
                <button className="btn-gold" style={{ padding:"10px 18px", fontSize:14 }}
                  onClick={() => { setEditing(null); setShowForm(true); }}>+ Add</button>
              </div>
            </div>
            {migration.error && <div style={{background:migration.error.startsWith("Stopped")?"#FEE2E2":"#D1FAE5",color:migration.error.startsWith("Stopped")?"var(--red)":"var(--green)",padding:12,borderRadius:9,marginBottom:14,fontSize:13}}>{migration.error}</div>}
            {showForm && (
              <div className="overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
                <div style={{ width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }}
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
            ) : products.map((p) => (
              <div key={p.docId} className="card" style={{ marginBottom:14, padding:14 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" loading="lazy"
                      style={{ width:70, height:70, objectFit:"cover", borderRadius:8, flexShrink:0 }} />
                  ) : (
                    <div style={{ width:70, height:70, background:"#f0ece8", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>📱</div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <p style={{ fontWeight:700, fontSize:15 }}>{p.name}</p>
                      {p.featured && <span style={{ background:"var(--gold)", color:"white", fontSize:10, padding:"2px 6px", borderRadius:10 }}>FEATURED</span>}
                    </div>
                    <p style={{ fontSize:13, color:"var(--gold)", fontWeight:600 }}>{fmt(p.sellingPrice)}</p>
                    <p style={{ fontSize:12, color: p.availableQuantity < 5 ? "var(--orange)" : "#777" }}>
                      Stock: {p.availableQuantity}
                      {p.availableQuantity <= 0 ? " - Out of stock" : p.availableQuantity < 5 ? " - Low!" : ""}
                    </p>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                    <button className="btn-gold" style={{ fontSize:13, padding:"8px 16px" }}
                      onClick={() => { setEditing(p); setShowForm(true); }}>Edit</button>
                    <button onClick={() => setConfirmDelete(p)}
                      style={{ fontSize:13, padding:"8px 16px", border:"1.5px solid var(--red)", background:"transparent", color:"var(--red)", borderRadius:8, fontWeight:600, cursor:"pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
