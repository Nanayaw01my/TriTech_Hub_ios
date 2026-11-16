/**
 * Who a customer should call, for the end of their texts:
 * the DSR who sold the phone ("Agent: Wassah 0201234567"), or the business
 * number when the DSR has left / was an admin sale ("Help: 0244000000").
 */
const User = require('../models/User');
const Settings = require('../models/Settings');
const { splitNumbers } = require('./companyAlert');

const local = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('233') && d.length === 12) return '0' + d.slice(3);
  return d;
};

async function helpContactFor(plan) {
  try {
    if (plan?.created_by) {
      const u = await User.findById(plan.created_by._id || plan.created_by).select('name phone role is_active').lean();
      if (u && u.role === 'staff' && u.is_active !== false && u.phone) {
        const first = String(u.name || '').trim().split(/\s+/)[0] || 'your agent';
        return `Agent: ${first} ${local(u.phone)}`;
      }
    }
    const s = await Settings.getSingleton().catch(() => null);
    const n = splitNumbers(s?.contact_phone || '')[0];
    return n ? `Help: ${local(n)}` : '';
  } catch {
    return '';
  }
}

module.exports = { helpContactFor };
