/**
 * Vercel Serverless Function: /api/config
 * Trả về Supabase credentials từ Environment Variables,
 * không để lộ key trong source code frontend.
 *
 * Cài đặt trên Vercel Dashboard:
 *   Settings → Environment Variables → thêm:
 *     SUPABASE_URL       = https://xxx.supabase.co
 *     SUPABASE_ANON_KEY  = eyJhbGci...
 */
export default function handler(req, res) {
  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Nếu chưa cấu hình env vars → trả 503
    return res.status(503).json({ error: 'Server chưa được cấu hình. Liên hệ quản trị viên.' });
  }

  // Không cache — mỗi lần gọi đều lấy giá trị mới nhất
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.status(200).json({ url, key });
}
