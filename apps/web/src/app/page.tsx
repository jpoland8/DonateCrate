import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/urls";

export default async function Home() {
  const host = (await headers()).get("host") || "";
  if (host === "app.donatecrate.com") {
    redirect("/login");
  }

  redirect(getSiteUrl());
}
