import React from 'react'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
      <h2 className="text-sm font-black text-gray-900 mb-3 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Row({ icon, label, desc }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
    </div>
  )
}

function Rule({ color, text }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red:   'bg-red-50 text-red-800 border-red-200',
    blue:  'bg-blue-50 text-blue-800 border-blue-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return (
    <div className={`text-xs font-semibold px-3 py-2 rounded-xl border ${colors[color]} leading-relaxed mb-2 last:mb-0`}>
      {text}
    </div>
  )
}

export default function AdminAbout() {
  return (
    <div className="max-w-2xl mx-auto pb-24 lg:pb-8">

      {/* Mobile hero */}
      <div className="lg:hidden -mx-0 mb-0" style={{
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1a3a1a 100%)',
        padding: '2rem 1.25rem 3rem',
      }}>
        <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">Admin Portal</p>
        <h1 className="text-white text-2xl font-black">About the System</h1>
        <p className="text-green-200/70 text-sm mt-1">TriTech Hub iOS · Full Reference Guide</p>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block pt-6 pb-4 px-0">
        <h1 className="text-2xl font-black text-gray-900">About the System</h1>
        <p className="text-gray-500 text-sm mt-1">TriTech Hub iOS · Admin Reference Guide</p>
      </div>

      <div className="px-4 lg:px-0 -mt-5 lg:mt-0">

        {/* Overview */}
        <Section title="System Overview">
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            TriTech Hub iOS is an iPhone installment management platform. Staff register customers with a device and payment plan.
            Customers pay in installments via Mobile Money or card. You manage everything from this admin portal.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { label: 'Admin', desc: 'Full control' },
              { label: 'Staff', desc: 'Register & pay' },
              { label: 'Customer', desc: 'View & track' },
            ].map(r => (
              <div key={r.label} className="bg-emerald-50 rounded-xl p-2.5 text-center">
                <p className="text-xs font-black text-emerald-900">{r.label}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5">{r.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Admin Tools */}
        <Section title="Your Admin Tools">
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />} label="Dashboard" desc="Revenue summary, recent activity, key stats at a glance" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />} label="Customers" desc="Full list of all customers across all staff. View details, reset passwords, lock/unlock devices, send reminders, export to CSV" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} label="Overdue Accounts" desc="Customers who've missed payments. Lock their device directly from this page" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />} label="Staff" desc="Add/edit/remove staff accounts. View each staff member's sales, set commission rates" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />} label="Devices" desc="Catalog tab: add/edit phones for sale. Sales tab: all sold devices with customer info, amount paid, remaining balance" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />} label="Transactions" desc="Every payment ever recorded. Filter by date, export to CSV" />
          <Row icon={<><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>} label="Reports" desc="Revenue charts, collection rates, revenue forecast" />
          <Row icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />} label="Audit Logs" desc="Full history of who did what and when — registrations, payments, logins, reminders" />
          <Row icon={<><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>} label="Settings" desc="Business info, contact details, change password. Set these first so customers see correct contact info" />
        </Section>

        {/* Device Rules */}
        <Section title="Device Rules">
          <Rule color="green" text="Catalog devices (Catalog tab) = available for sale. assigned_to is empty." />
          <Rule color="blue" text="When a customer is registered, the device is cloned and assigned to them. The original stays in the catalog." />
          <Rule color="amber" text="Locking a device shows a 'Locked' warning on the customer's dashboard. It is a visual indicator — the physical device must be managed manually." />
          <Rule color="red" text="Deleted catalog devices do not affect existing customer plans." />
        </Section>

        {/* Payment Rules */}
        <Section title="Payment Rules">
          <Rule color="green" text="All payments go through Paystack — Ghana Mobile Money (MoMo) and Mastercard/Visa." />
          <Rule color="blue" text="If a down payment is set, staff must collect it first before regular installments are unlocked." />
          <Rule color="green" text="When remaining_balance reaches 0, the plan status automatically changes to Completed." />
          <Rule color="amber" text="Missed payments change a customer's status to Defaulted. They appear on the Overdue Accounts page." />
          <Rule color="blue" text="Reminders send both SMS (Arkesel) and Email (MailerSend) simultaneously." />
        </Section>

        {/* Staff & Customer Rules */}
        <Section title="Staff & Customer Rules">
          <Rule color="blue" text="Staff only see their own customers — not other staff's customers." />
          <Rule color="red" text="Staff cannot delete customers, change device prices, or access reports." />
          <Rule color="green" text="Customer passwords are max 5 characters to keep logins simple." />
          <Rule color="amber" text="You can reset any customer's password from their Customer Detail page." />
          <Rule color="blue" text="Staff commission rates are set per staff member in the Staff tab." />
        </Section>

        {/* Security */}
        <Section title="Security">
          <Rule color="green" text="Login sessions use JWT tokens that expire automatically." />
          <Rule color="red" text="The 'Clear All Data' button in Settings permanently deletes all customers, plans, and transactions. Use only to reset for testing." />
          <Rule color="blue" text="All actions are logged in Audit Logs — you can see who made every change." />
          <Rule color="amber" text="Change the default admin password immediately after first login via Settings." />
        </Section>

        {/* Version */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 font-medium">TriTech Hub iOS · Powered by Ittek Solutions</p>
        </div>
      </div>
    </div>
  )
}
