import jsPDF from "jspdf";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export type InvoiceServiceLine = { name: string; qty: number; price: number };

export type InvoicePdfData = {
  invoice_number: string;
  client_name: string;
  issued_at: string;
  due_at: string | null;
  amount: number;
  vat_rate?: number;
  vat_included?: boolean;
  services: InvoiceServiceLine[];
  comment?: string | null;
};

export type RequisitesData = {
  legal_name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  bik?: string | null;
  correspondent_account?: string | null;
  legal_address?: string | null;
  director_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(n || 0);

// jsPDF default fonts don't ship Cyrillic. Render via HTML canvas trick: use addHTML alternative.
// Simpler reliable approach: build an HTML string and use html2pdf-style via window.print fallback.
// Here we use jsPDF + html() which supports Unicode through DOM rendering.
export async function generateInvoicePdf(invoice: InvoicePdfData, requisites: RequisitesData) {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 794px;
    padding: 40px; background: white; color: #111;
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px; line-height: 1.5;
  `;

  const total = invoice.amount;
  const vatRate = invoice.vat_rate ?? 0;
  const vatAmount = invoice.vat_included && vatRate > 0 ? +(total - total / (1 + vatRate / 100)).toFixed(2) : 0;

  const issued = invoice.issued_at ? format(new Date(invoice.issued_at), "d MMMM yyyy", { locale: ru }) : "—";
  const due = invoice.due_at ? format(new Date(invoice.due_at), "d MMMM yyyy", { locale: ru }) : "—";

  const servicesHtml = invoice.services && invoice.services.length > 0
    ? invoice.services.map((s, i) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:8px;border:1px solid #ddd">${escapeHtml(s.name)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${s.qty}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${RUB(s.price)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${RUB(s.qty * s.price)}</td>
        </tr>`).join("")
    : `<tr><td colspan="5" style="padding:12px;border:1px solid #ddd;text-align:center;color:#888">Услуги не указаны</td></tr>`;

  container.innerHTML = `
    <div style="border-bottom:3px solid #f59e0b;padding-bottom:20px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="margin:0;font-size:28px;color:#111">Счёт № ${escapeHtml(invoice.invoice_number)}</h1>
          <div style="color:#666;margin-top:4px">от ${issued}</div>
        </div>
        <div style="text-align:right">
          <div style="color:#666">К оплате до</div>
          <div style="font-weight:600;color:#dc2626">${due}</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div>
        <div style="color:#666;text-transform:uppercase;font-size:10px;letter-spacing:1px;margin-bottom:6px">Поставщик</div>
        <div style="font-weight:600;font-size:14px">${escapeHtml(requisites.legal_name || "—")}</div>
        ${requisites.inn ? `<div style="color:#444">ИНН: ${escapeHtml(requisites.inn)}${requisites.kpp ? " / КПП: " + escapeHtml(requisites.kpp) : ""}</div>` : ""}
        ${requisites.ogrn ? `<div style="color:#444">ОГРН: ${escapeHtml(requisites.ogrn)}</div>` : ""}
        ${requisites.legal_address ? `<div style="color:#444;margin-top:4px">${escapeHtml(requisites.legal_address)}</div>` : ""}
        ${requisites.email ? `<div style="color:#444;margin-top:4px">${escapeHtml(requisites.email)}</div>` : ""}
      </div>
      <div>
        <div style="color:#666;text-transform:uppercase;font-size:10px;letter-spacing:1px;margin-bottom:6px">Покупатель</div>
        <div style="font-weight:600;font-size:14px">${escapeHtml(invoice.client_name || "—")}</div>
      </div>
    </div>

    ${requisites.bank_name || requisites.account_number ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:24px">
      <div style="color:#666;text-transform:uppercase;font-size:10px;letter-spacing:1px;margin-bottom:8px">Банковские реквизиты</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${requisites.bank_name ? `<div><span style="color:#666">Банк:</span> ${escapeHtml(requisites.bank_name)}</div>` : ""}
        ${requisites.bik ? `<div><span style="color:#666">БИК:</span> ${escapeHtml(requisites.bik)}</div>` : ""}
        ${requisites.account_number ? `<div><span style="color:#666">Р/с:</span> ${escapeHtml(requisites.account_number)}</div>` : ""}
        ${requisites.correspondent_account ? `<div><span style="color:#666">К/с:</span> ${escapeHtml(requisites.correspondent_account)}</div>` : ""}
      </div>
    </div>` : ""}

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="background:#f59e0b;color:white">
          <th style="padding:10px;border:1px solid #f59e0b;text-align:center;width:40px">№</th>
          <th style="padding:10px;border:1px solid #f59e0b;text-align:left">Наименование услуги</th>
          <th style="padding:10px;border:1px solid #f59e0b;text-align:center;width:80px">Кол-во</th>
          <th style="padding:10px;border:1px solid #f59e0b;text-align:right;width:120px">Цена</th>
          <th style="padding:10px;border:1px solid #f59e0b;text-align:right;width:140px">Сумма</th>
        </tr>
      </thead>
      <tbody>${servicesHtml}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
      <table style="border-collapse:collapse">
        <tr><td style="padding:6px 16px;text-align:right;color:#666">Итого:</td><td style="padding:6px 16px;text-align:right;font-weight:600">${RUB(total - vatAmount)}</td></tr>
        ${vatRate > 0 ? `<tr><td style="padding:6px 16px;text-align:right;color:#666">НДС ${vatRate}%:</td><td style="padding:6px 16px;text-align:right">${RUB(vatAmount)}</td></tr>` : `<tr><td style="padding:6px 16px;text-align:right;color:#666">НДС:</td><td style="padding:6px 16px;text-align:right">Без НДС</td></tr>`}
        <tr style="border-top:2px solid #111"><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:14px">Всего к оплате:</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:16px;color:#f59e0b">${RUB(total)}</td></tr>
      </table>
    </div>

    ${invoice.comment ? `<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px;border-radius:4px;margin-bottom:20px"><strong>Комментарий:</strong> ${escapeHtml(invoice.comment)}</div>` : ""}

    ${requisites.director_name ? `
    <div style="margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
      <div>
        <div style="border-bottom:1px solid #999;height:32px"></div>
        <div style="color:#666;font-size:10px;margin-top:4px">Руководитель: ${escapeHtml(requisites.director_name)}</div>
      </div>
      <div>
        <div style="border-bottom:1px solid #999;height:32px"></div>
        <div style="color:#666;font-size:10px;margin-top:4px">Главный бухгалтер</div>
      </div>
    </div>` : ""}
  `;

  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "px", format: "a4", hotfixes: ["px_scaling"] });
    await pdf.html(container, {
      callback: (doc) => doc.save(`Счёт_${invoice.invoice_number}.pdf`),
      autoPaging: "text",
      margin: [20, 20, 20, 20],
      html2canvas: { scale: 0.75, useCORS: true },
      width: 555,
      windowWidth: 794,
    });
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
