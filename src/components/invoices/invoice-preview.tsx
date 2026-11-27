import { useTranslations } from "next-intl";
import { addressLines, type BuyerSnapshot, type SellerSnapshot } from "@/lib/invoices";
import { date, money } from "@/lib/format";
import type { Invoice, InvoiceLine, InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Paper-style on-screen rendering of an invoice (mirrors the PDF). */
export function InvoicePreview({
  invoice,
  lines,
  seller,
  buyer,
  status,
  locale,
}: {
  invoice: Invoice;
  lines: InvoiceLine[];
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  status: InvoiceStatus;
  locale: string;
}) {
  const t = useTranslations("invoices");
  const fmt = (n: number) => money(n, invoice.currency, locale);
  const stamp = status === "paid" || status === "void" || status === "draft" ? t(`status.${status}`) : null;
  const bank: [string, string | null][] = [
    [t("detail.bank"), seller.bank_name],
    [t("detail.iban"), seller.bank_iban],
    [t("detail.bic"), seller.bank_bic],
    [t("detail.sortCode"), seller.bank_sort_code],
    [t("detail.account"), seller.bank_account],
    [t("detail.paymentRef"), invoice.number],
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
      <div className="flex h-1.5">
        <div className="flex-1 bg-brand-500" />
        <div className="w-28 bg-lime-signal" />
      </div>
      {stamp && (
        <div
          className={cn(
            "pointer-events-none absolute right-[-60px] top-24 rotate-[30deg] px-24 py-1.5 text-center text-sm font-bold uppercase tracking-[0.3em] text-white",
            status === "paid" ? "bg-emerald-500" : status === "void" ? "bg-slate-400" : "bg-slate-700",
          )}
        >
          {stamp}
        </div>
      )}
      <div className="p-6 sm:p-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <div>
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt={seller.name} className="max-h-14 max-w-[180px] object-contain" />
            ) : (
              <div className="font-display text-xl font-bold text-ink-900">{seller.legal_name || seller.name}</div>
            )}
          </div>
          <div className="sm:text-right">
            <div className="font-display text-3xl font-bold tracking-tight text-ink-900">{t("detail.invoice").toUpperCase()}</div>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-1 text-sm sm:justify-end">
              <dt className="text-slate-500">{t("detail.invoiceNo")}</dt>
              <dd className="font-mono font-semibold text-slate-900">{invoice.number}</dd>
              <dt className="text-slate-500">{t("detail.issueDate")}</dt>
              <dd className="font-medium text-slate-900">{date(invoice.issue_date, locale)}</dd>
              {invoice.supply_date && (
                <>
                  <dt className="text-slate-500">{t("detail.supplyDate")}</dt>
                  <dd className="font-medium text-slate-900">{date(invoice.supply_date, locale)}</dd>
                </>
              )}
              <dt className="text-slate-500">{t("detail.dueDate")}</dt>
              <dd className="font-medium text-slate-900">{date(invoice.due_date, locale)}</dd>
            </dl>
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <Party
            title={t("detail.from")}
            name={seller.legal_name || seller.name}
            lines={[
              ...addressLines(seller),
              seller.vat_number ? `${t("detail.vatNo")} ${seller.vat_number}` : "",
              seller.company_number ? `${t("detail.companyNo")} ${seller.company_number}` : "",
              [seller.email, seller.phone].filter(Boolean).join(" · "),
            ]}
          />
          <Party
            title={t("detail.billTo")}
            name={buyer.name}
            lines={[buyer.contact_name ?? "", ...addressLines(buyer), buyer.vat_number ? `${t("detail.vatNo")} ${buyer.vat_number}` : "", buyer.email ?? ""]}
          />
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="rounded-l-lg px-3 py-2.5">{t("form.description")}</th>
                <th className="px-3 py-2.5 text-right">{t("form.qty")}</th>
                <th className="px-3 py-2.5 text-right">{t("form.unitPrice")}</th>
                <th className="rounded-r-lg px-3 py-2.5 text-right">{t("form.amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-3 text-slate-700">{l.description}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{Number(l.quantity)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{fmt(l.unit_price)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{t("form.subtotal")}</span>
              <span className="tabular-nums text-slate-900">{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>
                {t("form.vat")} {Number(invoice.vat_rate)}%
              </span>
              <span className="tabular-nums text-slate-900">{fmt(invoice.vat_amount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-ink-900 px-4 py-3 text-white">
              <span className="font-medium">{t("form.total")}</span>
              <span className="font-display text-xl font-bold tabular-nums text-lime-signal">{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.vat_note && (
          <div className="mt-6 border-l-[3px] border-brand-500 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">{invoice.vat_note}</div>
        )}
        {invoice.notes && <p className="mt-6 whitespace-pre-line text-sm text-slate-600">{invoice.notes}</p>}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">{t("detail.paymentDetails")}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            {bank
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-mono font-medium text-slate-900">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-3 text-center text-[11px] text-slate-400 sm:px-10">
        Generated with Haulora · Powered by Matrix Infotech Ltd
      </div>
    </div>
  );
}

function Party({ title, name, lines }: { title: string; name: string; lines: string[] }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">{title}</div>
      <div className="font-semibold text-slate-900">{name}</div>
      <div className="mt-1 space-y-0.5 text-sm text-slate-600">
        {lines.filter(Boolean).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
