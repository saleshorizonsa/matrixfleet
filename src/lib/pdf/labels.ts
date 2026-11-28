// Labels for generated documents, in the organisation's language.

export type PdfLocale = "en" | "de" | "fr" | "es" | "pl";

export function pdfLocale(l: string | null | undefined): PdfLocale {
  return (["en", "de", "fr", "es", "pl"] as const).includes(l as PdfLocale) ? (l as PdfLocale) : "en";
}

export interface InvoiceLabels {
  invoice: string;
  invoiceNo: string;
  issueDate: string;
  supplyDate: string;
  dueDate: string;
  from: string;
  billTo: string;
  vatNo: string;
  companyNo: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  vat: string;
  total: string;
  amountDue: string;
  paymentDetails: string;
  bank: string;
  iban: string;
  bic: string;
  sortCode: string;
  account: string;
  paymentRef: string;
  paymentTerms: (days: number) => string;
  notes: string;
  paid: string;
  void: string;
  draft: string;
  page: string;
  footer: string;
  creditNote: string;
  creditNoteNo: string;
  originalInvoice: string;
  reason: string;
  amountCredited: string;
  taxInvoice: string;
  simplifiedTaxInvoice: string;
  crNo: string;
}

const FOOTER = "Generated with MatrixFleet · Powered by Matrix Infotech Ltd";

