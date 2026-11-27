"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { importCustomers, type ImportRow } from "@/app/app/customers/actions";
import { Button, Textarea } from "@/components/ui";
import { Modal } from "@/components/app/client";

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas/semicolons). */
function parseCsv(text: string): ImportRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

export function ImportCustomersButton() {
  const t = useTranslations("customers");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, start] = React.useTransition();
  const rows = React.useMemo(() => (text ? parseCsv(text) : []), [text]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
  };

  const run = () =>
    start(async () => {
      const res = await importCustomers(rows);
      if (res.error) {
        toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : res.error);
        return;
      }
      toast.success(t("import.done", { count: res.inserted }));
      setOpen(false);
      setText("");
      router.refresh();
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> {t("import.button")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("import.title")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("import.cancel")}
            </Button>
            <Button onClick={run} disabled={!rows.length || pending}>
              {t("import.run", { count: rows.length })}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">{t("import.help")}</p>
        <code className="mb-4 block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          name,vat_number,country,address,city,postcode,contact,email,phone,payment_terms_days
        </code>
        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 transition hover:border-brand-300 hover:text-brand-600">
          <FileUp className="h-5 w-5" /> {t("import.choose")}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("import.paste")} className="min-h-[140px] font-mono text-xs" />
        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {Object.keys(rows[0]).map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-3 py-1.5 text-slate-700">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <div className="px-3 py-1.5 text-xs text-slate-400">{t("import.more", { count: rows.length - 5 })}</div>}
          </div>
        )}
      </Modal>
    </>
  );
}
