import React, { useState, useEffect } from 'react'
import api from '../../api/axios'

function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <div className="w-7 h-7 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {icon}
            </svg>
          </div>
        )}
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-800 pr-3">{q}</span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="text-sm text-gray-500 pb-3 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function CustomerAbout() {
  const [bizInfo, setBizInfo] = useState({ business_name: 'TriTech Hub', contact_phone: '', whatsapp_number: '', contact_email: '', contact_address: '' })

  useEffect(() => {
    api.get('/customer/business-info').then(res => {
      if (res.data?.success) setBizInfo(res.data.data)
    }).catch(() => {})
  }, [])

  return (
    <div className="max-w-lg mx-auto pb-24 lg:pb-8">

      {/* Mobile hero */}
      <div className="lg:hidden mb-0" style={{
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1a3a1a 100%)',
        padding: '2rem 1.25rem 3rem',
      }}>
        <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">{bizInfo.business_name}</p>
        <h1 className="text-white text-2xl font-black">Help & Info</h1>
        <p className="text-green-200/70 text-sm mt-1">How your payment plan works</p>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block pt-6 pb-4">
        <h1 className="text-2xl font-black text-gray-900">Help & Info</h1>
        <p className="text-gray-500 text-sm mt-1">How your payment plan works</p>
      </div>

      <div className="px-4 lg:px-0 -mt-5 lg:mt-0">

        {/* How Your Plan Works */}
        <Section title="How Your Plan Works"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}>
          <div className="space-y-2.5">
            {[
              { label: 'Total Price', desc: 'The full price of your device.' },
              { label: 'Down Payment', desc: 'A first payment made when you received your phone.' },
              { label: 'Installment Amount', desc: 'The fixed amount you pay each time.' },
              { label: 'Remaining Balance', desc: 'How much is left to pay. Goes down with each payment.' },
              { label: 'Next Due Date', desc: 'The date your next payment is expected.' },
            ].map(i => (
              <div key={i.label} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                <div>
                  <span className="text-sm font-bold text-gray-800">{i.label}: </span>
                  <span className="text-sm text-gray-500">{i.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* How Payments Work */}
        <Section title="How Payments Work"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />}>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Payments are collected by our staff on your behalf through <span className="font-bold text-gray-800">Mobile Money (MoMo)</span> or <span className="font-bold text-gray-800">card</span>.
            You do not make payments yourself through this app.
          </p>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs font-bold text-green-900 mb-1">When a payment is made:</p>
            <p className="text-xs text-green-800 leading-relaxed">
              You will receive a MoMo prompt on your phone. Approve it to complete the payment.
              Once confirmed, your balance updates immediately and you can see it on your dashboard.
            </p>
          </div>
        </Section>

        {/* What You Can See */}
        <Section title="What You Can See"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}>
          <div className="space-y-2">
            {[
              'Your device and its current status (locked / unlocked)',
              'Your remaining balance and how much you\'ve paid',
              'Your payment progress (how many installments done)',
              'Your next due date',
              'Full history of every payment with date and reference',
              'Your profile and account number',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* FAQs */}
        <Section title="Common Questions"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}>
          <FAQ q="I don't see a recent payment in my history — what do I do?"
            a="If you paid via MoMo, it can take a few minutes to confirm. If it doesn't appear after 10 minutes, contact our staff with your payment reference number." />
          <FAQ q="My device shows 'Locked' — what does that mean?"
            a="A locked status means your account has been flagged, usually due to a missed payment. Contact us immediately to resolve it." />
          <FAQ q="Can I pay more than the installment amount?"
            a="Yes. You can pay any amount up to your full remaining balance at any time. Tell our staff the amount you want to pay." />
          <FAQ q="What happens when I finish paying?"
            a="When your remaining balance reaches zero, your plan is marked as Completed. The device is fully yours." />
          <FAQ q="I forgot my password — how do I log in?"
            a="Contact our staff or call the number below. We can reset your password for you." />
          <FAQ q="Is my payment information safe?"
            a="Yes. All payments go through Paystack, a certified payment processor used by thousands of businesses in Ghana. We never store your card or MoMo details." />
        </Section>

        {/* Contact */}
        <Section title="Contact Us"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />}>
          <div className="space-y-2">
            {bizInfo.contact_phone && (
              <a href={`tel:${bizInfo.contact_phone}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Call Us</p>
                  <p className="text-sm font-bold text-gray-800">{bizInfo.contact_phone}</p>
                </div>
              </a>
            )}
            {bizInfo.whatsapp_number && (
              <a href={`https://wa.me/${bizInfo.whatsapp_number.replace(/[^0-9]/g, '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">WhatsApp</p>
                  <p className="text-sm font-bold text-gray-800">{bizInfo.whatsapp_number}</p>
                </div>
              </a>
            )}
            {bizInfo.contact_email && (
              <a href={`mailto:${bizInfo.contact_email}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Email</p>
                  <p className="text-sm font-bold text-gray-800">{bizInfo.contact_email}</p>
                </div>
              </a>
            )}
            {bizInfo.contact_address && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Address</p>
                  <p className="text-sm font-bold text-gray-800">{bizInfo.contact_address}</p>
                </div>
              </div>
            )}
            {!bizInfo.contact_phone && !bizInfo.whatsapp_number && !bizInfo.contact_email && (
              <p className="text-sm text-gray-400 text-center py-3">Contact details not set yet</p>
            )}
          </div>
        </Section>

        <div className="text-center py-4">
          <p className="text-xs text-gray-400 font-medium">TriTech Hub iOS · Powered by Ittek Solutions</p>
        </div>
      </div>
    </div>
  )
}
