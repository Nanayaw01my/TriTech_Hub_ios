const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Initialize a Paystack payment transaction.
 * @param {Object} params
 * @param {string} params.email - Customer email
 * @param {number} params.amount - Amount in GHS (will be converted to kobo)
 * @param {string} params.reference - Unique transaction reference
 * @param {string} params.callback_url - URL to redirect after payment
 * @param {Object} params.metadata - Additional metadata
 * @returns {Object} Paystack initialization response
 */
const initializePayment = async ({ email, amount, reference, callback_url, metadata = {} }) => {
  // Convert GHS to kobo (multiply by 100)
  const amountInKobo = Math.round(amount * 100);

  const payload = {
    email,
    amount: amountInKobo,
    reference,
    callback_url,
    metadata,
    currency: 'GHS',
  };

  const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
    headers: getHeaders(),
  });

  return response.data;
};

/**
 * Verify a Paystack payment by reference.
 * @param {string} reference - Transaction reference
 * @returns {Object} Paystack verification response
 */
const verifyPayment = async (reference) => {
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: getHeaders(), timeout: 20000 }
  );

  return response.data;
};

/**
 * Get a list of transactions from Paystack.
 * @param {Object} params - Query parameters (page, perPage, etc.)
 * @returns {Object} Paystack transactions list
 */
const listTransactions = async (params = {}) => {
  const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction`, {
    headers: getHeaders(),
    params,
  });

  return response.data;
};

/**
 * Create a transfer recipient for a Ghana mobile money account.
 * @param {Object} p
 * @param {string} p.name - Recipient name
 * @param {string} p.account_number - MoMo phone number
 * @param {string} p.bank_code - Network code (MTN / VOD / ATL)
 * @returns {string} recipient_code
 */
const createTransferRecipient = async ({ name, account_number, bank_code }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transferrecipient`,
    { type: 'mobile_money', name, account_number, bank_code, currency: 'GHS' },
    { headers: getHeaders(), timeout: 20000 }
  );
  return response.data?.data?.recipient_code;
};

/**
 * Initiate a transfer (payout) from your Paystack balance.
 * @param {Object} p
 * @param {number} p.amount - Amount in GHS
 * @param {string} p.recipient - recipient_code
 * @param {string} p.reason
 * @param {string} p.reference
 * @returns {Object} Paystack transfer response data
 */
const initiateTransfer = async ({ amount, recipient, reason, reference }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transfer`,
    { source: 'balance', amount: Math.round(amount * 100), recipient, reason, reference, currency: 'GHS' },
    { headers: getHeaders(), timeout: 30000 }
  );
  return response.data;
};

// ── DSR commission splits ────────────────────────────────────────────────
// Each DSR gets a Paystack subaccount (where their commission settles) and a
// flat "transaction split" that sends their commission to that subaccount on
// a deposit payment; the main account keeps the rest and bears the fees.

/** Ghana banks and mobile-money providers that can receive settlements. */
const listBanks = async () => {
  const response = await axios.get(`${PAYSTACK_BASE_URL}/bank`, {
    headers: getHeaders(), params: { currency: 'GHS', perPage: 200 }, timeout: 20000,
  });
  return (response.data?.data || []).filter((b) => b.active !== false);
};

/** Create a subaccount; returns Paystack's subaccount object (subaccount_code…). */
const createSubaccount = async ({ business_name, settlement_bank, account_number, description }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/subaccount`,
    // percentage_charge is required by the API but unused: splits set the shares.
    { business_name, settlement_bank, account_number, percentage_charge: 0, description },
    { headers: getHeaders(), timeout: 20000 }
  );
  return response.data?.data;
};

/** Change where an existing subaccount settles. */
const updateSubaccount = async (code, { business_name, settlement_bank, account_number }) => {
  const response = await axios.put(
    `${PAYSTACK_BASE_URL}/subaccount/${encodeURIComponent(code)}`,
    { business_name, settlement_bank, account_number },
    { headers: getHeaders(), timeout: 20000 }
  );
  return response.data?.data;
};

/** Create a flat split: [shareGHS] to the subaccount, the rest to the main account (which pays fees). */
const createSplit = async ({ name, subaccount, shareGHS }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/split`,
    {
      name, type: 'flat', currency: 'GHS', bearer_type: 'account',
      subaccounts: [{ subaccount, share: Math.round(shareGHS * 100) }],
    },
    { headers: getHeaders(), timeout: 20000 }
  );
  return response.data?.data; // { id, split_code, ... }
};

/** Set (add or update) a subaccount's flat share in an existing split. */
const setSplitShare = async ({ splitId, subaccount, shareGHS }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/split/${encodeURIComponent(splitId)}/subaccount/add`,
    { subaccount, share: Math.round(shareGHS * 100) },
    { headers: getHeaders(), timeout: 20000 }
  );
  return response.data?.data;
};

/** Paystack's own error message from an axios error, for showing to the admin. */
const paystackErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || 'Paystack request failed';

module.exports = {
  initializePayment, verifyPayment, listTransactions, createTransferRecipient, initiateTransfer,
  listBanks, createSubaccount, updateSubaccount, createSplit, setSplitShare, paystackErrorMessage,
};
