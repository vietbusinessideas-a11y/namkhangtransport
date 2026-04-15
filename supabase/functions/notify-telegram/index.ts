// ══════════════════════════════════════════════════════════════
// Nam Khang Transport — Supabase Edge Function
// Tên function : notify-telegram
// Trigger      : Database Webhook → bao_cao INSERT
// Mục đích     : Gửi tin nhắn Telegram khi tài xế nộp báo cáo
// ══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── Secrets (cấu hình trong Supabase Dashboard → Settings → Secrets) ──────────
const BOT_TOKEN  = Deno.env.get("TELEGRAM_BOT_TOKEN")  ?? "";
const CHAT_ID    = Deno.env.get("TELEGRAM_CHAT_ID")    ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")  ?? "";   // tùy chọn bảo mật

// ── Label tiếng Việt cho từng loại báo cáo ───────────────────────────────────
const LOAI_LABEL: Record<string, string> = {
  do_dau       : "⛽ Đổ dầu",
  km_dau       : "🔢 Km đầu chuyến",
  km_cuoi      : "🏁 Km cuối chuyến",
  hoan_thanh   : "✅ Hoàn thành chuyến",
  su_co        : "⚠️ Sự cố",
  bao_cao_khac : "📄 Báo cáo khác",
  hop_dong     : "📋 Thông tin hợp đồng",
  hanh_khach   : "👥 Hành khách",
};

// ── Handler chính ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Kiểm tra secret header nếu có cấu hình
  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("x-webhook-secret") ?? "";
    if (sig !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Chỉ nhận POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Supabase Database Webhook gửi payload: { type, table, schema, record, old_record }
  const row = (body.record ?? body) as Record<string, unknown>;
  if (!row) return new Response("no record", { status: 200 });

  // ── Xây dựng tin nhắn Telegram ────────────────────────────────────────────
  const ten     = (row.tai_xe_ten as string) || (row.tai_xe_sdt as string) || "Tài xế";
  const loai    = LOAI_LABEL[row.loai as string] ?? `📌 ${row.loai}`;
  const bien    = row.bien_xe  ? `\n🚌 *Xe:* ${row.bien_xe}`   : "";
  const hdso    = row.hd_so    ? `\n📋 *HĐ:* ${row.hd_so}`    : "";
  const sdt     = row.tai_xe_sdt ? `\n📞 ${row.tai_xe_sdt}`   : "";
  const ghiChu  = row.ghi_chu  ? `\n💬 _${row.ghi_chu}_`      : "";
  const soAnh   = Array.isArray(row.anh_urls) && row.anh_urls.length > 0
                    ? `\n📸 ${row.anh_urls.length} ảnh đính kèm`
                    : "";
  const soKm    = row.so_km    ? `\n🔢 Số Km: ${row.so_km}`   : "";
  const gps     = row.gps_lat
                    ? `\n📍 [Xem vị trí](https://maps.google.com/?q=${row.gps_lat},${row.gps_lng})`
                    : "";

  const now = new Date().toLocaleString("vi-VN", {
    timeZone : "Asia/Ho_Chi_Minh",
    hour12   : false,
  });

  const text =
    `🔔 *Báo cáo mới — Nam Khang Transport*\n\n`
  + `👤 *${ten}*${sdt}${bien}${hdso}\n`
  + `📌 ${loai}${soKm}${ghiChu}${soAnh}${gps}\n\n`
  + `⏰ ${now}`;

  // ── Gửi tin nhắn Telegram ─────────────────────────────────────────────────
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[notify-telegram] Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID");
    return new Response("Missing config", { status: 500 });
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({
          chat_id                  : CHAT_ID,
          text,
          parse_mode               : "Markdown",
          disable_web_page_preview : true,
        }),
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error("[notify-telegram] Telegram API lỗi:", tgData);
      return new Response(JSON.stringify(tgData), { status: 502 });
    }

    console.log("[notify-telegram] ✅ Đã gửi:", tgData.result?.message_id);
    return new Response(JSON.stringify({ ok: true }), {
      status  : 200,
      headers : { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[notify-telegram] Fetch lỗi:", err);
    return new Response(String(err), { status: 500 });
  }
});
