import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl, getSiteUrl } from "@/lib/urls";

export default async function Home() {
  const host = ((await headers()).get("host") || "").toLowerCase();
  const appHost = new URL(getAppUrl()).host.toLowerCase();

  if (host === appHost || host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) {
    redirect("/login");
  }

  redirect(getSiteUrl());
}
