import React from 'react'
import { Link } from 'react-router-dom'
import LegalLayout, { Section } from '../components/LegalLayout'
import useBusinessInfo from '../hooks/useBusinessInfo'

export default function DataDeletion() {
  const b = useBusinessInfo()
  return (
    <LegalLayout title="Delete my data" lastUpdated="November 2026">
      <p>You can ask us to delete the personal information we hold about you.</p>

      <Section heading="How to ask">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Customers:</strong> log in, open <strong>Profile</strong> and tap <strong>Request data deletion</strong>.
          </li>
          <li>
            Or contact us{b.contact_phone ? <> on <strong>{b.contact_phone}</strong></> : null} or at{' '}
            <span className="font-semibold text-gray-900">{b.contact_email || 'support@dandorsolar.site'}</span> with your
            name, phone number and account number. We may ask you to confirm your identity.
          </li>
        </ul>
      </Section>

      <Section heading="What happens next">
        <ul className="list-disc pl-5 space-y-1">
          <li>We reply within <strong>30 days</strong>.</li>
          <li>
            If your phone is <strong>fully paid</strong> (or the plan is closed), we delete your account, photos, ID images
            and location history.
          </li>
          <li>
            If a <strong>balance is still owed</strong>, we must keep the information needed to run and collect the plan
            until it is paid or closed; we then delete it.
          </li>
          <li>
            Payment and accounting records are kept only as long as the law requires, then deleted.
          </li>
        </ul>
      </Section>

      <p>
        More detail is in our <Link to="/privacy" className="text-orange-700 font-semibold underline">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  )
}
