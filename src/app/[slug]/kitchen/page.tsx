"use client";
import "../../globals.css";
import { useEffect, useState, use } from "react";
import { supabase } from "../supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { FiClock, FiCheck, FiPlay, FiAlertCircle } from "react-icons/fi";

export default function KitchenDisplay({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function loadKitchen() {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", resolvedParams.slug).single();
      if (!rest) return;
      setRestaurant(rest);

      // 🟢 ONLY FETCH PENDING & COOKING (Ignore Ready/Completed)
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", rest.id)
        .in("status", ["Pending", "Cooking"])
        .order("created_at", { ascending: true }); 
      
      setOrders(activeOrders || []);

      // Real-time listener
      const channel = supabase.channel('kitchen-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rest.id}` }, 
          (payload) => {
            toast.success(`NEW TICKET: Table ${payload.new.table_number}!`);
            setOrders(current => [...current, payload.new]);
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rest.id}` },
          (payload) => {
            // If it was marked "Ready" by someone else, remove it from the Kitchen screen
            if (payload.new.status === "Ready" || payload.new.status === "Completed") {
              setOrders(current => current.filter(o => o.id !== payload.new.id));
            } else {
              setOrders(current => current.map(o => o.id === payload.new.id ? payload.new : o));
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    loadKitchen();
  }, [resolvedParams.slug]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      // 🟢 If the Chef marks it Ready, instantly remove it from their screen!
      if (newStatus === "Ready") {
        setOrders(orders.filter(o => o.id !== id));
        toast.success("Order sent to waiters!");
      } else {
        setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
      }
    }
  };

  if (!restaurant) return <div className="h-screen bg-slate-950 flex items-center justify-center font-black text-amber-500 tracking-widest animate-pulse uppercase">Booting KDS...</div>;

  return (
    // 🟢 RUGGED DARK MODE FOR KITCHEN VISIBILITY
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6 selection:bg-amber-500/30">
      <Toaster richColors position="top-right" theme="dark" />
      
      {/* Kitchen Header */}
      <div className="max-w-[1600px] mx-auto flex justify-between items-center mb-8 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white leading-none">Kitchen Display <span className="text-amber-500">System</span></h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-2">{restaurant.name}</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950 px-5 py-3 rounded-xl border border-slate-800">
          <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-black uppercase tracking-widest text-slate-300">Live Feed</span>
        </div>
      </div>

      {/* Ticket Grid */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {orders.map((order) => (
            <motion.div 
              layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              key={order.id} 
              // 🟢 High contrast ticket colors
              className={`bg-slate-900 rounded-[32px] p-6 border-t-8 shadow-2xl flex flex-col transition-all
                ${order.status === "Pending" ? "border-t-amber-500" : "border-t-sky-500"}
              `}
            >
              {/* Ticket Header */}
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-4xl font-black text-white">Table {order.table_number}</h2>
                  <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">ID: {order.id.slice(0, 4)}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest
                  ${order.status === "Pending" ? "bg-amber-500/10 text-amber-500" : "bg-sky-500/10 text-sky-400"}
                `}>
                  {order.status === "Pending" ? "NEW" : "COOKING"}
                </div>
              </div>

              {/* Food Items (Massive text for chefs) */}
              <div className="flex-grow mb-8 space-y-5">
                {order.items.map((item: any, index: number) => (
                  <div key={index} className="flex items-start gap-4">
                    <span className="bg-slate-800 text-white font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                      {item.quantity}
                    </span>
                    <span className="font-bold text-slate-300 text-2xl leading-tight pt-1">{item.name}</span>
                  </div>
                ))}
              </div>

              {/* Kitchen Action Buttons ONLY */}
              <div className="mt-auto pt-6 border-t border-slate-800">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Cooking")} className="w-full bg-amber-600 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/50">
                    <FiPlay size={24} /> Start Cooking
                  </button>
                )}
                {order.status === "Cooking" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full bg-sky-600 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-sky-500 transition-colors shadow-lg shadow-sky-900/50">
                    <FiCheck size={24} /> Order Ready
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="col-span-full py-32 text-center flex flex-col items-center justify-center bg-slate-900 rounded-[40px] border border-slate-800 shadow-sm">
            <FiAlertCircle size={64} className="text-slate-700 mb-6" />
            <h3 className="text-2xl font-black text-slate-500 uppercase tracking-widest">Kitchen Clear</h3>
            <p className="text-slate-600 font-bold mt-2">Waiting for new tickets...</p>
          </div>
        )}
      </div>
    </div>
  );
}