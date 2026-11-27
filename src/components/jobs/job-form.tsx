"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowDown, Calculator, Check, Flame, Loader2, MapPin, Package, Plus, Route, Snowflake, Sparkles, Truck, User,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea, Badge } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/app/client";
import { AddressSearch, type GeoHit } from "./address-search";
import { DateTimeField } from "./datetime-field";
import { saveJob, quickAddCustomer } from "@/app/app/jobs/actions";
import { calculateQuote } from "@/lib/pricing";
import { money } from "@/lib/format";
import { COUNTRIES } from "@/lib/countries";
import type { Job, PricingSettings } from "@/lib/types";

export interface JobFormCustomer {
  id: string;
  name: string;
  rate_per_distance: number | null;
  country: string;
}
export interface JobFormDriver {
  id: string;
  full_name: string;
}
export interface JobFormVehicle {
  id: string;
  registration: string;
  default_driver_id: string | null;
}

interface Side {
  name: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  contact: string;
  phone: string;
}

function sideFrom(job: Partial<Job> | undefined, prefix: "pickup" | "delivery", country: string): Side {
  const j = (job ?? {}) as Record<string, unknown>;
  const s = (k: string) => (j[`${prefix}_${k}`] as string | null) ?? "";
  return {
    name: s("name"),
    address: s("address"),
    city: s("city"),
    postcode: s("postcode"),
    country: s("country") || country,
    lat: (j[`${prefix}_lat`] as number | null) ?? null,
    lng: (j[`${prefix}_lng`] as number | null) ?? null,
    contact: s("contact"),
    phone: s("phone"),
  };
}

