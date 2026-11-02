import React from 'react'
import LegalLayout, { Section } from '../components/LegalLayout'

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="November 2026">
      <p>
        This website and app use only <strong>essential</strong> browser storage — what is needed for them to work. We
        do not use advertising, tracking or analytics cookies.
      </p>

      <Section heading="What we store on your device">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Login session</strong> — keeps you signed in until you log out.</li>
          <li><strong>Your settings</strong> — for example that you have seen the cookie notice, and the company logo for faster loading.</li>
          <li><strong>Offline copy</strong> — lets the app show a page when you have no internet.</li>
        </ul>
      </Section>

      <Section heading="Payments">
        <p>
          When you pay, you are taken to Paystack's secure page. Paystack may use its own cookies there to process the
          payment safely; see Paystack's own privacy and cookie policies.
        </p>
      </Section>

      <Section heading="Your choices">
        <p>
          Because this storage is essential, the site cannot work properly without it. You can clear it at any time in
          your browser settings; you will then need to log in again.
        </p>
      </Section>
    </LegalLayout>
  )
}
