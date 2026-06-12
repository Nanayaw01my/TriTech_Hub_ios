const nodemailer = require('nodemailer');

/**
 * Create and return a configured nodemailer transporter using Gmail SMTP.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send a password reset email with a reset link.
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient's name
 * @param {string} resetUrl - Password reset URL
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `Tritech Hub iOS <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - Tritech Hub iOS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #1a73e8; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .body { padding: 30px; color: #333333; }
          .body p { line-height: 1.6; margin-bottom: 16px; }
          .button { display: inline-block; background-color: #1a73e8; color: white; text-decoration: none; padding: 14px 28px; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 20px 0; }
          .footer { background-color: #f8f8f8; padding: 20px 30px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
          .warning { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin-top: 20px; font-size: 14px; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tritech Hub iOS</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}!</h2>
            <p>We received a request to reset the password for your Tritech Hub iOS account associated with this email address.</p>
            <p>Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            <p>If the button above doesn't work, copy and paste the following URL into your browser:</p>
            <p style="word-break: break-all; background-color: #f4f4f4; padding: 10px; border-radius: 4px; font-size: 13px;">${resetUrl}</p>
            <div class="warning">
              <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email. Your password will not be changed unless you click the link above and create a new password.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello, ${name}!

We received a request to reset your Tritech Hub iOS account password.

Reset your password by visiting the link below (valid for 1 hour):
${resetUrl}

If you did not request a password reset, please ignore this email.

© ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Password reset email sent to ${email}: ${info.messageId}`);
  return info;
};

/**
 * Send a payment confirmation email to a customer.
 * @param {string} email - Recipient email address
 * @param {string} name - Customer's name
 * @param {number} amount - Payment amount in GHS
 * @param {Object} planDetails - Installment plan details
 * @param {string} planDetails.deviceModel - Device model name
 * @param {number} planDetails.remainingBalance - Remaining balance after this payment
 * @param {number} planDetails.paymentsLeft - Number of payments left
 * @param {Date|string} planDetails.nextDueDate - Next payment due date
 * @param {string} planDetails.reference - Payment reference
 */