export function JobForm({
  org,
  customers: initialCustomers,
  drivers,
  vehicles,
  job,
  defaultCustomerId,
  defaultQuote,
}: {
  org: { currency: string; distance_unit: "km" | "mi"; pricing: PricingSettings; country: string };
  customers: JobFormCustomer[];
  drivers: JobFormDriver[];
  vehicles: JobFormVehicle[];
  job?: Job;
  defaultCustomerId?: string;
  defaultQuote?: boolean;
}) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const [state, action] = React.useActionState(saveJob, undefined);
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [customerId, setCustomerId] = React.useState(job?.customer_id ?? defaultCustomerId ?? "");
  const [pickup, setPickup] = React.useState<Side>(() => sideFrom(job, "pickup", org.country));
  const [delivery, setDelivery] = React.useState<Side>(() => sideFrom(job, "delivery", org.country));
  const [pallets, setPallets] = React.useState<string>(job?.pallets?.toString() ?? "");
  const [adr, setAdr] = React.useState(job?.adr ?? false);
  const [distanceKm, setDistanceKm] = React.useState<number | null>(job?.distance_km ?? null);
  const [durationMin, setDurationMin] = React.useState<number | null>(job?.duration_min ?? null);
  const [estimated, setEstimated] = React.useState(false);
  const [routing, setRouting] = React.useState(false);
  const [price, setPrice] = React.useState<string>(job?.price_net?.toString() ?? "");
  const [driverId, setDriverId] = React.useState(job?.driver_id ?? "");
  const [vehicleId, setVehicleId] = React.useState(job?.vehicle_id ?? "");
  const [showAddCustomer, setShowAddCustomer] = React.useState(false);
  const isQuote = job ? job.status === "quote" : !!defaultQuote;

  // Auto-route whenever both ends have coordinates
  const routeKey = pickup.lat && delivery.lat ? `${pickup.lat},${pickup.lng},${delivery.lat},${delivery.lng}` : "";
  const firstRoute = React.useRef(true);
  React.useEffect(() => {
    if (!routeKey) return;
    if (firstRoute.current && job?.distance_km) {
      firstRoute.current = false;
      return; // keep stored distance on first render of an existing job
    }
    firstRoute.current = false;
    let alive = true;
    setRouting(true);
    const qs = new URLSearchParams({
      fromLat: String(pickup.lat),
      fromLng: String(pickup.lng),
      toLat: String(delivery.lat),
      toLng: String(delivery.lng),
    });
    fetch(`/api/geo/route?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || typeof j.km !== "number") return;
        setDistanceKm(j.km);
        setDurationMin(j.minutes);
        setEstimated(!!j.estimated);
      })
      .catch(() => toast.error(t("routeFailed")))
      .finally(() => alive && setRouting(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const customer = customers.find((c) => c.id === customerId);
  const quote =
    distanceKm != null
      ? calculateQuote({
          distanceKm,
          unit: org.distance_unit,
          pallets: Number(pallets) || 0,
          adr,
          pricing: org.pricing,
          ratePerDistance: customer?.rate_per_distance,
        })
      : null;

  const displayDistance = distanceKm != null ? (org.distance_unit === "mi" ? distanceKm * 0.621371 : distanceKm) : null;
  const fmt = (n: number) => money(n, org.currency);

  const swap = () => {
    setPickup(delivery);
    setDelivery(pickup);
  };

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_380px]">
      {job && <input type="hidden" name="id" value={job.id} />}
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="distance_km" value={distanceKm ?? ""} />
      <input type="hidden" name="duration_min" value={durationMin ?? ""} />

      <div className="space-y-6">
        {/* Customer */}
        <Card>
          <CardHeader title={t("form.customer")} description={t("form.customerHint")} />
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_auto_220px] sm:items-end">
            <Field label={t("form.customer")}>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t("form.noCustomer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="secondary" onClick={() => setShowAddCustomer(true)}>
              <Plus className="h-4 w-4" /> {t("form.newCustomer")}
            </Button>
            <Field label={t("form.customerRef")}>
              <Input name="customer_ref" defaultValue={job?.customer_ref ?? ""} placeholder="PO-12345" />
            </Field>
          </CardBody>
        </Card>

        {/* Route */}
        <Card>
          <CardHeader title={t("form.route")} description={t("form.routeHint")} />
          <CardBody className="space-y-2">
            <AddressBlock prefix="pickup" side={pickup} setSide={setPickup} defaultFrom={job?.pickup_from} defaultTo={job?.pickup_to} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={swap}
                title={t("form.swap")}
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition hover:rotate-180 hover:text-brand-600"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <AddressBlock prefix="delivery" side={delivery} setSide={setDelivery} defaultFrom={job?.delivery_from} defaultTo={job?.delivery_to} />
          </CardBody>
        </Card>

        {/* Goods */}
        <Card>
          <CardHeader title={t("form.goods")} />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("form.goodsDescription")} className="sm:col-span-2 lg:col-span-4">
              <Input name="goods_description" defaultValue={job?.goods_description ?? ""} placeholder={t("form.goodsPlaceholder")} />
            </Field>
            <Field label={t("form.weight")}>
              <Input name="weight_kg" type="number" step="0.1" min="0" defaultValue={job?.weight_kg ?? ""} />
            </Field>
            <Field label={t("form.pallets")}>
              <Input name="pallets" type="number" min="0" value={pallets} onChange={(e) => setPallets(e.target.value)} />
            </Field>
            <Field label={t("form.volume")}>
              <Input name="volume_m3" type="number" step="0.1" min="0" defaultValue={job?.volume_m3 ?? ""} />
            </Field>
            <Field label={t("form.scheduledDate")}>
              <Input name="scheduled_date" type="date" defaultValue={job?.scheduled_date ?? ""} />
            </Field>
            <div className="flex flex-wrap items-center gap-6 sm:col-span-2 lg:col-span-4">
              <Checkbox
                name="adr"
                checked={adr}
                onChange={(e) => setAdr(e.target.checked)}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" /> {t("form.adr")}
                  </span>
                }
              />
              <Checkbox
                name="temperature_controlled"
                defaultChecked={job?.temperature_controlled}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Snowflake className="h-4 w-4 text-sky-500" /> {t("form.temperature")}
                  </span>
                }
              />
              {adr && (
                <Input name="adr_un_number" defaultValue={job?.adr_un_number ?? ""} placeholder={t("form.unNumber")} className="w-40" />
              )}
            </div>
          </CardBody>
        </Card>

        {/* Assignment & notes */}
        <Card>
          <CardHeader title={t("form.assignment")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("driver")}>
              <Select
                name="driver_id"
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                  const v = vehicles.find((x) => x.default_driver_id === e.target.value);
                  if (v && !vehicleId) setVehicleId(v.id);
                }}
              >
                <option value="">{tc("unassigned")}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("vehicle")}>
              <Select name="vehicle_id" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("form.notes")} className="sm:col-span-2" hint={t("form.notesHint")}>
              <Textarea name="notes" defaultValue={job?.notes ?? ""} />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Quote calculator */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-hidden">
          <div className="relative overflow-hidden bg-ink-900 px-5 py-5 text-white">
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/40 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Calculator className="h-4 w-4 text-lime-signal" /> {t("quote.title")}
              </div>
              <div className="mt-3 font-display text-4xl font-bold">{quote ? fmt(quote.total) : "—"}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                <Route className="h-4 w-4" />
                {routing ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("quote.routing")}
                  </span>
                ) : displayDistance != null ? (
                  <>
                    {Math.round(displayDistance).toLocaleString()} {org.distance_unit}
                    {durationMin != null && <> · {Math.floor(durationMin / 60)}h {durationMin % 60}m</>}
                    {estimated && <Badge tone="amber" className="ml-1">{t("quote.estimated")}</Badge>}
                  </>
                ) : (
                  t("quote.needRoute")
                )}
              </div>
            </div>
          </div>
          <CardBody className="space-y-4">
            <Field label={t("quote.distance", { unit: org.distance_unit })} hint={t("quote.distanceHint")}>
              <Input
                type="number"
                min="0"
                step="1"
                value={displayDistance != null ? Math.round(displayDistance) : ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!e.target.value) return setDistanceKm(null);
                  setDistanceKm(org.distance_unit === "mi" ? v / 0.621371 : v);
                  setEstimated(false);
                }}
              />
            </Field>

            {quote && (
              <dl className="space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
                <Row label={t("quote.base")} value={fmt(quote.base)} />
                <Row
                  label={t("quote.distanceCharge", { distance: Math.round(quote.distance), unit: org.distance_unit, rate: fmt(quote.rate) })}
                  value={fmt(quote.distanceCharge)}
                />
                {quote.palletCharge > 0 && <Row label={t("quote.pallets")} value={fmt(quote.palletCharge)} />}
                {quote.adrCharge > 0 && <Row label={t("quote.adr")} value={fmt(quote.adrCharge)} />}
                <Row label={t("quote.fuel", { pct: quote.fuelPct })} value={fmt(quote.fuelCharge)} />
                <div className="my-1 h-px bg-slate-200" />
                <Row label={<span className="font-semibold text-slate-900">{t("quote.totalNet")}</span>} value={<span className="font-semibold">{fmt(quote.total)}</span>} />
                {customer?.rate_per_distance ? (
                  <p className="pt-1 text-xs text-brand-600">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {t("quote.customerRate", { name: customer.name })}
                  </p>
                ) : null}
              </dl>
            )}

            <Field label={t("form.price", { currency: org.currency })}>
              <div className="flex gap-2">
                <Input name="price_net" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                <Button type="button" variant="lime" disabled={!quote} onClick={() => quote && setPrice(quote.total.toFixed(2))}>
                  <Check className="h-4 w-4" /> {t("quote.use")}
                </Button>
              </div>
            </Field>
            <Field label={t("form.cost", { currency: org.currency })} hint={t("form.costHint")}>
              <Input name="cost_estimate" type="number" step="0.01" min="0" defaultValue={job?.cost_estimate ?? ""} />
            </Field>

            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : state.error}
              </p>
            )}

            <div className="grid gap-2">
              {(!job || isQuote) && (
                <SubmitButton name="intent" value="book" size="lg" className="w-full">
                  <Truck className="h-4 w-4" /> {job ? t("form.convertBook") : t("form.saveBooking")}
                </SubmitButton>
              )}
              {isQuote || !job ? (
                <SubmitButton name="intent" value="quote" variant="secondary" size="lg" className="w-full">
                  <Package className="h-4 w-4" /> {job ? t("form.saveQuote") : t("form.saveAsQuote")}
                </SubmitButton>
              ) : (
                <SubmitButton name="intent" value="save" size="lg" className="w-full">
                  <Check className="h-4 w-4" /> {tc("save")}
                </SubmitButton>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <QuickCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        defaultCountry={org.country}
        onCreated={(c) => {
          setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
          setCustomerId(c.id);
          setShowAddCustomer(false);
        }}
      />
    </form>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}

function AddressBlock({
  prefix,
  side,
  setSide,
  defaultFrom,
  defaultTo,
}: {
  prefix: "pickup" | "delivery";
  side: Side;
  setSide: React.Dispatch<React.SetStateAction<Side>>;
  defaultFrom?: string | null;
  defaultTo?: string | null;
}) {
  const t = useTranslations("jobs");
  const set = (k: keyof Side) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSide((s) => ({ ...s, [k]: e.target.value }));
  const onHit = (h: GeoHit) =>
    setSide((s) => ({
      ...s,
      name: s.name || h.name || "",
      address: h.address ?? s.address,
      city: h.city ?? s.city,
      postcode: h.postcode ?? s.postcode,
      country: h.country ?? s.country,
      lat: h.lat,
      lng: h.lng,
    }));
  const isPickup = prefix === "pickup";
  return (
    <div className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${isPickup ? "bg-sky-500" : "bg-emerald-500"}`}
          >
            {isPickup ? "A" : "B"}
          </span>
          <span className="font-display font-semibold text-slate-900">{t(isPickup ? "pickup" : "delivery")}</span>
        </div>
        {side.lat != null ? (
          <Badge tone="green">
            <MapPin className="h-3 w-3" /> {t("form.located")}
          </Badge>
        ) : (
          <Badge tone="slate">{t("form.notLocated")}</Badge>
        )}
      </div>
      <AddressSearch onSelect={onHit} placeholder={t("form.searchAddress")} />
      <input type="hidden" name={`${prefix}_lat`} value={side.lat ?? ""} />
      <input type="hidden" name={`${prefix}_lng`} value={side.lng ?? ""} />
      <div className="mt-3 grid gap-3 sm:grid-cols-6">
        <Input name={`${prefix}_name`} value={side.name} onChange={set("name")} placeholder={t("form.siteName")} className="sm:col-span-3" />
        <Input name={`${prefix}_address`} value={side.address} onChange={set("address")} placeholder={t("form.street")} className="sm:col-span-3" />
        <Input name={`${prefix}_city`} value={side.city} onChange={set("city")} placeholder={t("form.city")} className="sm:col-span-2" />
        <Input name={`${prefix}_postcode`} value={side.postcode} onChange={set("postcode")} placeholder={t("form.postcode")} className="sm:col-span-2" />
        <Select name={`${prefix}_country`} value={side.country} onChange={set("country")} className="sm:col-span-2">
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
        <div className="relative sm:col-span-3">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name={`${prefix}_contact`} value={side.contact} onChange={set("contact")} placeholder={t("form.contact")} className="pl-9" />
        </div>
        <Input name={`${prefix}_phone`} value={side.phone} onChange={set("phone")} placeholder={t("form.phone")} className="sm:col-span-3" type="tel" />
        <div className="sm:col-span-3">
          <div className="mb-1 text-xs font-medium text-slate-500">{t("form.windowFrom")}</div>
          <DateTimeField name={`${prefix}_from`} defaultValue={defaultFrom} />
        </div>
        <div className="sm:col-span-3">
          <div className="mb-1 text-xs font-medium text-slate-500">{t("form.windowTo")}</div>
          <DateTimeField name={`${prefix}_to`} defaultValue={defaultTo} />
        </div>
      </div>
    </div>
  );
}

function QuickCustomerModal({
  open,
  onClose,
  onCreated,
  defaultCountry,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: JobFormCustomer) => void;
  defaultCountry: string;
}) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [vat, setVat] = React.useState("");
  const [ctry, setCtry] = React.useState(defaultCountry);
  const submit = () =>
    start(async () => {
      const res = await quickAddCustomer({ name, email, vat_number: vat, country: ctry });
      if (res.error || !res.customer) return void toast.error(res.error ?? tc("errorGeneric"));
      toast.success(t("form.customerAdded"));
      onCreated(res.customer);
      setName("");
      setEmail("");
      setVat("");
    });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("form.newCustomer")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {tc("create")}
          </Button>
        </>
      }
    >
      <div
        className="grid gap-4"
        onKeyDown={(e) => {
          // this modal lives inside the job <form>; don't let Enter submit the job
          if (e.key === "Enter") {
            e.preventDefault();
            if (name.trim()) submit();
          }
        }}
      >
        <Field label={tc("name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={tc("email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tc("country")}>
            <Select value={ctry} onChange={(e) => setCtry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("form.vatNumber")}>
            <Input value={vat} onChange={(e) => setVat(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
