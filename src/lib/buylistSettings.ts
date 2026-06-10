import { prisma } from "@/lib/prisma";

export type BuylistSettings = {
  generalPayoutPct: number;
  excellentPenaltyPct: number;
  minimumBuyPriceCents: number;
  customerCanShipDirectly: boolean;
  shippingInstructions: string;
  termsText: string;
};

export const DEFAULT_BUYLIST_SETTINGS: BuylistSettings = {
  generalPayoutPct: 70,
  excellentPenaltyPct: 30,
  minimumBuyPriceCents: 100,
  customerCanShipDirectly: true,
  shippingInstructions:
    "Na het indienen kun je je kaarten direct opsturen naar Card House. Leg de kaarten op dezelfde volgorde als je buylist en voeg een briefje toe met je naam, e-mailadres en referentie.",
  termsText:
    "Deze buylist is een indicatieve prijsopgave. De definitieve uitbetaling wordt vastgesteld nadat Card House de kaarten heeft gecontroleerd. De buylist is gebaseerd op Engelse Near Mint Pokémon kaarten. Als kaarten niet Near Mint zijn, kan Card House de uitbetaling aanpassen. Kaarten die niet voldoen aan de buylistvoorwaarden kunnen worden aangepast of afgewezen.",
};

function toInt(value: string | null | undefined, fallback: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: string | null | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export async function getBuylistSettings(): Promise<BuylistSettings> {
  const rows = await prisma.buylistSetting.findMany();

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    generalPayoutPct: toInt(
      map.get("generalPayoutPct"),
      DEFAULT_BUYLIST_SETTINGS.generalPayoutPct
    ),
    excellentPenaltyPct: toInt(
      map.get("excellentPenaltyPct"),
      DEFAULT_BUYLIST_SETTINGS.excellentPenaltyPct
    ),
    minimumBuyPriceCents: toInt(
      map.get("minimumBuyPriceCents"),
      DEFAULT_BUYLIST_SETTINGS.minimumBuyPriceCents
    ),
    customerCanShipDirectly: toBool(
      map.get("customerCanShipDirectly"),
      DEFAULT_BUYLIST_SETTINGS.customerCanShipDirectly
    ),
    shippingInstructions:
      map.get("shippingInstructions") ??
      DEFAULT_BUYLIST_SETTINGS.shippingInstructions,
    termsText: map.get("termsText") ?? DEFAULT_BUYLIST_SETTINGS.termsText,
  };
}

export async function saveBuylistSettings(input: BuylistSettings) {
  const entries: Array<[string, string]> = [
    ["generalPayoutPct", String(input.generalPayoutPct)],
    ["excellentPenaltyPct", String(input.excellentPenaltyPct)],
    ["minimumBuyPriceCents", String(input.minimumBuyPriceCents)],
    ["customerCanShipDirectly", String(input.customerCanShipDirectly)],
    ["shippingInstructions", input.shippingInstructions],
    ["termsText", input.termsText],
  ];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.buylistSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
}