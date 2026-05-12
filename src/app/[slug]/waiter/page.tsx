"use client";
import "../../globals.css";
import { useEffect, useState, use } from "react"; // <-- 'use' is imported here now
import { supabase } from "../supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

export default function WaiterPanel({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params); // <-- This uses the import we just added
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    let channel: any;
    async function setup() {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", resolvedParams.slug).single();
      if (rest) {
        setRestaurant(rest);
        const { data: active } = await supabase.from("orders")
          .select("*")
          .eq("restaurant_id", rest.id)
          .in('status', ['Pending', 'Cooking', 'Ready'])
          .order("created_at", { ascending: false });
        setOrders(active || []);

        channel = supabase.channel(`kitchen-${rest.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rest.id}` }, 
            (payload) => { 
              setOrders(prev => prev.find(o => o.id === payload.new.id) ? prev : [payload.new, ...prev]);
              toast.success("🚀 NEW ORDER!"); 
            })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rest.id}` }, 
            (payload: any) => {
              if (payload.eventType === 'UPDATE') {
                setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o).filter(o => o.status !== 'Completed'));
              }
            })
          .subscribe();
      }
    }
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [resolvedParams.slug]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
  };

  if (!restaurant) return <div className="h-screen bg-[#020617] flex items-center justify-center text-white font-black uppercase">Syncing...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-10 font-sans">
      <Toaster theme="dark" richColors />
      <header className="flex justify-between items-center mb-12 max-w-7xl mx-auto border-b border-white/5 pb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter italic">{restaurant.name}</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <motion.div key={order.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0f172a] border border-slate-800 rounded-[40px] p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center mb-8">
                  <span className="bg-indigo-600 text-[10px] font-black px-4 py-2 rounded-full uppercase">Table {order.table_number}</span>
                </div>
                <div className="space-y-4 mb-10">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-4">
                      <span className="text-xl font-bold"><span className="text-indigo-400">{item.quantity}x</span> {item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {order.status === "Pending" ? (
                  <button onClick={() => updateStatus(order.id, "Cooking")} className="bg-white text-black py-5 rounded-2xl font-black text-xs uppercase">Accept Order</button>
                ) : order.status === "Cooking" ? (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="bg-emerald-500 text-black py-5 rounded-2xl font-black text-xs uppercase">Ready to Serve</button>
                ) : (
                  <button onClick={() => updateStatus(order.id, "Completed")} className="bg-slate-800 text-white py-5 rounded-2xl font-black text-xs uppercase">Complete</button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}