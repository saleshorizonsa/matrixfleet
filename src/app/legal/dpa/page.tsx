export const metadata = { title: "Data Processing Agreement" };

export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Agreement</h1>
      <p className="text-sm text-slate-500">Last updated: 27 November 2026</p>
      <p>
        This Data Processing Agreement (“DPA”) forms part of the MatrixFleet Terms of Service between the customer (“Controller”) and{" "}
        <strong>Matrix Infotech Ltd</strong> (“Processor”). It reflects the requirements of Article 28 of the UK GDPR and the EU
        GDPR. It is accepted when the Controller agrees to the Terms of Service.
      </p>

      <h2>1. Subject matter and duration</h2>
      <p>
        The Processor processes personal data on behalf of the Controller to provide the MatrixFleet transport management service, for
        the duration of the Terms and until deletion of the data in accordance with section 10.
      </p>

      <h2>2. Nature, purpose and categories</h2>
      <table>
        <tbody>
          <tr><th>Purpose</th><td>Managing transport jobs, dispatch, tracking, proof of delivery, invoicing, fleet compliance and related communications.</td></tr>
          <tr><th>Data subjects</th><td>Controller’s employees and contractors (incl. drivers), the Controller’s customers’ contacts, consignors and consignees.</td></tr>
          <tr><th>Personal data</th><td>Names, contact details, addresses, driving licence and CPC details, signatures, delivery photos, vehicle check records, working-time records, GPS location of drivers while on shift, user account and audit data.</td></tr>
          <tr><th>Special category data</th><td>Not intended. The Controller must not upload special category data unless strictly necessary.</td></tr>
        </tbody>
      </table>

      <h2>3. Processor obligations</h2>
      <p>The Processor shall:</p>
      <ol>
        <li>process personal data only on the Controller’s documented instructions (including these Terms and the Controller’s use of the Service), unless required by law;</li>
        <li>ensure that persons authorised to process the data are bound by confidentiality;</li>
        <li>implement appropriate technical and organisational measures under Article 32 (see Annex 1);</li>
        <li>respect the conditions for engaging sub-processors in section 4;</li>
        <li>assist the Controller, by appropriate measures, in responding to data subject requests (including through the in-app export and deletion tools);</li>
        <li>assist the Controller with security, breach notification, DPIAs and prior consultation, taking into account the nature of processing;</li>
        <li>at the Controller’s choice, delete or return all personal data at the end of the service (section 10);</li>
        <li>make available information necessary to demonstrate compliance and allow for audits, including inspections, by the Controller or its mandated auditor, on reasonable notice and no more than once a year unless required by a regulator;</li>
        <li>inform the Controller immediately if, in its opinion, an instruction infringes data protection law.</li>
      </ol>

      <h2>4. Sub-processors</h2>
      <p>
        The Controller gives general authorisation for the sub-processors below. The Processor will notify the Controller at least
        30 days before adding or replacing a sub-processor, and the Controller may object on reasonable grounds and terminate if no
        solution is found. The Processor imposes data protection obligations on each sub-processor equivalent to this DPA.
      </p>
      <table>
        <thead>
          <tr><th>Sub-processor</th><th>Service</th><th>Location</th></tr>
        </thead>
        <tbody>
          <tr><td>London VPS hosting provider</td><td>Infrastructure hosting self-hosted Supabase (database, authentication, storage, backups)</td><td>London, UK</td></tr>
          <tr><td>Vercel Inc.</td><td>Application hosting and CDN</td><td>Global; transfers covered by UK IDTA / EU SCCs</td></tr>
          <tr><td>Stripe</td><td>Billing of the Controller’s subscription (Controller account data only)</td><td>EU/UK, USA</td></tr>
          <tr><td>OpenStreetMap-based geocoding, routing and tile services</td><td>Address lookup and route distance (address strings only)</td><td>UK/EU</td></tr>
          <tr><td>Zoho Corporation (Zoho Mail)</td><td>Sending account emails (sign-up confirmation, sign-in links, password resets): recipient email address and the link</td><td>USA (Zoho US data centre) — UK IDTA / EU SCCs</td></tr>
          <tr><td>European Commission VIES and HMRC</td><td>Checking a customer&apos;s VAT number when you click Verify (VAT number only)</td><td>EU / UK</td></tr>
          <tr><td>Google Maps / Waze</td><td>Only when a driver taps Navigate: the destination address or coordinates, sent from the driver&apos;s phone to the app they choose</td><td>Google: USA/global</td></tr>
        </tbody>
      </table>

      <h2>5. International transfers</h2>
      <p>
        Primary storage is in the United Kingdom. Transfers outside the UK/EEA take place only under adequacy regulations or
        appropriate safeguards (UK International Data Transfer Addendum, EU Standard Contractual Clauses).
      </p>

      <h2>6. Personal data breaches</h2>
      <p>
        The Processor will notify the Controller without undue delay, and in any event within 48 hours, after becoming aware of a
        personal data breach affecting Controller data, providing the information required by Article 33(3) as it becomes available.
      </p>

      <h2>7. Controller obligations</h2>
      <p>
        The Controller is responsible for having a lawful basis for processing (including informing drivers about location
        tracking and, where required, consulting staff representatives), for the accuracy of the data, and for configuring user
        access appropriately.
      </p>

      <h2>8. Liability</h2>
      <p>Liability under this DPA is subject to the limitations in the Terms of Service, to the extent permitted by law.</p>

      <h2>9. Precedence</h2>
      <p>In case of conflict, this DPA prevails over the Terms of Service with respect to the processing of personal data.</p>

      <h2>10. Return and deletion</h2>
      <p>
        The Controller can export all data at any time. On termination, or when the Controller deletes its organisation in the
        Service, data is deleted from live systems immediately and from backups within 14 days, unless retention is required by law.
      </p>

      <h2>Annex 1 — Technical and organisational measures</h2>
      <ul>
        <li>Encryption in transit (TLS 1.2+) and at rest; encrypted off-site backups retained for 14 days.</li>
        <li>Logical tenant isolation enforced by PostgreSQL row-level security on every table.</li>
        <li>Role-based access control (owner, admin, dispatcher, accountant, driver) and least privilege.</li>
        <li>Database and administration interfaces not exposed to the internet; administrative access via SSH keys only.</li>
        <li>Audit logging of significant actions, available to the Controller.</li>
        <li>Secure software development, dependency updates and separation of test and production environments.</li>
        <li>Documented incident response and business continuity procedures, with tested restores.</li>
      </ul>
    </>
  );
}
