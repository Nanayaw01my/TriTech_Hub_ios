import React from 'react'
import LegalLayout, { Section } from '../components/LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 2026">
      <p>
        This Privacy Policy explains how TriTech Hub iOS collects, uses, stores, and protects
        your personal information when you use our platform and hire-purchase services. We are
        committed to handling your data responsibly and in line with the Ghana Data Protection
        Act, 2012 (Act 843).
      </p>

      <Section heading="1. Information We Collect">
        <p>To provide our services, we collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Identity details — full name, email, phone number, and Ghana Card ID (including card photos)</li>
          <li>Guarantor details — name, phone, Ghana Card ID, and relationship</li>
          <li>Location and income information provided at registration</li>
          <li>Device information — model, serial number, and identifiers for the phone you purchase</li>
          <li>Payment information processed through our payment partner</li>
          <li>A photo and signature captured during registration</li>
        </ul>
      </Section>

      <Section heading="2. How We Use Your Information">
        <p>We use your information to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Verify your identity and assess your installment application</li>
          <li>Manage your account, installment plan, and payment schedule</li>
          <li>Process payments and send receipts and reminders</li>
          <li>Manage and, where necessary, remotely lock/unlock your device</li>
          <li>Communicate with you by SMS, WhatsApp, or email</li>
        </ul>
      </Section>

      <Section heading="3. How We Protect Your Data">
        <p>
          Sensitive fields such as phone numbers and Ghana Card IDs are <strong>encrypted</strong>
          in our systems. Access is restricted by role — for example, Ghana Card ID images are
          visible only to administrators, not to field staff. We apply reasonable technical and
          organizational measures to protect your data against unauthorized access.
        </p>
      </Section>

      <Section heading="4. Sharing With Third Parties">
        <p>
          We do not sell your personal data. We share limited data only with trusted service
          providers who help us operate, such as our payment processor (to take payments), our
          SMS/messaging provider (to send notifications), our secure image storage provider, and
          our device-management provider (to manage the device). These providers are only given
          the data needed to perform their service.
        </p>
      </Section>

      <Section heading="5. Data Retention">
        <p>
          We keep your information for as long as your account and installment plan are active, and
          thereafter only as long as needed to meet legal, accounting, or dispute-resolution
          requirements.
        </p>
      </Section>

      <Section heading="6. Your Rights">
        <p>
          You have the right to access the personal data we hold about you, request corrections to
          inaccurate data, and request deletion where we are not legally required to retain it. To
          exercise these rights, contact us using the details below.
        </p>
      </Section>

      <Section heading="7. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated
          through the platform. Continued use after changes means you accept the updated policy.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          For privacy questions or data requests, contact TriTech Hub iOS at{' '}
          <span className="font-semibold text-gray-900">support@tritechhub.online</span>.
        </p>
      </Section>
    </LegalLayout>
  )
}
