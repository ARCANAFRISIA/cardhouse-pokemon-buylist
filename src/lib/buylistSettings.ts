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
    "Buylists onder €400 verzend je zelf, op eigen kosten en risico. Vanaf €400 kan Card House of the East kosteloos een verzendlabel aanbieden. Leg de kaarten op dezelfde volgorde als je buylist en voeg een briefje toe met je naam, e-mailadres en referentie.",
  termsText:
    `Deze buylist is een voorlopige prijsopgave voor Pokémon kaarten. De definitieve beoordeling en uitbetaling worden vastgesteld nadat Card House of the East de kaarten fysiek heeft ontvangen en gecontroleerd.

Geaccepteerde talen

Card House of the East accepteert uitsluitend originele Pokémon kaarten in de volgende talen:

- Engels
- Japans, voor zover deze kaarten actief in de buylist worden aangeboden

Kaarten in andere talen, waaronder Nederlands, Duits, Frans, Spaans, Italiaans, Portugees of Koreaans, worden niet geaccepteerd tenzij dit vooraf schriftelijk is overeengekomen.

Conditie-eis

Alle aangeboden kaarten moeten in Near Mint conditie zijn, tenzij vooraf anders is afgesproken.

Near Mint betekent dat de kaart vergelijkbaar is met een kaart die rechtstreeks uit een booster pack komt. Kaarten mogen geen zichtbare of duidelijke gebruikssporen bevatten, zoals:

- kreukels;
- vouwen;
- deuken;
- beschadigde hoeken;
- zichtbare whitening aan randen of hoeken;
- krassen;
- drukschade;
- vocht- of vuilschade;
- verkleuring;
- duidelijke slijtage of andere zichtbare beschadigingen.

Grote printafwijkingen, drukschade of andere productiefouten kunnen invloed hebben op de beoordeling.

Beoordeling door Card House of the East

De conditiebeoordeling van Card House of the East is leidend.

Als een kaart niet als Near Mint wordt beoordeeld, behoudt Card House of the East zich het recht voor om:

- de kaart af te waarderen;
- een aangepaste prijs aan te bieden;
- de kaart te weigeren;
- de volledige inzending te weigeren.

Verantwoordelijkheid van de verkoper

De verkoper is verantwoordelijk voor het vooraf zorgvuldig controleren van de kaarten, de aantallen, de kaartversies, de taal en de ingevulde contact- en uitbetalingsgegevens.

Kaarten die niet voldoen aan de buylistvoorwaarden komen mogelijk niet in aanmerking voor de vermelde buylistprijs.

Card House of the East is niet verantwoordelijk voor vertraging, retourzendingen of foutieve uitbetaling als gevolg van verkeerd ingevulde gegevens door de verkoper.

Verzending

Buylists onder €400 worden door de verkoper zelf verzonden, op eigen kosten en risico.

Bij buylists vanaf €400 kan Card House of the East kosteloos een verzendlabel aanbieden. In dat geval ontvang je verdere instructies per e-mail.

De verkoper moet de kaarten goed verpakken en meesturen met een briefje waarop minimaal de naam, het e-mailadres en de buylistreferentie staan.

Retourbeleid

Afgekeurde kaarten worden uitsluitend geretourneerd op verzoek van de verkoper en op kosten van de verkoper.

Als de verkoper geen retour wenst of de retourkosten niet voldoet, kan Card House of the East de verdere afhandeling bepalen.`,
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