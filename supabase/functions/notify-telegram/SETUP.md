# Hướng dẫn cài đặt Telegram Bot Notification
## Nam Khang Transport — Cấp 3: Push thông báo qua Telegram

---

## Bước 1 — Tạo Telegram Bot

1. Mở Telegram, tìm **@BotFather**
2. Gửi lệnh `/newbot`
3. Đặt tên bot: ví dụ `Nam Khang Transport`
4. Đặt username bot: ví dụ `namkhang_transport_bot`
5. BotFather sẽ trả về **Bot Token** dạng: `7123456789:AAxxxxxxxxxxxxxxxxxxxxxx`
   → **Copy và lưu lại token này**

---

## Bước 2 — Lấy Chat ID của admin

**Cách dễ nhất:**
1. Gửi tin nhắn bất kỳ cho bot vừa tạo (ví dụ: `/start`)
2. Mở trình duyệt, truy cập URL sau (thay YOUR_BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Trong kết quả JSON, tìm `"chat":{"id":XXXXXXX}` — số đó là **Chat ID** của bạn
   → **Copy và lưu lại Chat ID**

> Nếu muốn gửi vào **nhóm Telegram**, thêm bot vào nhóm rồi gửi 1 tin nhắn trong nhóm,
> sau đó gọi `getUpdates` — Chat ID của nhóm sẽ là số âm (ví dụ: `-1001234567890`)

---

## Bước 3 — Thêm Secrets vào Supabase

1. Vào **Supabase Dashboard** → Project **Nam Khang Transport**
2. Click **Settings** (bánh răng góc trái) → **Edge Functions** → **Secrets**
3. Thêm 2 secrets:

   | Name | Value |
   |------|-------|
   | `TELEGRAM_BOT_TOKEN` | Token từ Bước 1 |
   | `TELEGRAM_CHAT_ID` | Chat ID từ Bước 2 |

   *(Tùy chọn bảo mật)*
   | `WEBHOOK_SECRET` | Một chuỗi bí mật bất kỳ, ví dụ: `nkt_secret_2024` |

---

## Bước 4 — Deploy Edge Function

### Cách A — Dùng Supabase Dashboard (không cần cài gì)

1. Vào **Supabase Dashboard** → **Edge Functions** (icon tia sét ở sidebar trái)
2. Click **"New Function"**
3. Đặt tên: `notify-telegram`
4. Chọn **"Write function"** → paste toàn bộ nội dung file `index.ts` vào editor
5. Click **Deploy**
6. Sau deploy, copy **Function URL** (dạng `https://xxxx.supabase.co/functions/v1/notify-telegram`)

### Cách B — Dùng Supabase CLI (nếu đã cài CLI)

```bash
# Từ thư mục NK_WebApp/
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy notify-telegram
```

---

## Bước 5 — Tạo Database Webhook

1. Vào **Supabase Dashboard** → **Database** → **Database Webhooks**
2. Click **"Create a new hook"**
3. Điền thông tin:

   | Field | Value |
   |-------|-------|
   | **Name** | `on_bao_cao_insert` |
   | **Table** | `bao_cao` |
   | **Events** | ✅ `INSERT` |
   | **Type** | `HTTP Request` |
   | **Method** | `POST` |
   | **URL** | Function URL từ Bước 4 |

4. *(Nếu đã cấu hình WEBHOOK_SECRET)* Thêm header:
   - Header name: `x-webhook-secret`
   - Header value: chuỗi secret bạn đặt ở Bước 3

5. Click **Confirm** để lưu

---

## Bước 6 — Test thử

Từ Supabase Dashboard → **Table Editor** → **bao_cao** → **Insert row** với dữ liệu:
```json
{
  "loai": "su_co",
  "tai_xe_ten": "Test Tài Xế",
  "bien_xe": "51B-123.45",
  "hd_so": "HD-TEST-001",
  "ghi_chu": "Thử nghiệm thông báo Telegram"
}
```

→ Telegram của admin sẽ nhận được tin nhắn ngay lập tức! 🎉

---

## Tin nhắn mẫu nhận được

```
🔔 Báo cáo mới — Nam Khang Transport

👤 Nguyễn Văn A
🚌 Xe: 51B-123.45
📋 HĐ: HD-2024-001
📌 ⚠️ Sự cố
💬 Xe bị thủng bánh tại Km 45 QL1A
📍 Xem vị trí

⏰ 14/04/2026, 10:35:22
```
