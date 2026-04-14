-- ============================================================
-- Cấp quyền SELECT bảng thu_chi cho driver portal
-- (anon key cần đọc chi phí theo tài xế để hiện thống kê tháng)
-- ============================================================

-- Bật RLS nếu chưa bật
ALTER TABLE thu_chi ENABLE ROW LEVEL SECURITY;

-- Policy: anon được SELECT các khoản chi theo tài xế
-- (chỉ đọc, không write)
CREATE POLICY "anon_select_thu_chi"
  ON thu_chi
  FOR SELECT
  TO anon
  USING (true);

-- Nếu muốn hạn chế hơn (chỉ cho đọc cột cần thiết),
-- có thể dùng column-level security hoặc tạo view riêng.
-- Hiện tại USING (true) = cho phép đọc tất cả rows.
-- ============================================================
