export function normalizeToE164US(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    if (/^\+[1-9]\d{7,14}$/.test(normalized)) return normalized;
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function getTwilioConfigError() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    return "Twilio credentials are not configured";
  }
  if (!from && !messagingServiceSid) {
    return "Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID";
  }
  return null;
}

export async function getTwilioDeliveryHealth() {
  const configError = getTwilioConfigError();
  if (configError) {
    return { ready: false as const, status: "not_configured" as const, detail: configError };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        typeof json?.message === "string"
          ? json.message
          : typeof json?.error_message === "string"
            ? json.error_message
            : "Twilio verification failed";
      return { ready: false as const, status: "error" as const, detail };
    }
    return {
      ready: true as const,
      status: "verified" as const,
      detail: "Twilio credentials authenticated successfully.",
    };
  } catch (error) {
    return {
      ready: false as const,
      status: "error" as const,
      detail: error instanceof Error ? error.message : "Twilio verification failed",
    };
  }
}

export async function sendTwilioSms(params: { to: string; body: string }) {
  const configError = getTwilioConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: params.to,
    Body: params.body,
  });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  else if (from) body.set("From", from);

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.error_message === "string"
          ? json.error_message
          : "Twilio request failed";
    throw new Error(detail);
  }

  return { sid: typeof json?.sid === "string" ? json.sid : null };
}
