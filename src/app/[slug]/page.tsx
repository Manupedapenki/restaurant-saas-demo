import { supabase } from "@/app/lib/supabase"; // Adjust this path if your client is elsewhere
import { notFound } from "next/navigation";

export default async function RestaurantPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  // 1. Fetch Restaurant Details
  const { data: restaurant, error: restError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (restError || !restaurant) {
    return notFound();
  }

  // 2. Fetch Menu Items for this restaurant
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurant.id);

  return (
    <main className="min-h-screen bg-white p-6">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-zinc-900">{restaurant.name}</h1>
        <p className="text-zinc-500">{restaurant.description}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {menuItems?.map((item) => (
          <div key={item.id} className="border p-4 rounded-xl shadow-sm bg-zinc-50">
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p className="text-zinc-600 text-sm">{item.description}</p>
            <p className="mt-2 font-bold text-orange-600">₹{item.price}</p>
          </div>
        ))}
      </div>
    </main>
  );
}