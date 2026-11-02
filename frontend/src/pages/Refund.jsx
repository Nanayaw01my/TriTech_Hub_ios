import React from 'react'
import LegalLayout, { Section } from '../components/LegalLayout'
import useBusinessInfo from '../hooks/useBusinessInfo'

export default function Refund() {
  const b = useBusinessInfo()
  return (
    <LegalLayout title="Refund Policy" lastUpdated="November 2026">
      <p>This policy explains when money paid to {b.business_name || 'Dan & Dor Solar Company Ltd.'} can be refunded.</p>

      <Section heading="1. Payments made by mistake">
        <p>
          If you were charged twice, paid the wrong amount by mistake, or paid on the wrong account, contact us within
          <strong> 14 days</strong> with the payment reference. Once confirmed, we refund the extra amount to the same
          Mobile Money number or card, usually within <strong>7 working days</strong>.
        </p>
      </Section>

      <Section heading="2. Paying more than you owe">
        <p>
          If your payments go above the full price of the phone, the extra amount is refunded to you once the plan is
          completed.
        </p>
      </Section>

      <Section heading="3. Application not approved">
        <p>
          The deposit is only collected after your application is approved. If a deposit is taken and the sale is then
          cancelled by us before the phone is handed to you, the deposit is refunded in full.
        </p>
      </Section>

      <Section heading="4. Installments and late fees">
        <p>
          Installments and late fees that have been correctly charged and applied to your plan are not refundable,
          except as required by law.
        </p>
      </Section>

      <Section heading="5. Faulty phones">
        <p>
          If the phone develops a fault covered by the manufacturer's warranty, bring it to our office. We will arrange
          repair or replacement through the manufacturer's warranty. Damage from misuse, water or tampering is not
          covered.
        </p>
      </Section>

      <Section heading="6. How to ask for a refund">
        <p>
          Contact us{b.contact_phone ? <> on <strong>{b.contact_phone}</strong></> : null} or at{' '}
          <span className="font-semibold text-gray-900">{b.contact_email || 'support@dandorsolar.site'}</span> with your
          name, account number, the payment reference and the reason.
        </p>
      </Section>
    </LegalLayout>
  )
}
