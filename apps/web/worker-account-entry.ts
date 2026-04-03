// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - generated after `opennextjs-cloudflare build`
import baseWorker from "./.open-next/worker.js";

interface AccountWorkerEnv {
  STAGING_PROTECTION_ENABLED?: string;
  STAGING_BASIC_AUTH_USERNAME?: string;
  STAGING_BASIC_AUTH_PASSWORD?: string;
  [key: string]: unknown;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="DonateCrate staging", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request: Request, env: AccountWorkerEnv) {
  if (env.STAGING_PROTECTION_ENABLED !== "true") return true;

  const username = env.STAGING_BASIC_AUTH_USERNAME || "staging";
  const password = env.STAGING_BASIC_AUTH_PASSWORD;
  if (!password) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return false;

    return (
      decoded.slice(0, separatorIndex) === username &&
      decoded.slice(separatorIndex + 1) === password
    );
  } catch {
    return false;
  }
}

export default {
  ...baseWorker,

  async fetch(
    request: Request,
    env: AccountWorkerEnv,
    ctx: WorkerExecutionContext,
  ): Promise<Response> {
    if (!isAuthorized(request, env)) {
      return unauthorizedResponse();
    }

    return baseWorker.fetch(request, env, ctx);
  },
};
