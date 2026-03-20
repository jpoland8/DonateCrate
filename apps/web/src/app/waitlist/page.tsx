import { redirect } from "next/navigation";

export default function WaitlistPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4321";
  redirect(`${siteUrl.replace(/\/$/, "")}/waitlist`);
}
