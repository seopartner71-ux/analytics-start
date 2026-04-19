// Edge Function: bank-tochka
// Универсальный обработчик OAuth + синхронизации для банка Точка
// Действия: get_auth_url | exchange_code | sync | disconnect

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOCHKA_AUTH_URL = "https://enter.tochka.com/connect/authorize";
const TOCHKA_TOKEN_URL = "https://enter.tochka.com/connect/token";
const TOCHKA_API_BASE = "https://enter.tochka.com/uapi";
const SCOPES = "accounts statements balances";

interface RequestBody {
  action: "get_auth_url" | "exchange_code" | "sync" | "disconnect";
  integration_id?: string;
  code?: string;
  redirect_uri?: string;
  state?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Аутентификация ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // --- Service-role клиент для записи токенов ---
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as RequestBody;
    const action = body.action;

    let clientId = Deno.env.get("TOCHKA_CLIENT_ID") ?? "";
    let clientSecret = Deno.env.get("TOCHKA_CLIENT_SECRET") ?? "";

    // Fallback: значения из admin app_settings
    if (!clientId || !clientSecret) {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ["tochka_client_id", "tochka_client_secret"]);
      for (const s of settings ?? []) {
        if (s.key === "tochka_client_id" && !clientId) clientId = s.value;
        if (s.key === "tochka_client_secret" && !clientSecret) clientSecret = s.value;
      }
    }

    // --- get_auth_url: формирует ссылку на OAuth ---
    if (action === "get_auth_url") {
      if (!clientId) return json({ error: "TOCHKA_CLIENT_ID не настроен" }, 400);
      const redirectUri = body.redirect_uri ?? "";
      const state = body.state ?? userId;
      const url = new URL(TOCHKA_AUTH_URL);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      return json({ auth_url: url.toString() });
    }

    // --- exchange_code: обмен кода на токены и создание интеграции ---
    if (action === "exchange_code") {
      if (!clientId || !clientSecret) {
        return json({ error: "TOCHKA_CLIENT_ID/SECRET не настроены" }, 400);
      }
      if (!body.code || !body.redirect_uri) {
        return json({ error: "code и redirect_uri обязательны" }, 400);
      }

      const tokenRes = await fetch(TOCHKA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: body.code,
          redirect_uri: body.redirect_uri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Tochka token error", tokenData);
        return json({ error: "Не удалось получить токен Точки", details: tokenData }, 400);
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);
      const { data: integration, error: insErr } = await supabase
        .from("bank_integrations")
        .insert({
          owner_id: userId,
          provider: "tochka",
          display_name: "Точка Банк",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          expires_at: expiresAt.toISOString(),
          status: "active",
          last_sync_at: null,
        })
        .select()
        .single();

      if (insErr) {
        console.error("Insert integration error", insErr);
        return json({ error: insErr.message }, 500);
      }

      return json({ integration_id: integration.id, success: true });
    }

    // --- sync: подтянуть счета и операции за последние 30 дней ---
    if (action === "sync") {
      if (!body.integration_id) return json({ error: "integration_id обязателен" }, 400);

      const { data: integration, error: intErr } = await supabase
        .from("bank_integrations")
        .select("*")
        .eq("id", body.integration_id)
        .eq("owner_id", userId)
        .maybeSingle();

      if (intErr || !integration) return json({ error: "Интеграция не найдена" }, 404);

      const accessToken = integration.access_token;
      if (!accessToken) return json({ error: "Нет токена. Переподключите банк." }, 400);

      // 1) Список счетов
      const accountsRes = await fetch(`${TOCHKA_API_BASE}/open-banking/v1.0/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!accountsRes.ok) {
        const txt = await accountsRes.text();
        await supabase
          .from("bank_integrations")
          .update({ status: "error", error_message: `accounts: ${accountsRes.status}` })
          .eq("id", integration.id);
        return json({ error: "Tочка API: список счетов недоступен", details: txt }, 502);
      }
      const accountsJson = await accountsRes.json();
      const accountsList: any[] = accountsJson?.Data?.Account ?? [];

      let syncedAccounts = 0;
      let syncedTx = 0;

      for (const acc of accountsList) {
        const accountNumber = acc.accountId ?? acc.AccountId ?? acc.account ?? "";
        if (!accountNumber) continue;

        // Баланс
        let balance = 0;
        try {
          const balRes = await fetch(
            `${TOCHKA_API_BASE}/open-banking/v1.0/accounts/${accountNumber}/balances`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (balRes.ok) {
            const balJson = await balRes.json();
            const balArr = balJson?.Data?.Balance ?? [];
            const interim = balArr.find((b: any) => b.Type === "InterimAvailable") ?? balArr[0];
            balance = parseFloat(interim?.Amount?.amount ?? "0");
          }
        } catch (_) { /* skip */ }

        const { data: accountRow, error: accErr } = await supabase
          .from("bank_accounts")
          .upsert(
            {
              integration_id: integration.id,
              owner_id: userId,
              account_number: accountNumber,
              bank_name: "Точка Банк",
              bik: acc.bankCode ?? acc.bic ?? null,
              currency: acc.currency ?? "RUB",
              balance,
              last_sync_at: new Date().toISOString(),
              meta: acc,
            },
            { onConflict: "integration_id,account_number" },
          )
          .select()
          .single();

        if (accErr) {
          console.error("upsert account error", accErr);
          continue;
        }
        syncedAccounts++;

        // Операции за 30 дней
        const dateTo = new Date().toISOString().slice(0, 10);
        const dateFrom = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        const stmtRes = await fetch(
          `${TOCHKA_API_BASE}/open-banking/v1.0/accounts/${accountNumber}/statements?fromDate=${dateFrom}&toDate=${dateTo}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!stmtRes.ok) continue;
        const stmtJson = await stmtRes.json();
        const transactions: any[] = stmtJson?.Data?.Transaction ?? [];

        for (const tx of transactions) {
          const externalId = tx.transactionId ?? tx.TransactionId ?? `${accountNumber}-${tx.bookingDateTime}-${tx.Amount?.amount}`;
          const direction = (tx.creditDebitIndicator ?? "").toUpperCase() === "CREDIT" ? "in" : "out";
          const amount = Math.abs(parseFloat(tx.Amount?.amount ?? tx.amount ?? "0"));
          const purpose = tx.transactionInformation ?? tx.purpose ?? "";
          const counterparty = direction === "in"
            ? (tx.payerName ?? tx.creditorName ?? "")
            : (tx.receiverName ?? tx.debtorName ?? "");
          const opDate = (tx.bookingDateTime ?? tx.operationDate ?? new Date().toISOString()).slice(0, 10);

          // Простая категоризация
          let category = direction === "in" ? "income" : "other";
          const lower = purpose.toLowerCase();
          if (direction === "out") {
            if (/налог|ндфл|усн|страхов/i.test(lower)) category = "taxes";
            else if (/зарплат|зп|оплата труда/i.test(lower)) category = "salary";
            else if (/реклам|директ|google ads|яндекс/i.test(lower)) category = "ads";
            else category = "expense";
          }

          await supabase
            .from("bank_transactions")
            .upsert(
              {
                account_id: accountRow.id,
                owner_id: userId,
                external_id: externalId,
                operation_date: opDate,
                amount,
                direction,
                counterparty,
                purpose,
                category,
                raw_data: tx,
              },
              { onConflict: "account_id,external_id" },
            );
          syncedTx++;
        }
      }

      await supabase
        .from("bank_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          status: "active",
          error_message: null,
        })
        .eq("id", integration.id);

      return json({ success: true, accounts: syncedAccounts, transactions: syncedTx });
    }

    // --- disconnect ---
    if (action === "disconnect") {
      if (!body.integration_id) return json({ error: "integration_id обязателен" }, 400);
      const { error } = await supabase
        .from("bank_integrations")
        .update({ status: "disconnected", access_token: null, refresh_token: null })
        .eq("id", body.integration_id)
        .eq("owner_id", userId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Неизвестное действие" }, 400);
  } catch (e: any) {
    console.error("bank-tochka error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
