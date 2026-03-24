import { getAppUrl } from "@/lib/urls";

type EmailLinkType = "magiclink" | "recovery";

export function buildAuthCallbackLink(params: {
  tokenHash: string;
  type: EmailLinkType;
  nextPath: string;
}) {
  const url = new URL("/auth/callback", getAppUrl());
  url.searchParams.set("token_hash", params.tokenHash);
  url.searchParams.set("type", params.type);
  url.searchParams.set("next", params.nextPath);
  return url.toString();
}
