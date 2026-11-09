const cron = require('node-cron');
const InstallmentPlan = require('../models/InstallmentPlan');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Payment = require('../models/Payment');
const { sendLockNotificationEmail, sendAdminPaymentReminderEmail, sendAdminOverdueAlertEmail, sendPaymentReminderEmail } = require('./email');
const { sendSMS, sendPaymentReminderSMS, sendPaymentReminderWhatsApp, sendDeviceLockedSMS, sendDeviceLockedWhatsApp, sendLockTomorrowSMS } = require('./sms');
const Settings = require('../models/Settings');
const { ensurePayLink, amountDue } = require('./payLink');
const { applyLateFees } = require('./lateFees');
const { checkSilentPhones } = require('./tamperWatch');
const { sendCompanyAlert } = require('./companyAlert');
const agent = require('./androidAgent');
const logger = require('./logger');

/**
 * Check for overdue installment plans and lock devices.
 * An installment plan is considered overdue if:
 * - Status is 'active'
 * - next_due_date is more than 48 hours in the past
 */
// ─── DSR notifications ───────────────────────────────────────────────────────
const fmtMoney = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const firstWord = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/** The active DSR (staff) behind a plan, with a phone to text; else null. */
async function dsrFor(plan) {
  if (!plan?.created_by) return null;
  const u = await User.findById(plan.created_by).select('name phone role is_active').lean();
  return u && u.role === 'staff' && u.is_active !== false && u.phone ? u : null;
}

/** A DSR's customer missed a payment and the phone was just locked. */
async function notifyDsrOfLock(plan, customer, device) {
  const dsr = await dsrFor(plan);
  if (!dsr) return;
  const due = plan.next_due_date
    ? new Date(plan.next_due_date).toLocaleDateString('en-GH', { timeZone: 'UTC', day: 'numeric', month: 'short' })
    : 'the due date';
  await sendSMS(dsr.phone,
    `Hi ${firstWord(dsr.name)}, your customer ${customer.full_name}${customer.phone ? ` (${customer.phone})` : ''} did not pay ` +
    `GHS ${fmtMoney(amountDue(plan))} due ${due}. Their ${device.model || 'phone'} is now LOCKED. Please call them to pay; ` +
    `it unlocks as soon as they pay. -Dan & Dor Solar`);
  logger.info('[Scheduler] DSR %s told that %s was locked.', dsr.name, customer.full_name);
}

