/**
 * Move a sale onto a different phone: the customer has phone B, but the sale
 * was linked to phone A (wrong phone picked, two of the same model, or a
 * second IMEI). Phone B takes the sale's state (unlocked / locked / awaiting);
 * phone A goes back to stock showing "Awaiting Activation".
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const agent = require('./androidAgent');
const logger = require('./logger');

const OPEN = ['pending', 'returned', 'approved', 'active', 'defaulted', 'repossessed'];

class ChangePhoneError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function changeSalePhone({ customerId, deviceId, user, ip }) {
  const customer = await Customer.findOne({ _id: customerId, deleted_at: null }).select('_id full_name');
  if (!customer) throw new ChangePhoneError('Customer not found.', 404);
  const plan = await InstallmentPlan.findOne({ customer_id: customer._id, status: { $in: OPEN } }).sort({ createdAt: -1 });
  if (!plan) throw new ChangePhoneError('This customer has no open sale.');
  if (String(plan.device_id) === String(deviceId)) throw new ChangePhoneError('The sale is already on this phone.');

  if (!/^[0-9a-fA-F]{24}$/.test(String(deviceId || ''))) throw new ChangePhoneError('Choose a phone.');
  const target = await Device.findById(deviceId);
  if (!target || target.kind === 'staff') throw new ChangePhoneError('Phone not found.', 404);
  if (!target.agent?.enrolled) throw new ChangePhoneError('That phone is not set up with the lock app. Enroll it first (Enroll Stock).');
  if (target.assigned_to && String(target.assigned_to) !== String(customer._id)) {
    throw new ChangePhoneError('That phone is already sold to another customer.');
  }
  const busy = await InstallmentPlan.exists({ _id: { $ne: plan._id }, device_id: target._id, status: { $in: OPEN } });
  if (busy) throw new ChangePhoneError('That phone is in another open sale.');

  const old = plan.device_id ? await Device.findById(plan.device_id) : null;

  // 1. The sale now points at the right phone.
  plan.device_id = target._id;
  await plan.save();

  // 2. The right phone takes the sale's state.
  target.assigned_to = customer._id;
  target.sold_status = 'sold';
  target.held_by = null;
  target.held_since = null;
  if (['active', 'defaulted'].includes(plan.status)) {
    const overdue = plan.status === 'defaulted' || (plan.next_due_date && new Date(plan.next_due_date) < new Date());
    target.agent.desired_lock_state = overdue ? 'locked' : 'unlocked';
    target.agent.paid_until = agent.computePaidUntil(plan.next_due_date);
    target.lock_status = overdue ? 'locked' : 'unlocked';
  } else if (plan.status === 'repossessed') {
    target.agent.desired_lock_state = 'locked';
    target.agent.paid_until = new Date();
    target.lock_status = 'locked';
  } else {
    target.agent.desired_lock_state = 'pending_activation';
    target.agent.paid_until = null;
  }
  await target.save();
  try { await agent.pushCommand(target); } catch { /* applies on next check-in */ }

  // 3. The wrong phone goes back to stock (or is removed if it was only a copy).
  let oldResult = 'none';
  if (old && String(old._id) !== String(target._id)) {
    const usedElsewhere = await InstallmentPlan.exists({ device_id: old._id, status: { $in: OPEN } });
    if (!usedElsewhere) {
      if (old.agent?.enrolled) {
        old.assigned_to = null;
        old.sold_status = 'available';
        old.lock_status = 'unlocked';
        old.agent.desired_lock_state = 'pending_activation';
        old.agent.paid_until = null;
        await old.save();
        try { await agent.pushCommand(old); } catch { /* next check-in */ }
        oldResult = 'stock';
      } else if (!(await InstallmentPlan.exists({ device_id: old._id }))) {
        await Device.deleteOne({ _id: old._id }).catch(() => {});
        oldResult = 'removed';
      } else {
        old.assigned_to = null;
        old.sold_status = 'available';
        await old.save();
        oldResult = 'freed';
      }
    }
  }

  await AuditLog.create({
    user_id: user?._id, action: 'device_updated', ip_address: ip,
    details: {
      event: 'sale_phone_changed', plan_id: plan._id, customer_id: customer._id, customer_name: customer.full_name,
      from_device: old?._id || null, from_imei: old?.imei || null, to_device: target._id, to_imei: target.imei || null, old_phone: oldResult,
    },
  }).catch(() => {});
  logger.info('[change-phone] Sale %s moved from %s to %s', plan._id, old?._id, target._id);

  const state = target.agent.desired_lock_state;
  const now = state === 'unlocked' ? 'It unlocks on its next check-in (tap Check status on it to speed it up).'
    : state === 'locked' ? 'It stays locked (the customer is behind).'
      : 'It stays on Awaiting Activation until the sale is activated.';
  return {
    message: `Sale moved to ${String(target.model || 'the phone').replace(/^(\S+)\s+\1\b/i, '$1')}${target.imei ? ` (IMEI …${String(target.imei).slice(-6)})` : ''}. ${now}${oldResult === 'stock' ? ' The other phone is back in stock.' : ''}`,
  };
}

module.exports = { changeSalePhone, ChangePhoneError };
