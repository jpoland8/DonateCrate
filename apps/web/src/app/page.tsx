import { redirect } from "next/navigation";

export default function Home() {
  redirect(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4321");
}
