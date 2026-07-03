import React from 'react'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
      <h2 className="text-sm font-black text-gray-900 mb-3 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Step({ num, title, desc }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-full bg-emerald-700 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
        {num}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function Rule({ color, text }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red:   'bg-red-50 text-red-800 border-red-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return (
    <div className={`text-xs font-semibold px-3 py-2 rounded-xl border ${colors[color]} leading-relaxed mb-2 last:mb-0`}>
      {text}
    </div>
  )
}

export default function StaffAbout() {
  return (
    <div className="max-w-2xl mx-auto pb-24 lg:pb-8">

      {/* Mobile hero */}
      <div className="lg:hidden mb-0" style={{
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1a3a1a 100%)',
        padding: '2rem 1.25rem 3rem',
      }}>
        <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">Staff Portal</p>
        <h1 className="text-white text-2xl font-black">About</h1>
        <p className="text-green-200/70 text-sm mt-1">Your role, workflows, and guidelines</p>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block pt-6 pb-4">
        <h1 className="text-2xl font-black text-gray-900">About</h1>
        <p className="text-gray-500 text-sm mt-1">Staff Portal · Your role, workflows, and guidelines</p>
      </div>

      <div className="px-4 lg:px-0 -mt-5 lg:mt-0">

        {/* Your Role */}
        <Section title="Your Role">
          <p className="text-sm text-gray-600 leading-relaxed">
            As a staff member, you register customers, set up their installment plans, and collect payments on their behalf.
            You can only see and manage customers you personally registered.
          </p>
        </Section>

        {/* Registering a Customer */}
        <Section title="How to Register a Customer">
          <Step num="1" title="Go to Add Customer"
            desc="Tap 'Add Customer' in the navigation. Fill in the customer's full name, phone number, email, and Ghana Card / ID number." />
          <Step num="2" title="Take Photos"
            desc="Take a clear photo of the customer and their ID document. These are saved for verification purposes." />
          <Step num="3" title="Select a Device"
            desc="Choose the phone the customer is buying from the available catalog. Only phones not assigned to anyone will appear." />
          <Step num="4" title="Set the Payment Plan"
            desc="Enter the total price, down payment amount, number of installments, and how often they pay (weekly / biweekly / monthly). The system calculates the installment amount automatically." />
          <Step num="5" title="Submit"
            desc="The customer account is created with a unique account number. They receive their login details. The device is now assigned to them." />
        </Section>

        {/* Collecting a Payment */}
        <Section title="How to Collect a Payment">
          <Step num="1" title="Open the Customer"
            desc="Go to My Customers and tap the customer's name to open their detail page." />
          <Step num="2" title="Collect Down Payment First"
            desc="If a down payment is set and no payment has been made yet, the amber 'Collect Down Payment' button will appear. Collect this first." />
          <Step num="3" title="Tap Collect Installment"
            desc="After the down payment is done, use the green 'Collect Installment' button for regular payments." />
          <Step num="4" title="Customer Pays via MoMo or Card"
            desc="A Paystack popup opens. The customer enters their MoMo number or card details. For MoMo, they approve the prompt on their phone." />
          <Step num="5" title="Payment Recorded"
            desc="Once confirmed, the payment is saved, the remaining balance updates, and a receipt is shown. The customer's next due date also updates." />
        </Section>

        {/* Important Rules */}
        <Section title="Important Rules">
          <Rule color="amber" text="Always collect the down payment before regular installments — the system enforces this." />
          <Rule color="green" text="You can adjust the payment amount — it does not have to be exactly the installment amount. Partial payments are allowed." />
          <Rule color="amber" text="MoMo payments need the customer to approve on their phone. Wait for their confirmation before leaving." />
          <Rule color="green" text="If a customer wants to pay the full remaining balance at once, use the 'Full Balance' quick button in the payment screen." />
          <Rule color="red" text="Never share your staff login with anyone. Each account is tied to your sales record and commission." />
        </Section>

        {/* What You Cannot Do */}
        <Section title="What You Cannot Do">
          <Rule color="red" text="You cannot see other staff members' customers." />
          <Rule color="red" text="You cannot delete customers, devices, or payment records." />
          <Rule color="red" text="You cannot access admin reports, audit logs, or settings." />
          <Rule color="red" text="You cannot change a customer's installment plan after it has been created." />
          <Rule color="red" text="You cannot lock or unlock a customer's device — contact admin for that." />
        </Section>

        {/* Tips */}
        <Section title="Tips">
          <Rule color="green" text="If a payment shows 'pending', ask the customer to check their MoMo for a prompt to approve." />
          <Rule color="green" text="Payment history on each customer page shows every payment with date, amount, and reference number." />
          <Rule color="green" text="If you can't find a phone in the device catalog, ask admin to add it first." />
          <Rule color="amber" text="If a customer's account is locked, contact admin. Only admin can lock or unlock devices." />
        </Section>

        <div className="text-center py-4">
          <p className="text-xs text-gray-400 font-medium">TriTech Hub iOS · Powered by Ittek Solutions</p>
        </div>
      </div>
    </div>
  )
}
