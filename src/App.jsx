import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const fmt = (n) => `₦${Number(n).toLocaleString("en-NG")}`;
let productsCache = null;

function StockBadge({ qty }) {
  if (qty <= 0) return <span className="badge badge-out">Out of Stock</span>;
  if (qty < 5) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-in">In Stock</span>;
}

function OrderModal({ product, onClose, dark }) {
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

  const modalBg = dark ? "#1e1e1e" : "white";
  const textColor = dark ? "#f0f0f0" : "#1A1A1A";
  const subColor = dark ? "#aaa" : "#555";
  const inputStyle = {
    width: "100%", border: "1.5px solid " + (dark ? "#444" : "var(--border)"),
    borderRadius: 8, padding: "10px 14px", fontSize: 15,
    background: dark ? "#2a2a2a" : "white", color: textColor, outline: "none",
    fontFamily: "DM Sans, sans-serif",
  };

  if (done) {
    return (
      <div className="overlay" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ background: modalBg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h2 style={{ marginBottom: 8, color: textColor }}>Order Placed!</h2>
          <p style={{ color: subColor, marginBottom: 4 }}>Thank you, <strong>{form.name}</strong>!</p>
          <p style={{ color: subColor, marginBottom: 20, fontSize: 14 }}>
            We will contact you on <strong>{form.phone}</strong> to arrange delivery.
          </p>
          <button className="btn-gold" style={{ width: "100%" }} onClick={onClose}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: modalBg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} loading="lazy"
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
          )}
          <div>
            <h3 style={{ fontSize: 17, marginBottom: 4, color: textColor }}>{product.name}</h3>
            <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 16 }}>{fmt(product.sellingPrice)}</p>
            <StockBadge qty={product.availableQuantity} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8, color: textColor }}>Quantity</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, border: "1.5px solid " + (dark ? "#444" : "var(--border)"), borderRadius: 8, fontSize: 18, background: dark ? "#2a2a2a" : "white", color: textColor, cursor: "pointer" }}>-</button>
            <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: "center", color: textColor }}>{qty}</span>
            <button onClick={() => setQty(q => Math.min(Math.min(20, product.availableQuantity), q + 1))}
              style={{ width: 36, height: 36, border: "1.5px solid " + (dark ? "#444" : "var(--border)"), borderRadius: 8, fontSize: 18, background: dark ? "#2a2a2a" : "white", color: textColor, cursor: "pointer" }}>+</button>
            <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 15 }}>Total: {fmt(total)}</span>
          </div>
        </div>
        {[
          { key: "name", label: "Your Name *", placeholder: "e.g. Amaka Johnson" },
          { key: "phone", label: "Phone / WhatsApp *", placeholder: "e.g. 08012345678" },
          { key: "address", label: "Delivery Address *", placeholder: "Street, Area, City, State" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6, color: textColor }}>{label}</label>
            <input style={inputStyle} placeholder={placeholder}
              value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6, color: textColor }}>Notes (optional)</label>
          <textarea style={{ ...inputStyle, resize: "none" }} rows={2} placeholder="Any special requests?"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ background: dark ? "#2a2a2a" : "var(--gold-light)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: textColor }}>
          💳 <strong>Pay on Delivery</strong> — You pay cash when your item arrives.
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-gold" onClick={handleSubmit} disabled={loading || product.availableQuantity <= 0} style={{ flex: 2 }}>
            {loading ? "Placing Order..." : "Order Now - " + fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(productsCache || []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(!productsCache);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#121212" : "";
  }, [dark]);

  useEffect(() => {
    if (productsCache) return;
    getDocs(collection(db, "products")).then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
      productsCache = data;
      setProducts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const bg = dark ? "#121212" : "var(--light)";
  const cardBg = dark ? "#1e1e1e" : "white";
  const textColor = dark ? "#f0f0f0" : "#1A1A1A";
  const subColor = dark ? "#aaa" : "#777";

  return (
    <div style={{ minHeight: "100vh", background: bg }}>
      <header style={{
        background: dark ? "#0a0a0a" : "var(--dark)", padding: "18px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)"
      }}>
        <div>
          <h1 style={{ color: "var(--gold)", fontSize: 22, letterSpacing: 1 }}>Bright Accessories</h1>
          <p style={{ color: "#aaa", fontSize: 11 }}>Phone Accessories - Pay on Delivery</p>
        </div>
        <button onClick={() => setDark(d => !d)}
          style={{ background: dark ? "#2a2a2a" : "#333", border: "none", borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontSize: 18 }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      <div style={{ padding: "16px 16px 0" }}>
        <input placeholder="Search accessories..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", border: "1.5px solid " + (dark ? "#333" : "var(--border)"),
            borderRadius: 8, padding: "10px 14px", fontSize: 15,
            background: dark ? "#1e1e1e" : "white", color: textColor, outline: "none",
            fontFamily: "DM Sans, sans-serif",
          }} />
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: cardBg, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ paddingTop: "100%", background: dark ? "#2a2a2a" : "#f0ece8" }} />
                <div style={{ padding: 12 }}>
                  <div style={{ height: 14, background: dark ? "#2a2a2a" : "#f0ece8", borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 14, background: dark ? "#2a2a2a" : "#f0ece8", borderRadius: 4, width: "60%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: subColor }}>No products found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {filtered.map((product) => (
              <div key={product.id}
                onClick={() => product.availableQuantity > 0 && setSelected(product)}
                style={{
                  background: cardBg, borderRadius: 14, overflow: "hidden",
                  boxShadow: dark ? "0 2px 10px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.07)",
                  cursor: product.availableQuantity > 0 ? "pointer" : "default",
                  transition: "transform 0.2s", position: "relative",
                }}>
                {product.featured && (
                  <div style={{ position: "absolute", top: 8, right: 8, background: "var(--gold)", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, zIndex: 2 }}>
                    ⭐ FEATURED
                  </div>
                )}
                <div style={{ position: "relative", paddingTop: "100%", background: dark ? "#2a2a2a" : "#f0ece8" }}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📱</div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8 }}>
                    <StockBadge qty={product.availableQuantity} />
                  </div>
                </div>
                <div style={{ padding: "12px 12px 14px" }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3, color: textColor }}>{product.name}</p>
                  {product.description && (
                    <p style={{ fontSize: 12, color: subColor, marginBottom: 8, lineHeight: 1.4,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {product.description}
                    </p>
                  )}
                  {product.availableQuantity > 0 && product.availableQuantity < 5 && (
                    <p style={{ fontSize: 11, color: "var(--orange)", fontWeight: 600, marginBottom: 4 }}>
                      Only {product.availableQuantity} left!
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

      <footer style={{ textAlign: "center", padding: "30px 16px", color: subColor, fontSize: 12 }}>
        <p>All orders are Cash on Delivery</p>
        <p style={{ marginTop: 4 }}>2026 Bright Accessories Nigeria</p>
        <p style={{ marginTop: 8 }}>
          <a href="/admin" style={{ color: dark ? "#555" : "#888", fontSize: 11, textDecoration: "none" }}>Admin</a>
        </p>
      </footer>

      {selected && <OrderModal product={selected} onClose={() => setSelected(null)} dark={dark} />}
    </div>
  );
}