export const INVOICE_LABELS: Record<PdfLocale, InvoiceLabels> = {
  en: {
    invoice: "Invoice", invoiceNo: "Invoice no.", issueDate: "Issue date", supplyDate: "Date of supply", dueDate: "Due date",
    from: "From", billTo: "Bill to", vatNo: "VAT no.", companyNo: "Company no.", description: "Description", qty: "Qty",
    unitPrice: "Unit price", amount: "Amount", subtotal: "Subtotal (net)", vat: "VAT", total: "Total", amountDue: "Amount due",
    paymentDetails: "Payment details", bank: "Bank", iban: "IBAN", bic: "BIC/SWIFT", sortCode: "Sort code", account: "Account no.",
    paymentRef: "Payment reference", paymentTerms: (d) => `Payment due within ${d} days of the invoice date.`, notes: "Notes",
    paid: "PAID", void: "VOID", draft: "DRAFT", page: "Page", footer: FOOTER,
    creditNote: "Credit note", creditNoteNo: "Credit note no.", originalInvoice: "Original invoice", reason: "Reason",
    amountCredited: "Amount credited", taxInvoice: "Tax invoice", simplifiedTaxInvoice: "Simplified tax invoice", crNo: "CR no.",
  },
  de: {
    invoice: "Rechnung", invoiceNo: "Rechnungsnr.", issueDate: "Rechnungsdatum", supplyDate: "Leistungsdatum", dueDate: "Fällig am",
    from: "Von", billTo: "Rechnungsempfänger", vatNo: "USt-IdNr.", companyNo: "Handelsregisternr.", description: "Beschreibung", qty: "Menge",
    unitPrice: "Einzelpreis", amount: "Betrag", subtotal: "Zwischensumme (netto)", vat: "USt.", total: "Gesamt", amountDue: "Zahlbetrag",
    paymentDetails: "Zahlungsinformationen", bank: "Bank", iban: "IBAN", bic: "BIC", sortCode: "Sort Code", account: "Kontonr.",
    paymentRef: "Verwendungszweck", paymentTerms: (d) => `Zahlbar innerhalb von ${d} Tagen ab Rechnungsdatum.`, notes: "Hinweise",
    paid: "BEZAHLT", void: "STORNIERT", draft: "ENTWURF", page: "Seite", footer: FOOTER,
    creditNote: "Gutschrift", creditNoteNo: "Gutschriftnr.", originalInvoice: "Ursprüngliche Rechnung", reason: "Grund",
    amountCredited: "Gutgeschriebener Betrag", taxInvoice: "Steuerrechnung", simplifiedTaxInvoice: "Vereinfachte Steuerrechnung", crNo: "CR-Nr.",
  },
  fr: {
    invoice: "Facture", invoiceNo: "N° de facture", issueDate: "Date d'émission", supplyDate: "Date de la prestation", dueDate: "Échéance",
    from: "Émetteur", billTo: "Facturé à", vatNo: "N° TVA", companyNo: "SIREN/SIRET", description: "Désignation", qty: "Qté",
    unitPrice: "Prix unitaire", amount: "Montant", subtotal: "Total HT", vat: "TVA", total: "Total TTC", amountDue: "Net à payer",
    paymentDetails: "Coordonnées de paiement", bank: "Banque", iban: "IBAN", bic: "BIC", sortCode: "Sort code", account: "N° de compte",
    paymentRef: "Référence de paiement", paymentTerms: (d) => `Paiement à ${d} jours à compter de la date de facture. Pénalités de retard : taux légal ; indemnité forfaitaire de recouvrement : 40 €.`, notes: "Remarques",
    paid: "PAYÉE", void: "ANNULÉE", draft: "BROUILLON", page: "Page", footer: FOOTER,
    creditNote: "Avoir", creditNoteNo: "N° d'avoir", originalInvoice: "Facture d'origine", reason: "Motif",
    amountCredited: "Montant crédité", taxInvoice: "Facture fiscale", simplifiedTaxInvoice: "Facture fiscale simplifiée", crNo: "N° CR",
  },
  es: {
    invoice: "Factura", invoiceNo: "N.º de factura", issueDate: "Fecha de emisión", supplyDate: "Fecha de la operación", dueDate: "Vencimiento",
    from: "Emisor", billTo: "Facturar a", vatNo: "NIF-IVA", companyNo: "CIF", description: "Descripción", qty: "Cant.",
    unitPrice: "Precio unitario", amount: "Importe", subtotal: "Base imponible", vat: "IVA", total: "Total", amountDue: "Importe a pagar",
    paymentDetails: "Datos de pago", bank: "Banco", iban: "IBAN", bic: "BIC", sortCode: "Sort code", account: "N.º de cuenta",
    paymentRef: "Referencia de pago", paymentTerms: (d) => `Pago a ${d} días desde la fecha de factura.`, notes: "Observaciones",
    paid: "PAGADA", void: "ANULADA", draft: "BORRADOR", page: "Página", footer: FOOTER,
    creditNote: "Factura rectificativa", creditNoteNo: "N.º de rectificativa", originalInvoice: "Factura original", reason: "Motivo",
    amountCredited: "Importe abonado", taxInvoice: "Factura fiscal", simplifiedTaxInvoice: "Factura fiscal simplificada", crNo: "N.º CR",
  },
  pl: {
    invoice: "Faktura", invoiceNo: "Nr faktury", issueDate: "Data wystawienia", supplyDate: "Data wykonania usługi", dueDate: "Termin płatności",
    from: "Sprzedawca", billTo: "Nabywca", vatNo: "NIP/VAT UE", companyNo: "KRS/REGON", description: "Opis", qty: "Ilość",
    unitPrice: "Cena jedn. netto", amount: "Wartość netto", subtotal: "Razem netto", vat: "VAT", total: "Razem brutto", amountDue: "Do zapłaty",
    paymentDetails: "Dane do przelewu", bank: "Bank", iban: "IBAN", bic: "BIC/SWIFT", sortCode: "Sort code", account: "Nr rachunku",
    paymentRef: "Tytuł przelewu", paymentTerms: (d) => `Płatność w terminie ${d} dni od daty wystawienia faktury.`, notes: "Uwagi",
    paid: "OPŁACONA", void: "ANULOWANA", draft: "PROJEKT", page: "Strona", footer: FOOTER,
    creditNote: "Faktura korygująca", creditNoteNo: "Nr korekty", originalInvoice: "Faktura pierwotna", reason: "Powód",
    amountCredited: "Kwota korekty", taxInvoice: "Faktura podatkowa", simplifiedTaxInvoice: "Uproszczona faktura podatkowa", crNo: "Nr CR",
  },
};

/* --------------------------------------------------------------------- CMR */
// Standard CMR box titles. Rendered bilingual: organisation language / English.

export type CmrKey =
  | "title" | "subtitle" | "convention"
  | "b1" | "b2" | "b3" | "b4" | "b5" | "b6" | "b7" | "b8" | "b9" | "b10" | "b11" | "b12"
  | "b13" | "b14" | "b15" | "b16" | "b17" | "b18" | "b19" | "b20" | "b21" | "b22" | "b23" | "b24"
  | "place" | "date" | "country" | "pallets" | "adr" | "tempControlled" | "carriagePaid" | "receivedBy" | "at" | "reference";

