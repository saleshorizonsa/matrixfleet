export const metadata = { title: "Cookie Policy" };

export default function CookiePolicyPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-sm text-slate-500">Last updated: 27 November 2026</p>
      <p>
        MatrixFleet only uses cookies that are <strong>strictly necessary</strong> to provide the service you ask for. Under the UK
        Privacy and Electronic Communications Regulations (PECR) and the EU ePrivacy Directive, strictly necessary cookies do not
        require consent, so we do not show a cookie consent banner. We do not use advertising, analytics or tracking cookies.
      </p>

      <h2>Cookies we set</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>sb-*-auth-token</code></td><td>Keeps you signed in securely (authentication session)</td><td>Session / up to 7 days, refreshed while you use the app</td></tr>
          <tr><td><code>hl_locale</code></td><td>Remembers the language you selected</td><td>1 year</td></tr>
        </tbody>
      </table>

      <h2>Third parties</h2>
      <p>
        When you subscribe, you are redirected to Stripe’s hosted checkout and customer portal, which set their own strictly
        necessary cookies for fraud prevention. See Stripe’s privacy and cookie policy for details. Map tiles are loaded without
        cookies.
      </p>

      <h2>Local storage</h2>
      <p>
        The driver app may store data in your browser (for example, queued deliveries when you have no signal) so it can work
        offline. This is also strictly necessary for the service.
      </p>

      <h2>Changes</h2>
      <p>If we ever introduce non-essential cookies, we will ask for your consent first and update this policy.</p>
    </>
  );
}