const checkOverduePayments = async () => {
  logger.info('[Scheduler] Running checkOverduePayments job...');

  try {
    // Lock as soon as the due date passes (grace is 0 by default — same value the
    // phone uses for its offline self-lock).
    const cutoffDate = new Date(Date.now() - agent.OFFLINE_GRACE_MS);
    const now = new Date();

    // Overdue warnings during the grace window (none when grace is 0 — the phone
    // locks at the due date; customers are reminded beforehand instead).
    try {
      const warningPlans = await InstallmentPlan.find({
        status: 'active',
        next_due_date: { $lt: now, $gte: cutoffDate },
      })
        .populate({ path: 'device_id', select: 'model' })
        .populate({ path: 'customer_id', select: 'full_name phone email user_id' });

      for (const plan of warningPlans) {
        const customer = plan.customer_id;
        if (!customer || !plan.device_id) continue;
        try {
          let customerEmail = customer.email;
          if (!customerEmail && customer.user_id) {
            const userRecord = await User.findById(customer.user_id).select('email');
            customerEmail = userRecord?.email;
          }
          const overdueDetails = {
            deviceModel: plan.device_id.model,
            installmentAmount: plan.installment_amount,
            remainingBalance: plan.remaining_balance,
            nextDueDate: plan.next_due_date,
            isOverdue: true,
            link: await ensurePayLink(plan).catch(() => null),
          };

          if (customerEmail) {
            await sendPaymentReminderEmail(customerEmail, customer.full_name, overdueDetails);
            logger.info('[Scheduler] Overdue warning email sent to %s', customer.full_name);
          }
          if (customer.phone) {
            await sendPaymentReminderSMS(customer.phone, customer.full_name, overdueDetails)
              .catch(e => logger.error('[Scheduler] Overdue SMS failed: %s', e.message));
            await sendPaymentReminderWhatsApp(customer.phone, customer.full_name, overdueDetails)
              .catch(e => logger.error('[Scheduler] Overdue WhatsApp failed: %s', e.message));
            logger.info('[Scheduler] Overdue warning SMS+WhatsApp sent to %s', customer.full_name);
          }
        } catch (emailErr) {
          logger.error('[Scheduler] Failed to send overdue warning to %s: %s', customer?.full_name, emailErr.message);
        }
      }
    } catch (warnErr) {
      logger.error('[Scheduler] Error sending overdue warnings: %s', warnErr.message);
    }

    // Find all active plans past their due date (+ grace, if any)
    const overduePlans = await InstallmentPlan.find({
      status: 'active',
      next_due_date: { $lt: cutoffDate },
    })
      .populate({
        path: 'device_id',
        select: 'model udid lock_status serial_number',
      })
      .populate({
        path: 'customer_id',
        select: 'user_id full_name email phone',
      });

    if (overduePlans.length === 0) {
      logger.info('[Scheduler] No overdue plans found.');
      return;
    }

    logger.info('[Scheduler] Found %d overdue plan(s). Processing...', overduePlans.length);

    const overdueAdminList = [];

    for (const plan of overduePlans) {
      try {
        const device = plan.device_id;
        const customer = plan.customer_id;

        if (!device || !customer) {
          logger.warn('[Scheduler] Plan %s missing device or customer data. Skipping.', plan._id);
          continue;
        }

        // The phone may have locked itself at the due time already (it does so
        // offline). Still finish the job: record the lock on the server, mark
        // the plan overdue and send the texts. (Each plan is processed once:
        // it leaves 'active' below.)
        if (device.lock_status === 'locked') {
          logger.info('[Scheduler] Device %s already locked itself; recording the overdue lock.', device._id);
        }

        logger.info('[Scheduler] Marking device %s as locked for overdue plan %s (customer: %s)', device._id, plan._id, customer.full_name);

        // Send the lock command to the phone via the Dan & Dor Solar lock agent.
        // The agent applies it instantly (FCM push) or on its next check-in.
        let mdmResult = 'skipped (not enrolled)';
        try {
          const devDoc = await Device.findById(device._id);
          if (devDoc && devDoc.agent?.enrolled) {
            const r = await agent.lockDevice(devDoc);
            devDoc.lock_status = 'locked';
            await devDoc.save();
            mdmResult = r.delivered ? 'sent' : 'queued';
            logger.info('[Scheduler][agent] Lock %s for device %s', mdmResult, device._id);
          } else {
            // Not enrolled yet — record the intent so the UI reflects it.
            await Device.findByIdAndUpdate(device._id, { lock_status: 'locked' });
          }
        } catch (lockErr) {
          mdmResult = `failed: ${lockErr.message}`;
          logger.error('[Scheduler][agent] Lock failed for device %s: %s', device._id, lockErr.message);
          await Device.findByIdAndUpdate(device._id, { lock_status: 'locked' });
        }

        // Mark the plan as defaulted.
        await InstallmentPlan.findByIdAndUpdate(plan._id, { status: 'defaulted' });

        // Audit log
        await AuditLog.create({
          action: 'device_lock',
          device_udid: device.agent?.device_id || device.imei || null,
          target_user_id: customer.user_id,
          details: {
            reason: 'Automated: installment not paid by the due date',
            mdm: mdmResult,
            installment_plan_id: plan._id,
            next_due_date: plan.next_due_date,
            hours_overdue: Math.round((Date.now() - new Date(plan.next_due_date)) / (1000 * 60 * 60)),
            device_model: device.model,
            customer_name: customer.full_name,
          },
          ip_address: 'scheduler',
        });

        // Send lock notification email to customer
        try {
          let customerEmail = customer.email;
          if (!customerEmail && customer.user_id) {
            const userRecord = await User.findById(customer.user_id).select('email');
            customerEmail = userRecord?.email;
          }

          if (customerEmail) {
            await sendLockNotificationEmail(customerEmail, customer.full_name, device.model);
            logger.info('[Scheduler] Lock notification email sent to %s', customerEmail);
          }
          if (customer.phone) {
            await sendDeviceLockedSMS(customer.phone, customer.full_name, device.model, await ensurePayLink(plan).catch(() => null),
              (await Settings.getSingleton().catch(() => null))?.late_fee_per_day)
              .catch(e => logger.error('[Scheduler] Lock SMS failed: %s', e.message));
            await sendDeviceLockedWhatsApp(customer.phone, customer.full_name, device.model)
              .catch(e => logger.error('[Scheduler] Lock WhatsApp failed: %s', e.message));
            logger.info('[Scheduler] Lock SMS+WhatsApp sent to %s', customer.full_name);
          }
        } catch (emailError) {
          logger.error('[Scheduler] Failed to send lock notification: %s', emailError.message);
        }

        // Tell the DSR who sold it, so they can call the customer.
        await notifyDsrOfLock(plan, customer, device).catch((e) =>
          logger.error('[Scheduler] DSR lock SMS failed: %s', e.message));

        // Collect for admin overdue alert
        overdueAdminList.push({
          customerName: customer.full_name,
          phone: customer.phone || '',
          deviceModel: device.model,
          amount: plan.installment_amount,
          hoursOverdue: Math.round((Date.now() - new Date(plan.next_due_date)) / (1000 * 60 * 60)),
        });

        logger.info('[Scheduler] Successfully processed overdue plan %s: device locked, plan defaulted.', plan._id);
      } catch (planError) {
        logger.error('[Scheduler] Error processing plan %s: %s', plan._id, planError.message);
      }
    }

    // Email admin with all overdue customers in one digest
    if (overdueAdminList.length > 0 && process.env.ADMIN_EMAIL) {
      try {
        await sendAdminOverdueAlertEmail(process.env.ADMIN_EMAIL, overdueAdminList);
        logger.info('[Scheduler] Admin overdue alert sent to %s for %d customer(s).', process.env.ADMIN_EMAIL, overdueAdminList.length);
      } catch (adminEmailError) {
        logger.error('[Scheduler] Failed to send admin overdue alert: %s', adminEmailError.message);
      }
    }

    logger.info('[Scheduler] checkOverduePayments job completed.');
  } catch (error) {
    logger.error('[Scheduler] Fatal error in checkOverduePayments: %s', error.message);
  }
};

