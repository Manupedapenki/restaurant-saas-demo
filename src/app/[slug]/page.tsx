import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 font-sans">
      <h1 className="text-3xl font-bold text-black mb-6">Restaurant QR System</h1>
      <Link 
        href="/burger-house" 
        className="px-8 py-4 bg-orange-600 text-white rounded-full font-semibold shadow-lg hover:bg-orange-700 transition-all"
      >
        Open Burger House Menu
      </Link>
    </div>
  );
}