import React, { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "../firebase";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const IMGBB_KEY = "d025f246af80b099e6744a75bdfc8d30";
const ADMIN_PASSWORD = "Brightaccess2026";

const EMPTY_PRODUCT = {
  name: "", sellingPrice: "", costPrice: "", deliveryCost: "",
  availableQuantity: "", description: "", imageUrl: "", featured: false
};

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
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

function Dashboard({ products, orders }) {
  const successful = orders.filter(o => o.status === "successful");
  const pending = orders.filter(o => o.status === "pending");
  const revenue = successful.reduce((s, o) => s + (o.total || 0), 0);
  const cogs = successful.reduce((s, o) => s + ((o.costPrice || 0) * (o.quantity || 1)), 0);
  const delivery = successful.reduce((s, o) => s + ((o.deliveryCost || 0) * (o.quantity || 1)), 0);
  const profit = revenue - cogs - delivery;
  const lowStock = products.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5);
  const outOfStock = products.filter(p => p.availableQuantity <= 0);

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 17, marginBottom: 14, color: "#1A1A1A" }}>Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Revenue", value: fmt(revenue), color: "var(--green)", icon: "💰" },
          { label: "Net Profit", value: fmt(profit), color: profit >= 0 ? "var(--green)" : "var(--red)", icon: "📈" },
          { label: "Pending Orders", value: pending.length, color: "var(--orange)", icon: "⏳" },
          { label: "Delivered", value: successful.length, color: "var(--green)", icon: "✅" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <p style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <p style={{ fontWeight: 700, color: "var(--orange)", fontSize: 14, marginBottom: 8 }}>
            ⚠️ Low Stock Alert ({lowStock.length} products)
          </p>
          {lowStock.map(p => (
            <p key={p.docId} style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
              • {p.name} — <strong>{p.availableQuantity} units left</strong>
            </p>
          ))}
        </div>
      )}

      {outOfStock.length > 0 && (
        <div style={{ background: "#FEE2E2", borderRadius: 12, padding: 14 }}>
          <p style={{ fontWeight: 700, color: "var(--red)", fontSize: 14, marginBottom: 8 }}>
            🚫 Out of Stock ({outOfStock.length} products)
          </p>
          {outOfStock.map(p => (
            <p key={p.docId} style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
              • {p.name}
            </p>
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
      const fd = new FormData();
      fd.append("image", imgFile);
      const res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_KEY, { method: "POST", body: fd });
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
    if (!form.name.trim() || !form.sellingPrice) { setErr("Name and Selling Price are required."); return; }
    setSaving(true); setErr("");
    try {
      const imageUrl = await uploadImage();
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
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
    <div className="modal" style={{ maxWidth: "100%" }}>
      <h3 style={{ marginBottom: 18 }}>{initial?.docId ? "Edit Product" : "Add New Product"}</h3>
      {[
        { k: "name", label: "Product Name *", ph: "e.g. iPhone 17 Case" },
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
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>⭐ Mark as Featured (shows at top)</span>
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>Product Image</label>
        {preview && (
          <img src={preview} alt="preview"
            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
        )}
        <input type="file" accept="image/*" onChange={handleImagePick} style={{ fontSize: 13, display: "block" }} />
        {uploading && <p style={{ fontSize: 12, color: "var(--gold)", marginTop: 6, fontWeight: 600 }}>Uploading image...</p>}
      </div>
      {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn-gold" onClick={handleSave} disabled={saving || uploading} style={{ flex: 2 }}>
          {uploading ? "Uploading..." : saving ? "Saving..." : "Save Product"}
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [pSnap, oSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "orders")),
      ]);
      const prods = pSnap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      const ords = oSnap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      ords.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProducts(prods);
      setOrders(ords);
    } catch (e) { setError("Failed to load: " + e.message); }
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const handleSaveProduct = async (data) => {
    try {
      if (editing?.docId) {
        await updateDoc(doc(db, "products", editing.docId), data);
      } else {
        await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
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

  const handleOrderAction = async (order, action) => {
    try {
      await updateDoc(doc(db, "orders", order.docId), { status: action });
      if (action === "successful") {
        await updateDoc(doc(db, "products", order.productId), {
          availableQuantity: increment(-order.quantity),
        });
      }
      await loadData();
    } catch (e) { alert("Action failed: " + e.message); }
  };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pastOrders = orders.filter((o) => o.status !== "pending");

  const filteredOrders = orderSearch.trim()
    ? orders.filter(o =>
        o.customerName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customerPhone?.includes(orderSearch) ||
        o.productName?.toLowerCase().includes(orderSearch.toLowerCase())
      )
    : null;

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "orders", label: "Orders" + (pendingOrders.length ? " (" + pendingOrders.length + ")" : "") },
    { id: "products", label: "Products (" + products.length + ")" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--light)" }}>
      <header style={{ background: "var(--dark)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ color: "var(--gold)", fontSize: 20 }}>Bright Admin</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={loadData}
            style={{ background: "transparent", border: "1px solid #555", color: "#aaa", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
          <a href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none" }}>Store</a>
        </div>
      </header>

      <div style={{ display: "flex", background: "white", borderBottom: "1.5px solid var(--border)", overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "13px 8px", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              color: tab === t.id ? "var(--gold)" : "#888",
              borderBottom: tab === t.id ? "3px solid var(--gold)" : "3px solid transparent",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ background: "#FEE2E2", color: "var(--red)", padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {error}
            <button onClick={loadData} style={{ marginLeft: 10, fontWeight: 700, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "var(--gold)", fontWeight: 600 }}>Loading...</p>
          </div>
        ) : tab === "dashboard" ? (
          <Dashboard products={products} orders={orders} />
        ) : tab === "orders" ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <input className="input-field" placeholder="Search by name, phone or product..."
                value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>

            {filteredOrders ? (
              <>
                <h2 style={{ marginBottom: 14, fontSize: 16 }}>Search Results ({filteredOrders.length})</h2>
                {filteredOrders.length === 0 ? (
                  <p style={{ color: "#888", textAlign: "center", padding: 20 }}>No orders found</p>
                ) : filteredOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: 14, fontSize: 18 }}>Pending Orders ({pendingOrders.length})</h2>
                {pendingOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <p>No pending orders</p>
                  </div>
                ) : pendingOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}

                {pastOrders.length > 0 && (
                  <>
                    <h2 style={{ margin: "24px 0 12px", fontSize: 16, color: "#888" }}>Past Orders ({pastOrders.length})</h2>
                    {pastOrders.map((o) => (
                      <div key={o.docId} style={{ background: "white", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{o.productName}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                            background: o.status === "successful" ? "#D1FAE5" : "#FEE2E2",
                            color: o.status === "successful" ? "var(--green)" : "var(--red)"
                          }}>{o.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#666" }}>{o.customerName} - {o.customerPhone}</p>
                        <p style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{fmt(o.total)}</p>
                      </div>
                    ))}
                  </>
                )}
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
                  <ProductForm initial={editing} onSave={handleSaveProduct}
                    onCancel={() => { setShowForm(false); setEditing(null); }} />
                </div>
              </div>
            )}

            {confirmDelete && (
              <div className="overlay" onClick={() => setConfirmDelete(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 340 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
                  <h3 style={{ marginBottom: 8 }}>Delete Product?</h3>
                  <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-outline" onClick={() => setConfirmDelete(null)} style={{ flex: 1 }}>Cancel</button>
                    <button onClick={() => handleDeleteProduct(confirmDelete)}
                      style={{ flex: 1, padding: "12px 0", border: "none", background: "var(--red)", color: "white", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
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
                <div key={p.docId} className="card" style={{ marginBottom: 14, padding: 14 }}>
                  <div 

cat > src/pages/Admin.jsx << 'EOF'
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "../firebase";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const IMGBB_KEY = "d025f246af80b099e6744a75bdfc8d30";
const ADMIN_PASSWORD = "Brightaccess2026";

const EMPTY_PRODUCT = {
  name: "", sellingPrice: "", costPrice: "", deliveryCost: "",
  availableQuantity: "", description: "", imageUrl: "", featured: false
};

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
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

function Dashboard({ products, orders }) {
  const successful = orders.filter(o => o.status === "successful");
  const pending = orders.filter(o => o.status === "pending");
  const revenue = successful.reduce((s, o) => s + (o.total || 0), 0);
  const cogs = successful.reduce((s, o) => s + ((o.costPrice || 0) * (o.quantity || 1)), 0);
  const delivery = successful.reduce((s, o) => s + ((o.deliveryCost || 0) * (o.quantity || 1)), 0);
  const profit = revenue - cogs - delivery;
  const lowStock = products.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5);
  const outOfStock = products.filter(p => p.availableQuantity <= 0);

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 17, marginBottom: 14, color: "#1A1A1A" }}>Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Revenue", value: fmt(revenue), color: "var(--green)", icon: "💰" },
          { label: "Net Profit", value: fmt(profit), color: profit >= 0 ? "var(--green)" : "var(--red)", icon: "📈" },
          { label: "Pending Orders", value: pending.length, color: "var(--orange)", icon: "⏳" },
          { label: "Delivered", value: successful.length, color: "var(--green)", icon: "✅" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <p style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <p style={{ fontWeight: 700, color: "var(--orange)", fontSize: 14, marginBottom: 8 }}>
            ⚠️ Low Stock Alert ({lowStock.length} products)
          </p>
          {lowStock.map(p => (
            <p key={p.docId} style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
              • {p.name} — <strong>{p.availableQuantity} units left</strong>
            </p>
          ))}
        </div>
      )}

      {outOfStock.length > 0 && (
        <div style={{ background: "#FEE2E2", borderRadius: 12, padding: 14 }}>
          <p style={{ fontWeight: 700, color: "var(--red)", fontSize: 14, marginBottom: 8 }}>
            🚫 Out of Stock ({outOfStock.length} products)
          </p>
          {outOfStock.map(p => (
            <p key={p.docId} style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
              • {p.name}
            </p>
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
      const fd = new FormData();
      fd.append("image", imgFile);
      const res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_KEY, { method: "POST", body: fd });
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
    if (!form.name.trim() || !form.sellingPrice) { setErr("Name and Selling Price are required."); return; }
    setSaving(true); setErr("");
    try {
      const imageUrl = await uploadImage();
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
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
    <div className="modal" style={{ maxWidth: "100%" }}>
      <h3 style={{ marginBottom: 18 }}>{initial?.docId ? "Edit Product" : "Add New Product"}</h3>
      {[
        { k: "name", label: "Product Name *", ph: "e.g. iPhone 17 Case" },
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
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>⭐ Mark as Featured (shows at top)</span>
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>Product Image</label>
        {preview && (
          <img src={preview} alt="preview"
            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
        )}
        <input type="file" accept="image/*" onChange={handleImagePick} style={{ fontSize: 13, display: "block" }} />
        {uploading && <p style={{ fontSize: 12, color: "var(--gold)", marginTop: 6, fontWeight: 600 }}>Uploading image...</p>}
      </div>
      {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn-gold" onClick={handleSave} disabled={saving || uploading} style={{ flex: 2 }}>
          {uploading ? "Uploading..." : saving ? "Saving..." : "Save Product"}
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [pSnap, oSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "orders")),
      ]);
      const prods = pSnap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      const ords = oSnap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      ords.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProducts(prods);
      setOrders(ords);
    } catch (e) { setError("Failed to load: " + e.message); }
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const handleSaveProduct = async (data) => {
    try {
      if (editing?.docId) {
        await updateDoc(doc(db, "products", editing.docId), data);
      } else {
        await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
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

  const handleOrderAction = async (order, action) => {
    try {
      await updateDoc(doc(db, "orders", order.docId), { status: action });
      if (action === "successful") {
        await updateDoc(doc(db, "products", order.productId), {
          availableQuantity: increment(-order.quantity),
        });
      }
      await loadData();
    } catch (e) { alert("Action failed: " + e.message); }
  };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pastOrders = orders.filter((o) => o.status !== "pending");

  const filteredOrders = orderSearch.trim()
    ? orders.filter(o =>
        o.customerName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customerPhone?.includes(orderSearch) ||
        o.productName?.toLowerCase().includes(orderSearch.toLowerCase())
      )
    : null;

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "orders", label: "Orders" + (pendingOrders.length ? " (" + pendingOrders.length + ")" : "") },
    { id: "products", label: "Products (" + products.length + ")" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--light)" }}>
      <header style={{ background: "var(--dark)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ color: "var(--gold)", fontSize: 20 }}>Bright Admin</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={loadData}
            style={{ background: "transparent", border: "1px solid #555", color: "#aaa", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
          <a href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none" }}>Store</a>
        </div>
      </header>

      <div style={{ display: "flex", background: "white", borderBottom: "1.5px solid var(--border)", overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "13px 8px", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              color: tab === t.id ? "var(--gold)" : "#888",
              borderBottom: tab === t.id ? "3px solid var(--gold)" : "3px solid transparent",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ background: "#FEE2E2", color: "var(--red)", padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {error}
            <button onClick={loadData} style={{ marginLeft: 10, fontWeight: 700, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "var(--gold)", fontWeight: 600 }}>Loading...</p>
          </div>
        ) : tab === "dashboard" ? (
          <Dashboard products={products} orders={orders} />
        ) : tab === "orders" ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <input className="input-field" placeholder="Search by name, phone or product..."
                value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>

            {filteredOrders ? (
              <>
                <h2 style={{ marginBottom: 14, fontSize: 16 }}>Search Results ({filteredOrders.length})</h2>
                {filteredOrders.length === 0 ? (
                  <p style={{ color: "#888", textAlign: "center", padding: 20 }}>No orders found</p>
                ) : filteredOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: 14, fontSize: 18 }}>Pending Orders ({pendingOrders.length})</h2>
                {pendingOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <p>No pending orders</p>
                  </div>
                ) : pendingOrders.map((o) => (
                  <OrderCard key={o.docId} o={o} onAction={handleOrderAction} fmt={fmt} />
                ))}

                {pastOrders.length > 0 && (
                  <>
                    <h2 style={{ margin: "24px 0 12px", fontSize: 16, color: "#888" }}>Past Orders ({pastOrders.length})</h2>
                    {pastOrders.map((o) => (
                      <div key={o.docId} style={{ background: "white", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{o.productName}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                            background: o.status === "successful" ? "#D1FAE5" : "#FEE2E2",
                            color: o.status === "successful" ? "var(--green)" : "var(--red)"
                          }}>{o.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#666" }}>{o.customerName} - {o.customerPhone}</p>
                        <p style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{fmt(o.total)}</p>
                      </div>
                    ))}
                  </>
                )}
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
                  <ProductForm initial={editing} onSave={handleSaveProduct}
                    onCancel={() => { setShowForm(false); setEditing(null); }} />
                </div>
              </div>
            )}

            {confirmDelete && (
              <div className="overlay" onClick={() => setConfirmDelete(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 340 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
                  <h3 style={{ marginBottom: 8 }}>Delete Product?</h3>
                  <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-outline" onClick={() => setConfirmDelete(null)} style={{ flex: 1 }}>Cancel</button>
                    <button onClick={() => handleDeleteProduct(confirmDelete)}
                      style={{ flex: 1, padding: "12px 0", border: "none", background: "var(--red)", color: "white", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
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
                <div key={p.docId} className="card" style={{ marginBottom: 14, padding: 14 }}>
                  <div 

);
}