const sendPaymentConfirmationEmail = async (email, name, amount, planDetails) => {
  const transporter = createTransporter();

  const {
    deviceModel = 'iPhone',
    remainingBalance = 0,
    paymentsLeft = 0,
    nextDueDate = null,
    reference = 'N/A',
  } = planDetails || {};

  const formattedAmount = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);

  const formattedBalance = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(remainingBalance);

  const formattedNextDue = nextDueDate
    ? new Date(nextDueDate).toLocaleDateString('en-GH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const isPaidOff = remainingBalance <= 0;

  const mailOptions = {
    from: process.env.EMAIL_FROM || `Tritech Hub iOS <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Payment Confirmed: ${formattedAmount} - Tritech Hub iOS`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #28a745; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .amount { font-size: 36px; font-weight: bold; margin: 10px 0 0; }
          .body { padding: 30px; color: #333333; }
          .body p { line-height: 1.6; margin-bottom: 16px; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table td { padding: 12px; border-bottom: 1px solid #eeeeee; }
          .details-table td:first-child { font-weight: bold; color: #555555; width: 40%; }
          .success-badge { display: inline-block; background-color: #28a745; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
          .footer { background-color: #f8f8f8; padding: 20px 30px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
          .completed-notice { background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 16px; margin-top: 20px; text-align: center; color: #155724; font-size: 16px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Confirmed</h1>
            <div class="amount">${formattedAmount}</div>
          </div>
          <div class="body">
            <h2>Hello, ${name}!</h2>
            <p>Your payment has been successfully received. Here are your payment details:</p>
            <table class="details-table">
              <tr>
                <td>Reference</td>
                <td>${reference}</td>
              </tr>
              <tr>
                <td>Device</td>
                <td>${deviceModel}</td>
              </tr>
              <tr>
                <td>Amount Paid</td>
                <td>${formattedAmount}</td>
              </tr>
              <tr>
                <td>Remaining Balance</td>
                <td>${formattedBalance}</td>
              </tr>
              ${!isPaidOff ? `
              <tr>
                <td>Payments Left</td>
                <td>${paymentsLeft}</td>
              </tr>
              <tr>
                <td>Next Due Date</td>
                <td>${formattedNextDue}</td>
              </tr>
              ` : ''}
              <tr>
                <td>Status</td>
                <td><span class="success-badge">PAID</span></td>
              </tr>
            </table>
            ${isPaidOff ? `
            <div class="completed-notice">
              Congratulations! You have fully paid for your ${deviceModel}. Your device is now fully unlocked!
            </div>
            ` : `
            <p>Your next payment of <strong>${formattedAmount}</strong> is due on <strong>${formattedNextDue}</strong>. Please ensure timely payment to avoid device lock.</p>
            `}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p>
            <p>This is an automated payment confirmation. Please keep this for your records.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello, ${name}!

Your payment of ${formattedAmount} has been successfully received.

Payment Details:
- Reference: ${reference}
- Device: ${deviceModel}
- Amount Paid: ${formattedAmount}
- Remaining Balance: ${formattedBalance}
${!isPaidOff ? `- Payments Left: ${paymentsLeft}\n- Next Due Date: ${formattedNextDue}` : ''}

${isPaidOff ? `Congratulations! You have fully paid for your ${deviceModel}. Your device is now fully unlocked!` : `Your next payment is due on ${formattedNextDue}.`}

© ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Payment confirmation email sent to ${email}: ${info.messageId}`);
  return info;
};

/**
 * Send a device lock notification email.
 * @param {string} email - Recipient email address
 * @param {string} name - Customer's name
 * @param {string} deviceModel - Device model name
 */
const sendLockNotificationEmail = async (email, name, deviceModel) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `Tritech Hub iOS <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Important: Your ${deviceModel} Has Been Locked - Tritech Hub iOS`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Device Locked</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #dc3545; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .icon { font-size: 48px; margin: 10px 0 0; }
          .body { padding: 30px; color: #333333; }
          .body p { line-height: 1.6; margin-bottom: 16px; }
          .action-box { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 16px; margin: 20px 0; }
          .contact-info { background-color: #e8f4f8; border: 1px solid #bee5eb; border-radius: 4px; padding: 16px; margin: 20px 0; }
          .footer { background-color: #f8f8f8; padding: 20px 30px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">🔒</div>
            <h1>Device Locked</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}!</h2>
            <p>We are writing to inform you that your <strong>${deviceModel}</strong> has been locked due to an overdue installment payment.</p>
            <p>Your payment was due more than <strong>48 hours ago</strong>, and we have not received your installment payment. As per the terms of your installment agreement, we have remotely locked your device.</p>
            <div class="action-box">
              <strong>How to Unlock Your Device:</strong>
              <p style="margin-top: 8px; margin-bottom: 0;">To restore access to your device, please make your overdue installment payment immediately. Once your payment is confirmed, your device will be automatically unlocked within minutes.</p>
            </div>
            <div class="contact-info">
              <strong>Need Help?</strong>
              <p style="margin-top: 8px; margin-bottom: 0;">If you believe this is an error or need assistance, please contact our support team immediately. We are here to help you resolve this matter quickly.</p>
            </div>
            <p>You can make your payment through our app or by visiting any of our authorized payment centers.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.</p>
            <p>This is an automated notification. Please contact support if you need assistance.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello, ${name}!

Your ${deviceModel} has been locked due to an overdue installment payment.

Your payment was due more than 48 hours ago. As per the terms of your installment agreement, we have remotely locked your device.

To unlock your device, please make your overdue installment payment immediately. Once your payment is confirmed, your device will be automatically unlocked.

If you believe this is an error, please contact our support team immediately.

© ${new Date().getFullYear()} Tritech Hub iOS. All rights reserved.
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Lock notification email sent to ${email}: ${info.messageId}`);
  return info;
};

module.exports = {
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendLockNotificationEmail,
  sendAdminPaymentReminderEmail,
  sendAdminOverdueAlertEmail,
  sendAdminSaleNotificationEmail,
};

/**
 * Email admin immediately when a staff member registers a new customer/sale.
 * @param {string} adminEmail
 * @param {{ staffName, staffId, branch, customerName, customerPhone, deviceModel,
 *           downPayment, totalPrice, installmentAmount, frequency, totalPayments }} sale
 */
async function sendAdminSaleNotificationEmail(adminEmail, sale) {
  const transporter = createTransporter();
  const businessName = process.env.BUSINESS_NAME || 'Tritech Hub iOS';
  const freqLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[sale.frequency] || sale.frequency;
  const now = new Date().toLocaleString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${businessName} <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `✅ New Sale — ${sale.deviceModel} sold by ${sale.staffName}${sale.branch ? ' @ ' + sale.branch : ''}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:linear-gradient(135deg,#166534,#15803d);padding:28px 30px">
            <h1 style="color:#fff;margin:0;font-size:20px">${businessName}</h1>
            <p style="color:#bbf7d0;margin:6px 0 0;font-size:15px">✅ New iPhone Sale Recorded</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 20px">A new sale was just registered on <strong>${now}</strong>.</p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7;width:40%">Staff</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:600">${sale.staffName}${sale.staffId ? ' <span style="color:#6b7280;font-weight:400;font-family:monospace">(${sale.staffId})</span>' : ''}</td>
              </tr>
              ${sale.branch ? `<tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Branch</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.branch}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Customer</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.customerName}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Phone</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7">${sale.customerPhone || '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Device</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:700">${sale.deviceModel}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Device Price</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7">GHS ${Number(sale.totalPrice).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#166534;font-weight:700;border-bottom:1px solid #dcfce7">Down Payment</td>
                <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;font-weight:700;color:#166534">GHS ${Number(sale.downPayment).toLocaleString()}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;color:#166534;font-weight:700">Installment Plan</td>
                <td style="padding:10px 14px">GHS ${Number(sale.installmentAmount).toLocaleString()} × ${sale.totalPayments} payments (${freqLabel})</td>
              </tr>
            </table>

            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;font-size:13px;color:#166534">
              Log in to <strong>${businessName}</strong> to view the full customer record and installment plan.
            </div>
          </div>
          <div style="background:#f9fafb;padding:14px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName} · Sale alert
          </div>
        </div>
      </body></html>
    `,
  });
}

/**
 * Email admin 2 days before a customer's payment is due.
 */
async function sendAdminPaymentReminderEmail(adminEmail, customers) {
  const transporter = createTransporter();
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

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${businessName} <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `⏰ ${customers.length} Payment(s) Due in 2 Days — ${businessName}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:#166534;padding:28px 30px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">${businessName}</h1>
            <p style="color:#bbf7d0;margin:6px 0 0;font-size:15px">⏰ Payment Due Reminder</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 16px">
              The following customer(s) have a payment due in <strong>2 days</strong>.
              Please follow up with them now to ensure timely payment.
            </p>
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
            <p style="color:#6b7280;font-size:13px;margin:20px 0 0">
              Log in to your dashboard to view full customer details.
            </p>
          </div>
          <div style="background:#f9fafb;padding:16px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName} · Automated reminder
          </div>
        </div>
      </body></html>
    `,
  });
}

/**
 * Email admin when a customer's payment is overdue (48+ hours).
 */
async function sendAdminOverdueAlertEmail(adminEmail, customers) {
  const transporter = createTransporter();
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

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${businessName} <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🔴 ${customers.length} Overdue Payment(s) — Action Required — ${businessName}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
        <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)">
          <div style="background:#dc2626;padding:28px 30px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">${businessName}</h1>
            <p style="color:#fecaca;margin:6px 0 0;font-size:15px">🔴 Overdue Payment Alert</p>
          </div>
          <div style="padding:28px 30px">
            <p style="color:#374151;font-size:15px;margin:0 0 8px">
              The following customer(s) have <strong>not paid</strong> and are overdue by 48+ hours.
            </p>
            <p style="color:#374151;font-size:15px;margin:0 0 20px">
              <strong>Please lock their iPhone on iCloud now</strong> — go to
              <a href="https://icloud.com/find" style="color:#dc2626">icloud.com/find</a>,
              find their device and enable Lost Mode.
            </p>
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
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px;margin:20px 0 0">
              <strong style="color:#991b1b">Steps to lock on iCloud:</strong>
              <ol style="color:#7f1d1d;margin:8px 0 0;padding-left:18px;line-height:1.8">
                <li>Go to <a href="https://icloud.com/find" style="color:#dc2626">icloud.com/find</a></li>
                <li>Sign in with your business Apple ID</li>
                <li>Click on the customer's device name</li>
                <li>Click <strong>Lost Mode</strong> → enter your phone number → Activate</li>
              </ol>
            </div>
          </div>
          <div style="background:#f9fafb;padding:16px 30px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #eee">
            &copy; ${new Date().getFullYear()} ${businessName} · Automated alert
          </div>
        </div>
      </body></html>
    `,
  });
}
