// Customers registered without an email get a stand-in address built from their
// account number. Nothing is ever sent to it; it only keeps the required/unique
// email field and Paystack (which needs an email) working. They log in with
// their account number instead.
const PLACEHOLDER_DOMAIN = 'customer.dandorsolar.site';

const placeholderEmail = (accountNumber) =>
  `${String(accountNumber).toLowerCase()}@${PLACEHOLDER_DOMAIN}`;

const isPlaceholderEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);

module.exports = { PLACEHOLDER_DOMAIN, placeholderEmail, isPlaceholderEmail };
