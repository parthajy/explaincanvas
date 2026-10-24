import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Refunds and cancellation", description: "Refunds and cancellation for ExplainCanvas, the visual AI learning tool for any subject and level.", path: "/legal/refunds" });

export default function RefundsPage() {
  return (
    <>
      <h1>Refunds and cancellation</h1>
      <p className="text-muted">Last updated 23 October 2026.</p>

      <h2>Cancelling a subscription</h2>
      <p>Cancel any time from your account page or by emailing hello@explaincanvas.com. You keep access and your remaining credits until the end of the paid period. No further charges are made.</p>

      <h2>Refunds</h2>
      <ul>
        <li>A failed generation never charges credits; they are released automatically.</li>
        <li>If an explanation is factually wrong, tell us and we refund its credits.</li>
        <li>A monthly plan can be refunded in full within 7 days of first purchase if fewer than 50 credits have been used.</li>
        <li>The annual plan can be refunded within 14 days of purchase, less the value of credits used at the monthly plan rate.</li>
        <li>Top-up packs are refundable within 7 days if unused.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method through Dodo Payments, our payment partner and merchant of record, normally within 5 to 7 working days.</p>

      <h2>Contact</h2>
      <p>hello@explaincanvas.com. Include the account email and the date of the payment.</p>
    </>
  );
}
