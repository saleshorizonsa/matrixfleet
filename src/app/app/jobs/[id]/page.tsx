import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft, Camera, CircleDot, Clock, Flame, MapPin, MessageSquare, Package, Pencil, Phone, Receipt, Route,
  Signature, Snowflake, Truck, User, UserCheck,
} from "lucide-react";
import { requireOffice } from "@/lib/auth";
import { Avatar, Badge, Card, CardBody, CardHeader, LinkButton, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/app/status-badge";
import { RouteMap } from "@/components/maps";
import { country } from "@/lib/countries";
import { APP_URL } from "@/lib/utils";
import { dateTime, date as fmtDate, distance, intlLocale, money } from "@/lib/format";
import type { Customer, Driver, Job, JobEvent, Vehicle } from "@/lib/types";
import { DocumentToolbar } from "@/components/documents/document-toolbar";
import { AssignForm, CopyLink, DangerActions, DuplicateButton, NoteForm, StatusControls } from "./job-actions";

export const metadata = { title: "Job" };

type Detail = Job & {
  customer: Pick<Customer, "id" | "name" | "email" | "phone"> | null;
  driver: Pick<Driver, "id" | "full_name" | "colour" | "phone"> | null;
  vehicle: Pick<Vehicle, "id" | "registration" | "make" | "model"> | null;
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOffice();
  const t = await getTranslations("jobs");
  const ts = await getTranslations("common.status");
  const locale = intlLocale(await getLocale());
  const canEdit = ["owner", "admin", "dispatcher"].includes(ctx.membership.role);

  const { data: job } = await ctx.supabase
    .from("hl_jobs")
    .select(
      "*, customer:hl_customers(id, name, email, phone), driver:hl_drivers(id, full_name, colour, phone), vehicle:hl_vehicles(id, registration, make, model)",
    )
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .maybeSingle<Detail>();
  if (!job) notFound();

  const [{ data: events }, { data: drivers }, { data: vehicles }] = await Promise.all([
    ctx.supabase.from("hl_job_events").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("hl_drivers").select("id, full_name").eq("org_id", ctx.org.id).neq("status", "inactive").order("full_name"),
    ctx.supabase.from("hl_vehicles").select("id, registration, default_driver_id").eq("org_id", ctx.org.id).order("registration"),
  ]);

  // Proof of delivery — private bucket, short-lived signed URLs
  const podPaths = [job.pod_signature_path, ...(job.pod_photo_paths ?? [])].filter(Boolean) as string[];
  const signed: Record<string, string> = {};
  if (podPaths.length) {
    const { data } = await ctx.supabase.storage.from("hl-pod").createSignedUrls(podPaths, 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed[s.path] = s.signedUrl;
  }

  const trackingUrl = `${APP_URL}/track/${job.tracking_token}`;
  const margin = job.price_net != null && job.cost_estimate != null ? job.price_net - job.cost_estimate : null;
  const from = job.pickup_lat != null && job.pickup_lng != null ? { lat: job.pickup_lat, lng: job.pickup_lng, label: job.pickup_city ?? undefined } : null;
  const to = job.delivery_lat != null && job.delivery_lng != null ? { lat: job.delivery_lat, lng: job.delivery_lng, label: job.delivery_city ?? undefined } : null;

  return (
    <div className="animate-fade-up">
      <Link href="/app/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-slate-900 sm:text-[28px]">{job.reference}</h1>
            <StatusBadge status={job.status} className="text-sm" />
            {job.adr && (
              <Badge tone="amber">
                <Flame className="h-3 w-3" /> ADR {job.adr_un_number}
              </Badge>
            )}
            {job.temperature_controlled && (
              <Badge tone="sky">
                <Snowflake className="h-3 w-3" /> {t("form.temperature")}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {job.customer ? (
              <Link href={`/app/customers/${job.customer.id}`} className="font-medium text-slate-700 hover:underline">
                {job.customer.name}
              </Link>
            ) : (
              t("form.noCustomer")
            )}
            {job.customer_ref && <> · {t("form.customerRef")}: {job.customer_ref}</>}
            {" · "}
            {t("createdAt", { date: dateTime(job.created_at, locale) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <LinkButton href={`/app/jobs/${job.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> {t("actions.edit")}
            </LinkButton>
          )}
          {canEdit && <DuplicateButton jobId={job.id} />}
          {job.status !== "quote" && (
            <DocumentToolbar
              kind="cmr"
              id={job.id}
              filename={`CMR-${job.reference}.pdf`}
              shareable={job.status !== "cancelled"}
              email={{
                to: job.customer?.email ?? "",
                subject: t("cmrEmailSubject", { reference: job.reference, company: ctx.org.legal_name || ctx.org.name }),
                message: t("cmrEmailBody", { reference: job.reference, company: ctx.org.legal_name || ctx.org.name }),
              }}
              whatsapp={{
                phone: job.customer?.phone ?? "",
                message: t("cmrWhatsapp", { reference: job.reference, company: ctx.org.legal_name || ctx.org.name }),
              }}
            />
          )}
          {job.invoice_id ? (
            <LinkButton href={`/app/invoices/${job.invoice_id}`} variant="secondary">
              <Receipt className="h-4 w-4" /> {t("actions.viewInvoice")}
            </LinkButton>
          ) : (
            ["delivered", "in_transit", "assigned", "booked"].includes(job.status) && (
              <LinkButton href={`/app/invoices/new?job=${job.id}`} variant={job.status === "delivered" ? "lime" : "secondary"}>
                <Receipt className="h-4 w-4" /> {t("actions.createInvoice")}
              </LinkButton>
            )
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Map + route */}
          <Card className="overflow-hidden">
            {from || to ? (
              <RouteMap from={from} to={to} className="h-72 w-full sm:h-80" />
            ) : (
              <div className="grid h-40 place-items-center bg-slate-50 text-sm text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {t("noCoordinates")}
                </span>
              </div>
            )}
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
              <Stop
                letter="A"
                tone="bg-sky-500"
                title={t("pickup")}
                name={job.pickup_name}
                lines={[job.pickup_address, [job.pickup_postcode, job.pickup_city].filter(Boolean).join(" "), country(job.pickup_country)?.name]}
                contact={job.pickup_contact}
                phone={job.pickup_phone}
                window={[job.pickup_from, job.pickup_to]}
                actual={job.picked_up_at}
                actualLabel={t("pickedUpAt")}
                locale={locale}
              />
              <Stop
                letter="B"
                tone="bg-emerald-500"
                title={t("delivery")}
                name={job.delivery_name}
                lines={[job.delivery_address, [job.delivery_postcode, job.delivery_city].filter(Boolean).join(" "), country(job.delivery_country)?.name]}
                contact={job.delivery_contact}
                phone={job.delivery_phone}
                window={[job.delivery_from, job.delivery_to]}
                actual={job.delivered_at}
                actualLabel={t("deliveredAt")}
                locale={locale}
              />
            </div>
          </Card>

          {/* Goods */}
          <Card>
            <CardHeader title={t("form.goods")} />
            <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Info label={t("form.goodsDescription")} value={job.goods_description} wide />
              <Info label={t("form.weight")} value={job.weight_kg != null ? `${job.weight_kg} kg` : null} />
              <Info label={t("form.pallets")} value={job.pallets} />
              <Info label={t("form.volume")} value={job.volume_m3 != null ? `${job.volume_m3} m³` : null} />
              <Info label={t("form.scheduledDate")} value={fmtDate(job.scheduled_date, locale)} />
              {job.notes && <Info label={t("form.notes")} value={job.notes} wide />}
            </CardBody>
          </Card>

          {/* POD */}
          {(job.pod_signed_by || podPaths.length > 0) && (
            <Card>
              <CardHeader
                title={t("pod.title")}
                description={job.delivered_at ? t("pod.deliveredAt", { date: dateTime(job.delivered_at, locale) }) : undefined}
                action={<Badge tone="green">{t("pod.verified")}</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <UserCheck className="h-3.5 w-3.5" /> {t("pod.signedBy")}
                    </div>
                    <div className="font-medium text-slate-900">{job.pod_signed_by ?? "—"}</div>
                    {job.pod_notes && <p className="mt-2 text-sm text-slate-600">{job.pod_notes}</p>}
                    {job.pod_lat != null && job.pod_lng != null && (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${job.pod_lat}&mlon=${job.pod_lng}#map=17/${job.pod_lat}/${job.pod_lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="h-3 w-3" /> {t("pod.location")}
                      </a>
                    )}
                  </div>
                  {job.pod_signature_path && signed[job.pod_signature_path] && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Signature className="h-3.5 w-3.5" /> {t("pod.signature")}
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signed[job.pod_signature_path]} alt={t("pod.signature")} className="h-28 w-full rounded-xl bg-slate-50 object-contain ring-1 ring-slate-200" />
                    </div>
                  )}
                </div>
                {(job.pod_photo_paths ?? []).length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <Camera className="h-3.5 w-3.5" /> {t("pod.photos")}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {job.pod_photo_paths.map(
                        (p) =>
                          signed[p] && (
                            <a key={p} href={signed[p]} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl ring-1 ring-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={signed[p]} alt="" className="aspect-square w-full object-cover transition group-hover:scale-105" />
                            </a>
                          ),
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader title={t("timeline.title")} />
            <CardBody className="space-y-5">
              <NoteForm jobId={job.id} />
              <ol className="relative space-y-4 border-l-2 border-slate-100 pl-6">
                {((events ?? []) as JobEvent[]).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full bg-white ring-2 ring-slate-100">
                      {e.kind === "note" ? (
                        <MessageSquare className="h-3 w-3 text-slate-500" />
                      ) : e.kind === "assigned" ? (
                        <User className="h-3 w-3 text-violet-500" />
                      ) : e.kind === "pod" ? (
                        <Signature className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <CircleDot className="h-3 w-3 text-brand-500" />
                      )}
                    </span>
                    <div className="text-sm text-slate-800">
                      {e.kind === "created" && t("timeline.created", { status: e.status ? ts(e.status) : "" })}
                      {e.kind === "status" && e.status && (
                        <span className="inline-flex items-center gap-2">
                          {t("timeline.statusChanged")} <StatusBadge status={e.status} />
                        </span>
                      )}
                      {e.kind === "assigned" && t("timeline.assigned", { name: e.message ?? "" })}
                      {!["created", "status", "assigned"].includes(e.kind) && (e.message ?? e.kind)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{dateTime(e.created_at, locale)}</div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader title={t("workflow")} />
              <CardBody>
                <StatusControls jobId={job.id} status={job.status} />
              </CardBody>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="bg-ink-900 p-5 text-white">
              <div className="text-sm text-white/60">{t("price")}</div>
              <div className="mt-1 font-display text-3xl font-bold">{money(job.price_net, job.currency, locale)}</div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Route className="h-4 w-4 text-lime-signal" /> {distance(job.distance_km, ctx.org.distance_unit)}
                </span>
                {job.duration_min != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-lime-signal" /> {Math.floor(job.duration_min / 60)}h {job.duration_min % 60}m
                  </span>
                )}
              </div>
            </div>
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <Info label={t("form.cost", { currency: job.currency })} value={money(job.cost_estimate, job.currency, locale)} />
              <Info
                label={t("margin")}
                value={
                  margin != null ? (
                    <span className={margin >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {money(margin, job.currency, locale)}
                      {job.price_net ? ` (${Math.round((margin / job.price_net) * 100)}%)` : ""}
                    </span>
                  ) : null
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("form.assignment")} />
            <CardBody>
              {job.driver && (
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <Avatar name={job.driver.full_name} colour={job.driver.colour} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{job.driver.full_name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Truck className="h-3 w-3" /> {job.vehicle?.registration ?? "—"}
                    </div>
                  </div>
                  {job.driver.phone && (
                    <a href={`tel:${job.driver.phone}`} className={buttonClass("secondary", "sm")} aria-label="Call driver">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
              {canEdit ? (
                <AssignForm
                  jobId={job.id}
                  driverId={job.driver_id}
                  vehicleId={job.vehicle_id}
                  drivers={drivers ?? []}
                  vehicles={vehicles ?? []}
                />
              ) : (
                !job.driver && <p className="text-sm text-slate-500">{t("notAssigned")}</p>
              )}
            </CardBody>
          </Card>

          {job.status !== "quote" && (
            <Card>
              <CardHeader title={t("trackingLink")} description={t("trackingLinkHint")} />
              <CardBody>
                <CopyLink url={trackingUrl} />
              </CardBody>
            </Card>
          )}

          {canEdit && (
            <DangerActions
              jobId={job.id}
              canCancel={!["cancelled", "invoiced", "delivered"].includes(job.status)}
              canDelete={["owner", "admin"].includes(ctx.membership.role) && !job.invoice_id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : undefined}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 whitespace-pre-line text-slate-900">{value === null || value === undefined || value === "" ? "—" : value}</div>
    </div>
  );
}

function Stop({
  letter,
  tone,
  title,
  name,
  lines,
  contact,
  phone,
  window,
  actual,
  actualLabel,
  locale,
}: {
  letter: string;
  tone: string;
  title: string;
  name: string | null;
  lines: (string | null | undefined)[];
  contact: string | null;
  phone: string | null;
  window: [string | null, string | null];
  actual: string | null;
  actualLabel: string;
  locale: string;
}) {
  return (
    <div className="bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white ${tone}`}>{letter}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      {name && <div className="font-medium text-slate-900">{name}</div>}
      <div className="text-sm text-slate-600">
        {lines.filter(Boolean).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      {(window[0] || window[1]) && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5" />
          {dateTime(window[0], locale)} – {dateTime(window[1], locale)}
        </div>
      )}
      {(contact || phone) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {contact && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {contact}
            </span>
          )}
          {phone && (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <Phone className="h-3.5 w-3.5" /> {phone}
            </a>
          )}
        </div>
      )}
      {actual && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Package className="h-3.5 w-3.5" /> {actualLabel}: {dateTime(actual, locale)}
        </div>
      )}
    </div>
  );
}
