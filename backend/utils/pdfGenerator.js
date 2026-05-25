const PDFDocument = require('pdfkit');

/**
 * Generate a thermal receipt PDF for a sale.
 * @param {Object} saleData - Sale document with items populated
 * @returns {Promise<Buffer>}
 */
const generateReceipt = (saleData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [226, 600], // 80mm thermal paper width approx
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { invoice_no, customer_name, customer_phone, items, subtotal, discount, discount_type, total_amount, payment_method, payment_status, sale_date } = saleData;

      // Header
      doc.fontSize(10).font('Helvetica-Bold').text('DAN & DOR SOLAR COMPANY LIMITED', { align: 'center' });
      doc.fontSize(7).font('Helvetica').text('Solar Energy Solutions', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(7).text('--------------------------------', { align: 'center' });
      doc.fontSize(8).font('Helvetica-Bold').text('SALES RECEIPT', { align: 'center' });
      doc.fontSize(7).font('Helvetica').text('--------------------------------', { align: 'center' });

      // Invoice info
      doc.fontSize(7).text(`Invoice: ${invoice_no}`);
      doc.text(`Date: ${new Date(sale_date || Date.now()).toLocaleString('en-GH')}`);
      if (customer_name) doc.text(`Customer: ${customer_name}`);
      if (customer_phone) doc.text(`Phone: ${customer_phone}`);

      doc.fontSize(7).text('--------------------------------', { align: 'center' });

      // Items
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Item                     Qty  Price    Total');
      doc.font('Helvetica');
      doc.fontSize(7).text('--------------------------------', { align: 'center' });

      (items || []).forEach((item) => {
        const name = (item.product_name || '').substring(0, 20).padEnd(20);
        const qty = String(item.quantity).padStart(4);
        const price = `GH₵${Number(item.unit_price).toFixed(2)}`.padStart(8);
        const total = `GH₵${Number(item.total).toFixed(2)}`.padStart(8);
        doc.text(`${name} ${qty} ${price} ${total}`);
      });

      doc.fontSize(7).text('--------------------------------', { align: 'center' });

      // Totals
      doc.fontSize(7);
      doc.text(`Subtotal:                  GH₵${Number(subtotal || 0).toFixed(2)}`);
      if (discount && discount > 0) {
        const discStr = discount_type === 'percentage' ? `${discount}%` : `GH₵${Number(discount).toFixed(2)}`;
        doc.text(`Discount (${discStr}):`);
      }
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`TOTAL:                     GH₵${Number(total_amount || 0).toFixed(2)}`);
      doc.fontSize(7).font('Helvetica');
      doc.text(`Payment: ${(payment_method || '').toUpperCase()}`);
      doc.text(`Status: ${(payment_status || '').toUpperCase()}`);

      doc.fontSize(7).text('--------------------------------', { align: 'center' });
      doc.fontSize(7).text('Thank you for your business!', { align: 'center' });
      doc.text('Powered by ITTEK Solution', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate a credit agreement PDF (A4).
 * @param {Object} agreementData - CreditAgreement document
 * @returns {Promise<Buffer>}
 */
const generateCreditAgreement = (agreementData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        customer_name, customer_phone, customer_address,
        guarantor_name, guarantor_phone, guarantor_address,
        product_description, total_amount, down_payment, remaining,
        weekly_installment, interest_rate, start_date, end_date, status,
      } = agreementData;

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('DAN & DOR SOLAR COMPANY LIMITED', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Credit Sale Agreement', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(14).font('Helvetica-Bold').text('CREDIT AGREEMENT', { align: 'center' });
      doc.moveDown(1);

      // Agreement details
      const row = (label, value) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value || 'N/A'));
      };

      doc.fontSize(11).font('Helvetica-Bold').text('Customer Information:');
      doc.moveDown(0.3);
      row('Full Name', customer_name);
      row('Phone', customer_phone);
      row('Address', customer_address);
      doc.moveDown(0.5);

      doc.fontSize(11).font('Helvetica-Bold').text('Guarantor Information:');
      doc.moveDown(0.3);
      row('Full Name', guarantor_name);
      row('Phone', guarantor_phone);
      row('Address', guarantor_address);
      doc.moveDown(0.5);

      doc.fontSize(11).font('Helvetica-Bold').text('Product & Payment Details:');
      doc.moveDown(0.3);
      row('Product/Description', product_description);
      row('Total Amount', `GH₵${Number(total_amount || 0).toFixed(2)}`);
      row('Down Payment', `GH₵${Number(down_payment || 0).toFixed(2)}`);
      row('Remaining Balance', `GH₵${Number(remaining || 0).toFixed(2)}`);
      row('Interest Rate', `${interest_rate || 0}%`);
      row('Weekly Installment', `GH₵${Number(weekly_installment || 0).toFixed(2)}`);
      row('Start Date', start_date ? new Date(start_date).toLocaleDateString('en-GH') : 'N/A');
      row('End Date (21 days)', end_date ? new Date(end_date).toLocaleDateString('en-GH') : 'N/A');
      row('Status', (status || 'active').toUpperCase());
      doc.moveDown(1);

      // Terms
      doc.fontSize(11).font('Helvetica-Bold').text('Terms & Conditions:');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').text(
        '1. The customer agrees to pay the weekly installment of GH₵' + Number(weekly_installment || 0).toFixed(2) + ' every week for 3 weeks.\n' +
        '2. Failure to make payment on time may result in repossession of the product.\n' +
        '3. The guarantor is jointly liable for all outstanding payments.\n' +
        '4. Any disputes shall be settled under Ghanaian law.'
      );
      doc.moveDown(2);

      // Signatures
      const sigY = doc.y;
      doc.fontSize(10).font('Helvetica').text('Customer Signature:', 60, sigY);
      doc.moveTo(60, sigY + 30).lineTo(230, sigY + 30).stroke();
      doc.text('Date: ___________', 60, sigY + 35);

      doc.text('Guarantor Signature:', 300, sigY);
      doc.moveTo(300, sigY + 30).lineTo(470, sigY + 30).stroke();
      doc.text('Date: ___________', 300, sigY + 35);

      doc.moveDown(3);
      doc.text('Company Representative Signature:');
      doc.moveTo(60, doc.y + 5).lineTo(230, doc.y + 5).stroke();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate a general report PDF (A4).
 * @param {Object} reportData - Data for the report
 * @param {string} title - Report title
 * @returns {Promise<Buffer>}
 */
const generateReport = (reportData, title = 'Report') => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('DAN & DOR SOLAR COMPANY LIMITED', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('ITTEK Solution - Business Management', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-GH')}`, { align: 'center' });
      doc.moveDown(1);

      // Summary section
      if (reportData.summary) {
        doc.fontSize(11).font('Helvetica-Bold').text('Summary:');
        doc.moveDown(0.3);
        Object.entries(reportData.summary).forEach(([key, value]) => {
          doc.fontSize(9).font('Helvetica-Bold').text(`${key}: `, { continued: true });
          doc.font('Helvetica').text(String(value));
        });
        doc.moveDown(0.5);
      }

      // Data table
      if (reportData.rows && reportData.rows.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Details:');
        doc.moveDown(0.3);
        reportData.rows.forEach((row, idx) => {
          doc.fontSize(9).font(idx % 2 === 0 ? 'Helvetica' : 'Helvetica-Oblique').text(
            Object.values(row).join('  |  ')
          );
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateReceipt, generateCreditAgreement, generateReport };
