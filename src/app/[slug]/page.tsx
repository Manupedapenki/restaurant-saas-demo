export default function RestaurantPage({ params }: { params: { slug: string } }) {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Menu for: {params.slug}</h1>
      <p>If you see this, the dynamic route is working!</p>
    </div>
  );
}