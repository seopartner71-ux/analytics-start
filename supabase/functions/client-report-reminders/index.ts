import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ClientRow {
  id: string;
  name: string;
  report_day: number | null;
  report_enabled: boolean;
  last_report_date: string | null;
  status: string;
  responsible_id: string | null;
}

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ru(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function dueInMonth(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(day, 1), last));
}
/** Ближайшая незакрытая отчётная дата */
function nextDue(day: number, lastDone: string | null, today: Date) {
  let due = dueInMonth(today.getFullYear(), today.getMonth(), day);
  if (lastDone) {
    const done = new Date(lastDone);
    if (due.getTime() <= done.getTime()) due = dueInMonth(today.getFullYear(), today.getMonth() + 1, day);
  }
  return due;
}
function periodKeyOf(due: Date) {
  const p = new Date(due.getFullYear(), due.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

async function sendTelegram(chatId: string, text: string) {
  if (!TG_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = await res.json();
  if (!res.ok || body?.ok === false) throw new Error(`Telegram: ${body?.description || res.status}`);
}

async function sendEmail(from: string, to: string, subject: string, html: string) {
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY не настроен");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: from || "SEO-CRM <onboarding@resend.dev>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Email: ${res.status} ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: { action?: string; channel?: string } = {};
    try { body = await req.json(); } catch { /* cron без тела */ }

    const { data: settings } = await supabase.from("client_report_settings").select("*").limit(1).maybeSingle();
    if (!settings) return json({ error: "Настройки уведомлений не найдены" }, 400);

    // Тестовая отправка
    if (body.action === "test") {
      if (body.channel === "telegram") {
        if (!settings.telegram_chat_id) return json({ error: "Не указан Chat ID" }, 400);
        await sendTelegram(settings.telegram_chat_id, "✅ Тестовое сообщение SEO-CRM. Уведомления об отчётности работают.");
      } else {
        if (!settings.email_to) return json({ error: "Не указан email получателя" }, 400);
        await sendEmail(
          settings.email_from || "",
          settings.email_to,
          "Тестовое письмо · SEO-CRM",
          "<p>Тестовое письмо. Уведомления об отчётности клиентов работают.</p>",
        );
      }
      return json({ ok: true });
    }

    const warnDays = Number(settings.warn_days) || 3;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: clients } = await supabase
      .from("financial_clients")
      .select("id, name, report_day, report_enabled, last_report_date, status, responsible_id")
      .eq("report_enabled", true)
      .eq("status", "active");

    const list = (clients || []) as ClientRow[];
    const results: Record<string, unknown>[] = [];

    for (const c of list) {
      if (!c.report_day) continue;
      const due = nextDue(c.report_day, c.last_report_date, today);
      const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
      const type = daysLeft === 0 ? "REPORT_DUE_TODAY" : daysLeft === warnDays ? `REPORT_REMINDER_${warnDays}_DAYS` : null;
      if (!type) continue;

      const periodKey = periodKeyOf(due);
      let responsible = "не назначен";
      if (c.responsible_id) {
        const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", c.responsible_id).maybeSingle();
        responsible = p?.full_name || p?.email || "не назначен";
      }

      const channels: ("telegram" | "email")[] = [];
      if (settings.telegram_enabled && settings.telegram_chat_id) channels.push("telegram");
      if (settings.email_enabled && settings.email_to) channels.push("email");

      for (const channel of channels) {
        // Защита от дублей: уникальный ключ (клиент, период, тип, канал)
        const { error: lockErr } = await supabase.from("client_report_notifications").insert({
          client_id: c.id, period_key: periodKey, due_date: ymd(due),
          notification_type: type, channel, status: "pending",
        });
        if (lockErr) { results.push({ client: c.name, channel, skipped: "already_sent" }); continue; }

        try {
          if (channel === "telegram") {
            const text = daysLeft === 0
              ? `🔴 <b>Сегодня отчётность</b>\n\nКлиент: ${c.name}\nОтчётная дата: ${ru(due)}\nОтветственный: ${responsible}\n\nОтметьте отчётность после выполнения.`
              : `🔔 <b>Отчётность через ${warnDays} дн.</b>\n\nКлиент: ${c.name}\nОтчётная дата: ${ru(due)}\nОтветственный: ${responsible}\n\nНе забудьте подготовить отчёт.`;
            await sendTelegram(settings.telegram_chat_id!, text);
          } else {
            const subject = daysLeft === 0
              ? `Сегодня отчётность клиента ${c.name}`
              : `Отчётность клиента ${c.name} через ${warnDays} дн.`;
            const link = APP_URL ? `<p><a href="${APP_URL}/finance/clients">Открыть карточку клиента</a></p>` : "";
            await sendEmail(settings.email_from || "", settings.email_to!, subject,
              `<h2>${subject}</h2><p><b>Клиент:</b> ${c.name}<br/><b>Отчётная дата:</b> ${ru(due)}<br/><b>Ответственный:</b> ${responsible}</p>${link}`);
          }
          await supabase.from("client_report_notifications").update({ status: "sent" })
            .eq("client_id", c.id).eq("period_key", periodKey).eq("notification_type", type).eq("channel", channel);
          results.push({ client: c.name, channel, type, sent: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("send failed", c.name, channel, msg);
          await supabase.from("client_report_notifications")
            .update({ status: "failed", error_message: msg })
            .eq("client_id", c.id).eq("period_key", periodKey).eq("notification_type", type).eq("channel", channel);
          results.push({ client: c.name, channel, error: msg });
        }
      }
    }

    return json({ ok: true, checked: list.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return json({ error: msg }, 500);
  }
});
