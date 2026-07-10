import React from 'react'
import LegalLayout, { Section } from '../components/LegalLayout'

export default function Terms() {
  return (
    <LegalLayout title="Terms & Agreement" lastUpdated="July 2026">
      <p>
        These Terms &amp; Agreement ("Terms") govern your use of the TriTech Hub iOS
        platform and any device purchased through our hire-purchase (installment) plan.
        By registering an account, purchasing a device, or making a payment, you agree to
        these Terms.
      </p>

      <Section heading="1. Hire-Purchase Agreement">
        <p>
          Devices are sold on a hire-purchase (installment) basis. <strong>Ownership of the
          device remains with TriTech Hub iOS until the full purchase price has been paid.</strong>
          You are granted possession and use of the device while payments are up to date.
        </p>
      </Section>

      <Section heading="2. Payment Obligations">
        <p>
          You agree to pay the agreed down payment and installment amounts on or before each
          due date, according to the schedule shown in your account. Payments are made through
          approved channels (Mobile Money and card, via our payment partner). You are responsible
          for keeping your account up to date.
        </p>
      </Section>

      <Section heading="3. Device Management &amp; Remote Locking">
        <p>
          Devices sold under this plan are enrolled in our device management system. You agree
          that TriTech Hub iOS may <strong>remotely lock or restrict the device if a payment is
          overdue</strong>, and unlock it once the outstanding amount is paid. You agree not to
          remove, disable, or tamper with the device management profile while any balance is owed.
        </p>
      </Section>

      <Section heading="4. Default, Late Payment &amp; Repossession">
        <p>
          If you fail to make payments as agreed, your device may be locked, and TriTech Hub iOS
          reserves the right to recover the device and/or pursue the outstanding balance, including
          from your guarantor. Any fees for late payment will be as communicated to you.
        </p>
      </Section>

      <Section heading="5. Guarantor Responsibility">
        <p>
          Where a guarantor is provided, the guarantor accepts responsibility for the outstanding
          balance if you default on your payments. You confirm that your guarantor has consented
          to act in this capacity.
        </p>
      </Section>

      <Section heading="6. Your Responsibilities">
        <p>
          You agree to: provide accurate personal and identification information; keep the device
          in good condition; not sell, pledge, or transfer the device before full payment; and
          notify us promptly of any loss, theft, or damage.
        </p>
      </Section>

      <Section heading="7. Suspension &amp; Termination">
        <p>
          We may suspend or terminate access to your account for breach of these Terms, fraud, or
          non-payment. Termination does not remove your obligation to pay any outstanding balance.
        </p>
      </Section>

      <Section heading="8. Governing Law">
        <p>
          These Terms are governed by the laws of the Republic of Ghana. Any disputes shall be
          subject to the jurisdiction of the Ghanaian courts.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          For questions about these Terms, contact TriTech Hub iOS at{' '}
          <span className="font-semibold text-gray-900">support@tritechhub.online</span>{' '}
          or through the contact details provided at registration.
        </p>
      </Section>
    </LegalLayout>
  )
}
