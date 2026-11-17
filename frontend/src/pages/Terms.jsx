import React from 'react'
import { Link } from 'react-router-dom'
import LegalLayout, { Section } from '../components/LegalLayout'
import useBusinessInfo from '../hooks/useBusinessInfo'

export default function Terms() {
  const b = useBusinessInfo()
  const fee = Number(b.late_fee_per_day ?? 10)
  return (
    <LegalLayout title="Terms & Agreement" lastUpdated="November 2026">
      <p>
        These Terms &amp; Agreement ("Terms") govern your use of the Dan &amp; Dor Solar Company Ltd.
        ("we", "us") platform and any phone bought from us on hire purchase (paying in installments).
        By registering, receiving a phone or making a payment, you agree to these Terms.
      </p>

      <Section heading="1. Who can buy">
        <p>You must be <strong>18 years or older</strong> and hold a valid Ghana Card. We do not sell on hire purchase to children.</p>
      </Section>

      <Section heading="2. Hire-purchase plan">
        <p>
          The phone remains the property of Dan &amp; Dor Solar Company Ltd. <strong>until the full price is paid</strong>.
          You may use it while your payments are up to date.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Deposit:</strong> paid after we approve your application. The phone is activated once it is paid.</li>
          <li><strong>Plan length:</strong> 4 months. You choose to pay <strong>daily (120 payments)</strong> or <strong>weekly (17 payments)</strong>.</li>
          <li>The price, deposit, amount per payment and every due date are shown to you before you agree and in your account.</li>
          <li>You may pay ahead or pay the full balance early at any time, with no extra charge.</li>
        </ul>
      </Section>

      <Section heading="3. Payments">
        <p>
          Pay on or before each due date through our approved channels (Mobile Money or card via our payment
          partner Paystack, or at our office). Payments are applied first to any late fees, then to your
          installments in date order. We text you a reminder the day before a payment is due.
        </p>
      </Section>

      <Section heading="4. Late payment, late fees and locking">
        <ul className="list-disc pl-5 space-y-1">
          <li>If a payment is not made by its due date, <strong>the phone is locked</strong> on that day. Emergency calls remain possible.</li>
          {fee > 0 ? (
            <li>
              The due day itself is free. From the next day, a <strong>late fee of GHS {fee.toLocaleString()} is added for each
              extra day</strong> the payment remains unpaid.
            </li>
          ) : (
            <li>No late fees are currently charged.</li>
          )}
          <li>The phone is unlocked as soon as the overdue amount and any late fees are paid.</li>
          <li>There are <strong>no other fees</strong> beyond the price, deposit and late fees described here.</li>
        </ul>
      </Section>

      <Section heading="5. Device management, location and reset protection">
        <p>
          Phones sold on this plan run our device-management app. You agree that, while any balance is owed, we may:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>lock and unlock the phone as described above;</li>
          <li>record the phone's <strong>location</strong> to protect and recover it;</li>
          <li>prevent factory reset, and protect the phone with our company Google account so it cannot be set up again after a forced reset.</li>
        </ul>
        <p>
          You agree not to remove, disable or tamper with the app, or to reset or flash the phone, while a balance is owed.
          When you finish paying, <strong>we release the phone completely</strong>: the app removes itself, location
          collection stops and the phone is fully yours.
        </p>
      </Section>

      <Section heading="6. Default and recovery">
        <p>
          If payments stop, we may keep the phone locked, contact you and your guarantor, recover the phone
          and/or pursue the outstanding balance as permitted by Ghanaian law.
        </p>
      </Section>

      <Section heading="7. Guarantor">
        <p>
          Your guarantor agrees to be responsible for the outstanding balance if you default. You confirm your
          guarantor has agreed to this.
        </p>
      </Section>

      <Section heading="8. Your responsibilities">
        <p>
          Give accurate information; keep the phone in good condition; do not sell, pawn or give away the phone
          before it is fully paid; tell us promptly about loss, theft or damage.
        </p>
      </Section>

      <Section heading="9. Refunds">
        <p>See our <Link to="/refunds" className="text-orange-700 font-semibold underline">Refund Policy</Link>.</p>
      </Section>

      <Section heading="10. Your data">
        <p>
          How we use your information is explained in our{' '}
          <Link to="/privacy" className="text-orange-700 font-semibold underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section heading="11. Suspension and termination">
        <p>
          We may suspend or close your account for breach of these Terms, fraud or non-payment. This does not
          cancel any amount you still owe.
        </p>
      </Section>

      <Section heading="12. Governing law">
        <p>These Terms are governed by the laws of the Republic of Ghana, and disputes are subject to the Ghanaian courts.</p>
      </Section>

      <Section heading="13. Contact">
        <p>
          {b.business_name || 'Dan & Dor Solar Company Ltd.'}
          {b.contact_address ? `, ${b.contact_address}` : ''}.{' '}
          {b.contact_phone ? <>Phone {b.contact_phone}. </> : null}
          Email <span className="font-semibold text-gray-900">{b.contact_email || 'support@dandorsolar.site'}</span>.
        </p>
      </Section>
    </LegalLayout>
  )
}
