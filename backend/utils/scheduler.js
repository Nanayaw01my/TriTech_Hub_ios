const cron = require('node-cron');
const InstallmentPlan = require('../models/InstallmentPlan');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Payment = require('../models/Payment');
const { sendLockNotificationEmail, sendAdminPaymentReminderEmail, sendAdminOverdueAlertEmail, sendPaymentReminderEmail } = require('./email');
const { sendPaymentReminderSMS, sendPaymentReminderWhatsApp, sendDeviceLockedSMS, sendDeviceLockedWhatsApp } = require('./sms');
const { lockDevice: mdmLock } = require('./simpleMDM');
const logger = require('./logger');

/**
 * Check for overdue installment plans and lock devices.
 * An installment plan is considered overdue if:
 * - Status is 'active'
 * - next_due_date is more than 48 hours in the past
 */
const checkOverduePayments = async () => {
  logger.info('[Scheduler] Running checkOverduePayments job...');

  try {
    const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    const now = new Date();

    // Send overdue warnings (0–48h overdue) — not yet locked, but urgently remind customer
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

    // Find all active plans where next_due_date is past the 48-hour cutoff
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

        // Skip if device is already locked
        if (device.lock_status === 'locked') {
          logger.info('[Scheduler] Device %s already marked as locked. Skipping.', device._id);
          continue;
        }

        logger.info('[Scheduler] Marking device %s as locked for overdue plan %s (customer: %s)', device._id, plan._id, customer.full_name);

        // Send the ACTUAL lock command to the physical iPhone via SimpleMDM (Lost Mode).
        // Requires the device to be supervised and enrolled in SimpleMDM with a stored UDID.
        let mdmResult = 'skipped (no UDID)';
        if (device.udid) {
          try {
            await mdmLock(device.udid);
            mdmResult = 'sent';
            logger.info('[Scheduler][MDM] Lock command sent for UDID %s', device.udid);
          } catch (mdmErr) {
            mdmResult = `failed: ${mdmErr.message}`;
            logger.error('[Scheduler][MDM] Lock failed for UDID %s: %s', device.udid, mdmErr.message);
          }
        }

        // Mark device as locked in DB and plan as defaulted
        await Device.findByIdAndUpdate(device._id, { lock_status: 'locked' });
        await InstallmentPlan.findByIdAndUpdate(plan._id, { status: 'defaulted' });

        // Audit log
        await AuditLog.create({
          action: 'device_lock',
          device_udid: device.udid || null,
          target_user_id: customer.user_id,
          details: {
            reason: 'Automated: payment overdue by more than 48 hours',
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
            await sendDeviceLockedSMS(customer.phone, customer.full_name, device.model)
              .catch(e => logger.error('[Scheduler] Lock SMS failed: %s', e.message));
            await sendDeviceLockedWhatsApp(customer.phone, customer.full_name, device.model)
              .catch(e => logger.error('[Scheduler] Lock WhatsApp failed: %s', e.message));
            logger.info('[Scheduler] Lock SMS+WhatsApp sent to %s', customer.full_name);
          }
        } catch (emailError) {
          logger.error('[Scheduler] Failed to send lock notification: %s', emailError.message);
        }

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
 * Check for payments due within the next 48 hours and email the admin a reminder.
 */
const checkUpcomingPayments = async () => {
  logger.info('[Scheduler] Running checkUpcomingPayments job...');

  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcomingPlans = await InstallmentPlan.find({
      status: 'active',
      next_due_date: { $gte: now, $lte: in48Hours },
    })
      .populate({ path: 'device_id', select: 'model' })
      .populate({ path: 'customer_id', select: 'full_name phone email user_id' });

    if (upcomingPlans.length === 0) {
      logger.info('[Scheduler] No upcoming payments in the next 48 hours.');
      return;
    }

    const validPlans = upcomingPlans.filter((p) => p.device_id && p.customer_id);

    // Email each customer individually about their upcoming payment
    for (const plan of validPlans) {
      const customer = plan.customer_id;
      try {
        let customerEmail = customer.email;
        if (!customerEmail && customer.user_id) {
          const userRecord = await User.findById(customer.user_id).select('email');
          customerEmail = userRecord?.email;
        }
        const reminderDetails = {
          deviceModel: plan.device_id.model,
          installmentAmount: plan.installment_amount,
          remainingBalance: plan.remaining_balance,
          nextDueDate: plan.next_due_date,
          isOverdue: false,
        };

        if (customerEmail) {
          await sendPaymentReminderEmail(customerEmail, customer.full_name, reminderDetails);
          logger.info('[Scheduler] Upcoming payment email sent to %s', customer.full_name);
        }

        if (customer.phone) {
          await sendPaymentReminderSMS(customer.phone, customer.full_name, reminderDetails)
            .catch(e => logger.error('[Scheduler] Reminder SMS failed for %s: %s', customer.full_name, e.message));
          await sendPaymentReminderWhatsApp(customer.phone, customer.full_name, reminderDetails)
            .catch(e => logger.error('[Scheduler] Reminder WhatsApp failed for %s: %s', customer.full_name, e.message));
          logger.info('[Scheduler] Upcoming payment SMS+WhatsApp sent to %s', customer.full_name);
        }
      } catch (emailErr) {
        logger.error('[Scheduler] Failed to send reminder to %s: %s', customer.full_name, emailErr.message);
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
      logger.info('[Scheduler] Admin payment reminder sent for %d upcoming payment(s).', reminderList.length);
    }
  } catch (error) {
    logger.error('[Scheduler] Fatal error in checkUpcomingPayments: %s', error.message);
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
    if (adminEmail && process.env.MAIL_API_KEY) {
      try {
        const { sendBackupEmail } = require('./email');
        await sendBackupEmail(adminEmail, backupJson, filename);
        logger.info('[Scheduler] Backup emailed to %s', adminEmail);
      } catch (emailErr) {
        logger.error('[Scheduler] Failed to email backup: %s', emailErr.message);
      }
    } else {
      logger.warn('[Scheduler] No ADMIN_EMAIL or MAIL_API_KEY configured. Backup email not sent.');
    }

    logger.info('[Scheduler] Daily backup completed.');
  } catch (error) {
    logger.error('[Scheduler] Fatal error in dailyBackup: %s', error.message);
  }
};

/**
 * Start all cron jobs.
 * - Every hour: check for overdue installment plans and lock devices.
 * - Daily at 8 AM: email admin about payments due in the next 48 hours.
 * - Daily at 2 AM: create and email a backup of all system data.
 */
const startScheduler = () => {
  logger.info('[Scheduler] Initializing scheduled jobs...');

  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    await checkOverduePayments();
  });

  logger.info('[Scheduler] Overdue payment checker scheduled: every hour.');

  // Run daily at 8:00 AM to remind admin about upcoming payments
  cron.schedule('0 8 * * *', async () => {
    await checkUpcomingPayments();
  });

  logger.info('[Scheduler] Upcoming payment reminder scheduled: daily at 08:00.');

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

module.exports = { startScheduler, checkOverduePayments, checkUpcomingPayments, dailyBackup };
