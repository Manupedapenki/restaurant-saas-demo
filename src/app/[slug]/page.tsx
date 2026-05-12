export const dynamic = 'force-dynamic';
"use client";
import "../globals.css";
import { useState, useEffect, use } from "react";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import { FiShoppingBag, FiPlus, FiMinus, FiSearch, FiX } from "react-icons/fi";

export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  
  // --- EXISTING STATES ---
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // --- 🟢 NEW TRACKING STATES ---
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  // 1. LOAD DATA EFFECT
  useEffect(() => {
    async function loadData() {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", resolvedParams.slug).single();
      if (rest) {
        setRestaurant(rest);
        const { data: items, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", rest.id)
          .order("created_at", { ascending: false });
        if (items) setMenuItems(items);
      }
    }
    loadData();
  }, [resolvedParams.slug]);

  // 2. 🟢 REAL-TIME STATUS LISTENER EFFECT
  useEffect(() => {
    if (!activeOrderId) return;

    const channel = supabase.channel(`order-status-${activeOrderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders', 
        filter: `id=eq.${activeOrderId}` 
      }, (payload) => {
        setOrderStatus(payload.new.status);
        if (payload.new.status === "Ready") {
          toast.success("🍽️ Your food is ready! Enjoy!");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeOrderId]);

  // --- LOGIC ---
  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const updateCart = (item: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const newQuantity = existing.quantity + delta;
        if (newQuantity <= 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => i.id === item.id ? { ...i, quantity: newQuantity } : i);
      }
      if (delta > 0) {
        toast.success(`Added ${item.name}`);
        return [...prev, { ...item, quantity: 1 }];
      }
      return prev;
    });
  };

  const getQuantity = (id: string) => cart.find(i => i.id === id)?.quantity || 0;
  const totalPrice = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // 3. 🟢 UPDATED CHECKOUT LOGIC
  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting || !restaurant) return;
    setIsSubmitting(true);
    const loadingToast = toast.loading("Processing Order...");
    try {
      const { data, error } = await supabase.from('orders').insert([{
        restaurant_id: restaurant.id,
        table_number: "01",
        items: cart.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
        total_price: totalPrice,
        status: 'Pending'
      }]).select(); // Capture the new order ID

      if (!error && data) {
        toast.success("Order Sent!", { id: loadingToast });
        setActiveOrderId(data[0].id); // Start tracking!
        setOrderStatus("Pending");
        setCart([]);
      } else toast.error("Checkout failed", { id: loadingToast });
    } catch { toast.error("Connection error", { id: loadingToast }); }
    finally { setIsSubmitting(false); }
  };

  if (!restaurant) return <div className="h-screen bg-white flex items-center justify-center text-emerald-500 font-black tracking-widest uppercase animate-pulse">Syncing...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-32 selection:bg-emerald-200">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-6 pt-8 pb-4 sticky top-0 z-40 border-b border-emerald-100 shadow-sm">
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-6 max-w-7xl mx-auto">{restaurant.name}</h1>
        <div className="relative max-w-7xl mx-auto">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
          <input 
            type="text" placeholder="Search for items..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-emerald-50/50 text-slate-900 text-sm font-medium py-3.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 border border-emerald-100 transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white/80 backdrop-blur-md px-6 py-4 sticky top-[132px] z-30 border-b border-emerald-50">
        <div className="flex gap-3 overflow-x-auto no-scrollbar max-w-7xl mx-auto">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                activeCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-emerald-600 border border-emerald-100'
              }`}
            > {cat} </button>
          ))}
        </div>
      </div>

      {/* 4. GRID: Products entered via Admin Panel */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div 
                layout key={item.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -12, scale: 1.02 }}
                className="group flex flex-col bg-white border border-emerald-50 rounded-[40px] overflow-hidden shadow-sm hover:bg-emerald-50/90 hover:shadow-[0_30px_60px_rgba(16,185,129,0.2)] transition-all duration-500 relative"
              >
                <div className="h-56 w-full overflow-hidden bg-emerald-100 relative">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                </div>
                <div className="p-7 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-black text-slate-800 leading-tight">{item.name}</h3>
                    <span className="text-lg font-black text-emerald-600">₹{item.price}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-8 flex-grow">{item.description}</p>
                  <div className="mt-auto">
                    {getQuantity(item.id) === 0 ? (
                      <motion.button 
                        whileTap={{ scale: 0.95 }} onClick={() => updateCart(item, 1)} 
                        className="w-full bg-emerald-50 text-emerald-700 border border-emerald-100 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest transition-all duration-300 hover:bg-emerald-600 hover:text-white"
                      >
                        <FiPlus size={18} /> Add Item
                      </motion.button>
                    ) : (
                      <div className="flex items-center justify-between w-full bg-emerald-600 rounded-[24px] text-white p-1.5 shadow-lg">
                        <button onClick={() => updateCart(item, -1)} className="w-12 h-11 flex items-center justify-center hover:bg-black/10 rounded-2xl"><FiMinus size={20} /></button>
                        <span className="text-base font-black">{getQuantity(item.id)}</span>
                        <button onClick={() => updateCart(item, 1)} className="w-12 h-11 flex items-center justify-center hover:bg-black/10 rounded-2xl"><FiPlus size={20} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* 5. CART SUMMARY */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
            <div className="max-w-xl mx-auto pointer-events-auto">
              <button onClick={handleCheckout} disabled={isSubmitting}
                className="w-full bg-slate-900 text-white py-6 px-10 rounded-full font-black uppercase tracking-[0.2em] flex items-center justify-between shadow-2xl active:scale-95 transition-all border border-slate-700 hover:bg-emerald-600"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-500 text-white h-9 w-9 rounded-full flex items-center justify-center text-sm font-black">{totalItems}</div>
                  <span className="text-xs">Review & Pay</span>
                </div>
                <span className="text-xl">₹{totalPrice}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟢 6. ORDER TRACKER UI (Appears after checkout) */}
      <AnimatePresence>
        {activeOrderId && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            className="fixed top-24 left-6 right-6 z-[60]"
          >
            <div className="bg-white border border-emerald-100 shadow-2xl rounded-3xl p-5 flex items-center justify-between overflow-hidden relative">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-emerald-500 text-white rounded-full flex items-center justify-center animate-pulse">
                   {orderStatus === "Pending" ? "⏳" : orderStatus === "Cooking" ? "👨‍🍳" : "✅"}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</p>
                  <p className="text-sm font-black text-slate-900">
                    {orderStatus === "Pending" && "Order Received..."}
                    {orderStatus === "Cooking" && "Chef is preparing your food!"}
                    {orderStatus === "Ready" && "Food is ready to serve!"}
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveOrderId(null)} className="text-slate-300 hover:text-slate-900 transition-colors">
                <FiX size={20} />
              </button>
              <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000" 
                   style={{ width: orderStatus === "Pending" ? "20%" : orderStatus === "Cooking" ? "60%" : "100%" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}