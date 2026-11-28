export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: 27 November 2026</p>

      <p>
        This policy explains how <strong>Matrix Infotech Ltd</strong> (“we”) handles personal data in connection with MatrixFleet.
        It is written to meet the UK GDPR, the Data Protection Act 2018 and the EU General Data Protection Regulation (EU GDPR).
      </p>

      <h2>1. Two different roles</h2>
      <ul>
        <li>
          <strong>Controller</strong> — for data about our own customers’ account holders (name, work email, billing details), our
          website visitors and support contacts.
        </li>
        <li>
          <strong>Processor</strong> — for data our customers put into MatrixFleet about their staff, drivers, customers and consignees
          (for example delivery addresses, signatures, photos and driver GPS positions). The transport company is the controller of
          that data and our <a href="/legal/dpa">Data Processing Agreement</a> applies. If you are a driver or a consignee, please
          contact the transport company first.
        </li>
      </ul>

      <h2>2. Data we collect as controller</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Purpose</th><th>Lawful basis</th></tr>
        </thead>
        <tbody>
          <tr><td>Name, work email, password hash, company</td><td>Create and secure your account</td><td>Contract</td></tr>
          <tr><td>Billing address, VAT number, payment status (card data is held by Stripe only)</td><td>Billing and tax compliance</td><td>Contract; legal obligation</td></tr>
          <tr><td>Usage logs, IP address, device information</td><td>Security, fraud prevention, troubleshooting</td><td>Legitimate interests</td></tr>
          <tr><td>Support correspondence</td><td>Helping you</td><td>Contract; legitimate interests</td></tr>
          <tr><td>Product update emails</td><td>Service and feature announcements</td><td>Legitimate interests (you can opt out)</td></tr>
        </tbody>
      </table>

      <h2>3. Where your data is stored</h2>
      <p>
        MatrixFleet’s database and file storage run on a server located in <strong>London, United Kingdom</strong>. Backups are taken
        nightly and encrypted. The UK benefits from an EU adequacy decision, so personal data of EU customers can flow to the UK
        without additional safeguards. Where a sub-processor processes data outside the UK/EEA, we rely on adequacy regulations,
        the UK International Data Transfer Addendum and/or EU Standard Contractual Clauses.
      </p>

      <h2>4. Sub-processors</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>Location</th></tr>
        </thead>
        <tbody>
          <tr><td>VPS hosting provider (London data centre) running self-hosted Supabase (PostgreSQL, authentication, file storage)</td><td>Primary database, authentication and files</td><td>London, UK</td></tr>
          <tr><td>Vercel Inc.</td><td>Application hosting and content delivery</td><td>Global edge network; EU/UK regions where available</td></tr>
          <tr><td>Stripe Payments Europe Ltd / Stripe Inc.</td><td>Subscription billing and payments</td><td>EU/UK, USA</td></tr>
          <tr><td>OpenStreetMap Foundation and map/routing services</td><td>Map tiles, address search and route distances (addresses only, no names)</td><td>UK/EU</td></tr>
          <tr><td>Zoho Corporation (Zoho Mail)</td><td>Sending account emails (sign-up confirmation, sign-in links, password resets): recipient email address and the link</td><td>USA (Zoho US data centre) — UK IDTA / EU SCCs</td></tr>
          <tr><td>European Commission VIES and HMRC</td><td>Checking a customer&apos;s VAT number when you click Verify (VAT number only)</td><td>EU / UK</td></tr>
          <tr><td>Google Maps / Waze</td><td>Only when a driver taps Navigate: the destination address or coordinates, sent from the driver&apos;s phone to the app they choose</td><td>Google: USA/global</td></tr>
        </tbody>
      </table>

      <h2>5. Retention</h2>
      <ul>
        <li>Account data: for the life of your account, then deleted within 30 days of closure (backups within a further 14 days).</li>
        <li>Billing records: 6 years after the end of the financial year (UK tax law).</li>
        <li>Security logs: up to 12 months.</li>
        <li>Driver GPS history: 90 days, then deleted automatically.</li>
        <li>
          Free-trial fingerprint: to offer one free trial per email address, we keep a one-way SHA-256 hash of the email
          address used to start a trial, even after the account is deleted. The address cannot be read back from it
          (legitimate interest: preventing abuse of free trials).
        </li>
        <li>Sign-in attempt counters (hashed IP address and email, used for rate limiting): up to 24 hours.</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        We use TLS encryption in transit, encryption at rest, row-level security that isolates every company’s data, role-based
        access, audit logging, and restricted administrative access to production systems over SSH keys.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You have the right to access, rectify, erase, restrict or object to processing of your personal data, and to data
        portability. Company owners can export or delete all company data directly in Settings → Privacy &amp; data. To exercise
        your rights, email info@matrixinfo.co.uk. You may complain to the UK Information Commissioner’s Office (ico.org.uk) or your local EU
        supervisory authority.
      </p>

      <h2>8. EU representative</h2>
      <p>Where required under Article 27 EU GDPR, our EU representative will be named here once appointed. Until then, individuals in the EU can contact us directly at info@matrixinfo.co.uk.</p>

      <h2>9. Cookies</h2>
      <p>We only use strictly necessary cookies. See our <a href="/legal/cookies">Cookie Policy</a>.</p>

      <h2>10. Contact</h2>
      <p>Matrix Infotech Ltd (company number 15056659), 167–169 Great Portland Street, Fifth Floor, London W1W 5PF, England. Email: info@matrixinfo.co.uk.</p>
    </>
  );
}
