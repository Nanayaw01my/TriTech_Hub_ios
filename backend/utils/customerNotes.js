/**
 * Customer notes ("called, promised to pay Friday"), the "To call today" list,
 * overdue age groups, and a customer's full history (timeline).
 * Used by the admin portal (all customers) and the DSR app (own customers).
 */
const Customer = require('../models/Customer');
const CustomerNote = require('../models/CustomerNote');
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const SmsLog = require('../models/SmsLog');
const { amountDue } = require('./payLink');
const { formatPhone } = require('./sms');
const logger = require('./logger');

const DAY = 24 * 60 * 60 * 1000;
const isStaff = (req) => req.user?.role === 'staff';
const endOfToday = () => { const d = new Date(); d.setUTCHours(23, 59, 59, 999); return d; };

/** The customer, if this user may see them (DSRs: only their own). */
async function customerFor(req, id) {
  const c = await Customer.findOne({ _id: id, deleted_at: null }).select('full_name phone created_by user_id guarantor').lean();
  if (!c) return null;
  if (isStaff(req) && String(c.created_by) !== String(req.user._id)) return null;
  return c;
}

const fail = (res, e, where) => {
  logger.error(`[notes] ${where}: %s`, e.message);
  return res.status(500).json({ success: false, message: 'Server error.' });
};

async function listHandler(req, res) {
  try {
    const c = await customerFor(req, req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const notes = await CustomerNote.find({ customer_id: c._id }).sort({ createdAt: -1 }).limit(100)
      .populate({ path: 'created_by', select: 'name role' }).lean();
    return res.status(200).json({ success: true, data: { notes } });
  } catch (e) { return fail(res, e, 'list'); }
}

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function addHandler(req, res) {
  try {
    const c = await customerFor(req, req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const text = String(req.body?.text || '').trim();
    if (text.length < 2) return res.status(400).json({ success: false, message: 'Write the note first.' });
    const amt = Number(req.body?.promise_amount);
    const note = await CustomerNote.create({
      customer_id: c._id,
      text: text.slice(0, 1000),
      promise_date: toDate(req.body?.promise_date),
      promise_amount: Number.isFinite(amt) && amt > 0 ? amt : null,
      follow_up_date: toDate(req.body?.follow_up_date),
      created_by: req.user._id,
    });
    AuditLog.create({
      user_id: req.user._id, action: 'customer_note', target_user_id: c.user_id, ip_address: req.ip,
      details: { customer_id: c._id, note_id: note._id },
    }).catch(() => {});
    return res.status(201).json({ success: true, message: 'Note saved.', data: { note } });
  } catch (e) { return fail(res, e, 'add'); }
}

/** PATCH /notes/:id { done } — mark a follow-up / promise as done (or not). */
async function updateHandler(req, res) {
  try {
    const note = await CustomerNote.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });
    const c = await customerFor(req, note.customer_id);
    if (!c) return res.status(404).json({ success: false, message: 'Note not found.' });
    if (req.body?.done !== undefined) {
      note.done = !!req.body.done;
      note.done_at = note.done ? new Date() : null;
    }
    await note.save();
    return res.status(200).json({ success: true, message: note.done ? 'Marked done.' : 'Reopened.', data: { note } });
  } catch (e) { return fail(res, e, 'update'); }
}

/** Age group of an overdue plan, by days late. */
const bucketOf = (days) => (days <= 7 ? '1-7' : days <= 30 ? '8-30' : days <= 60 ? '31-60' : '60+');

/**
 * GET follow-ups: everyone to call today (overdue customers + notes whose
 * follow-up or promise date has come), and overdue age groups.
 */