/**
 * The day before a payment is due (= the day before the phone would lock),
 * text the customer once: "pay today or your phone locks tomorrow". Plans
 * paid ahead have a later due date, so they aren't reminded. Ghana time = UTC.
 */
const checkUpcomingPayments = async () => {
  logger.info('[Scheduler] Running checkUpcomingPayments job (lock-tomorrow reminders)...');

  try {
    const now = new Date();
    const startTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const endTomorrow = new Date(startTomorrow.getTime() + 24 * 60 * 60 * 1000);

    const upcomingPlans = await InstallmentPlan.find({
      status: 'active',
      next_due_date: { $gte: startTomorrow, $lt: endTomorrow },
    })
      .populate({ path: 'device_id', select: 'model' })
      .populate({ path: 'customer_id', select: 'full_name phone email user_id deleted_at' });

    // One reminder per due date (safe if the job runs twice).
    const validPlans = upcomingPlans.filter((p) =>
      p.device_id && p.customer_id && !p.customer_id.deleted_at &&
      !(p.lock_reminder_for && new Date(p.lock_reminder_for).getTime() === new Date(p.next_due_date).getTime()));

    if (validPlans.length === 0) {
      logger.info('[Scheduler] No payments due tomorrow.');
      return;
    }

    const settings = await Settings.getSingleton().catch(() => null);
    const contact = settings?.contact_phone || agent.config.BUSINESS_PHONE || '';

    for (const plan of validPlans) {
      const customer = plan.customer_id;
      try {
        if (customer.phone) {
          await sendLockTomorrowSMS(customer.phone, customer.full_name, {
            amount: amountDue(plan), dueDate: plan.next_due_date, contact,
            link: await ensurePayLink(plan).catch(() => null),
          });
          logger.info('[Scheduler] Lock-tomorrow SMS sent to %s', customer.full_name);
        }

        let customerEmail = customer.email;
        if (!customerEmail && customer.user_id) {
          const userRecord = await User.findById(customer.user_id).select('email');
          customerEmail = userRecord?.email;
        }
        if (customerEmail && !/@customer\.dandorsolar\.site$/i.test(customerEmail)) {
          await sendPaymentReminderEmail(customerEmail, customer.full_name, {
            deviceModel: plan.device_id.model,
            installmentAmount: plan.installment_amount,
            remainingBalance: plan.remaining_balance,
            nextDueDate: plan.next_due_date,
            isOverdue: false,
          }).catch((e) => logger.error('[Scheduler] Reminder email failed for %s: %s', customer.full_name, e.message));
        }

        await InstallmentPlan.updateOne({ _id: plan._id }, { $set: { lock_reminder_for: plan.next_due_date } });
      } catch (err) {
        logger.error('[Scheduler] Failed to send reminder to %s: %s', customer.full_name, err.message);
      }
    }

    const reminderList = validPlans.map((p) => ({
      customerName: p.customer_id.full_name,
      phone: p.customer_id.phone || '',
      deviceModel: p.device_id.model,
      amount: p.installment_amount,
      dueDate: new Date(p.next_due_date).toLocaleDateString('en-GH', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      }),
    }));

    if (reminderList.length > 0 && process.env.ADMIN_EMAIL) {
      await sendAdminPaymentReminderEmail(process.env.ADMIN_EMAIL, reminderList);
      logger.info('[Scheduler] Admin payment reminder sent for %d payment(s) due tomorrow.', reminderList.length);
    }
  } catch (error) {
    logger.error('[Scheduler] Fatal error in checkUpcomingPayments: %s', error.message);
  }
};

