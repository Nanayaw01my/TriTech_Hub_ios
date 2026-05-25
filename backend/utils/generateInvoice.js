const Sale = require('../models/Sale');

/**
 * Generate a unique invoice number in format INV-YYYYMMDD-XXXX
 * XXXX is zero-padded count of today's invoices + 1
 */
const generateInvoiceNo = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  // Count invoices already created today
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const count = await Sale.countDocuments({
    sale_date: { $gte: startOfDay, $lte: endOfDay },
    invoice_no: { $regex: `^INV-${datePart}-` },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${datePart}-${sequence}`;
};

module.exports = { generateInvoiceNo };
