import type { ServiceInput } from "./repository";

type ServicePayload = Partial<ServiceInput>;

export type ParsedServiceInput =
  | { ok: true; input: ServiceInput }
  | { ok: false; error: string };

export function parseServiceInput(payload: ServicePayload): ParsedServiceInput {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const durationMinutes = Number(payload.durationMinutes);
  const priceCents = Number(payload.priceCents);

  if (!name) return { ok: false, error: "Enter a service name." };
  if (!category) return { ok: false, error: "Choose a service category." };
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: "Duration must be greater than 0 minutes." };
  }
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return { ok: false, error: "Price must be 0 or greater." };
  }

  return {
    ok: true,
    input: {
      name,
      category,
      durationMinutes: Math.round(durationMinutes),
      priceCents: Math.round(priceCents),
      description: typeof payload.description === "string" ? payload.description.trim() : "",
      imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "",
      popular: Boolean(payload.popular),
      addon: Boolean(payload.addon),
    },
  };
}