/**
 * Two days before payments are due, text the company numbers (main + silent
 * backup) a list of who has to pay, and each DSR a list of their own
 * customers due, so they can call ahead. Each payment is
 * listed once (company_reminder_for). Ghana time = UTC.
 */
const checkCompanyDueSoon = async () => {
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const plans = await InstallmentPlan.find({
      status: 'active',
      next_due_date: { $gte: start, $lt: end },
    })
      .populate({ path: 'device_id', select: 'model' })
      .populate({ path: 'customer_id', select: 'full_name phone deleted_at' });

    const list = plans.filter((p) => p.customer_id && !p.customer_id.deleted_at &&
      !(p.company_reminder_for && new Date(p.company_reminder_for).getTime() === new Date(p.next_due_date).getTime()));
    if (!list.length) {
      logger.info('[Scheduler] Company due-soon: no payments due in 2 days.');
      return 0;
    }

    const day = start.toLocaleDateString('en-GH', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
    const money = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const lines = list.map((p) => {
      const c = p.customer_id;
      return `${c.full_name}${c.phone ? ` ${c.phone}` : ''} - GHS ${money(amountDue(p))}${p.device_id?.model ? ` (${p.device_id.model})` : ''}`;
    });
    const total = list.reduce((s, p) => s + amountDue(p), 0);

    // Long lists go out as several texts of up to 8 names each.
    const PER_TEXT = 8;
    const parts = Math.ceil(lines.length / PER_TEXT);
    for (let i = 0; i < parts; i++) {
      const chunk = lines.slice(i * PER_TEXT, (i + 1) * PER_TEXT)
        .map((l, j) => `${i * PER_TEXT + j + 1}. ${l}`).join('\n');
      const head = `Dan & Dor Solar: ${list.length} payment(s) due ${day} (in 2 days)${parts > 1 ? ` [${i + 1}/${parts}]` : ''}:`;
      const foot = i === parts - 1 ? `\nTotal GHS ${money(total)}.` : '';
      await sendCompanyAlert(`${head}\n${chunk}${foot}`, { tag: 'due-soon' });
    }

    // Each DSR gets their own customers only.
    const byDsr = new Map();
    for (const p of list) {
      const k = p.created_by ? String(p.created_by) : null;
      if (!k) continue;
      if (!byDsr.has(k)) byDsr.set(k, []);
      byDsr.get(k).push(p);
    }
    for (const mine of byDsr.values()) {
      try {
        const dsr = await dsrFor(mine[0]);
        if (!dsr) continue;
        const rows = mine.map((p) => {
          const c = p.customer_id;
          return `${c.full_name}${c.phone ? ` ${c.phone}` : ''} - GHS ${money(amountDue(p))}`;
        });
        const n = Math.ceil(rows.length / PER_TEXT);
        for (let i = 0; i < n; i++) {
          const chunk = rows.slice(i * PER_TEXT, (i + 1) * PER_TEXT)
            .map((l, j) => `${i * PER_TEXT + j + 1}. ${l}`).join('\n');
          const head = `Hi ${firstWord(dsr.name)}, ${rows.length} of your customer(s) must pay on ${day} (in 2 days)${n > 1 ? ` [${i + 1}/${n}]` : ''}. Please remind them:`;
          await sendSMS(dsr.phone, `${head}\n${chunk}\n-Dan & Dor Solar`);
        }
        logger.info('[Scheduler] DSR %s told about %d payment(s) due %s.', dsr.name, rows.length, day);
      } catch (e) {
        logger.error('[Scheduler] DSR due-soon SMS failed: %s', e.message);
      }
    }

    await InstallmentPlan.bulkWrite(list.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { company_reminder_for: p.next_due_date } } },
    })));
    logger.info('[Scheduler] Company due-soon text sent for %d payment(s) due %s.', list.length, day);
    return list.length;
  } catch (error) {
    logger.error('[Scheduler] checkCompanyDueSoon: %s', error.message);
    return 0;
  }
};

