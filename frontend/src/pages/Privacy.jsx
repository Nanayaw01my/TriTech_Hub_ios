import React from 'react'
import { Link } from 'react-router-dom'
import LegalLayout, { Section } from '../components/LegalLayout'
import useBusinessInfo from '../hooks/useBusinessInfo'

export default function Privacy() {
  const b = useBusinessInfo()
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="November 2026">
      <p>
        This policy explains what personal information {b.business_name || 'Dan & Dor Solar Company Ltd.'} collects,
        why, who we share it with and your rights. We handle personal data in line with Ghana's
        <strong> Data Protection Act, 2012 (Act 843)</strong>.
      </p>

      <Section heading="1. What we collect — and only what we need">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Identity:</strong> full name, phone number, optional email, Ghana Card number and photos of the card, your photo and signature — to verify who you are.</li>
          <li><strong>Guarantor:</strong> name, phone, Ghana Card number, relationship and photo — required for hire purchase.</li>
          <li><strong>Address and income:</strong> region, town, landmark, GPS address, occupation and proof of income — to assess your application.</li>
          <li><strong>Phone details:</strong> model, IMEI/serial number, app version and the phone's check-ins — to manage and protect the phone.</li>
          <li><strong>Location of the phone</strong> while a balance is owed — to protect and recover it. It stops when the phone is paid off and released.</li>
          <li><strong>Payments:</strong> amounts, dates and references. Card and Mobile Money details are handled by Paystack; we never see your card number or PIN.</li>
        </ul>
        <p>Staff (DSRs) also provide their name, phone, Ghana Card and photos for identification and commission payouts.</p>
      </Section>

      <Section heading="2. How we use it">
        <ul className="list-disc pl-5 space-y-1">
          <li>Verify identity and approve hire-purchase applications.</li>
          <li>Run your plan: schedules, payments, receipts, reminders and late fees.</li>
          <li>Lock, unlock, locate and finally release your phone as described in our Terms.</li>
          <li>Send service messages by SMS and email (payment reminders, confirmations, account codes).</li>
          <li>Prevent fraud and meet legal and accounting duties.</li>
        </ul>
        <p>We do <strong>not</strong> sell your data, show you ads or send marketing messages.</p>
      </Section>

      <Section heading="3. Who we share it with">
        <p>Only these service providers, and only what each needs to do its job:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Paystack</strong> — payments (Mobile Money and card) and staff commission payouts.</li>
          <li><strong>Arkesel</strong> and <strong>NkomoSMS</strong> — sending SMS messages.</li>
          <li><strong>Google Firebase</strong> — instantly delivering lock/unlock commands to the phone.</li>
          <li><strong>Cloudinary</strong> — secure storage of ID and registration photos.</li>
          <li><strong>MongoDB Atlas</strong> and <strong>Render</strong> — secure hosting of our database and website.</li>
          <li>Our email provider — sending receipts and account emails.</li>
        </ul>
        <p>We may also disclose information where required by law or a court order.</p>
      </Section>

      <Section heading="4. How we protect it">
        <p>
          All connections use HTTPS. Passwords are stored hashed. Sensitive fields such as phone numbers and Ghana Card
          numbers are <strong>encrypted</strong> in our database. Access is limited by role — for example, field staff
          cannot see Ghana Card images.
        </p>
      </Section>

      <Section heading="5. How long we keep it">
        <p>
          While your plan is active, and afterwards only as long as needed for accounting, tax, legal or dispute
          purposes. Location history is kept only while the phone is under a plan. Setup logs from phones are deleted
          after 7 days.
        </p>
      </Section>

      <Section heading="6. Your rights">
        <p>
          You can ask to see the data we hold about you, correct it, or delete it where we are not required by law to
          keep it. See <Link to="/data-deletion" className="text-orange-700 font-semibold underline">Delete my data</Link>.
          You can also complain to Ghana's Data Protection Commission.
        </p>
      </Section>

      <Section heading="7. Children">
        <p>Our services are only for people aged 18 and over. We do not knowingly collect data from children.</p>
      </Section>

      <Section heading="8. Cookies">
        <p>We only use essential browser storage to keep you logged in. See our <Link to="/cookies" className="text-orange-700 font-semibold underline">Cookie Policy</Link>.</p>
      </Section>

      <Section heading="9. Changes">
        <p>We may update this policy. We will show the new date at the top and tell you about important changes.</p>
      </Section>

      <Section heading="10. Contact">
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
