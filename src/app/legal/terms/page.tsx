import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Terms of service", description: "Terms of service for ExplainCanvas, the visual AI learning tool for any subject and level.", path: "/legal/terms" });

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-muted">Last updated 23 October 2026. Plain-language draft for launch; have it reviewed by a lawyer.</p>

      <h2>The service</h2>
      <p>ExplainCanvas generates visual explanations for school topics in response to a question or a photograph. Explanations are produced by AI and reviewed by an automated accuracy pass. They are a study aid, not a replacement for a teacher or a textbook, and may occasionally contain mistakes. Report anything wrong from inside the lesson and we will fix or withdraw it.</p>

      <h2>Accounts</h2>
      <p>An account must be created by an adult parent or guardian, who is responsible for the child&apos;s use. Keep your Google sign-in secure. One account per family; the number of student profiles depends on the plan.</p>

      <h2>Credits and plans</h2>
      <ul>
        <li>Every output costs credits, shown before it is made. Plans include a monthly credit allowance; unused plan credits roll over one month. Top-up credits do not expire while a subscription is active.</li>
        <li>Prices exclude GST, which is added at checkout. Subscriptions renew monthly or yearly until cancelled.</li>
        <li>If a generation fails, its credits are released automatically. If an explanation is wrong, write to us and we will refund its credits.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Use the service for learning. Do not use it to cheat in a live examination, to generate harmful content, or to probe or overload the system. We may limit or close accounts that do.</p>

      <h2>Content</h2>
      <p>You own your questions and photos. You grant us a licence to process them to provide the service. Explanations we generate may be reused in our shared library after review, with personal content removed; photos are never reused.</p>

      <h2>Liability</h2>
      <p>The service is provided as is. To the extent permitted by law, our liability is limited to the amount you paid in the three months before a claim.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Disputes are subject to the courts of the operator&apos;s registered city.</p>

      <h2>Contact</h2>
      <p>hello@explaincanvas.com</p>
    </>
  );
}