/**
 * Create and email a daily backup of all system data.
 */
const dailyBackup = async () => {
  logger.info('[Scheduler] Running daily backup...');

  try {
    const [customers, devices, plans, payments, auditLogs, staffUsers] = await Promise.all([
      Customer.find().lean(),
      Device.find().lean(),
      InstallmentPlan.find().lean(),
      Payment.find().lean(),
      AuditLog.find().lean(),
      User.find({ role: { $in: ['staff', 'admin'] } }).lean(),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      counts: {
        customers: customers.length,
        devices: devices.length,
        plans: plans.length,
        payments: payments.length,
        auditLogs: auditLogs.length,
      },
      data: { customers, devices, plans, payments, auditLogs, staffUsers },
    };

    const backupJson = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().split('T')[0];
    const filename = `tritech-backup-${date}.json`;

    logger.info('[Scheduler] Backup file: %s (%d bytes)', filename, backupJson.length);

    // Email backup to admin
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_FROM;
    const { sendBackupEmail, emailConfigured } = require('./email');
    if (adminEmail && emailConfigured()) {
      try {
        await sendBackupEmail(adminEmail, backupJson, filename);
        logger.info('[Scheduler] Backup emailed to %s', adminEmail);
      } catch (emailErr) {
        logger.error('[Scheduler] Failed to email backup: %s', emailErr.message);
      }
    } else {
      logger.warn('[Scheduler] Backup email not sent — set ADMIN_EMAIL and an email provider (MAILERSEND_API_KEY, or EMAIL_USER + EMAIL_PASS).');
    }

    logger.info('[Scheduler] Daily backup completed.');
  } catch (error) {
    logger.error('[Scheduler] Fatal error in dailyBackup: %s', error.message);
  }
};

/**
 * Start all cron jobs.
 * - Every hour: check for overdue installment plans and lock devices.
 * - Daily at 8 AM: text customers whose payment is due tomorrow (phone locks then).
 * - Daily at 2 AM: create and email a backup of all system data.
 */
const startScheduler = () => {
  logger.info('[Scheduler] Initializing scheduled jobs...');

  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    await checkOverduePayments();
  });

  logger.info('[Scheduler] Overdue payment checker scheduled: every hour.');

  // Just after midnight (Ghana time): add the day's late fees to overdue plans.
  // Also run once shortly after start-up, to catch up if the server was asleep.
  cron.schedule('5 0 * * *', async () => {
    await applyLateFees().catch((e) => logger.error('[LateFee] %s', e.message));
  });
  setTimeout(() => applyLateFees().catch((e) => logger.error('[LateFee] %s', e.message)), 60 * 1000);
  logger.info('[Scheduler] Late fees scheduled: daily at 00:05.');

  // Run daily at 8:00 AM (Ghana time): 'your phone locks tomorrow' reminders
  cron.schedule('0 8 * * *', async () => {
    await checkUpcomingPayments();
    // The company's own list of payments due in 2 days.
    await checkCompanyDueSoon();
  });

  logger.info('[Scheduler] Lock-tomorrow reminder scheduled: daily at 08:00.');
  // If the server was asleep or restarting at 8:00, send the company's
  // due-soon list once it's up (each payment is only listed once anyway).
  setTimeout(() => {
    if (new Date().getUTCHours() >= 8) checkCompanyDueSoon().catch(() => {});
  }, 2 * 60 * 1000);

  // Every hour at :20 — text the company about sold phones that stopped
  // checking in (switched off for long, no data, or reset/flashed).
  cron.schedule('20 * * * *', async () => {
    await checkSilentPhones().catch((e) => logger.error('[silent-phone] %s', e.message));
  });
  logger.info('[Scheduler] Silent-phone check scheduled: every hour.');

  // Run daily at 2:00 AM to create and email a system backup
  cron.schedule('0 2 * * *', async () => {
    await dailyBackup();
  });

  logger.info('[Scheduler] Daily backup scheduled: daily at 02:00.');

  // Run an initial check at startup (delayed by 10 seconds to allow DB connection)
  setTimeout(async () => {
    await checkOverduePayments();
  }, 10000);
};

module.exports = { startScheduler, checkOverduePayments, checkUpcomingPayments, checkCompanyDueSoon, notifyDsrOfLock, dailyBackup };
