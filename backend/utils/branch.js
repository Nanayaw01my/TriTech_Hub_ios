/**
 * Branch names are typed by hand ("BOGOSO", "bogoso ", "Bogoso"), so they are
 * stored in one form: extra spaces removed, each word capitalised ("Bogoso",
 * "Tarkwa Nsuaem"). Reports and filters then treat them as the same branch.
 */
function normalizeBranch(v) {
  if (v === null || v === undefined) return v;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

/** Start-up: rewrite existing staff branches into the one form (once per value). */
async function normalizeAllBranches() {
  const User = require('../models/User');
  const users = await User.find({ branch: { $nin: [null, ''] } }).select('_id branch').lean();
  let n = 0;
  for (const u of users) {
    const clean = normalizeBranch(u.branch);
    if (clean !== u.branch) {
      await User.updateOne({ _id: u._id }, { $set: { branch: clean } });
      n += 1;
    }
  }
  return n;
}

module.exports = { normalizeBranch, normalizeAllBranches };
