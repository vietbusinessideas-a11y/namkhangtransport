/**
 * MIGRATION SCRIPT — Đổi số hợp đồng HD-YYMMDDHH → HD-YYMMDDXX
 * ─────────────────────────────────────────────────────────────────
 * CÁCH CHẠY:
 *   1. Mở trình duyệt, đăng nhập vào trang Admin (index.html)
 *   2. Mở DevTools → Console (F12 hoặc Cmd+Option+J)
 *   3. Copy toàn bộ nội dung script này, paste vào Console, Enter
 *   4. Chờ xem kết quả — script tự log từng bước
 * ─────────────────────────────────────────────────────────────────
 */

(async function migrateHDSo() {
  console.log('═══════════════════════════════════════════');
  console.log('  MIGRATION: HD-YYMMDDHH → HD-YYMMDDXX');
  console.log('═══════════════════════════════════════════');

  // ── 1. Lấy credentials từ app đang chạy ──────────────────────
  if (typeof SB_URL === 'undefined' || !SB_URL) {
    console.error('❌ Không tìm thấy SB_URL — hãy chạy script này khi đang mở trang Admin.');
    return;
  }
  const H = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // ── 2. Fetch toàn bộ hợp đồng ────────────────────────────────
  console.log('📥 Đang tải danh sách hợp đồng...');
  let allHD = [];
  try {
    const r = await fetch(SB_URL + '/rest/v1/hop_dong?select=id,so,ngay,ngay_di,created_at&order=created_at.asc&limit=10000', { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + await r.text());
    allHD = await r.json();
  } catch (e) {
    console.error('❌ Lỗi tải dữ liệu:', e.message);
    return;
  }
  console.log(`✅ Tải được ${allHD.length} hợp đồng.`);

  // ── 3. Lọc các HĐ có số theo định dạng cũ: HD-\d{8} ─────────
  //    Định dạng cũ: HD-YYMMDDHH  (8 ký tự số, 2 cuối là giờ 00-23)
  //    Cần phân biệt với HĐ nhập tay tự do
  const oldPattern = /^HD-\d{8}$/;
  const toMigrate = allHD.filter(h => h.so && oldPattern.test(h.so));
  console.log(`🔍 Số HĐ cần đổi (khớp HD-\\d{8}): ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log('✨ Không có hợp đồng nào cần migrate.');
    return;
  }

  // ── 4. Nhóm theo YYMMDD (6 ký tự sau "HD-") ──────────────────
  //    và sắp xếp trong nhóm theo created_at (tức là thứ tự nhập)
  const groups = {};
  toMigrate.forEach(h => {
    const dayKey = h.so.slice(3, 9); // "YYMMDD"
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(h);
  });

  // Sắp xếp mỗi nhóm: ưu tiên created_at, fallback theo số cũ (giờ tăng dần)
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => {
      const ca = a.created_at || a.so;
      const cb = b.created_at || b.so;
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
  });

  // ── 5. Tạo mapping: id → số mới ──────────────────────────────
  const mapping = []; // [{id, soCu, soMoi}]
  const dayKeys = Object.keys(groups).sort();

  dayKeys.forEach(dayKey => {
    const list = groups[dayKey];
    list.forEach((h, idx) => {
      const xx = String(idx + 1).padStart(2, '0');
      const soMoi = 'HD-' + dayKey + xx;
      if (soMoi !== h.so) {
        mapping.push({ id: h.id, soCu: h.so, soMoi });
      }
    });
  });

  console.log(`\n📋 Preview mapping (${mapping.length} thay đổi):`);
  mapping.forEach(m => console.log(`   ${m.soCu}  →  ${m.soMoi}  (id: ${m.id})`));

  if (mapping.length === 0) {
    console.log('✨ Tất cả số HĐ đã đúng định dạng mới, không cần đổi.');
    return;
  }

  // ── 6. Xác nhận trước khi PATCH ──────────────────────────────
  const go = confirm(
    `Sắp cập nhật ${mapping.length} số hợp đồng trên Supabase.\n\n` +
    `Xem chi tiết trong Console.\n\nTiếp tục không?`
  );
  if (!go) { console.log('⏸ Huỷ bởi người dùng.'); return; }

  // ── 7. PATCH từng hợp đồng ────────────────────────────────────
  console.log('\n🔄 Đang cập nhật...');
  let ok = 0, fail = 0;
  for (const m of mapping) {
    try {
      const r = await fetch(SB_URL + '/rest/v1/hop_dong?id=eq.' + m.id, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ so: m.soMoi }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + await r.text());
      console.log(`   ✅ ${m.soCu} → ${m.soMoi}`);
      ok++;
    } catch (e) {
      console.error(`   ❌ ${m.soCu} — Lỗi: ${e.message}`);
      fail++;
    }
    // Delay nhỏ để không spam API
    await new Promise(res => setTimeout(res, 80));
  }

  // ── 8. Kết quả ───────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`  XONG: ✅ ${ok} thành công  |  ❌ ${fail} thất bại`);
  console.log('═══════════════════════════════════════════');

  if (ok > 0) {
    console.log('🔄 Đang reload dữ liệu...');
    if (typeof loadDB === 'function') {
      await loadDB();
      if (typeof renderHD === 'function') renderHD();
      if (typeof renderDashboard === 'function') renderDashboard();
      console.log('✨ Giao diện đã được làm mới!');
    }
  }
})();
