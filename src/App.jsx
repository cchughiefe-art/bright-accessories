import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const fmt = (n) => `₦${Number(n).toLocaleString("en-NG")}`;

function StockBadge({ qty }) {
  if (qty <= 0) return <span className="badge badge-out">Out of Stock</span>;
  if (qty < 5) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-in">In Stock</span>;
}

function OrderModal({ product, onClose }) {
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const total = qty * product.sellingPrice;

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please fill in Name, Phone, and Address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const orderData = {
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl || "",
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice || 0,
        deliveryCost: product.deliveryCost || 0,
        quantity: qty,
        total,
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        deliveryAddress: form.address.trim(),
        notes: form.notes.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "orders"), orderData);
      await fetch("/api/order-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderData, createdAt: new Date().toISOString() }),
      });
      setDone(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>Order Placed!</h2>
          <p style={{ color: "#555", marginBottom: 4 }}>Thank you, <strong>{form.name}</strong>!</p>
          <p style={{ color: "#555", marginBottom: 20, fontSize: 14 }}>
            We will contact you on <strong>{form.phone}</strong> to arrange delivery.<br />
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>Pay on Delivery</span>
          </p>
          <button className="btn-gold" style={{ width: "100%" }} onClick={onClose}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
          )}
          <div>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>{product.name}</h3>
            <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 16 }}>{fmt(product.sellingPrice)}</p>
            <StockBadge qty={product.availableQuantity} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>Quantity</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 18, background: "white" }}>-</button>
            <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty(q => Math.min(Math.min(20, product.availableQuantity), q + 1))}
              style={{ width: 36, height: 36, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 18, background: "white" }}>+</button>
            <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 15 }}>Total: {fmt(total)}</span>
          </div>
        </div>
        {[
          { key: "name", label: "Your Name *", placeholder: "e.g. Amaka Johnson" },
          { key: "phone", label: "Phone / WhatsApp *", placeholder: "e.g. 08012345678" },
          { key: "address", label: "Delivery Address *", placeholder: "Street, Area, City, State" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>{label}</label>
            <input className="input-field" placeholder={placeholder}
              value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>Notes (optional)</label>
          <textarea className="input-field" rows={2} placeholder="Any special requests?"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ background: "var(--gold-light)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
          💳 <strong>Pay on Delivery</strong> — You pay cash when your item arrives.
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-gold" onClick={handleSubmit} disabled={loading || product.availableQuantity <= 0} style={{ flex: 2 }}>
            {loading ? "Placing Order..." : `Order Now - ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, "products")).then((snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--light)" }}>
      <header style={{
        background: "var(--dark)", padding: "18px 20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)"
      }}>
        <h1 style={{ color: "var(--gold)", fontSize: 26, letterSpacing: 1 }}>Bright Accessories</h1>
        <p style={{ color: "#aaa", fontSize: 12, letterSpacing: 0.5 }}>Quality Phone Accessories - Pay on Delivery</p>
      </header>
      <div style={{ padding: "16px 16px 0" }}>
        <input className="input-field" placeholder="Search accessories..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 15, background: "white" }} />
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Loading products...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888" }}>No products found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {filtered.map((product) => (
              <div key={product.id} className="card"
                onClick={() => product.availableQuantity > 0 && setSelected(product)}
                style={{ cursor: product.availableQuantity > 0 ? "pointer" : "default" }}>
                <div style={{ position: "relative", paddingTop: "100%", background: "#f0ece8" }}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>💍</div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8 }}>
                    <StockBadge qty={product.availableQuantity} />
                  </div>
                </div>
                <div style={{ padding: "12px 12px 14px" }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{product.name}</p>
                  {product.description && (
                    <p style={{ fontSize: 12, color: "#777", marginBottom: 8, lineHeight: 1.4,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {product.description}
                    </p>
                  )}
                  <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 15 }}>{fmt(product.sellingPrice)}</p>
                  {product.availableQuantity > 0 && (
                    <button className="btn-gold" style={{ width: "100%", marginTop: 10, padding: "9px 0", fontSize: 13 }}>
                      Order Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer style={{ textAlign: "center", padding: "30px 16px", color: "#999", fontSize: 12 }}>
        <p>All orders are Cash on Delivery</p>
        <p style={{ marginTop: 4 }}>2026 Bright Accessories Nigeria</p><p style={{ marginTop: 8 }}><a href="/admin" style={{ color: "#555", fontSize: 11, textDecoration: "none" }}>Admin</a></p></p>
      </footer>
      {selected && <OrderModal product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
