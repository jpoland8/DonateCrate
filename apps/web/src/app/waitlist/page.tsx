import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/urls";

export default function WaitlistPage() {
  const siteUrl = getSiteUrl();
  redirect(`${siteUrl.replace(/\/$/, "")}/waitlist`);
}
