export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-slate-500">Last updated: 27 November 2026</p>

      <h2>1. Who we are</h2>
      <p>
        MatrixFleet (the “Service”) is provided by <strong>Matrix Infotech Ltd</strong>, a company registered in England and Wales
        (company number [●], registered office [●]) (“we”, “us”). These Terms form a contract between us and the business that
        creates a MatrixFleet account (“Customer”, “you”). The Service is intended for business use only; you confirm you are not
        acting as a consumer.
      </p>

      <h2>2. The Service</h2>
      <p>
        MatrixFleet is a cloud transport management system for haulage and delivery companies, including job and quote management,
        dispatch, GPS tracking via drivers’ mobile devices, proof of delivery, invoicing, document generation (including CMR
        consignment notes) and fleet compliance tools. We may improve or change features from time to time; we will not
        materially reduce the core functionality of a paid plan during a billing period.
      </p>

      <h2>3. Accounts and users</h2>
      <ul>
        <li>You are responsible for everyone you invite (“Authorised Users”), including drivers, and for keeping credentials secure.</li>
        <li>You must give accurate company information, including VAT status, and keep it up to date.</li>
        <li>Plan limits (vehicles and users) apply as shown on our pricing page.</li>
      </ul>

      <h2>4. Free trial</h2>
      <p>
        New accounts receive a 14-day free trial. At the end of the trial you must choose a paid plan to continue using the
        Service. If you do not, your account becomes read-only; your data is kept for at least 90 days before deletion, unless
        you delete it sooner.
      </p>

      <h2>5. Fees, VAT and payment</h2>
      <ul>
        <li>Subscriptions are billed monthly in advance through our payment provider, Stripe. Prices exclude VAT.</li>
        <li>UK customers are charged UK VAT. EU business customers who provide a valid VAT number are invoiced under the reverse-charge mechanism; you are responsible for accounting for VAT in your country.</li>
        <li>If payment fails we may suspend access after reasonable notice. Fees are non-refundable except where required by law.</li>
        <li>We may change prices with at least 30 days’ notice, effective from your next billing period.</li>
      </ul>

      <h2>6. Your data</h2>
      <p>
        You own all data you or your Authorised Users enter into the Service (“Customer Data”). You grant us a licence to host and
        process Customer Data only to provide and support the Service. Where Customer Data includes personal data, our{" "}
        <a href="/legal/dpa">Data Processing Agreement</a> applies and forms part of these Terms. You can export your data at any time.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>use the Service unlawfully, including to track individuals without a lawful basis or without informing them;</li>
        <li>attempt to access other customers’ data, probe or disrupt the Service, or reverse engineer it;</li>
        <li>upload malware or content that infringes third-party rights.</li>
      </ul>

      <h2>8. Your responsibilities as an operator</h2>
      <p>
        The Service supports, but does not replace, your legal obligations as a transport operator — including operator licensing,
        drivers’ hours and tachograph rules, vehicle roadworthiness, dangerous goods (ADR) requirements, customs and tax. VAT
        treatment suggested by the Service is based on the information you provide and should be checked by your adviser for
        unusual transactions. Route distances and quotes are estimates.
      </p>

      <h2>9. Availability and support</h2>
      <p>
        We aim for 99.5% monthly availability, excluding planned maintenance and events outside our reasonable control. Support is
        provided by email during UK business hours; Pro plans receive priority support.
      </p>

      <h2>10. Liability</h2>
      <ul>
        <li>Nothing limits liability for death or personal injury caused by negligence, fraud, or anything that cannot be limited by law.</li>
        <li>We are not liable for loss of profits, revenue, goodwill or indirect or consequential loss.</li>
        <li>Our total liability in any 12-month period is limited to the fees you paid us in that period.</li>
      </ul>

      <h2>11. Term and termination</h2>
      <p>
        You may cancel at any time from Settings → Billing; cancellation takes effect at the end of the current billing period.
        We may terminate for material breach not remedied within 14 days of notice. On termination you may export your data for
        30 days, after which it is deleted from live systems and from backups within a further 14 days.
      </p>

      <h2>12. General</h2>
      <p>
        These Terms are governed by the laws of England and Wales and the courts of England and Wales have exclusive
        jurisdiction. If any provision is unenforceable the rest remains in effect. Contact: legal@[●].
      </p>
    </>
  );
}
