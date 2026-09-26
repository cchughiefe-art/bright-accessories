import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";

const money = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const defaultZones = [
  { id: "mainland", name: "Lagos Mainland", fee: 2500 },
  { id: "island", name: "Lagos Island", fee: 3500 },
  { id: "nationwide", name: "Outside Lagos", fee: 5000 },
];

function Icon({ name, size = 20 }) {
  const p = {
    bag: <><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>, plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, check: <path d="m5 12 4 4L19 6"/>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

function Product({ item, add }) {
  const stock = Number(item.availableQuantity || 0);
  return <article className="product-card">
    <div className="product-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy"/> : <Icon name="bag" size={40}/>} {item.featured && <span className="pill">Featured</span>}</div>
    <div className="product-copy"><small>{item.category || "Accessories"}</small><h3>{item.name}</h3><p>{item.description || "Quality accessory, ready for fast delivery."}</p>
      <div><strong>{money(item.sellingPrice)}</strong><button disabled={!stock} onClick={() => add(item)}>{stock ? <><Icon name="plus"/> Add</> : "Sold out"}</button></div>
      {stock > 0 && stock < 6 && <em>Only {stock} left</em>}
    </div>
  </article>;
}

function Cart({ cart, products, change, close, checkout }) {
  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  return <div className="scrim" onMouseDown={close}><aside className="drawer" onMouseDown={e => e.stopPropagation()}>
    <header><div><small>YOUR SELECTION</small><h2>Shopping bag</h2></div><button className="round" onClick={close}><Icon name="close"/></button></header>
    <section>{cart.length ? cart.map(i => <div className="cart-line" key={i.id}>{i.imageUrl ? <img src={i.imageUrl} alt=""/> : <span><Icon name="bag"/></span>}<div><h3>{i.name}</h3><strong>{money(i.sellingPrice)}</strong><nav><button onClick={() => change(i.id, i.quantity - 1)}><Icon name="minus" size={14}/></button><b>{i.quantity}</b><button onClick={() => change(i.id, Math.min(i.quantity + 1, products.find(p => p.id === i.id)?.availableQuantity || i.quantity))}><Icon name="plus" size={14}/></button></nav></div><button className="remove" onClick={() => change(i.id, 0)}>Remove</button></div>) : <div className="empty"><Icon name="bag" size={44}/><h3>Your bag is empty</h3><p>Add something you love.</p><button className="primary" onClick={close}>Continue shopping</button></div>}</section>
    {!!cart.length && <footer><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Delivery is calculated at checkout.</p><button className="primary wide" onClick={checkout}>Proceed to checkout <Icon name="arrow"/></button></footer>}
  </aside></div>;
}

function Summary({ cart, delivery }) {
  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  return <aside className="summary"><small>ORDER SUMMARY</small>{cart.map(i => <div className="summary-line" key={i.id}>{i.imageUrl ? <img src={i.imageUrl} alt=""/> : <span><Icon name="bag"/></span>}<div><b>{i.name}</b><small>Qty {i.quantity}</small></div><strong>{money(i.sellingPrice * i.quantity)}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div><div><dt>Delivery</dt><dd>{money(delivery)}</dd></div><div><dt>Total</dt><dd>{money(subtotal + delivery)}</dd></div></dl></aside>;
}

function Checkout({ cart, back, complete, settings }) {
  const [step, setStep] = useState(1), [receipt, setReceipt] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [form, setForm] = useState({ name:"", phone:"", email:"", address:"", state:"Lagos", zone:"mainland", payment:"transfer", notes:"" });
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const zones = settings.deliveryZones || defaultZones;
  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0), delivery = zones.find(z => z.id === form.zone)?.fee || 0, total = subtotal + delivery;
  const next = () => { if (!form.name.trim() || !/^\+?[0-9 ]{10,15}$/.test(form.phone) || !form.address.trim()) return setError("Enter your name, a valid phone number and your complete address."); setError(""); setStep(2); };
  const submit = async () => {
    if (form.payment === "transfer" && !receipt) return setError("Upload your transfer receipt before placing the order.");
    setBusy(true); setError("");
    try {
      const orderRef = `BA-${crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase()}`; let receiptUrl = "";
      if (receipt) { if (!receipt.type.startsWith("image/") || receipt.size > 5242880) throw new Error("Receipt must be an image under 5MB."); const fileRef = ref(storage, `receipts/${orderRef}/${Date.now()}-${receipt.name.replace(/[^a-z0-9._-]/gi,"-")}`); await uploadBytes(fileRef, receipt); receiptUrl = await getDownloadURL(fileRef); }
      const order = { orderRef, items:cart.map(i => ({productId:i.id,name:i.name,imageUrl:i.imageUrl||"",price:Number(i.sellingPrice),quantity:i.quantity})), customer:{name:form.name.trim(),phone:form.phone.trim(),email:form.email.trim(),address:form.address.trim(),state:form.state.trim(),zone:form.zone}, paymentMethod:form.payment, paymentStatus:form.payment === "transfer" ? "awaiting_verification" : "pay_on_delivery", receiptUrl, subtotal, deliveryFee:delivery, total, notes:form.notes.trim(), status:"pending", createdAt:serverTimestamp() };
      await addDoc(collection(db,"orders"), order);
      await setDoc(doc(db,"publicOrders",orderRef), { orderRef, phoneLast7:form.phone.replace(/\s/g,"").slice(-7), status:"pending", updatedAt:serverTimestamp() });
      fetch("/api/order-alert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(order)}).catch(()=>{}); complete(order);
    } catch (e) { setError(e.message || "We could not place the order. Try again."); } finally { setBusy(false); }
  };
  return <div className="checkout"><header><button onClick={step === 1 ? back : () => setStep(1)}>← Back</button><a className="brand" href="/">BRIGHT<span>ACCESSORIES</span></a><span><Icon name="shield"/> Secure checkout</span></header><main><section className="checkout-form"><div className="steps"><i className="on">1</i><b/><i className={step === 2 ? "on" : ""}>2</i></div>
    {step === 1 ? <><small>DELIVERY INFORMATION</small><h1>Where should we send it?</h1><div className="two"><label>Full name<input value={form.name} onChange={e=>set("name",e.target.value)}/></label><label>Phone / WhatsApp<input value={form.phone} onChange={e=>set("phone",e.target.value)} inputMode="tel"/></label></div><label>Email <em>(optional)</em><input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></label><label>Complete address<textarea rows="3" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="House number, street and nearest landmark"/></label><div className="two"><label>State<input value={form.state} onChange={e=>set("state",e.target.value)}/></label><label>Delivery zone<select value={form.zone} onChange={e=>set("zone",e.target.value)}>{zones.map(z=><option value={z.id} key={z.id}>{z.name} · {money(z.fee)}</option>)}</select></label></div><label>Delivery note <em>(optional)</em><textarea rows="2" value={form.notes} onChange={e=>set("notes",e.target.value)}/></label>{error&&<p className="error">{error}</p>}<button className="primary wide" onClick={next}>Continue to payment <Icon name="arrow"/></button></> : <><small>PAYMENT</small><h1>Choose how to pay</h1><div className="payments"><button className={form.payment === "transfer" ? "on" : ""} onClick={()=>set("payment","transfer")}><i/><span><b>Bank transfer</b><small>Transfer now and upload your receipt</small></span></button><button className={form.payment === "cod" ? "on" : ""} onClick={()=>set("payment","cod")}><i/><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span></button></div>{form.payment === "transfer" && <div className="bank"><p>Transfer exactly <strong>{money(total)}</strong> to:</p><dl><div><dt>Bank</dt><dd>{settings.bankName || "Contact the store"}</dd></div><div><dt>Account</dt><dd>{settings.accountNumber || "Not configured"}</dd></div><div><dt>Name</dt><dd>{settings.accountName || "Bright Accessories"}</dd></div></dl><label className="upload">Payment receipt<input type="file" accept="image/*" onChange={e=>setReceipt(e.target.files?.[0]||null)}/><span>{receipt ? receipt.name : "Choose receipt image"}</span></label></div>}{error&&<p className="error">{error}</p>}<button className="primary wide" disabled={busy} onClick={submit}>{busy ? "Placing order…" : `Place order · ${money(total)}`}</button></>}
  </section><Summary cart={cart} delivery={delivery}/></main></div>;
}

function Tracker({ close }) {
  const [orderRef,setRef]=useState(""), [phone,setPhone]=useState(""), [result,setResult]=useState(null), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const track = async () => { setBusy(true);setError("");try{const snap=await getDoc(doc(db,"publicOrders",orderRef.trim().toUpperCase()));if(!snap.exists())throw Error("Order not found. Check the reference.");const data=snap.data();if(data.phoneLast7!==phone.replace(/\s/g,"").slice(-7))throw Error("Phone number does not match this order.");setResult(data)}catch(e){setError(e.message)}finally{setBusy(false)}};
  return <div className="scrim"><div className="modal"><button className="round close" onClick={close}><Icon name="close"/></button><small>ORDER TRACKING</small><h2>Track your delivery</h2>{result?<div className="result"><span><Icon name="box" size={30}/></span><h3>{result.orderRef}</h3><p>Your order is <strong>{String(result.status).replaceAll("_"," ")}</strong>.</p><button className="secondary wide" onClick={()=>setResult(null)}>Track another</button></div>:<><p>Enter your order reference and delivery phone number.</p><label>Order reference<input value={orderRef} onChange={e=>setRef(e.target.value)} placeholder="BA-12345678"/></label><label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel"/></label>{error&&<p className="error">{error}</p>}<button className="primary wide" disabled={busy||!orderRef||!phone} onClick={track}>{busy?"Checking…":"Track order"}</button></>}</div></div>;
}

export default function App() {
  const [products,setProducts]=useState([]), [loading,setLoading]=useState(true), [loadError,setLoadError]=useState(""), [search,setSearch]=useState(""), [category,setCategory]=useState("All"), [cartOpen,setCartOpen]=useState(false), [checkout,setCheckout]=useState(false), [tracking,setTracking]=useState(false), [order,setOrder]=useState(null), [dark,setDark]=useState(()=>localStorage.getItem("bright-theme")==="dark");
  const [settings,setSettings]=useState({deliveryZones:defaultZones,bankName:"",accountNumber:"",accountName:"Bright Accessories",whatsapp:"234"});
  const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem("bright-cart")||"[]")}catch{return[]}});
  useEffect(()=>{getDocs(collection(db,"products")).then(s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.active!==false))).catch(()=>setLoadError("Products could not load. Check your connection and retry.")).finally(()=>setLoading(false))},[]);
  useEffect(()=>{getDoc(doc(db,"settings","store")).then(s=>{if(s.exists())setSettings(old=>({...old,...s.data()}))}).catch(()=>{})},[]);
  useEffect(()=>localStorage.setItem("bright-cart",JSON.stringify(cart)),[cart]); useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("bright-theme",dark?"dark":"light")},[dark]);
  const categories=useMemo(()=>["All",...new Set(products.map(p=>p.category||"Accessories"))],[products]); const visible=useMemo(()=>products.filter(p=>(category==="All"||(p.category||"Accessories")===category)&&`${p.name} ${p.description||""}`.toLowerCase().includes(search.toLowerCase())),[products,category,search]);
  const add=p=>{setCart(c=>{const old=c.find(i=>i.id===p.id);return old?c.map(i=>i.id===p.id?{...i,quantity:Math.min(i.quantity+1,p.availableQuantity)}:i):[...c,{id:p.id,name:p.name,imageUrl:p.imageUrl||"",sellingPrice:Number(p.sellingPrice),quantity:1}]});setCartOpen(true)}; const change=(id,quantity)=>setCart(c=>quantity<1?c.filter(i=>i.id!==id):c.map(i=>i.id===id?{...i,quantity}:i)); const count=cart.reduce((s,i)=>s+i.quantity,0);
  if(checkout)return <Checkout cart={cart} settings={settings} back={()=>setCheckout(false)} complete={o=>{setCart([]);setCheckout(false);setOrder(o)}}/>;
  return <div><header className="topbar"><a className="brand" href="#top">BRIGHT<span>ACCESSORIES</span></a><nav><a href="#shop">Shop</a><button onClick={()=>setTracking(true)}>Track order</button><a href={`https://wa.me/${settings.whatsapp || "234"}`} target="_blank" rel="noreferrer">Support</a></nav><div><button className="round" onClick={()=>setDark(!dark)}><Icon name={dark?"sun":"moon"}/></button><button className="cart-button" onClick={()=>setCartOpen(true)}><Icon name="bag"/> Bag {count>0&&<b>{count}</b>}</button></div></header>
    <main id="top"><section className="hero"><div><small>ORIGINAL QUALITY · DELIVERED NATIONWIDE</small><h1>Everyday tech,<br/><em>finished beautifully.</em></h1><p>Thoughtfully selected phone accessories that look good, work properly and arrive without stress.</p><a className="primary" href="#shop">Shop the collection <Icon name="arrow"/></a><aside><span><Icon name="truck"/> Nationwide delivery</span><span><Icon name="shield"/> Secure ordering</span></aside></div><figure><img src="/banner.jpg" alt="Bright Accessories collection"/><figcaption><small>NEW ARRIVALS</small><b>Built for your everyday</b></figcaption></figure></section>
      <section className="shop" id="shop"><header><div><small>THE COLLECTION</small><h2>Find your next essential</h2></div><label className="search"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products"/></label></header><nav>{categories.map(c=><button className={c===category?"on":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</nav>{loading?<div className="products">{[1,2,3,4].map(i=><i className="skeleton" key={i}/>)}</div>:loadError?<div className="empty"><h3>Connection problem</h3><p>{loadError}</p><button className="secondary" onClick={()=>location.reload()}>Try again</button></div>:visible.length?<div className="products">{visible.map(p=><Product item={p} add={add} key={p.id}/>)}</div>:<div className="empty"><h3>No matching products</h3><p>Try a different search or category.</p></div>}</section>
      <section className="benefits"><div><Icon name="truck"/><h3>Fast dispatch</h3><p>Lagos delivery and nationwide shipping.</p></div><div><Icon name="shield"/><h3>Shop confidently</h3><p>Transfer verification or cash on delivery.</p></div><div><Icon name="box"/><h3>Helpful support</h3><p>Updates from purchase to delivery.</p></div></section></main>
    <footer><a className="brand" href="#top">BRIGHT<span>ACCESSORIES</span></a><p>Quality accessories. Straightforward service.</p><button onClick={()=>setTracking(true)}>Track an order</button><small>© {new Date().getFullYear()} Bright Accessories</small></footer>
    {cartOpen&&<Cart cart={cart} products={products} change={change} close={()=>setCartOpen(false)} checkout={()=>{setCartOpen(false);setCheckout(true)}}/>}{tracking&&<Tracker close={()=>setTracking(false)}/>} {order&&<div className="scrim"><div className="modal confirmation"><span className="success"><Icon name="check" size={34}/></span><small>ORDER RECEIVED</small><h2>Thank you, {order.customer.name.split(" ")[0]}.</h2><p>Your reference is <strong>{order.orderRef}</strong>. Keep it safe for tracking. We’ll contact you on {order.customer.phone}.</p><button className="primary wide" onClick={()=>setOrder(null)}>Continue shopping</button></div></div>}
  </div>;
}
