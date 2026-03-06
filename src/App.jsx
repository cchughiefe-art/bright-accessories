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

function CartModal({ cart, products, onUpdateQty, onRemove, onClose, onCheckout, dark }) {
  const total = cart.reduce((s, item) => s + item.sellingPrice * item.qty, 0);
  const bg = dark ? "#1e1e1e" : "white";
  const textColor = dark ? "#f0f0f0" : "#1A1A1A";
  const subColor = dark ? "#aaa" : "#555";
  const borderColor = dark ? "#333" : "#eee";

  if (cart.length === 0) {
    return (
      <div className="overlay" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ background: bg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
          <h2 style={{ color: textColor, marginBottom: 8 }}>Your cart is empty</h2>
          <p style={{ color: subColor, marginBottom: 20 }}>Add some products to get started!</p>
          <button className="btn-gold" style={{ width: "100%" }} onClick={onClose}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: bg, borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1.5px solid " + borderColor }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: textColor, fontSize: 20 }}>🛒 My Cart ({cart.length} items)</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: subColor }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px" }}>
          {cart.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + borderColor }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} loading="lazy"
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, background: dark ? "#2a2a2a" : "#f0ece8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📱</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: textColor, marginBottom: 2 }}>{item.name}</p>
                <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 14 }}>{fmt(item.sellingPrice)} each</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <button onClick={() => onUpdateQty(item.id, item.qty - 1)}
                    style={{ width: 28, height: 28, border: "1.5px solid " + (dark ? "#444" : "var(--border)"), borderRadius: 6, fontSize: 16, background: dark ? "#2a2a2a" : "white", color: textColor, cursor: "pointer" }}>-</button>
                  <span style={{ fontWeight: 700, fontSize: 15, color: textColor, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => onUpdateQty(item.id, item.qty + 1)}
                    style={{ width: 28, height: 28, border: "1.5px solid " + (dark ? "#444" : "var(--border)"), borderRadius: 6, fontSize: 16, background: dark ? "#2a2a2a" : "white", color: textColor, cursor: "pointer" }}>+</button>
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 13, marginLeft: 4 }}>{fmt(item.sellingPrice * item.qty)}</span>
                </div>
              </div>
              <button onClick={() => onRemove(item.id)}
                style={{ background: "none", border: "none", color: "var(--red)", fontSize: 20, cursor: "pointer", flexShrink: 0, padding: 4 }}>🗑️</button>
            </div>
          ))}
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1.5px solid " + borderColor }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: textColor }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>{fmt(total)}</span>
          </div>
          <div style={{ background: dark ? "#2a2a2a" : "var(--gold-light)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: textColor }}>
            💳 <strong>Pay on Delivery</strong> — Cash when item arrives
          </div>
          <button className="btn-gold" style={{ width: "100%", fontSize: 16, padding: "14px 0" }} onClick={onCheckout}>
            Checkout — {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({ cart, onClose, onSuccess, dark }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const total = cart.reduce((s, item) => s + item.sellingPrice * item.qty, 0);
  const bg = dark ? "#1e1e1e" : "white";
  const textColor = dark ? "#f0f0f0" : "#1A1A1A";
  const borderColor = dark ? "#444" : "var(--border)";
  const inputStyle = {
    width: "100%", border: "1.5px solid " + borderColor, borderRadius: 8,
    padding: "10px 14px", fontSize: 15, background: dark ? "#2a2a2a" : "white",
    color: textColor, outline: "none", fontFamily: "DM Sans, sans-serif",
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please fill in Name, Phone, and Address."); return;
    }
    setError(""); setLoading(true);
    try {
      for (const item of cart) {
        const orderData = {
          productId: item.id,
          productName: item.name,
          productImage: item.imageUrl || "",
          sellingPrice: item.sellingPrice,
          costPrice: item.costPrice || 0,
          deliveryCost: item.deliveryCost || 0,
          quantity: item.qty,
          total: item.sellingPrice * item.qty,
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
      }
      onSuccess(form.name);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: bg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ color: textColor, marginBottom: 6, fontSize: 20 }}>Checkout</h2>
        <p style={{ color: dark ? "#aaa" : "#777", fontSize: 13, marginBottom: 20 }}>
          {cart.length} item{cart.length > 1 ? "s" : ""} · Total: <strong style={{ color: "var(--gold)" }}>{fmt(total)}</strong>
        </p>

        <div style={{ background: dark ? "#2a2a2a" : "#f9f5f0", borderRadius: 10, padding: 12, marginBottom: 18 }}>
          {cart.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: dark ? "#ccc" : "#444", marginBottom: 6 }}>
              <span>{item.name} x{item.qty}</span>
              <span style={{ fontWeight: 600 }}>{fmt(item.sellingPrice * item.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid " + (dark ? "#444" : "#eee"), marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--gold)" }}>
            <span>Total</span><span>{fmt(total)}</span>
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
          💳 <strong>Pay on Delivery</strong> — You pay cash when your items arrive.
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Back</button>
          <button className="btn-gold" onClick={handleSubmit} disabled={loading} style={{ flex: 2 }}>
            {loading ? "Placing Order..." : "Place Order — " + fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ name, onClose, dark }) {
  const bg = dark ? "#1e1e1e" : "white";
  const textColor = dark ? "#f0f0f0" : "#1A1A1A";
  return (
    <div className="overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: bg, borderRadius: 16, padding: 32, width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <h2 style={{ color: textColor, marginBottom: 8 }}>Order Placed!</h2>
        <p style={{ color: dark ? "#aaa" : "#555", marginBottom: 20, lineHeight: 1.6 }}>
          Thank you, <strong>{name}</strong>!<br />
          We will contact you to arrange delivery.
        </p>
        <button className="btn-gold" style={{ width: "100%" }} onClick={onClose}>Continue Shopping</button>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(productsCache || []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!productsCache);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [successName, setSuccessName] = useState(null);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("theme") === "dark"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
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

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id
          ? { ...i, qty: Math.min(i.qty + 1, product.availableQuantity) }
          : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return; }
    const product = products.find((p) => p.id === id);
    const maxQty = product ? product.availableQuantity : 20;
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.min(qty, maxQty) } : i));
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

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
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setDark(d => !d)}
            style={{ background: dark ? "#2a2a2a" : "#333", border: "none", borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontSize: 18 }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
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
            {[1, 2, 3, 4].map(i => (
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
            {filtered.map((product) => {
              const inCart = cart.find((i) => i.id === product.id);
              return (
                <div key={product.id}
                  style={{
                    background: cardBg, borderRadius: 14, overflow: "hidden",
                    boxShadow: dark ? "0 2px 10px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.07)",
                    transition: "transform 0.2s", position: "relative",
                  }}>
                  {product.featured && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: "var(--gold)", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, zIndex: 2 }}>
                      FEATURED
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
                    <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{fmt(product.sellingPrice)}</p>
                    {product.availableQuantity > 0 && (
                      inCart ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "#2a2a2a" : "var(--gold-light)", borderRadius: 8, padding: "6px 10px" }}>
                          <button onClick={() => updateQty(product.id, inCart.qty - 1)}
                            style={{ width: 28, height: 28, border: "none", borderRadius: 6, background: "var(--gold)", color: "white", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>-</button>
                          <span style={{ fontWeight: 700, color: textColor }}>{inCart.qty}</span>
                          <button onClick={() => updateQty(product.id, inCart.qty + 1)}
                            style={{ width: 28, height: 28, border: "none", borderRadius: 6, background: "var(--gold)", color: "white", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
                        </div>
                      ) : (
                        <button className="btn-gold" style={{ width: "100%", padding: "9px 0", fontSize: 13 }}
                          onClick={() => addToCart(product)}>
                          + Add to Cart
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 100 }} />

      <footer style={{ textAlign: "center", padding: "30px 16px", color: subColor, fontSize: 12 }}>
        <p>All orders are Cash on Delivery</p>
        <p style={{ marginTop: 4 }}>2026 Bright Accessories Nigeria</p>
        <p style={{ marginTop: 8 }}>
          <a href="/admin" style={{ color: dark ? "#555" : "#888", fontSize: 11, textDecoration: "none" }}>Admin</a>
        </p>
      </footer>

      {cartCount > 0 && (
        <button onClick={() => setShowCart(true)}
          style={{
            position: "fixed", bottom: 24, right: 20, zIndex: 100,
            background: "var(--gold)", border: "none", borderRadius: 50,
            width: 64, height: 64, fontSize: 26, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <span style={{ position: "relative" }}>
            🛒
            <span style={{
              position: "absolute", top: -10, right: -12,
              background: "var(--red)", color: "white",
              borderRadius: "50%", width: 20, height: 20,
              fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{cartCount}</span>
          </span>
        </button>
      )}

      {showCart && !showCheckout && (
        <CartModal
          cart={cart}
          products={products}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onClose={() => setShowCart(false)}
          onCheckout={() => { setShowCart(false); setShowCheckout(true); }}
          dark={dark}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          onClose={() => setShowCheckout(false)}
          onSuccess={(name) => {
            setCart([]);
            setShowCheckout(false);
            setSuccessName(name);
          }}
          dark={dark}
        />
      )}

      {successName && (
        <SuccessModal
          name={successName}
          onClose={() => setSuccessName(null)}
          dark={dark}
        />
      )}
    </div>
  );
}
