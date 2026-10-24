import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Privacy policy", description: "Privacy policy for ExplainCanvas, the visual AI learning tool for CBSE Classes 6 to 10.", path: "/legal/privacy" });

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-muted">Last updated 23 October 2026. This is a plain-language draft for launch and should be reviewed by a lawyer before the product takes payments at scale.</p>

      <h2>Who we are</h2>
      <p>ExplainCanvas is a learning product for school students in India, operated by its founder (the &quot;operator&quot;). A parent or guardian creates the account; a child uses it under that account.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account: the parent&apos;s email and name from Google sign-in.</li>
        <li>Student profiles: a first name and class level, entered by the parent. No date of birth, address or school is required.</li>
        <li>Questions and photos the student submits, and the explanations we generate for them.</li>
        <li>Check-question answers and streaks, used for the daily parent report.</li>
        <li>Payment records from Dodo Payments, our merchant of record. We never see card numbers.</li>
        <li>Technical logs needed to run and secure the service.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To generate explanations. Questions and photos are sent to our AI providers (Anthropic, and where enabled fal.ai and Google) solely to produce the explanation. They are not used by us to train models.</li>
        <li>To send the parent a daily report by email and the sign-in link.</li>
        <li>To build a shared library: an explanation may be reused for other students only after review and only if it contains no personal content. Uploaded photos are never shared.</li>
        <li>To bill and to prevent abuse.</li>
      </ul>

      <h2>Children&apos;s data</h2>
      <p>Accounts are created by a parent or guardian, who consents on the child&apos;s behalf in line with India&apos;s Digital Personal Data Protection Act, 2023. We collect the minimum needed to teach, do not show advertising, do not track children across other sites, and do not sell data.</p>

      <h2>Where data lives</h2>
      <p>Our database and file storage run on DigitalOcean in Bangalore, India. Email is sent through Resend. AI providers process requests in their own regions.</p>

      <h2>Your rights</h2>
      <p>You can see, correct or delete your account and your child&apos;s data by writing to hello@explaincanvas.com. Deleting the account removes chats, photos and reports within 30 days, except billing records we must keep by law.</p>

      <h2>Retention</h2>
      <p>Uploaded photos are kept for 90 days, then deleted. Chats are kept while the account exists. Sessions expire after 30 days of inactivity.</p>

      <h2>Changes</h2>
      <p>We will post changes here and, for material changes, email account holders.</p>
    </>
  );
}
