import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight, Calculator, CheckCircle2, ClipboardCheck, FileText, Globe2, KanbanSquare, Link2,
  MapPinned, PenLine, Receipt, ShieldCheck, Smartphone, Star,
} from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { HeroPreview } from "@/components/landing/hero-preview";
import { RoiCalculator } from "@/components/landing/roi-calculator";
import { PricingSection } from "@/components/landing/pricing";
import { LandingFooter } from "@/components/landing/footer";
import { buttonClass } from "@/components/ui";

const FEATURES = [
  { key: "jobs", icon: Calculator },
  { key: "dispatch", icon: KanbanSquare },
  { key: "tracking", icon: MapPinned },
  { key: "driver", icon: Smartphone },
  { key: "invoicing", icon: Receipt },
  { key: "cmr", icon: FileText },
  { key: "compliance", icon: ClipboardCheck },
  { key: "links", icon: Link2 },
  { key: "gdpr", icon: ShieldCheck },
  { key: "languages", icon: Globe2 },
] as const;

const STATS = ["s1", "s2", "s3", "s4"] as const;
const FAQ = ["q1", "q2", "q9", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <div className="bg-white">
      <LandingNav />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden bg-ink-900 pb-20 pt-32 sm:pt-36 lg:pb-28">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/30 blur-[140px]" />
        <div className="absolute -right-40 top-1/2 h-[380px] w-[380px] rounded-full bg-lime-signal/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <a
              href="#features"
              className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-sm text-white/80 ring-1 ring-white/15 transition hover:bg-white/10"
            >
              <span className="rounded-full bg-lime-signal px-2 py-0.5 text-[11px] font-bold uppercase text-ink-900">{t("hero.badgeNew")}</span>
              {t("hero.badge")}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <h1 className="animate-fade-up mt-7 font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              {t.rich("hero.title", {
                hl: (c) => <span className="bg-gradient-to-r from-brand-300 via-white to-lime-signal bg-clip-text text-transparent">{c}</span>,
              })}
            </h1>
            <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/65">{t("hero.subtitle")}</p>
            <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClass("lime", "lg", "w-full px-7 sm:w-auto")}>
                {t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={buttonClass("dark", "lg", "w-full bg-white/5 ring-1 ring-white/15 hover:bg-white/10 sm:w-auto")}>
                {t("hero.ctaSecondary")}
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/50">
              {(["c1", "c2", "c3"] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-lime-signal" /> {t(`hero.${k}`)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-6xl">
            <HeroPreview />
          </div>

          {/* stats */}
          <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s} className="text-center">
                <dt className="order-2 mt-1 text-sm text-white/50">{t(`stats.${s}.label`)}</dt>
                <dd className="font-display text-3xl font-bold text-white sm:text-4xl">{t(`stats.${s}.value`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ features */}
      <section id="features" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionTitle eyebrow={t("features.eyebrow")} title={t("features.title")} subtitle={t("features.subtitle")} />
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {FEATURES.map(({ key, icon: Icon }, i) => (
              <div
                key={key}
                className={`group relative overflow-hidden rounded-3xl p-6 ring-1 transition hover:-translate-y-1 hover:shadow-xl ${
                  i === 0 || i === 4 ? "bg-ink-900 ring-ink-800 hover:shadow-brand-500/20" : "bg-slate-50 ring-slate-200/70 hover:bg-white hover:shadow-slate-200"
                }`}
              >
                <div
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${
                    i === 0 || i === 4 ? "bg-lime-signal text-ink-900" : "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className={`mt-5 font-display text-lg font-semibold ${i === 0 || i === 4 ? "text-white" : "text-slate-900"}`}>
                  {t(`features.items.${key}.title`)}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${i === 0 || i === 4 ? "text-white/60" : "text-slate-500"}`}>
                  {t(`features.items.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ driver spotlight */}
      <section className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t("driverSpot.eyebrow")}</div>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-900 sm:text-5xl">{t("driverSpot.title")}</h2>
            <p className="mt-5 text-lg text-slate-600">{t("driverSpot.body")}</p>
            <ul className="mt-8 space-y-4">
              {(["b1", "b2", "b3", "b4"] as const).map((b) => (
                <li key={b} className="flex gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> {t(`driverSpot.${b}`)}
                </li>
              ))}
            </ul>
          </div>
          <PhoneMock
            labels={{
              title: t("driverSpot.phoneTitle"),
              stop: t("driverSpot.phoneStop"),
              sign: t("driverSpot.phoneSign"),
              photo: t("driverSpot.phonePhoto"),
              done: t("driverSpot.phoneDone"),
            }}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section id="how" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionTitle eyebrow={t("how.eyebrow")} title={t("how.title")} subtitle={t("how.subtitle")} />
          <ol className="relative mt-16 grid gap-8 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent md:block" />
            {(["s1", "s2", "s3"] as const).map((s, i) => (
              <li key={s} className="relative text-center">
                <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-900 font-display text-xl font-bold text-lime-signal shadow-xl">
                  {i + 1}
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-slate-900">{t(`how.${s}.title`)}</h3>
                <p className="mx-auto mt-2 max-w-xs text-slate-500">{t(`how.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ ROI */}
      <section className="bg-ink-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionTitle dark eyebrow={t("roi.eyebrow")} title={t("roi.title")} subtitle={t("roi.subtitle")} />
          <div className="mt-14">
            <RoiCalculator />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ testimonial */}
      <section className="py-20">
        <figure className="mx-auto max-w-3xl px-5 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Star className="h-5 w-5" />
          </div>
          <blockquote className="mt-6 font-display text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">“{t("quote.text")}”</blockquote>
          <figcaption className="mt-5 text-sm text-slate-500">{t("quote.by")}</figcaption>
        </figure>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionTitle eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} subtitle={t("pricing.subtitle")} />
          <div className="mt-12">
            <PricingSection />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="faq" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <SectionTitle eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
          <div className="mt-12 divide-y divide-slate-200 rounded-3xl ring-1 ring-slate-200">
            {FAQ.map((q) => (
              <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                  {t(`faq.${q}.q`)}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45 group-open:bg-brand-500 group-open:text-white">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{t(`faq.${q}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ final CTA */}
      <section className="px-5 pb-24 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink-900 px-8 py-16 text-center sm:px-16 sm:py-20">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute -top-24 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-brand-500/40 blur-[100px]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold text-white sm:text-5xl">{t("cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/65">{t("cta.subtitle")}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClass("lime", "lg", "px-8")}>
                {t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing" className={buttonClass("dark", "lg", "bg-white/5 ring-1 ring-white/15 hover:bg-white/10")}>
                {t("cta.secondary")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, dark = false }: { eyebrow: string; title: string; subtitle?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className={`text-sm font-semibold uppercase tracking-wider ${dark ? "text-lime-signal" : "text-brand-600"}`}>{eyebrow}</div>
      <h2 className={`mt-3 font-display text-3xl font-bold sm:text-5xl ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
      {subtitle && <p className={`mt-5 text-lg ${dark ? "text-white/60" : "text-slate-500"}`}>{subtitle}</p>}
    </div>
  );
}

function PhoneMock({ labels }: { labels: { title: string; stop: string; sign: string; photo: string; done: string } }) {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="absolute -inset-10 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative rounded-[2.75rem] bg-ink-950 p-3 shadow-2xl ring-1 ring-black/10">
        <div className="overflow-hidden rounded-[2.2rem] bg-surface">
          <div className="bg-ink-900 px-5 pb-5 pt-8 text-white">
            <div className="text-xs text-white/50">{labels.title}</div>
            <div className="mt-1 font-display text-xl font-bold">JOB-001284</div>
            <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
              <MapPinned className="h-4 w-4 text-lime-signal" /> Unit 4, Trafford Park, M17 1PG
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
              <div className="text-xs font-semibold uppercase text-slate-400">{labels.stop}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">6 pallets · 1,840 kg</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                <PenLine className="h-3.5 w-3.5" /> {labels.sign}
              </div>
              <svg viewBox="0 0 240 60" className="mt-2 h-14 w-full">
                <path
                  d="M10 40 C 30 10, 45 55, 60 30 S 85 15, 95 38 S 120 50, 130 25 S 160 20, 170 40 S 200 45, 230 22"
                  fill="none"
                  stroke="#4A44E6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="400"
                  strokeDashoffset="400"
                >
                  <animate attributeName="stroke-dashoffset" from="400" to="0" dur="2.6s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-gradient-to-br from-slate-200 to-slate-300" />
              ))}
            </div>
            <div className="rounded-2xl bg-lime-signal py-3.5 text-center text-sm font-bold text-ink-900">{labels.done}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
