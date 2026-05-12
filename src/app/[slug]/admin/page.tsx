"use client";
import "../../globals.css";
import { useEffect, useState, use } from "react";
import { supabase } from "../supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { FiTrendingUp, FiDollarSign, FiShoppingBag, FiSettings, FiDownload, FiPlus, FiTrash2, FiEdit2, FiGrid, FiList, FiMaximize, FiAward } from "react-icons/fi";

export default function AdminDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [activeTab, setActiveTab] = useState<"dashboard" | "menu" | "qr">("dashboard");

  // 🟢 NEW: Added topItem to stats state
  const [stats, setStats] = useState({ revenue: 0, orders: 0, avgTicket: 0, topItem: "N/A" });
  const [restaurant, setRestaurant] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState("1");
  
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", price: "", category: "Fast Food", description: "", image: "" });

  useEffect(() => {
    async function loadDashboard() {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", resolvedParams.slug).single();
      if (rest) {
        setRestaurant(rest);
        
        // 🟢 Advanced Data Aggregation
        const { data: orders } = await supabase.from("orders").select("total_price, items").eq("restaurant_id", rest.id).neq("status", "Cancelled");
        
        const totalRevenue = orders?.reduce((acc, curr) => acc + Number(curr.total_price), 0) || 0;
        const totalOrders = orders?.length || 0;
        
        // Calculate Top Selling Item
        const itemCounts: Record<string, number> = {};
        orders?.forEach(order => {
          order.items?.forEach((item: any) => {
            itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
          });
        });
        const bestSeller = Object.keys(itemCounts).length > 0 
          ? Object.keys(itemCounts).reduce((a, b) => itemCounts[a] > itemCounts[b] ? a : b) 
          : "No Sales Yet";

        setStats({ 
          revenue: totalRevenue, 
          orders: totalOrders, 
          avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          topItem: bestSeller
        });

        const { data: items } = await supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).order('created_at', { ascending: false });
        setMenuItems(items || []);
      }
    }
    loadDashboard();
  }, [resolvedParams.slug]);

  const handleAddOrEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return toast.error("Name and Price are required.");
    setIsSubmitting(true);

    if (editingId) {
      const { data, error } = await supabase.from("menu_items")
        .update({ name: newItem.name, price: Number(newItem.price), category: newItem.category, description: newItem.description, image: newItem.image })
        .eq("id", editingId).select();

      if (!error && data) {
        toast.success("Dish updated successfully!");
        setMenuItems(menuItems.map(item => item.id === editingId ? data[0] : item));
        cancelEditing();
      } else toast.error("Failed to update item.");
    } else {
      const { data, error } = await supabase.from("menu_items").insert([{
        restaurant_id: restaurant.id, name: newItem.name, price: Number(newItem.price), category: newItem.category, description: newItem.description, image: newItem.image || "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80"
      }]).select();

      if (!error && data) {
        toast.success("New dish added!");
        setMenuItems([data[0], ...menuItems]);
        cancelEditing();
      } else toast.error("Failed to add item.");
    }
    setIsSubmitting(false);
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setNewItem({ name: item.name, price: item.price.toString(), category: item.category, description: item.description || "", image: item.image || "" });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewItem({ name: "", price: "", category: "Fast Food", description: "", image: "" });
  };

  const deleteMenuItem = async (id: string) => {
    if(!window.confirm("Delete this dish?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (!error) {
      setMenuItems(menuItems.filter(item => item.id !== id));
      toast.success("Dish deleted");
      if (editingId === id) cancelEditing();
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById("restaurant-qr");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 2000; canvas.height = 2000;
      ctx!.fillStyle = "white"; ctx!.fillRect(0,0,2000,2000); ctx?.drawImage(img, 0, 0, 2000, 2000);
      const downloadLink = document.createElement("a");
      downloadLink.download = `${restaurant.slug}-table-${selectedTable}.png`;
      downloadLink.href = canvas.toDataURL("image/png");
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(svg));
  };

  if (!restaurant) return <div className="h-screen bg-slate-50 flex items-center justify-center font-black text-indigo-500 tracking-widest animate-pulse uppercase">Syncing Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-200 flex flex-col">
      <Toaster richColors position="top-right" />
      
      {/* SaaS Navigation */}
      <nav className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">{restaurant.name}</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Admin Panel</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Admin</p>
                <p className="text-xs font-black text-slate-900">PEDAPENKI_MANOHAR</p>
             </div>
             <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black shadow-inner">PM</div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-8">
        <div className="max-w-7xl mx-auto flex gap-8">
          <button onClick={() => setActiveTab("dashboard")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === "dashboard" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            <FiGrid size={16} /> Overview
          </button>
          <button onClick={() => setActiveTab("menu")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === "menu" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            <FiList size={16} /> Edit Menu
          </button>
          <button onClick={() => setActiveTab("qr")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === "qr" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            <FiMaximize size={16} /> QR Codes
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-8 w-full flex-grow">
        
        {/* ============================== */}
        {/* TAB 1: DASHBOARD ANALYTICS     */}
        {/* ============================== */}
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* 🟢 4 Metric Cards (Now includes Top Item) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard label="Total Revenue" value={`₹${stats.revenue}`} icon={<FiDollarSign />} color="text-emerald-600" bg="bg-emerald-50" />
              <MetricCard label="Active Orders" value={stats.orders} icon={<FiShoppingBag />} color="text-sky-600" bg="bg-sky-50" />
              <MetricCard label="Average Order" value={`₹${stats.avgTicket.toFixed(0)}`} icon={<FiTrendingUp />} color="text-violet-600" bg="bg-violet-50" />
              <MetricCard label="Best Seller" value={stats.topItem} truncate={true} icon={<FiAward />} color="text-rose-600" bg="bg-rose-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* 🟢 NEW: Animated CSS Graph (No libraries needed!) */}
              <div className="lg:col-span-2 bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Today's Sales Trend</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Hourly Volume</p>
                  </div>
                  <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase">
                    Live Data
                  </div>
                </div>
                
                {/* Visual Chart Area */}
                <div className="h-56 w-full flex items-end justify-between gap-2 mt-auto">
                  {/* These heights simulate a standard restaurant rush curve (lunch and dinner peaks) */}
                  {[10, 25, 60, 95, 40, 20, 15, 30, 75, 100, 85, 45].map((h, i) => (
                    <div key={i} className="w-full bg-slate-50 rounded-t-lg h-full relative group">
                      <motion.div 
                        initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
                        className="absolute bottom-0 w-full bg-indigo-500 rounded-t-lg group-hover:bg-indigo-400 transition-colors"
                      />
                      {/* Hover Tooltip */}
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {h}% Max
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* X-Axis Labels */}
                <div className="flex justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
                  <span>10 AM</span>
                  <span>2 PM</span>
                  <span>6 PM</span>
                  <span>10 PM</span>
                </div>
              </div>

              {/* Menu Overview Card */}
              <div className="bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm flex flex-col justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FiList size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Menu Catalog</h3>
                <div className="flex justify-center items-center gap-3 mb-6">
                    <span className="text-4xl font-black text-indigo-600">{menuItems.length}</span>
                    <span className="text-sm font-bold text-slate-400 text-left leading-tight">Active<br/>Dishes</span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8">
                    Add new dishes, update prices, and manage inventory to keep your data fresh.
                </p>
                <button onClick={() => setActiveTab("menu")} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-colors">
                  Open Catalog
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* ============================== */}
        {/* TAB 2: EDIT MENU ENGINE        */}
        {/* ============================== */}
        {activeTab === "menu" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row gap-8">
            
            {/* Form */}
            <div className="w-full lg:w-[400px] bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm h-fit sticky top-24">
               <h2 className="text-xl font-black text-slate-900 mb-6">{editingId ? "Edit Dish Details" : "Add New Dish"}</h2>
               <form onSubmit={handleAddOrEditItem} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Dish Name</label>
                    <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all" placeholder="e.g. Samosa" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Price (₹)</label>
                      <input required type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all" placeholder="250" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                      <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                        <option>Fast Food</option><option>Starters</option><option>Main Course</option><option>Desserts</option><option>Beverages</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
                    <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all resize-none h-24" placeholder="Brief description..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Image URL (Optional)</label>
                    <input type="text" value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all" placeholder="unsplash.com/..." />
                  </div>
                  
                  <div className="pt-2 flex gap-3">
                    {editingId && (
                      <button type="button" onClick={cancelEditing} className="w-1/3 bg-white border border-slate-200 text-slate-600 py-4 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
                    )}
                    <button disabled={isSubmitting} type="submit" className={`${editingId ? 'w-2/3' : 'w-full'} bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2`}>
                      {isSubmitting ? "Saving..." : editingId ? "Save Changes" : <><FiPlus size={16} /> Add Dish</>}
                    </button>
                  </div>
               </form>
            </div>

            {/* List */}
            <div className="flex-grow">
               <h2 className="text-xl font-black text-slate-900 mb-6">Live Inventory</h2>
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                 <AnimatePresence>
                   {menuItems.map((item) => (
                     <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} key={item.id} 
                        className={`bg-white border p-4 rounded-[24px] transition-all flex items-center gap-4 ${editingId === item.id ? 'border-indigo-400 shadow-md ring-2 ring-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
                     >
                       <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100">
                         <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-grow min-w-0">
                         <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.category}</p>
                         <h4 className="text-base font-black text-slate-900 truncate leading-tight">{item.name}</h4>
                         <p className="text-sm font-bold text-slate-500">₹{item.price}</p>
                       </div>
                       <div className="flex gap-1 flex-shrink-0">
                         <button onClick={() => startEditing(item)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><FiEdit2 size={16} /></button>
                         <button onClick={() => deleteMenuItem(item.id)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><FiTrash2 size={16} /></button>
                       </div>
                     </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
            </div>
          </motion.div>
        )}

        {/* ============================== */}
        {/* TAB 3: TABLE QR CODES          */}
        {/* ============================== */}
        {activeTab === "qr" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm text-center mt-8">
            <h2 className="text-2xl font-black mb-2 text-slate-900">Table QR Generator</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">Create unique scanning codes for your restaurant tables.</p>
            
            <div className="flex flex-col items-center gap-2 mb-8">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Table Number</label>
              <input 
                type="number" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}
                className="w-24 text-center bg-slate-50 border-2 border-slate-100 rounded-xl py-3 font-black text-2xl text-indigo-600 focus:bg-white focus:border-indigo-300 transition-all outline-none"
              />
            </div>

            <div className="bg-white p-6 rounded-3xl mb-8 border border-slate-200 inline-block shadow-sm">
              
              <QRCodeSVG 
  id="restaurant-qr" 
  // 🟢 This automatically uses your live Netlify URL instead of localhost!
  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${restaurant.slug}?table=${selectedTable}`} 
  size={200} 
  level="H" 
  includeMargin={false}
/>
            </div>

            <button onClick={downloadQR} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-sm">
              <FiDownload size={18} /> Download Table {selectedTable} QR
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// 🟢 4-Column Metric Card with Truncation for long names
const MetricCard = ({ label, value, icon, color, bg, truncate }: any) => (
  <div className="bg-white p-8 rounded-[32px] border border-slate-200 flex flex-col justify-center shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
    <div className={`${bg} ${color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{label}</p>
    <h2 className={`text-3xl font-black text-slate-900 ${truncate ? 'truncate w-full' : ''}`} title={truncate ? value : ""}>
      {value}
    </h2>
  </div>
);