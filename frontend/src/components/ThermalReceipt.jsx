import React, { useRef, useState } from 'react'
import { formatPKR, formatDateTime } from '../services/api'

export default function ThermalReceipt({ sale, settings, onClose }) {
  const [paperWidth, setPaperWidth] = useState(settings?.printer_type || '110mm')
  const receiptRef = useRef(null)

  const handlePrint = () => {
    // If running inside Electron, use main-process printing to target only the receipt HTML.
    try {
      const doPrint = async () => {
        if (window.electronAPI && window.electronAPI.printReceipt && receiptRef.current) {
          try {
            // Collect stylesheet texts (inline styles and linked CSS) to preserve design
            let cssTexts = [];
            // inline <style> tags
            document.querySelectorAll('style').forEach((s) => cssTexts.push(s.innerText));
            // linked stylesheets
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            for (const l of links) {
              try {
                const href = l.href;
                const resp = await fetch(href);
                if (resp.ok) {
                  const txt = await resp.text();
                  cssTexts.push(txt);
                }
              } catch (e) {
                // ignore fetch failures, continue
                console.warn('Could not fetch stylesheet', l.href, e);
              }
            }

            // Keep entire stylesheet text if it mentions receipt-related selectors/rules
            const receiptCss = cssTexts
              .filter((txt) => /thermal|printable-area|@page|@media print|thermal-receipt|\.printable-area|\.thermal-/i.test(txt))
              .join('\n');

            const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${receiptCss}</style></head><body>${receiptRef.current.outerHTML}</body></html>`;

            // request a single copy — ensure only one print job is created
            const res = await window.electronAPI.printReceipt(html);
            if (!res || !res.success) {
              console.error('Print failed:', res && res.failureReason);
            }
            return;
          } catch (err) {
            console.error('Electron print failed', err);
          }
        }

        // Fallback to window.print for non-Electron environments (single job)
        try {
          window.print();
        } catch (e) {
          console.error('Print failed', e);
        }
      };

      doPrint();
    } catch (e) {
      console.error('Print failed', e);
    }
  }

  if (!sale) return null

  const bizName = settings?.business_name || 'A1 STEEL & CEMENT DEALER'
  const tagline = settings?.tagline || 'Wholesale & Retail Cement & Steel Suppliers'
  const phone = settings?.phone || '0300-1234567 / 0312-9876543'
  const address = settings?.address || 'Main G.T. Road, Pakistan'
  const footerNote = settings?.invoice_footer || 'Thank you for your business! Items once sold cannot be returned without receipt.'

  const is58mm = paperWidth === '58mm'
  const prevBal = sale.customer_previous_balance || 0
  // Use backend-provided customer-facing remaining amount (already excludes mazdori)
  const billRem = sale.remaining_amount || 0
  // Compute invoice-level overpayment (credit) relative to displayed invoice total (includes mazdori)
  const invoiceCredit = Math.max((sale.paid_amount || 0) - (sale.total_amount || 0), 0)
  const totalBal = sale.customer_total_balance !== undefined ? sale.customer_total_balance : prevBal + billRem
  const totalCredit = Math.max(-(totalBal || 0), 0)

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong>Thermal Receipt Preview</strong>
            <select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value)} className="form-control" style={{ width: 110 }}>
              <option value="110mm">110mm</option>
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
            </select>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <div ref={receiptRef} className={`thermal-receipt-container printable-area ${paperWidth === '110mm' ? 'thermal-110mm' : is58mm ? 'thermal-58mm' : 'thermal-80mm'}`}>
            <h2 style={{ margin: 0 }}>{bizName}</h2>
            <div className="tagline">{tagline}</div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>{address}</div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>Phone: {phone}</div>

            <hr />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <div><strong>Invoice:</strong> {sale.invoice_number || sale.invoice_no || '-'}</div>
              <div><strong>Date:</strong> {formatDateTime(sale.sale_date)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <div><strong>Customer:</strong> {sale.customer_name || '-'}</div>
              <div>{sale.customer_code || ''}</div>
            </div>

            {sale.customer_phone && <div style={{ fontSize: 10 }}>Phone: {sale.customer_phone}</div>}
            {sale.notes && <div style={{ fontSize: 10, fontStyle: 'italic' }}>Note: {sale.notes}</div>}

            <hr />

            <table style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ fontSize: 10, color: '#555' }}>[{item.category} - {item.unit}]</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(item.unit_price)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{formatPKR(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                <span>Discount:</span>
                <span>-{formatPKR(sale.discount)}</span>
              </div>
            )}

            {sale.mazdori > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a' }}>
                <span>Mazdori (Labour):</span>
                <span>+{formatPKR(sale.mazdori)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
              <span>Total Bill:</span>
              <span>{formatPKR(sale.total_amount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid ({sale.payment_method || 'Cash'}):</span>
              <span>{formatPKR(sale.paid_amount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Bill Remaining:</span>
              <span>{formatPKR(billRem)}</span>
            </div>

            {invoiceCredit > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                <span>Customer Credit:</span>
                <span>{formatPKR(invoiceCredit)}</span>
              </div>
            )}

            <hr />

            <div style={{ background: '#fff', padding: 6, borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>Previous Balance:</span>
                <span>{formatPKR(prevBal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#b91c1c' }}>
                <span>Total Customer Balance:</span>
                <span>{formatPKR(Math.max(totalBal || 0, 0))}</span>
              </div>
              {invoiceCredit <= 0 && totalCredit > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#059669' }}>
                  <span>Customer Credit:</span>
                  <span>{formatPKR(totalCredit)}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>{footerNote}</div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn btn-primary">🖨️ Print Thermal Receipt</button>
        </div>
      </div>
    </div>
  )
}
