const Refund = require('../models/Refund');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

/**
 * GET /api/refunds
 */
const getRefunds = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.refund_date = {};
      if (startDate) filter.refund_date.$gte = new Date(startDate);
      if (endDate) filter.refund_date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [refunds, total] = await Promise.all([
      Refund.find(filter)
        .populate('processed_by', 'username')
        .populate('sale_id', 'invoice_no')
        .sort({ refund_date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Refund.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: refunds,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('Get refunds error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/refunds/lookup/:invoiceNo
 * Look up a sale by invoice number to pre-fill the refund form.
 */
const lookupSaleByInvoice = async (req, res) => {
  try {
    const sale = await Sale.findOne({ invoice_no: req.params.invoiceNo.trim() });
    if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    return res.status(200).json({ success: true, data: sale });
  } catch (err) {
    console.error('Lookup sale error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/refunds
 * All authenticated users can process a refund.
 */
const createRefund = async (req, res) => {
  try {
    const { invoice_ref, customer_name, customer_phone, refund_amount, reason, refund_method, items = [] } = req.body;

    if (!customer_name) return res.status(400).json({ success: false, message: 'Customer name is required.' });
    if (!refund_amount || refund_amount <= 0) return res.status(400).json({ success: false, message: 'Refund amount must be greater than 0.' });
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required.' });
    if (!refund_method) return res.status(400).json({ success: false, message: 'Refund method is required.' });

    let sale_id = null;

    // Look up original sale if invoice ref provided
    if (invoice_ref) {
      const sale = await Sale.findOne({ invoice_no: invoice_ref.trim() });
      if (sale) sale_id = sale._id;
    }

    // Restore stock for each returned item
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: item.quantity } });
      }
    }

    const refund = await Refund.create({
      sale_id,
      invoice_ref: invoice_ref?.trim() || undefined,
      customer_name,
      customer_phone: customer_phone || undefined,
      refund_amount: Number(refund_amount),
      reason,
      refund_method,
      items: items.map(i => ({
        product_id: i.product_id || undefined,
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      })),
      processed_by: req.user._id,
    });

    await Notification.create({
      user_id: null,
      type: 'important',
      title: 'Refund Processed',
      message: `Refund of GH₵${Number(refund_amount).toFixed(2)} for ${customer_name}${invoice_ref ? ` (${invoice_ref})` : ''} by ${req.user.username}`,
    });

    const populated = await Refund.findById(refund._id).populate('processed_by', 'username');
    return res.status(201).json({ success: true, message: 'Refund processed successfully.', data: populated });
  } catch (err) {
    console.error('Create refund error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/refunds/:id  — CEO / Super Admin only
 */
const updateRefund = async (req, res) => {
  try {
    const { reason, refund_method } = req.body;
    const refund = await Refund.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found.' });
    if (reason) refund.reason = reason;
    if (refund_method) refund.refund_method = refund_method;
    await refund.save();
    const populated = await Refund.findById(refund._id).populate('processed_by', 'username');
    return res.status(200).json({ success: true, message: 'Refund updated.', data: populated });
  } catch (err) {
    console.error('Update refund error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/refunds/:id  — CEO / Super Admin only
 * Reverses the stock restoration when deleting.
 */
const deleteRefund = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id);
    if (!refund) return res.status(404).json({ success: false, message: 'Refund not found.' });

    // Reverse the stock restoration
    for (const item of refund.items) {
      if (item.product_id && item.quantity > 0) {
        await Product.findByIdAndUpdate(item.product_id, { $inc: { quantity: -item.quantity } });
      }
    }

    await Refund.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Refund deleted and stock reversed.' });
  } catch (err) {
    console.error('Delete refund error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getRefunds, lookupSaleByInvoice, createRefund, updateRefund, deleteRefund };
