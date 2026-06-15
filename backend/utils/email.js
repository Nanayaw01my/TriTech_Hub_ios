const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

const getClient = () => new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });

const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'noreply@tritechhub.online';
const FROM_NAME  = process.env.EMAIL_FROM_NAME    || 'Tritech Hub iOS';

const send = async ({ to, toName, subject, html, text }) => {
  const ms         = getClient();
  const sentFrom   = new Sender(FROM_EMAIL, FROM_NAME);
  const recipients = [new Recipient(to, toName || to)];

  const params = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(html)
    .setText(text || '');

  await ms.email.send(params);
};

const sendPasswordResetEmail = async (email, name, resetUrl) => {
  await send({
    to: email,
    toName: name,
    subject: 'Your Tritech Hub iOS password reset link',
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
        .container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
        .header{background:#1a73e8;color:#fff;padding:30px;text-align:center}
        .header h1{margin:0;font-size:24px}
        .body{padding:30px;color:#333}
        .body p{line-height:1.6;margin-bottom:16px}
        .button{display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:14px 28px;border-radius:5px;font-weight:bold;font-size:16px;margin:20px 0}
        .footer{background:#f8f8f8;padding:20px 30px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee}
        .warning{background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin-top:20px;font-size:14px;color:#856404}
      </style>
      </head><body>
      <div class="container">
        <div class="header"><h1>Tritech Hub iOS</h1></div>
        <div class="body">
          <h2>Hello, ${name}!</h2>
          <p>We received a request to reset the password for your account.</p>
          <p>Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
          <div style="text-align:center"><a href="${resetUrl}" class="button">Reset My Password</a></div>
          <p>If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="word-break:break-all;background:#f4f4f4;padding:10px;border-radius:4px;font-size:13px">${resetUrl}</p>
          <div class="warning"><strong>Security Notice:</strong> If you did not request a password reset, please ignore this email.</div>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p><p>Contact support if you need help.</p></div>
      </div>
      </body></html>`,
    text: `Hello, ${name}!\n\nReset your password (valid 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n© ${new Date().getFullYear()} Tritech Hub iOS`,
  });
};

const sendPaymentConfirmationEmail = async (email, name, amount, planDetails) => {
  const {
    deviceModel = 'iPhone',
    remainingBalance = 0,
    paymentsLeft = 0,
    nextDueDate = null,
    reference = 'N/A',
  } = planDetails || {};

  const fmt     = (n) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(n);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  const fmtAmount   = fmt(amount);
  const fmtBalance  = fmt(remainingBalance);
  const fmtNextDue  = fmtDate(nextDueDate);
  const isPaidOff   = remainingBalance <= 0;

  await send({
    to: email,
    toName: name,
    subject: `Receipt: ${fmtAmount} received for your ${deviceModel}`,
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <style>
        body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
        .container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
        .header{background:#28a745;color:#fff;padding:30px;text-align:center}
        .header h1{margin:0;font-size:24px}
        .header .amount{font-size:36px;font-weight:bold;margin:10px 0 0}
        .body{padding:30px;color:#333}
        .body p{line-height:1.6;margin-bottom:16px}
        .dt{width:100%;border-collapse:collapse;margin:20px 0}
        .dt td{padding:12px;border-bottom:1px solid #eee}
        .dt td:first-child{font-weight:bold;color:#555;width:40%}
        .badge{display:inline-block;background:#28a745;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold}
        .footer{background:#f8f8f8;padding:20px 30px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee}
        .done{background:#d4edda;border:1px solid #c3e6cb;border-radius:4px;padding:16px;margin-top:20px;text-align:center;color:#155724;font-size:16px;font-weight:bold}
      </style>
      </head><body>
      <div class="container">
        <div class="header"><h1>Payment Confirmed</h1><div class="amount">${fmtAmount}</div></div>
        <div class="body">
          <h2>Hello, ${name}!</h2>
          <p>Your payment has been successfully received.</p>
          <table class="dt">
            <tr><td>Reference</td><td>${reference}</td></tr>
            <tr><td>Device</td><td>${deviceModel}</td></tr>
            <tr><td>Amount Paid</td><td>${fmtAmount}</td></tr>
            <tr><td>Remaining Balance</td><td>${fmtBalance}</td></tr>
            ${!isPaidOff ? `<tr><td>Payments Left</td><td>${paymentsLeft}</td></tr><tr><td>Next Due Date</td><td>${fmtNextDue}</td></tr>` : ''}
            <tr><td>Status</td><td><span class="badge">PAID</span></td></tr>
          </table>
          ${isPaidOff
            ? `<div class="done">Congratulations! You have fully paid for your ${deviceModel}. Your device is now fully unlocked!</div>`
            : `<p>Your next payment of <strong>${fmtAmount}</strong> is due on <strong>${fmtNextDue}</strong>.</p>`
          }
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p><p>Keep this email as your payment receipt.</p></div>
      </div>
      </body></html>`,
    text: `Hello, ${name}!\n\nPayment of ${fmtAmount} received.\n\nReference: ${reference}\nDevice: ${deviceModel}\nAmount Paid: ${fmtAmount}\nRemaining Balance: ${fmtBalance}\n${!isPaidOff ? `Payments Left: ${paymentsLeft}\nNext Due: ${fmtNextDue}` : 'Your device is fully paid off!'}\n\n© ${new Date().getFullYear()} Tritech Hub iOS`,
  });
};

const sendLockNotificationEmail = async (email, name, deviceModel) => {
  await send({
    to: email,
    toName: name,
    subject: `Your ${deviceModel} has been locked — Tritech Hub iOS`,
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <style>
        body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
        .container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
        .header{background:#dc3545;color:#fff;padding:30px;text-align:center}
        .header h1{margin:0;font-size:24px}
        .body{padding:30px;color:#333}
        .body p{line-height:1.6;margin-bottom:16px}
        .action{background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:16px;margin:20px 0}
        .contact{background:#e8f4f8;border:1px solid #bee5eb;border-radius:4px;padding:16px;margin:20px 0}
        .footer{background:#f8f8f8;padding:20px 30px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee}
      </style>
      </head><body>
      <div class="container">
        <div class="header"><div style="font-size:48px;margin-bottom:8px">🔒</div><h1>Device Locked</h1></div>
        <div class="body">
          <h2>Hello, ${name}!</h2>
          <p>Your <strong>${deviceModel}</strong> has been locked due to an overdue installment payment.</p>
          <p>Your payment was due more than <strong>48 hours ago</strong>. As per your installment agreement, we have remotely locked your device.</p>
          <div class="action">
            <strong>How to Unlock:</strong>
            <p style="margin:8px 0 0">Make your overdue installment payment through the Tritech Hub iOS app. Once confirmed, your device will be unlocked within minutes.</p>
          </div>
          <div class="contact">
            <strong>Need Help?</strong>
            <p style="margin:8px 0 0">Contact our support team if you believe this is an error or need assistance.</p>
          </div>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p><p>Contact our support team if you need help.</p></div>
      </div>
      </body></html>`,
    text: `Hello, ${name}!\n\nYour ${deviceModel} has been locked due to an overdue installment payment.\n\nTo unlock, make your payment through the Tritech Hub iOS app. Contact support if you need help.\n\n© ${new Date().getFullYear()} Tritech Hub iOS`,
  });
};

const sendPaymentReminderEmail = async (email, name, details) => {
  const {
    deviceModel = 'iPhone',
    installmentAmount = 0,
    remainingBalance = 0,
    nextDueDate = null,
    isOverdue = false,
  } = details || {};

  const fmt     = (n) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(n);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  const fmtAmount  = fmt(installmentAmount);
  const fmtBalance = fmt(remainingBalance);
  const fmtDue     = fmtDate(nextDueDate);
  const headerColor = isOverdue ? '#dc2626' : '#166534';

  await send({
    to: email,
    toName: name,
    subject: isOverdue
      ? `Action Needed: Your ${deviceModel} installment is past due`
      : `Your ${deviceModel} installment payment is coming up`,
    html: `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      </head><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:${headerColor};padding:28px 30px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">Tritech Hub iOS</h1>
            <p style="color:#fff;opacity:.85;margin:6px 0 0;font-size:15px">
              ${isOverdue ? 'Overdue Payment Reminder' : 'Payment Reminder'}
            </p>
          </div>
          <div style="padding:28px 30px">
            <h2 style="margin:0 0 12px;color:#111">Hello, ${name}!</h2>
            <p style="color:#374151;line-height:1.6;margin:0 0 20px">
              ${isOverdue
                ? `Your installment payment for your <strong>${deviceModel}</strong> is <strong>overdue</strong>. Please make your payment as soon as possible to avoid your device being locked.`
                : `This is a friendly reminder that your next installment payment for your <strong>${deviceModel}</strong> is due soon.`
              }
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7;width:45%">Device</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:600">${deviceModel}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #f3f4f6">Amount Due</td>
                <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-weight:700;color:${headerColor}">${fmtAmount}</td>
              </tr>
              <tr style="background:#f9fafb">
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #f3f4f6">Due Date</td>
                <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:${isOverdue ? '#dc2626' : '#374151'};font-weight:600">${fmtDue}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700">Remaining Balance</td>
                <td style="padding:10px 14px;font-weight:600">${fmtBalance}</td>
              </tr>
            </table>
            <div style="background:${isOverdue ? '#fef2f2' : '#f0fdf4'};border:1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'};border-radius:8px;padding:14px;font-size:14px;color:${isOverdue ? '#991b1b' : '#166534'}">
              <strong>${isOverdue ? 'Action Required:' : 'How to Pay:'}</strong>
              ${isOverdue
                ? ' Log in to the Tritech Hub iOS app and make your payment immediately to prevent your device from being locked.'
                : ' Log in to the Tritech Hub iOS app and tap "Make Payment" to complete your installment.'
              }
            </div>
          </div>
          <div style="background:#f9fafb;padding:14px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} Tritech Hub iOS · Powered by Ittek Solutions
          </div>
        </div>
      </body></html>`,
    text: `Hello, ${name}!\n\nPayment reminder for your ${deviceModel}.\n\nAmount Due: ${fmtAmount}\nDue Date: ${fmtDue}\nRemaining Balance: ${fmtBalance}\n\nLog in to the app to make your payment.\n\n© ${new Date().getFullYear()} Tritech Hub iOS`,
  });
};

async function sendAdminSaleNotificationEmail(adminEmail, sale) {
  const businessName = process.env.BUSINESS_NAME || 'Tritech Hub iOS';
  const freqLabel    = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[sale.frequency] || sale.frequency;
  const now = new Date().toLocaleString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  await send({
    to: adminEmail,
    toName: businessName,
    subject: `New sale — ${sale.deviceModel} sold by ${sale.staffName}${sale.branch ? ' @ ' + sale.branch : ''}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:linear-gradient(135deg,#166534,#15803d);padding:28px 30px">
            <h1 style="color:#fff;margin:0;font-size:20px">${businessName}</h1>
            <p style="color:#bbf7d0;margin:6px 0 0;font-size:15px">New iPhone Sale Recorded</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 20px">A new sale was registered on <strong>${now}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
              <tr style="background:#f0fdf4"><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7;width:40%">Staff</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:600">${sale.staffName}</td></tr>
              ${sale.branch ? `<tr><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Branch</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.branch}</td></tr>` : ''}
              <tr><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Customer</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.customerName}</td></tr>
              <tr style="background:#f0fdf4"><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Phone</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.customerPhone || '—'}</td></tr>
              <tr><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Device</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:700">${sale.deviceModel}</td></tr>
              <tr style="background:#f0fdf4"><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Device Price</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7">GHS ${Number(sale.totalPrice).toLocaleString()}</td></tr>
              <tr><td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Down Payment</td><td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:700;color:#166534">GHS ${Number(sale.downPayment).toLocaleString()}</td></tr>
              <tr style="background:#f0fdf4"><td style="padding:10px 14px;color:#166534;font-weight:700">Installment Plan</td><td style="padding:10px 14px">GHS ${Number(sale.installmentAmount).toLocaleString()} × ${sale.totalPayments} payments (${freqLabel})</td></tr>
            </table>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;font-size:13px;color:#166534">
              Log in to <strong>${businessName}</strong> to view the full customer record.
            </div>
          </div>
          <div style="background:#f9fafb;padding:14px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName} · Sale alert
          </div>
        </div>
      </body></html>`,
  });
}

async function sendAdminPaymentReminderEmail(adminEmail, customers) {
  const businessName = process.env.BUSINESS_NAME || 'Tritech Hub iOS';

  const rows = customers.map(c => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${c.customerName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${c.phone || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${c.deviceModel}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#166534">GHS ${Number(c.amount).toLocaleString()}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#d97706;font-weight:600">${c.dueDate}</td>
    </tr>
  `).join('');

  await send({
    to: adminEmail,
    toName: businessName,
    subject: `${customers.length} customer payment(s) due in 2 days — ${businessName}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:#166534;padding:28px 30px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">${businessName}</h1>
            <p style="color:#bbf7d0;margin:6px 0 0;font-size:15px">Payment Due Reminder</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 16px">The following customer(s) have a payment due in <strong>2 days</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <thead>
                <tr style="background:#f0fdf4">
                  <th style="padding:10px 12px;text-align:left;color:#166534;border-bottom:2px solid #dcfce7">Customer</th>
                  <th style="padding:10px 12px;text-align:left;color:#166534;border-bottom:2px solid #dcfce7">Phone</th>
                  <th style="padding:10px 12px;text-align:left;color:#166534;border-bottom:2px solid #dcfce7">Device</th>
                  <th style="padding:10px 12px;text-align:left;color:#166534;border-bottom:2px solid #dcfce7">Amount</th>
                  <th style="padding:10px 12px;text-align:left;color:#166534;border-bottom:2px solid #dcfce7">Due Date</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="background:#f9fafb;padding:16px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName}
          </div>
        </div>
      </body></html>`,
  });
}

async function sendAdminOverdueAlertEmail(adminEmail, customers) {
  const businessName = process.env.BUSINESS_NAME || 'Tritech Hub iOS';

  const rows = customers.map(c => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600">${c.customerName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${c.phone || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${c.deviceModel}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;color:#991b1b">GHS ${Number(c.amount).toLocaleString()}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#dc2626;font-weight:600">${c.hoursOverdue}h overdue</td>
    </tr>
  `).join('');

  await send({
    to: adminEmail,
    toName: businessName,
    subject: `${customers.length} overdue payment(s) need attention — ${businessName}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:#dc2626;padding:28px 30px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">${businessName}</h1>
            <p style="color:#fecaca;margin:6px 0 0;font-size:15px">Overdue Payment Alert</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 8px">The following customer(s) have <strong>not paid</strong> and are overdue by 48+ hours.</p>
            <p style="color:#374151;font-size:15px;margin:0 0 20px">Please lock their iPhone on iCloud now — go to <a href="https://icloud.com/find" style="color:#dc2626">icloud.com/find</a>, find the device and enable Lost Mode.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <thead>
                <tr style="background:#fef2f2">
                  <th style="padding:10px 12px;text-align:left;color:#991b1b;border-bottom:2px solid #fecaca">Customer</th>
                  <th style="padding:10px 12px;text-align:left;color:#991b1b;border-bottom:2px solid #fecaca">Phone</th>
                  <th style="padding:10px 12px;text-align:left;color:#991b1b;border-bottom:2px solid #fecaca">Device</th>
                  <th style="padding:10px 12px;text-align:left;color:#991b1b;border-bottom:2px solid #fecaca">Amount</th>
                  <th style="padding:10px 12px;text-align:left;color:#991b1b;border-bottom:2px solid #fecaca">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="background:#f9fafb;padding:16px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName}
          </div>
        </div>
      </body></html>`,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendLockNotificationEmail,
  sendPaymentReminderEmail,
  sendAdminPaymentReminderEmail,
  sendAdminOverdueAlertEmail,
  sendAdminSaleNotificationEmail,
};
