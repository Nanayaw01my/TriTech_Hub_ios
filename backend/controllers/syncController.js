const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { generateInvoiceNo } = require('../utils/generateInvoice');

const calcTotals = (items, discount = 0, discount_type = 'fixed') => {
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const discountAmount = discount_type === 'percentage'
    ? (subtotal * discount) / 100
    : discount;
  return { subtotal, cart_total: Math.max(0, subtotal - discountAmount) };
};

const processSingleSale = async (type, payload, userId, username) => {
  const { customer_name, customer_phone, cart, discount = 0, discount_type = 'fixed', payment_method, amount_paid } = payload;

  if (!cart || !cart.length) throw new Error('Empty cart');

  const items = [];
  for (const cartItem of cart) {
    const product = await Product.findById(cartItem.product_id);
    if (!product || !product.is_active) throw new Error(`Product not found: ${cartItem.product_id}`);
    if (product.quantity < cartItem.quantity) throw new Error(`Insufficient stock for ${product.name}`);
    items.push({
      product_id: product._id,
      product_name: product.name,
      barcode: product.barcode,
      quantity: cartItem.quantity,
      unit_price: product.selling_price,
      cost_price: product.cost_price,
      total: product.selling_price * cartItem.quantity,
    });
  }

  const { subtotal, cart_total } = calcTotals(items, discount, discount_type);
  const invoice_no = await generateInvoiceNo();

  if (type === 'short_payment') {
    if (!customer_name) throw new Error('Customer name required for short payment');
    const paidAmount = Math.min(Number(amount_paid) || 0, cart_total);
    const debtAmount = cart_total - paidAmount;

    const sale = await Sale.create({
      invoice_no, user_id: userId, customer_name, customer_phone,
      subtotal, discount, discount_type,
      total_amount: paidAmount, cart_total, debt_amount: debtAmount,
      payment_status: 'partial', payment_method, items,
    });

    for (const item of items) {
      await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: -item.quantity } });
    }

    const debt = await Debt.create({
      sale_id: sale._id, customer_name, customer_phone,
      amount_owed: debtAmount, amount_paid: 0, created_by: userId,
    });

    await Notification.create({
      user_id: null, type: 'important', title: 'New Debt (offline sync)',
      message: `${customer_name} owes GH₵${debtAmount.toFixed(2)} — ${invoice_no}`,
      link: `/debts/${debt._id}`,
    });

    return { invoice_no, sale_id: sale._id };
  }

  // Regular full-payment sale
  const sale = await Sale.create({
    invoice_no, user_id: userId, customer_name, customer_phone,
    subtotal, discount, discount_type,
    total_amount: cart_total, cart_total, debt_amount: 0,
    payment_status: 'paid', payment_method, items,
  });

  for (const item of items) {
    await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: -item.quantity } });
  }

  await Notification.create({
    user_id: null, type: 'info', title: 'Sale synced (offline)',
    message: `${invoice_no} — GH₵${cart_total.toFixed(2)} by ${username}`,
    link: `/pos/sales/${sale._id}`,
  });

  return { invoice_no, sale_id: sale._id };
};

/**
 * POST /api/sync/offline-sales
 * Accepts: { sales: [{ type: 'sale'|'short_payment', payload: {...} }] }
 */
const syncOfflineSales = async (req, res) => {
  try {
    const { sales } = req.body;
    if (!Array.isArray(sales) || !sales.length) {
      return res.status(400).json({ success: false, message: 'No sales to sync.' });
    }

    const results = [];
    for (const entry of sales) {
      try {
        const result = await processSingleSale(
          entry.type || 'sale',
          entry.payload,
          req.user._id,
          req.user.username,
        );
        results.push({ status: 'synced', ...result });
      } catch (err) {
        results.push({ status: 'failed', reason: err.message });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return res.status(200).json({
      success: true,
      message: `${synced} synced, ${failed} failed.`,
      data: results,
    });
  } catch (err) {
    console.error('Offline sync error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during sync.' });
  }
};

module.exports = { syncOfflineSales };