async function followUpsHandler(req, res) {
  try {
    const now = new Date();
    const planQ = { status: { $in: ['active', 'defaulted'] }, next_due_date: { $lt: now } };
    if (isStaff(req)) planQ.created_by = req.user._id;
    const overdue = await InstallmentPlan.find(planQ)
      .select('customer_id device_id next_due_date remaining_balance penalty_balance installment_amount payments_made total_price down_payment schedule status created_by')
      .populate({ path: 'customer_id', select: 'full_name phone deleted_at created_by user_id', populate: { path: 'user_id', select: 'account_number' } })
      .populate({ path: 'device_id', select: 'model lock_status' })
      .populate({ path: 'created_by', select: 'name' })
      .lean();

    const noteQ = { done: false, $or: [{ follow_up_date: { $lte: endOfToday() } }, { promise_date: { $lte: endOfToday() } }] };
    const dueNotes = await CustomerNote.find(noteQ).populate({ path: 'created_by', select: 'name' }).lean();

    const items = new Map();
    const aging = { '1-7': { count: 0, amount: 0 }, '8-30': { count: 0, amount: 0 }, '31-60': { count: 0, amount: 0 }, '60+': { count: 0, amount: 0 } };

    for (const p of overdue) {
      const c = p.customer_id;
      if (!c || c.deleted_at) continue;
      const days = Math.max(1, Math.ceil((now - new Date(p.next_due_date)) / DAY));
      const due = amountDue(p);
      const b = bucketOf(days);
      aging[b].count += 1;
      aging[b].amount = Math.round((aging[b].amount + due) * 100) / 100;
      items.set(String(c._id), {
        customer_id: c._id, name: c.full_name, phone: c.phone, account_number: c.user_id?.account_number || '',
        dsr: p.created_by?.name || '', device_model: p.device_id?.model || '', locked: p.device_id?.lock_status === 'locked',
        days_overdue: days, amount_due: due, bucket: b, reasons: ['overdue'], open_notes: [],
      });
    }

    // Customers with a follow-up/promise due today (overdue or not).
    const extraIds = dueNotes.map((n) => String(n.customer_id)).filter((id) => !items.has(id));
    if (extraIds.length) {
      const q = { _id: { $in: extraIds }, deleted_at: null };
      if (isStaff(req)) q.created_by = req.user._id;
      const extra = await Customer.find(q).select('full_name phone user_id').populate({ path: 'user_id', select: 'account_number' }).lean();
      for (const c of extra) {
        items.set(String(c._id), {
          customer_id: c._id, name: c.full_name, phone: c.phone, account_number: c.user_id?.account_number || '',
          dsr: '', device_model: '', locked: false, days_overdue: 0, amount_due: null, bucket: null, reasons: [], open_notes: [],
        });
      }
    }
    for (const n of dueNotes) {
      const it = items.get(String(n.customer_id));
      if (!it) continue;
      it.open_notes.push({
        _id: n._id, text: n.text, promise_date: n.promise_date, promise_amount: n.promise_amount,
        follow_up_date: n.follow_up_date, by: n.created_by?.name || '', at: n.createdAt,
      });
      if (n.promise_date && new Date(n.promise_date) <= endOfToday() && !it.reasons.includes('promise')) it.reasons.push('promise');
      if (n.follow_up_date && new Date(n.follow_up_date) <= endOfToday() && !it.reasons.includes('follow_up')) it.reasons.push('follow_up');
    }

    // Latest note for each (so the caller knows what was said last time).
    const ids = [...items.keys()];
    if (ids.length) {
      const latest = await CustomerNote.aggregate([
        { $match: { customer_id: { $in: ids.map((i) => new (require('mongoose').Types.ObjectId)(i)) } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$customer_id', text: { $first: '$text' }, at: { $first: '$createdAt' } } },
      ]);
      for (const l of latest) {
        const it = items.get(String(l._id));
        if (it) it.last_note = { text: l.text, at: l.at };
      }
    }

    const list = [...items.values()].sort((a, b) =>
      (b.reasons.includes('promise') - a.reasons.includes('promise')) || (b.days_overdue - a.days_overdue));
    return res.status(200).json({ success: true, data: { items: list, aging, total_overdue: overdue.length } });
  } catch (e) { return fail(res, e, 'follow-ups'); }
}

const AUDIT_TEXT = {
  customer_registered: 'Sale registered',
  customer_updated: 'Details updated',
  plan_activated: 'Plan started (deposit paid) — phone activated',
  device_lock: 'Phone locked',
  device_unlock: 'Phone unlocked',
  device_released: 'Phone released to the customer',
  device_repossessed: 'Phone repossessed',
  installment_completed: 'Fully paid',
  installment_defaulted: 'Marked overdue',
  payment_reminder_sent: 'Payment reminder sent',
  payment_voided: 'Payment cancelled',
  late_fee_waived: 'Late fees waived',
  due_date_extended: 'Extra days given',
  password_reset: 'Password reset',
};

/** GET timeline: payments, texts, locks/unlocks, notes and changes, newest first. */
async function timelineHandler(req, res) {
  try {
    const c = await customerFor(req, req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const plans = await InstallmentPlan.find({ customer_id: c._id }).select('_id device_id').lean();
    const planIds = plans.map((p) => p._id);
    const deviceIds = plans.map((p) => p.device_id).filter(Boolean);
    const phone = formatPhone(c.phone);

    const [payments, logs, notes, sms] = await Promise.all([
      Payment.find({ customer_id: c._id }).setOptions({ includeVoided: true }).sort({ payment_date: -1 }).limit(200)
        .populate({ path: 'recorded_by', select: 'name' }).lean(),
      AuditLog.find({
        action: { $in: Object.keys(AUDIT_TEXT) },
        $or: [
          { target_user_id: c.user_id },
          { 'details.customer_id': c._id },
          { 'details.plan_id': { $in: planIds } },
          { 'details.installment_plan_id': { $in: planIds } },
          ...(deviceIds.length ? [{ 'details.device_id': { $in: deviceIds } }] : []),
        ],
      }).sort({ created_at: -1, createdAt: -1 }).limit(200).populate({ path: 'user_id', select: 'name' }).lean(),
      CustomerNote.find({ customer_id: c._id }).sort({ createdAt: -1 }).limit(100).populate({ path: 'created_by', select: 'name' }).lean(),
      phone ? SmsLog.find({ to: phone }).sort({ at: -1 }).limit(100).lean() : [],
    ]);

    const money = (n) => `GHS ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const events = [];
    for (const p of payments) {
      events.push({
        type: 'payment', at: p.payment_date || p.createdAt,
        title: `${p.voided ? 'Cancelled payment' : 'Payment'} ${money(p.amount)}`,
        detail: [p.payment_method === 'paystack' ? 'Paystack' : 'Recorded by hand', p.notes, p.voided ? `cancelled: ${p.void_reason}` : null].filter(Boolean).join(' · '),
        by: p.recorded_by?.name || p.paid_by?.name || '',
      });
    }
    for (const l of logs) {
      // A payment already shows from the payments list; skip its audit twin.
      if (l.action === 'payment_made') continue;
      const d = l.details || {};
      const extra = l.action === 'late_fee_waived' ? money(d.amount)
        : l.action === 'due_date_extended' ? `${d.days} day(s)`
          : l.action === 'payment_voided' ? `${money(d.amount)} — ${d.reason || ''}`
            : (d.reason || '');
      events.push({ type: 'event', at: l.created_at || l.createdAt, title: AUDIT_TEXT[l.action] || l.action, detail: String(extra || '').slice(0, 200), by: l.user_id?.name || (l.ip_address === 'scheduler' ? 'System' : '') });
    }
    for (const n of notes) {
      const bits = [];
      if (n.promise_date) bits.push(`promised ${n.promise_amount ? money(n.promise_amount) + ' ' : ''}by ${new Date(n.promise_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}`);
      if (n.follow_up_date) bits.push(`call again ${new Date(n.follow_up_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}`);
      if (n.done) bits.push('done');
      events.push({ type: 'note', at: n.createdAt, title: n.text, detail: bits.join(' · '), by: n.created_by?.name || '' });
    }
    for (const m of sms) {
      events.push({ type: 'sms', at: m.at, title: m.ok ? 'Text sent' : 'Text NOT sent', detail: m.message, by: m.provider || '' });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    return res.status(200).json({ success: true, data: { events: events.slice(0, 300) } });
  } catch (e) { return fail(res, e, 'timeline'); }
}

module.exports = { listHandler, addHandler, updateHandler, followUpsHandler, timelineHandler };
