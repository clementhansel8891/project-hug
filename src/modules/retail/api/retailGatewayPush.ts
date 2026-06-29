// @audit-ignore: dynamic URL resolved from env var
import { retailGateway } from "@/modules/retail/api/RetailPublicGateway";
import type { RetailGatewayPushEvent } from "@/modules/retail/api/RetailPublicGateway";

type RetailPushInput = Omit<RetailGatewayPushEvent, "occurredAt" | "eventId" | "source"> & {
  occurredAt?: string;
  eventId?: string;
  source?: string;
};

const resolveRemotePushUrl = () => {
  const explicit = import.meta.env.VITE_RETAIL_GATEWAY_PUSH_URL as string | undefined;
  return explicit?.trim() ?? "";
};

const createEventId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const postEvent = async (url: string, event: RetailGatewayPushEvent) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Retail push failed (${response.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
};

const getLocalGateway = () => {
  if (typeof window === "undefined") return null;
  if (retailGateway?.emitPushEvent) {
    return retailGateway;
  }
  const gateway = (window as { Estela Gea?: { RetailGateway?: { emitPushEvent?: (event: RetailGatewayPushEvent) => void } } })
    .Estela Gea?.RetailGateway;
  return gateway?.emitPushEvent ? gateway : null;
};

export const emitRetailPushEvent = async (input: RetailPushInput) => {
  const event: RetailGatewayPushEvent = {
    eventId: input.eventId ?? createEventId(),
    source: input.source ?? "estelagea-retail",
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    type: input.type,
    tenantId: input.tenantId,
    channelId: input.channelId,
    payload: input.payload,
  };

  const remoteUrl = resolveRemotePushUrl();
  if (remoteUrl) {
    try {
      await postEvent(remoteUrl, event);
      return;
    } catch (error) {
      console.warn("Retail push remote delivery failed, falling back to local gateway.", error);
    }
  }

  const localGateway = getLocalGateway();
  if (localGateway) {
    localGateway.emitPushEvent?.(event);
    return;
  }

  console.warn("Retail push dropped: no remote URL or local gateway available.", event);
};
