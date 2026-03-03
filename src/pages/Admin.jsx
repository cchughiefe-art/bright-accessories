import React, { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "../firebase";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const IMGBB_KEY = "d025f246af80b099e6744a75bdfc8d30";
const ADMIN_PASSWORD = "Brightaccess2026";

const EMPTY_PRODUCT = {
  name: "", sellingPrice: "", costPrice: "", deliveryCost: "",
  availableQuantity: "", description: "", imageUrl: ""
};

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "var(--dark)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <h1 style={{ color: "var(--gold)", marginBottom: 6, fontSize: 24 }}>Bright Admin</h1>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>Enter password to continue</p>
        <input className="input-field" type="password" placeholder="Admin Password"
          value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (pw === ADMIN_PASSWORD ? onLogin() : setErr("Wrong password"))}
          style={{ marginBottom: 12 }} />
        {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</p>}
        <button className="btn-gold" style={{ width: "100%" }}
          onClick={() => pw === ADMIN_PASSWORD ? onLogin() : setErr("Wrong password")}>
          Login
        </button>
      </div>
    </div>
  );
}

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_PRODUCT);
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
      const fd = new FormData();
      fd.append("image", imgFile);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setUploading(false);
      if (data.success) return data.data.url;
      throw new Error(data.error?.message || "Upload failed");
    } catch (e) {
      setUploading(false);
      throw e;
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sellingPrice) {
      setErr("Name and Selling Price are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const imageUrl = await uploadImage();
      await onSave({
        ...form,
        imageUrl,
        sellingPrice: Number(form.sellingPrice),
        costPrice: Number(form.costPrice || 0),
        deliveryCost: Number(form.deliveryCost || 0),
        availableQuantity: Number(form.availableQuantity || 0),
      });
    } catch (e) {
      setErr("Save failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="modal" style={{ maxWidth: "100%" }}>
      <h3 style={{ marginBottom: 18 }}>{initial?.id ? "Edit Product" : "Add New Product"}</h3>
      {[
        { k: "name", label: "Product Name *", ph: "e.g. iPhone 15 Case" },
        { k: "sellingPrice", label: "Selling Price (N) *", ph: "e.g. 5000", type: "number" },
        { k: "costPrice", label: "Cost Price (N)", ph: "e.g. 2500", type: "number" },
        { k: "deliveryCost", label: "Delivery Cost (N)", ph: "e.g. 500", type: "number" },
        { k: "availableQuantity", label: "Stock Quantity", ph: "e.g. 20", type: "number" },
      ].map(({ k, label, ph, type = "text" }) => (
        <div key={k} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</label>
          <input className="input-field" type={type} placeholder={ph}
            value={form[k]} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>Description</label>
        <textarea className="input-field" rows={2} placeholder="Short product description"
          value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>Product Image</label>
        {preview && (
          <img src={preview} alt="preview"
            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
        )}
        <input type="file" accept="image/*" onChange={handleImagePick}
          style={{ fontSize: 13, display: "block" }} />
        {uploading && (
          <p style={{ fontSize: 12, color: "var(--gold)", marginTop: 6, fontWeight: 600 }}>
            Uploading image... please wait
          </p>
        )}
      </div>
      {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn-gold" onClick={handleSave} disabled={saving || uploading} style={{ flex: 2 }}>
          {uploading ? "Uploading Image..." : saving ? "Saving..." : "Save Product"}
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("orders");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [pSnap, oSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "orders")),
      ]);
      const prods = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const ords = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      ords.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProducts(prods);
      setOrders(ords);
    } catch (e) {
      setError("Failed to load data: " + e.message);
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const handleSaveProduct = async (data) => {
    if (editing?.id) {
      await updateDoc(doc(db, "products", editing.id), data);
    } else {
      await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
    }
    setShowForm(false);
    setEditing(null);
    await loadData();
  };

  const handleOrderAction = async (order, action) => {
    await updateDoc(doc(db, "orders", order.id), { status: action });
    if (action === "successful") {
      await updateDoc(doc(db, "products", order.productId), {
        availableQuantity: increment(-order.quantity),
      });
    }
    await loadData();
  };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pastOrders = orders.filter((o) => o.status !== "pending");

  return (
    <div style={{ minHeight: "100vh", background: "var(--light)" }}>
      <header style={{ background: "var(--dark)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ color: "var(--gold)", fontSize: 20 }}>Bright Admin</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={loadData} style={{ background: "transparent", border: "1px solid #555", color: "#aaa", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
          <a href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none" }}>Store</a>
        </div>
      </header>

      <div style={{ display: "flex", background: "white", borderBottom: "1.5px solid var(--border)" }}>
        {[
          { id: "orders", label: `Orders${pendingOrders.length ? ` (${pendingOrders.length})` : ""}` },
          { id: "products", label: `Products (${products.length})` },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "14px 0", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 15, cursor: "pointer",
              color: tab === t.id ? "var(--gold)" : "#888",
              borderBottom: tab === t.id ? "3px solid var(--gold)" : "3px solid transparent",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ background: "#FEE2E2", color: "var(--red)", padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {error}
            <button onClick={loadData} style={{ marginLeft: 10, fontWeight: 700, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "var(--gold)", fontWeight: 600 }}>Loading...</p>
          </div>
        ) : tab === "orders" ? (
          <>
            <h2 style={{ marginBottom: 14, fontSize: 18 }}>
              Pending Orders ({pendingOrders.length})
            </h2>
            {pendingOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <p>No pending orders</p>
              </div>
            ) : (
              pendingOrders.map((o) => (
                <div key={o.id} className="card" style={{ marginBottom: 14, padding: 16 }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    {o.productImage && (
                      <img src={o.productImage} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15 }}>{o.productName}</p>
                      <p style={{ fontSize: 13, color: "#555" }}>Qty: {o.quantity} x {fmt(o.sellingPrice)}</p>
                      <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 16 }}>Total: {fmt(o.total)}</p>
                    </div>
                  </div>
                  <div style={{ background: "#f9f5f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#444", lineHeight: 1.8, marginBottom: 14 }}>
                    <p>👤 <strong>{o.customerName}</strong></p>
                    <p>📞 {o.customerPhone}</p>
                    <p>📍 {o.deliveryAddress}</p>
                    {o.notes && <p>📝 {o.notes}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleOrderAction(o, "cancelled")}
                      style={{ flex: 1, padding: "10px 0", border: "1.5px solid var(--red)", background: "transparent",
                        color: "var(--red)", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button onClick={() => handleOrderAction(o, "successful")}
                      style={{ flex: 2, padding: "10px 0", border: "none", background: "var(--green)",
                        color: "white", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      ✓ Mark Delivered
                    </button>
                  </div>
                </div>
              ))
            )}

            {pastOrders.length > 0 && (
              <>
                <h2 style={{ margin: "24px 0 12px", fontSize: 16, color: "#888" }}>
                  Past Orders ({pastOrders.length})
                </h2>
                {pastOrders.map((o) => (
                  <div key={o.id} style={{ background: "white", borderRadius: 12, padding: 14, marginBottom: 10,
                    border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{o.productName}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                        background: o.status === "successful" ? "#D1FAE5" : "#FEE2E2",
                        color: o.status === "successful" ? "var(--green)" : "var(--red)"
                      }}>{o.status}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#666" }}>{o.customerName} • {o.customerPhone}</p>
                    <p style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{fmt(o.total)}</p>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18 }}>Products ({products.length})</h2>
              <button className="btn-gold" style={{ padding: "10px 18px", fontSize: 14 }}
                onClick={() => { setEditing(null); setShowForm(true); }}>+ Add</button>
            </div>

            {showForm && (
              <div className="overlay" onClick={() => { setShowForm(false); setEditing(null); }}>
                <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
                  onClick={(e) => e.stopPropagation()}>
                  <ProductForm
                    initial={editing}
                    onSave={handleSaveProduct}
                    onCancel={() => { setShowForm(false); setEditing(null); }}
                  />
                </div>
              </div>
            )}

            {products.length === 0 ? (
              <div style={{ textAlign: "center", color: "#888", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <p>No products yet. Add your first product!</p>
              </div>
            ) : (
              products.map((p) => (
                <div key={p.id} className="card" style={{ marginBottom: 14, padding: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 70, height: 70, background: "#f0ece8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>📱</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{p.name}</p>
                      <p style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{fmt(p.sellingPrice)}</p>
                      <p style={{ fontSize: 12, color: "#777" }}>Stock: {p.availableQuantity} • Cost: {fmt(p.costPrice)}</p>
                      {p.description && <p style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{p.description}</p>}
                    </div>
                    <button className="btn-gold" style={{ fontSize: 13, padding: "8px 16px", flexShrink: 0 }}
                      onClick={() => { setEditing(p); setShowForm(true); }}>Edit</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
