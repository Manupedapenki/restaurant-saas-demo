import { redirect } from "next/navigation";

export default function Home() {
  // This automatically sends visitors from the main URL 
  // straight to your demo restaurant
  redirect("/burger-house");
}