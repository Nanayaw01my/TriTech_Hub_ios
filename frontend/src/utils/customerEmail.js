// Customers registered without an email get an internal stand-in address
// (see backend utils/customerEmail.js). Never show it as if it were real.
const PLACEHOLDER_DOMAIN = '@customer.dandorsolar.site'

export const isPlaceholderEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith(PLACEHOLDER_DOMAIN)

/** The customer's real email, or '' if they registered without one. */
export const displayEmail = (email) => (email && !isPlaceholderEmail(email) ? email : '')