export const CMR_LABELS: Record<PdfLocale, Record<CmrKey, string>> = {
  en: {
    title: "CMR", subtitle: "International consignment note",
    convention: "This carriage is subject, notwithstanding any clause to the contrary, to the Convention on the Contract for the International Carriage of Goods by Road (CMR).",
    b1: "Sender (name, address, country)", b2: "Consignee (name, address, country)", b3: "Place of delivery of the goods",
    b4: "Place and date of taking over the goods", b5: "Documents attached", b6: "Marks and Nos", b7: "Number of packages",
    b8: "Method of packing", b9: "Nature of the goods", b10: "Statistical number", b11: "Gross weight kg", b12: "Volume m³",
    b13: "Sender's instructions", b14: "Directions as to payment", b15: "Cash on delivery", b16: "Carrier (name, address, country)",
    b17: "Successive carriers", b18: "Carrier's reservations and observations", b19: "Special agreements", b20: "To be paid by",
    b21: "Established in / on", b22: "Signature and stamp of the sender", b23: "Signature and stamp of the carrier",
    b24: "Goods received — signature and stamp of the consignee",
    place: "Place", date: "Date", country: "Country", pallets: "Pallets", adr: "Dangerous goods (ADR)", tempControlled: "Temperature controlled",
    carriagePaid: "Carriage paid", receivedBy: "Received by", at: "at", reference: "Reference",
  },
  de: {
    title: "CMR", subtitle: "Internationaler Frachtbrief",
    convention: "Diese Beförderung unterliegt trotz einer gegenteiligen Abmachung den Bestimmungen des Übereinkommens über den Beförderungsvertrag im internationalen Straßengüterverkehr (CMR).",
    b1: "Absender (Name, Anschrift, Land)", b2: "Empfänger (Name, Anschrift, Land)", b3: "Auslieferungsort des Gutes",
    b4: "Ort und Tag der Übernahme des Gutes", b5: "Beigefügte Dokumente", b6: "Kennzeichen und Nummern", b7: "Anzahl der Packstücke",
    b8: "Art der Verpackung", b9: "Bezeichnung des Gutes", b10: "Statistik-Nr.", b11: "Bruttogewicht kg", b12: "Umfang m³",
    b13: "Anweisungen des Absenders", b14: "Frachtzahlungsanweisungen", b15: "Rückerstattung", b16: "Frachtführer (Name, Anschrift, Land)",
    b17: "Nachfolgende Frachtführer", b18: "Vorbehalte und Bemerkungen der Frachtführer", b19: "Besondere Vereinbarungen", b20: "Zu zahlen vom",
    b21: "Ausgefertigt in / am", b22: "Unterschrift und Stempel des Absenders", b23: "Unterschrift und Stempel des Frachtführers",
    b24: "Gut empfangen — Unterschrift und Stempel des Empfängers",
    place: "Ort", date: "Datum", country: "Land", pallets: "Paletten", adr: "Gefahrgut (ADR)", tempControlled: "Temperaturgeführt",
    carriagePaid: "Frei", receivedBy: "Empfangen von", at: "am", reference: "Referenz",
  },
  fr: {
    title: "CMR", subtitle: "Lettre de voiture internationale",
    convention: "Ce transport est soumis, nonobstant toute clause contraire, à la Convention relative au contrat de transport international de marchandises par route (CMR).",
    b1: "Expéditeur (nom, adresse, pays)", b2: "Destinataire (nom, adresse, pays)", b3: "Lieu prévu pour la livraison",
    b4: "Lieu et date de la prise en charge", b5: "Documents annexés", b6: "Marques et numéros", b7: "Nombre de colis",
    b8: "Mode d'emballage", b9: "Nature de la marchandise", b10: "N° statistique", b11: "Poids brut kg", b12: "Cubage m³",
    b13: "Instructions de l'expéditeur", b14: "Prescriptions d'affranchissement", b15: "Remboursement", b16: "Transporteur (nom, adresse, pays)",
    b17: "Transporteurs successifs", b18: "Réserves et observations du transporteur", b19: "Conventions particulières", b20: "À payer par",
    b21: "Établie à / le", b22: "Signature et timbre de l'expéditeur", b23: "Signature et timbre du transporteur",
    b24: "Marchandises reçues — signature et timbre du destinataire",
    place: "Lieu", date: "Date", country: "Pays", pallets: "Palettes", adr: "Marchandises dangereuses (ADR)", tempControlled: "Température dirigée",
    carriagePaid: "Franco", receivedBy: "Reçu par", at: "le", reference: "Référence",
  },
  es: {
    title: "CMR", subtitle: "Carta de porte internacional",
    convention: "Este transporte queda sometido, no obstante toda cláusula contraria, al Convenio relativo al contrato de transporte internacional de mercancías por carretera (CMR).",
    b1: "Remitente (nombre, domicilio, país)", b2: "Consignatario (nombre, domicilio, país)", b3: "Lugar de entrega de la mercancía",
    b4: "Lugar y fecha de carga de la mercancía", b5: "Documentos anexos", b6: "Marcas y números", b7: "Número de bultos",
    b8: "Clase de embalaje", b9: "Naturaleza de la mercancía", b10: "N.º estadístico", b11: "Peso bruto kg", b12: "Volumen m³",
    b13: "Instrucciones del remitente", b14: "Forma de pago", b15: "Reembolso", b16: "Porteador (nombre, domicilio, país)",
    b17: "Porteadores sucesivos", b18: "Reservas y observaciones del porteador", b19: "Estipulaciones particulares", b20: "A pagar por",
    b21: "Formalizado en / el", b22: "Firma y sello del remitente", b23: "Firma y sello del transportista",
    b24: "Mercancía recibida — firma y sello del consignatario",
    place: "Lugar", date: "Fecha", country: "País", pallets: "Palés", adr: "Mercancías peligrosas (ADR)", tempControlled: "Temperatura controlada",
    carriagePaid: "Porte pagado", receivedBy: "Recibido por", at: "el", reference: "Referencia",
  },
  pl: {
    title: "CMR", subtitle: "Międzynarodowy list przewozowy",
    convention: "Niniejszy przewóz podlega, bez względu na jakiekolwiek przeciwne klauzule, postanowieniom Konwencji o umowie międzynarodowego przewozu drogowego towarów (CMR).",
    b1: "Nadawca (nazwisko lub nazwa, adres, kraj)", b2: "Odbiorca (nazwisko lub nazwa, adres, kraj)", b3: "Miejsce przeznaczenia",
    b4: "Miejsce i data załadowania", b5: "Załączone dokumenty", b6: "Cechy i numery", b7: "Ilość sztuk",
    b8: "Sposób opakowania", b9: "Rodzaj towaru", b10: "Numer statystyczny", b11: "Waga brutto kg", b12: "Objętość m³",
    b13: "Instrukcje nadawcy", b14: "Postanowienia odnośnie przewoźnego", b15: "Zapłata", b16: "Przewoźnik (nazwisko lub nazwa, adres, kraj)",
    b17: "Kolejni przewoźnicy", b18: "Zastrzeżenia i uwagi przewoźnika", b19: "Postanowienia specjalne", b20: "Do zapłacenia",
    b21: "Wystawiono w / dnia", b22: "Podpis i stempel nadawcy", b23: "Podpis i stempel przewoźnika",
    b24: "Przesyłkę otrzymano — podpis i stempel odbiorcy",
    place: "Miejsce", date: "Data", country: "Kraj", pallets: "Palety", adr: "Towary niebezpieczne (ADR)", tempControlled: "Kontrolowana temperatura",
    carriagePaid: "Przewoźne opłacone", receivedBy: "Odebrał", at: "dnia", reference: "Numer referencyjny",
  },
};

/** "Absender / Sender" — local language plus English (English only when locale is en). */
export function cmrLabel(locale: PdfLocale, key: CmrKey) {
  const local = CMR_LABELS[locale][key];
  if (locale === "en") return local;
  return `${local} / ${CMR_LABELS.en[key]}`;
}

export function pdfDate(d: string | Date | null | undefined, locale: PdfLocale) {
  if (!d) return "";
  const intl = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" }[locale];
  return new Intl.DateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" }).format(new Date(d));
}

export function pdfDateTime(d: string | Date | null | undefined, locale: PdfLocale) {
  if (!d) return "";
  const intl = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" }[locale];
  return new Intl.DateTimeFormat(intl, {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(new Date(d));
}

export function pdfMoney(n: number | null | undefined, currency: string, locale: PdfLocale) {
  const intl = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL" }[locale];
  // Intl uses (narrow) no-break spaces in fr/pl — normalise to a plain space.
  return new Intl.NumberFormat(intl, { style: "currency", currency }).format(Number(n ?? 0)).replace(/[  ]/g, " ");
}
