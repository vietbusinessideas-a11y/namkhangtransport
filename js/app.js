// ═══════════════════════════════════════
// SUPABASE — Config load từ /api/config
// ═══════════════════════════════════════
var SB_URL='', SB_KEY='';
var SB_H={};  // Sẽ được khởi tạo sau khi load config

function initSBHeaders(){
  SB_H={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=representation'};
}

async function loadConfig(){
  try{
    var r=await fetch('/api/config');
    if(!r.ok) throw new Error('HTTP '+r.status);
    var cfg=await r.json();
    SB_URL=cfg.url||'';
    SB_KEY=cfg.key||'';
    initSBHeaders();
    return true;
  }catch(e){
    console.warn('Không tải được config — chạy offline mode:',e.message);
    SB_URL='';SB_KEY='';
    return false;
  }
}

function sbFetch(t,p){return fetch(SB_URL+'/rest/v1/'+t+'?'+(p||''),{headers:SB_H}).then(function(r){if(!r.ok)return r.text().then(function(e){throw new Error(r.status+': '+e);});return r.json();});}
function sbPost(t,b){return fetch(SB_URL+'/rest/v1/'+t,{method:'POST',headers:SB_H,body:JSON.stringify(b)}).then(function(r){if(!r.ok)return r.text().then(function(e){throw new Error(r.status+': '+e);});return r.json();});}
function sbPatch(t,id,b){return fetch(SB_URL+'/rest/v1/'+t+'?id=eq.'+id,{method:'PATCH',headers:SB_H,body:JSON.stringify(b)}).then(function(r){if(!r.ok)return r.text().then(function(e){throw new Error(r.status+': '+e);});return r.json();});}
function sbDel(t,id){return fetch(SB_URL+'/rest/v1/'+t+'?id=eq.'+id,{method:'DELETE',headers:SB_H}).then(function(r){if(!r.ok)return r.text().then(function(e){throw new Error(r.status+': '+e);});});}

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
var CURRENT_USER=null;

function initAuth(){
  var raw=null;
  try{raw=localStorage.getItem('nk_session_v3');}catch(e){}
  if(!raw){window.location.replace('/login.html');return false;}
  var s=null;
  try{s=JSON.parse(raw);}catch(e){}
  if(!s||!s.user||!s.exp||Date.now()>s.exp){
    try{localStorage.removeItem('nk_session_v3');}catch(e){}
    window.location.replace('/login.html');
    return false;
  }
  CURRENT_USER=s.user;
  document.getElementById('userName').textContent=CURRENT_USER.name||CURRENT_USER.email||'Người dùng';
  document.getElementById('userAvatar').textContent=CURRENT_USER.initial||((CURRENT_USER.name||CURRENT_USER.email||'U').substring(0,2).toUpperCase());
  document.getElementById('userRole').textContent=isAdmin()?'👑 Admin':'👤 Nhân viên';
  if(isAdmin()){
    // Hiện mục Duyệt BC ngay khi xác nhận là admin
    var navDuyet=document.getElementById('nav-duyet-bc');
    if(navDuyet) navDuyet.style.display='';
  } else {
    var canh=document.querySelector('.nav-item[data-page="caidat"]');
    if(canh&&canh.closest('.nav-section'))canh.closest('.nav-section').remove();
    // Ẩn mục Duyệt BC với non-admin
    var navDuyetHide=document.getElementById('nav-duyet-bc');
    if(navDuyetHide) navDuyetHide.style.display='none';
  }
  return true;
}

function isAdmin(){return !!(CURRENT_USER&&CURRENT_USER.role==='admin');}
function requireAdmin(){if(!isAdmin()){toast('🚫 Bạn không có quyền thực hiện thao tác này','error');return false;}return true;}

// ═══════════════════════════════════════
// DATA & DEFAULTS
// ═══════════════════════════════════════
var DB={hopDong:[],thuChi:[],xe:[],taiXe:[],khachHang:[]};

// Không dùng dữ liệu demo — luôn lấy từ Supabase
var DEFAULT_HD=[];
var DEFAULT_TC=[];
var DEFAULT_XE=[];
var DEFAULT_TX=[];
var DEFAULT_KH=[];

// ═══════════════════════════════════════
// DASHBOARD MONTH STATE
// ═══════════════════════════════════════
var DB_MONTH = (function(){var d=new Date();return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();})();

function prevYM(ym){var mm=parseInt(ym.slice(0,2)),yyyy=parseInt(ym.slice(3));var d=new Date(yyyy,mm-2,1);return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function lastYearYM(ym){return ym.slice(0,3)+(parseInt(ym.slice(3))-1);}
function getMonthTotals(ym){
  // Doanh thu = giá trị HĐ ĐÃ HOÀN THÀNH trong tháng (ghi nhận theo ngày thực hiện)
  var thu=DB.hopDong.filter(function(h){
    return (h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan') && getMY(h.ngay||h.ngay_di||'')===ym;
  }).reduce(function(s,h){return s+h.giatri;},0);
  // Chi phí = các khoản chi ghi nhận trong thu_chi
  var chi=DB.thuChi.filter(function(t){
    return t.type==='chi' && getMY(t.ngay)===ym;
  }).reduce(function(s,t){return s+t.sotien;},0);
  return {thu:thu,chi:chi};
}

function setDBMonth(ym){DB_MONTH=ym;renderDashboard();}
function initDBMonthSel(){
  var sel=document.getElementById('db-month-sel');if(!sel)return;
  var d=new Date();var opts='';
  for(var i=0;i<24;i++){var dd=new Date(d.getFullYear(),d.getMonth()-i,1);var mm=String(dd.getMonth()+1).padStart(2,'0');var yyyy=dd.getFullYear();var ym=mm+'/'+yyyy;opts+='<option value="'+ym+'"'+(ym===DB_MONTH?' selected':'')+'>Tháng '+parseInt(mm)+'/'+yyyy+'</option>';}
  sel.innerHTML=opts;
}

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
function fmt(n){return new Intl.NumberFormat('vi-VN').format(n);}
function fmtM(n){if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return fmt(n);}

function fmtInput(el){
  var raw=el.value.replace(/[^0-9]/g,'');
  if(raw===''){el.value='';return;}
  el.value=new Intl.NumberFormat('vi-VN').format(parseInt(raw));
}
function readMoney(id){
  var raw=(document.getElementById(id).value||'').replace(/[.,\s]/g,'');
  return parseInt(raw)||0;
}
function fmtD(d){if(!d)return'—';var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function getMY(d){if(!d)return'';var p=d.split('-');return p[1]+'/'+p[0];}
function uid(){return'id'+Date.now()+Math.random().toString(36).slice(2,5);}
// Tách "HCM → Vũng Tàu" thành {di:'HCM', den:'Vũng Tàu'}
function parseTuyen(tuyen){
  if(!tuyen) return {di:'',den:''};
  var parts = tuyen.split(/\s*→\s*|\s*->\s*/);
  return {di:(parts[0]||'').trim(), den:(parts[1]||'').trim()};
}
function genHDSo(){
  var n=new Date();
  var yy=String(n.getFullYear()).slice(-2);
  var mm=String(n.getMonth()+1).padStart(2,'0');
  var dd=String(n.getDate()).padStart(2,'0');
  var prefix='HD-'+yy+mm+dd;
  // Tìm số thứ tự lớn nhất trong ngày hôm nay (HD-YYMMDDXX)
  var maxSeq=0;
  (DB.hopDong||[]).forEach(function(h){
    if(h.so&&h.so.startsWith(prefix)){
      var seq=parseInt((h.so+'').slice(-2))||0;
      if(seq>maxSeq) maxSeq=seq;
    }
  });
  var next=Math.min(maxSeq+1,99);
  return prefix+String(next).padStart(2,'0');
}
function pct(a,b){return b?((a-b)/b*100).toFixed(1):'0.0';}
var TTMAP={cho_xe:'<span class="badge b-gray">Chờ thực hiện</span>',dang_chay:'<span class="badge b-blue">Đang thực hiện</span>',hoan_thanh:'<span class="badge b-green">Hoàn thành</span>'};
var LOAIBADGE={'Thu hợp đồng':'b-green','Đặt cọc':'b-green','Thu khác':'b-green','Nhiên liệu':'b-orange','Sửa chữa':'b-red','Lương tài xế':'b-yellow','Cầu đường':'b-gray','Bảo dưỡng':'b-gray','Khác':'b-gray'};
function badgeHTML(loai,type){var cls=LOAIBADGE[loai]||(type==='thu'?'b-green':'b-orange');return'<span class="badge '+cls+'">'+loai+'</span>';}
function toast(msg,type,duration){var wrap=document.getElementById('toastWrap');var t=document.createElement('div');t.className='toast t-'+(type||'info');t.innerHTML=msg;wrap.appendChild(t);requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},400);},duration||3000);}
function showModal(title,sub,body,footer){document.getElementById('modalTitle').textContent=title;document.getElementById('modalSub').textContent=sub;document.getElementById('modalBody').innerHTML=body;document.getElementById('modalFooter').innerHTML=footer;document.getElementById('mainModal').classList.add('show');}
function closeModal(){document.getElementById('mainModal').classList.remove('show');}
function handleModalBg(e){if(e.target===document.getElementById('mainModal'))closeModal();}
var confirmCb=null;
// askConfirm: hộp xác nhận tùy chỉnh (thay thế confirm() native)
function askConfirm(opts,cb){
  var o=typeof opts==='string'?{title:opts}:opts;
  document.getElementById('confirmIcon').textContent  = o.icon||'❓';
  document.getElementById('confirmTitle').textContent = o.title||'Xác nhận';
  document.getElementById('confirmMsg').textContent   = o.msg||'Bạn có chắc muốn thực hiện thao tác này?';
  var btn=document.getElementById('confirmDoBtn');
  btn.textContent=o.btnLabel||'Xác nhận';
  btn.className='btn '+(o.btnClass||'btn-red');
  confirmCb=cb;
  document.getElementById('confirmOverlay').classList.add('show');
}
// askDelete: shortcut cho xóa
function askDelete(title,msg,cb){askConfirm({icon:'🗑️',title:title,msg:msg||'Hành động này không thể hoàn tác.',btnLabel:'Xóa',btnClass:'btn-red'},cb);}
function closeConfirm(){confirmCb=null;document.getElementById('confirmOverlay').classList.remove('show');}
function doConfirm(){if(confirmCb)confirmCb();closeConfirm();}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show');}

// ═══════════════════════════════════════
// LOAD DB
// ═══════════════════════════════════════
function mapHD(r){return{id:r.id,so:r.so_hd||'',kh:r.khach_hang||'',maKH:r.ma_kh||'',tuyen:r.tuyen_duong||'',ngay:r.ngay_th||'',ngay_di:r.ngay_di||'',ngay_ve:r.ngay_ve||'',xe:r.bien_so_xe||'',taixe:r.tai_xe||'',giatri:Number(r.gia_tri)||0,dathu:Number(r.da_thu)||0,tt:r.trang_thai||'cho_xe'};}

function calcDuration(ngay_di,ngay_ve){
  if(!ngay_di) return '';
  if(!ngay_ve||ngay_di===ngay_ve) return 'Trong ngày';
  var d1=new Date(ngay_di),d2=new Date(ngay_ve);
  var nights=Math.round((d2-d1)/864e5);
  if(nights<=0) return 'Trong ngày';
  return (nights+1)+'N'+nights+'D';
}
function mapTC(r){return{id:r.id,type:r.loai_gd||'thu',loai:r.danh_muc||'',ngay:r.ngay_gd||'',gio:r.gio_gd||'00:00',sotien:Number(r.so_tien)||0,hd:r.hd_so||'',hd_id:r.hd_id||null,httt:r.hinh_thuc||'Tiền mặt',xe:r.bien_so_xe||'',taixe:r.tai_xe||'',kh:r.doi_tac||'',mota:r.mo_ta||''};}
function mapXe(r){return{id:r.id,bien:r.bien_so||'',loai:r.loai_xe||'',nam:Number(r.nam_sx)||0,km:Number(r.km_chay)||0,dangKiem:r.han_dk||'',baoHiem:r.han_bh||'',kmThayNhot:r.km_thay_nhot!=null?Number(r.km_thay_nhot):null,dungTichBinh:r.dung_tich_binh!=null?Number(r.dung_tich_binh):null,dinhMuc:r.dinh_muc_l100km!=null?Number(r.dinh_muc_l100km):null,giaDauTK:r.gia_dau_tk!=null?Number(r.gia_dau_tk):null,tt:r.trang_thai||'san_sang'};}
function mapTX(r){return{id:r.id,ten:r.ho_ten||'',cmnd:r.cmnd||'',bangLai:r.bang_lai||'',ngaySinh:r.ngay_sinh||'',sdt:r.so_dt||'',luong:Number(r.luong_cb)||0,chuyen:0,doanhThu:0};}
function mapKH(r){return{id:r.id,maKH:r.ma_kh||'',ten:r.ten||'',loai:r.loai||'',sdt:r.so_dt||'',diaChi:r.dia_chi||'',hdCount:0,doanhSo:0};}
// Sinh mã KH tiếp theo: KH-001, KH-002, ...
function genMaKH(){
  var max=0;
  DB.khachHang.forEach(function(k){
    var m=(k.maKH||'').match(/^KH-(\d+)$/);
    if(m){var n=parseInt(m[1],10);if(n>max)max=n;}
  });
  return 'KH-'+String(max+1).padStart(3,'0');
}
// Khi gõ/chọn mã KH trong form HĐ → tự điền tên + xóa cảnh báo
function fillKHFromCode(val){
  var code=(val||'').trim().toUpperCase();
  var kh=DB.khachHang.find(function(k){return (k.maKH||'').toUpperCase()===code;});
  var fKh=document.getElementById('f-kh');
  if(!fKh) return;
  if(kh){
    fKh.value=kh.ten;
    fKh.style.borderColor='';
    var hint=document.getElementById('kh-sync-hint'); if(hint) hint.textContent='';
  } else if(code){
    // Mã gõ nhưng chưa khớp → không xóa tên cũ, chỉ cảnh báo nhẹ
    var hint=document.getElementById('kh-sync-hint');
    if(hint) hint.textContent='';
  }
}
// Khi gõ/chọn tên KH trong form HĐ → tự điền mã + kiểm tra đồng bộ
function fillCodeFromKH(val){
  var name=(val||'').trim();
  var kh=DB.khachHang.find(function(k){return k.ten===name;});
  var elCode=document.getElementById('f-ma-kh-hd');
  var hint=document.getElementById('kh-sync-hint');
  if(!elCode) return;
  if(kh){
    elCode.value=kh.maKH||'';
    elCode.style.borderColor='';
    if(hint) hint.textContent='';
  } else if(name){
    // Tên chưa có trong DB → xóa mã, hiện gợi ý
    elCode.value='';
    if(hint) hint.textContent='⚠️ Khách hàng chưa có trong danh sách, hãy thêm mới trước.';
  } else {
    elCode.value='';
    if(hint) hint.textContent='';
  }
}
// Kiểm tra mã và tên có khớp không — gọi trước khi lưu
function validateKHSync(){
  var code=(document.getElementById('f-ma-kh-hd')||{}).value||'';
  var name=((document.getElementById('f-kh')||{}).value||'').trim();
  if(!code || !name) return true; // một trong hai trống → ok, validate bắt buộc ở saveHD
  var kh=DB.khachHang.find(function(k){return (k.maKH||'').toUpperCase()===code.trim().toUpperCase();});
  if(kh && kh.ten!==name){
    var hint=document.getElementById('kh-sync-hint');
    if(hint) hint.textContent='⚠️ Mã '+code+' thuộc "'+kh.ten+'", không khớp tên đã nhập. Vui lòng kiểm tra lại.';
    (document.getElementById('f-ma-kh-hd')||{style:{}}).style.borderColor='#ef4444';
    (document.getElementById('f-kh')||{style:{}}).style.borderColor='#ef4444';
    return false;
  }
  return true;
}

// ─── Helper: tìm các HĐ thuộc về một KH ─────────────────────────────────────
// Ưu tiên so khớp theo mã (bất biến), fallback theo tên (hỗ trợ dữ liệu cũ chưa có mã)
function hdCuaKH(k) {
  if (k.maKH) {
    // Có mã → dùng mã là chính; nếu HĐ chưa có mã thì fallback tên
    return DB.hopDong.filter(function(h){
      return h.maKH ? h.maKH === k.maKH : h.kh === k.ten;
    });
  }
  // KH chưa có mã → dùng tên
  return DB.hopDong.filter(function(h){ return h.kh === k.ten; });
}

// ── Tự động chuyển CHỜ THỰC HIỆN → ĐANG CHẠY khi đến ngày khởi hành ──────────
function autoTransitionHD(){
  var todayStr=new Date().toISOString().slice(0,10);
  var toActivate=DB.hopDong.filter(function(h){
    var startDate=h.ngay_di||h.ngay; // ưu tiên ngày_di, fallback ngày_th
    return h.tt==='cho_xe' && startDate && startDate<=todayStr;
  });
  if(!toActivate.length) return Promise.resolve();
  var patches=toActivate.map(function(h){
    return sbPatch('hop_dong',h.id,{trang_thai:'dang_chay'}).then(function(){
      h.tt='dang_chay';
    }).catch(function(err){
      console.warn('[NK] autoTransition lỗi HD',h.so,':',err.message);
    });
  });
  return Promise.all(patches).then(function(){
    var n=toActivate.length;
    console.log('[NK] autoTransition: đã chuyển',n,'HĐ → dang_chay');
    if(n) toast('🚌 '+n+' hợp đồng tự động chuyển sang Đang chạy','info');
  });
}

// ─── Overlay cảnh báo HĐ quá hạn — tách biệt, không bị đóng khi xem chi tiết HĐ ─
function showOverdueAdmin(title, sub, body, footer){
  var el = document.getElementById('overdue-admin-modal');
  if(!el) return;
  document.getElementById('overdue-modal-title').textContent = title;
  document.getElementById('overdue-modal-sub').textContent = sub;
  document.getElementById('overdue-modal-body').innerHTML = body;
  document.getElementById('overdue-modal-footer').innerHTML = footer;
  el.style.display = 'flex';
}
function closeOverdueAdmin(){
  var el = document.getElementById('overdue-admin-modal');
  if(el) el.style.display = 'none';
}

// ─── Kiểm tra HĐ quá hạn chưa báo cáo hoàn thành → cảnh báo admin ─────────
async function checkOverdueHDAdmin(){
  if(!SB_URL || !SB_KEY) return;
  var todayStr = new Date().toISOString().slice(0,10);

  // Lọc HĐ đang chạy mà ngày về đã qua
  var candidates = DB.hopDong.filter(function(h){
    return h.tt === 'dang_chay' && h.ngay_ve && h.ngay_ve < todayStr;
  });
  if(!candidates.length) return;

  // Với mỗi HĐ, kiểm tra xem đã có báo cáo hoan_thanh chưa
  var overdue = [];
  for(var i = 0; i < candidates.length; i++){
    var h = candidates[i];
    try{
      var rows = await sbFetch('bao_cao',
        'hd_so=eq.'+encodeURIComponent(h.so)+'&loai=eq.hoan_thanh&select=id&limit=1');
      if(!rows || !rows.length) overdue.push(h); // chưa có báo cáo hoàn thành
    } catch(e){
      overdue.push(h); // không check được → cũng đưa vào danh sách
    }
  }
  if(!overdue.length) return;

  // Build danh sách HTML
  // onclick chỉ gọi openHDDetail — KHÔNG closeModal() để overlay này vẫn còn sau khi đóng chi tiết HĐ
  var rows = overdue.map(function(h){
    var daysPast = Math.round((new Date(todayStr) - new Date(h.ngay_ve)) / 864e5);
    var pastLabel = daysPast === 1 ? '1 ngày' : daysPast + ' ngày';
    return '<tr onclick="openHDDetail(\''+h.id+'\')" '
      +'style="cursor:pointer" title="Xem chi tiết">'
      +'<td><span class="mono" style="color:var(--blue);font-weight:700">'+h.so+'</span></td>'
      +'<td style="font-weight:500">'+h.kh+'</td>'
      +'<td style="color:var(--text2);font-size:.78rem">'+h.tuyen+'</td>'
      +'<td style="font-size:.78rem">'+fmtD(h.ngay_di||h.ngay||'')+'</td>'
      +'<td style="font-size:.78rem">'+fmtD(h.ngay_ve)+'</td>'
      +'<td style="color:var(--red);font-weight:700">+'+pastLabel+'</td>'
      +'<td style="font-size:.78rem;color:var(--text3)">'+( h.taixe||'—')+'</td>'
      +'</tr>';
  }).join('');

  var body = '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;'
    +'padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start">'
    +'<span style="font-size:1.6rem;line-height:1">⚠️</span>'
    +'<div>'
    +'<div style="font-weight:700;color:#991b1b;margin-bottom:4px">'
    +overdue.length+' hợp đồng quá ngày về — tài xế chưa báo cáo hoàn thành</div>'
    +'<div style="font-size:.78rem;color:#b91c1c">Bấm vào từng hợp đồng để xem chi tiết và liên hệ tài xế.</div>'
    +'</div></div>'
    +'<div class="table-wrap"><table class="dt" style="min-width:580px">'
    +'<thead><tr>'
    +'<th>Số HĐ</th><th>Khách hàng</th><th>Tuyến đường</th>'
    +'<th>Ngày đi</th><th>Ngày về</th><th>Quá hạn</th><th>Tài xế</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'</table></div>';

  showOverdueAdmin(
    '🚨 Cảnh báo hợp đồng quá hạn',
    'Phát hiện lúc đăng nhập · ' + new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}),
    body,
    '<button class="btn btn-ghost" onclick="closeOverdueAdmin()">Đã biết, đóng lại</button>'
  );
}

function loadDB(){
  DB={hopDong:DEFAULT_HD.slice(),thuChi:DEFAULT_TC.slice(),xe:DEFAULT_XE.slice(),taiXe:DEFAULT_TX.slice(),khachHang:DEFAULT_KH.slice()};
  updateBadges();
  renderCurrentPage();

  Promise.all([
    sbFetch('hop_dong','order=id.desc'),
    sbFetch('thu_chi','order=id.desc'),
    sbFetch('xe','order=id.asc'),
    sbFetch('tai_xe','order=id.asc'),
    sbFetch('khach_hang','order=id.asc'),
  ]).then(function(results){
    var hd=results[0],tc=results[1],xe=results[2],tx=results[3],kh=results[4];
    console.log('SB OK:',{hd:hd.length,tc:tc.length,xe:xe.length,tx:tx.length,kh:kh.length});
    if(hd.length) DB.hopDong=hd.map(mapHD);
    if(tc.length) DB.thuChi=tc.map(mapTC);
    if(xe.length) DB.xe=xe.map(mapXe);
    if(tx.length) DB.taiXe=tx.map(mapTX);
    if(kh.length) DB.khachHang=kh.map(mapKH);
    toast('☁️ Dữ liệu từ Supabase','success');
    autoTransitionHD().then(function(){
      updateBadges();
      renderCurrentPage();
      checkOverdueHDAdmin();  // Kiểm tra HĐ quá hạn chưa báo cáo hoàn thành
      checkPendingBaoCao();   // Kiểm tra báo cáo tài xế chờ duyệt
    });
  }).catch(function(err){
    console.error('SB ERR:',err.message);
    toast('📦 Dùng dữ liệu mẫu ('+err.message+')','info');
  });
}

// ═══════════════════════════════════════
// NAV
// ═══════════════════════════════════════
var currentPage='dashboard';
// ── Navigation History (nút Back) ────────────────────────────────────────────
var NAV_HISTORY = [];

function _snapNavState(){
  return {
    page:       currentPage,
    hdTT:       (document.getElementById('hd-filter-tt')    ||{}).value||'',
    hdMonth:    (document.getElementById('hd-filter-month') ||{}).value||'',
    hdSearch:   (document.getElementById('hd-search')       ||{}).value||'',
    tcMonth:    (document.getElementById('tc-month')        ||{}).value||'',
    tcTab:      tcTab||'all'
  };
}
function _updateBackBtn(){
  var btn=document.getElementById('back-btn');
  if(btn) btn.style.display = NAV_HISTORY.length > 0 ? 'flex' : 'none';
}
function goBack(){
  if(!NAV_HISTORY.length) return;
  var prev=NAV_HISTORY.pop();
  // Khôi phục filters trước khi render
  var elTT=document.getElementById('hd-filter-tt');
  var elMo=document.getElementById('hd-filter-month');
  var elQ =document.getElementById('hd-search');
  if(elTT) elTT.value = prev.hdTT||'';
  if(elMo) elMo.value = prev.hdMonth||'';
  if(elQ)  elQ.value  = prev.hdSearch||'';
  var elTCM=document.getElementById('tc-month');
  if(elTCM&&prev.tcMonth) elTCM.value=prev.tcMonth;
  if(prev.tcTab) tcTab=prev.tcTab;
  _navInternal(prev.page);
  _updateBackBtn();
}
// navTo nội bộ — KHÔNG đẩy history (dùng trong goBack và lần đầu load)
function _navInternal(page){
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===page);});
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var pg=document.getElementById('page-'+page); if(pg)pg.classList.add('active');
  currentPage=page;
  var m=PAGE_META[page]||{title:page,sub:'',actions:function(){return'';}};
  document.getElementById('pageTitle').textContent=m.title;
  document.getElementById('pageSub').textContent=m.sub;
  document.getElementById('topbarActions').innerHTML=m.actions();
  if(window.innerWidth<768)closeSidebar();
  renderCurrentPage();
}

var PAGE_META={
  dashboard:{title:'Dashboard',sub:'',actions:function(){return'';}},
  hopdong:{title:'Hợp đồng',sub:'Quản lý hợp đồng vận chuyển',actions:function(){return(isAdmin()?'<button class="btn btn-accent" onclick="openHDModal()">＋ Thêm hợp đồng</button>':'')+'<button class="btn btn-ghost btn-sm" onclick="exportHD()">📥 Xuất Excel</button>';}},
  khachhang:{title:'Khách hàng',sub:'Danh sách đối tác',actions:function(){return(isAdmin()?'<button class="btn btn-accent" onclick="openKHModal()">＋ Thêm KH</button>':'')+'<button class="btn btn-ghost btn-sm" onclick="exportKH()">📥 Xuất Excel</button>';}},
  xe:{title:'Xe & Tài xế',sub:'Quản lý phương tiện',actions:function(){return(isAdmin()?'<button class="btn btn-accent" onclick="xeTab===\'xe\'?openXeModal():openTXModal()">＋ Thêm mới</button>':'')+'<button class="btn btn-ghost btn-sm" onclick="exportExcel()">📥 Xuất Excel</button>';}},
  thuchi:{title:'Thu Chi',sub:'Ghi nhận doanh thu & chi phí',actions:function(){return'<button class="btn btn-green" onclick="openTCModal(\'thu\')">＋ Ghi thu</button><button class="btn btn-red" onclick="openTCModal(\'chi\')">＋ Ghi chi</button><button class="btn btn-ghost btn-sm" onclick="chotLuongThang()" title="Tạo phiếu chi lương hàng loạt cho tài xế">💰 Chốt lương</button><button class="btn btn-ghost btn-sm" onclick="exportTC()">📥 Xuất Excel</button>';}},
  baocao:{title:'Báo cáo & Thống kê',sub:'Phân tích tài chính',actions:function(){return'';}},
  caidat:{title:'Cài đặt',sub:'Thông tin hệ thống',actions:function(){return'';}},
};
function navTo(page){
  // Chỉ push history khi thực sự đổi trang (tránh duplicate khi click cùng menu item)
  if(page !== currentPage){
    NAV_HISTORY.push(_snapNavState());
    // Giới hạn stack 20 bước để tránh memory leak
    if(NAV_HISTORY.length > 20) NAV_HISTORY.shift();
  }
  _navInternal(page);
  _updateBackBtn();
}
function renderCurrentPage(){
  populateHDMonthFilter(); // Cập nhật dropdown tháng mỗi khi data thay đổi
  var fns={dashboard:renderDashboard,hopdong:renderHD,khachhang:renderKH,xe:renderXe,thuchi:renderTCAll,baocao:renderBC,'duyet-bc':renderDuyetBC,caidat:loadCaiDat};
  if(fns[currentPage])fns[currentPage]();
}
// Điều hướng đến trang HĐ và set filter trạng thái
// Luôn push history kể cả khi đã ở trang hopdong (vì filter thay đổi = "bước mới")
function navToHD(tt){
  NAV_HISTORY.push(_snapNavState());
  if(NAV_HISTORY.length > 20) NAV_HISTORY.shift();
  var sel=document.getElementById('hd-filter-tt');
  if(sel) sel.value = tt||'';
  PAGES.hd=1;
  _navInternal('hopdong');
  _updateBackBtn();
}
function navToTC(ym, type){
  NAV_HISTORY.push(_snapNavState());
  if(NAV_HISTORY.length > 20) NAV_HISTORY.shift();
  // Populate tc-month options if not already present, then set value
  var sel=document.getElementById('tc-month');
  if(sel){
    var found=false;
    for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===ym){found=true;break;}}
    if(!found){var opt=document.createElement('option');opt.value=ym;opt.textContent='Tháng '+ym;sel.add(opt,1);}
    sel.value=ym;
    var dr=document.getElementById('tc-date-range');if(dr)dr.style.display='none';
  }
  tcTab=type||'all';
  PAGES.tc=1;
  _navInternal('thuchi');
  // Activate the correct tab button after rendering
  setTimeout(function(){
    document.querySelectorAll('#page-thuchi .tab').forEach(function(b){
      b.classList.remove('active');
      if(b.getAttribute('onclick')&&b.getAttribute('onclick').indexOf("'"+tcTab+"'")>-1)b.classList.add('active');
    });
    renderTCAll();
  },50);
  _updateBackBtn();
}
function updateBadges(){
  var active=DB.hopDong.filter(function(h){return h.tt!=='hoan_thanh';}).length;
  document.getElementById('hdBadge').textContent=active;
  document.getElementById('hdBadge').style.display=active?'':'none';
  var cxe=document.getElementById('count-xe');
  var ctx=document.getElementById('count-tx');
  if(cxe)cxe.textContent=DB.xe.length;
  if(ctx)ctx.textContent=DB.taiXe.length;
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
function renderDashboard(){
  initDBMonthSel();
  var ym=DB_MONTH;
  var mm=parseInt(ym.slice(0,2)),yyyy=parseInt(ym.slice(3));
  // Cập nhật sub title
  document.getElementById('pageSub').textContent='Tháng '+mm+'/'+yyyy;

  // Totals
  var cur=getMonthTotals(ym);
  var ymPrev=prevYM(ym); var prev=getMonthTotals(ymPrev);
  var ymLY=lastYearYM(ym); var ly=getMonthTotals(ymLY);
  var lnCur=cur.thu-cur.chi, lnPrev=prev.thu-prev.chi, lnLY=ly.thu-ly.chi;

  // Tìm tháng cao nhất / thấp nhất — dùng cùng logic getMonthTotals (HĐ hoàn thành)
  var allYms={};
  // Thu thập tất cả các tháng có dữ liệu (từ HĐ hoàn thành + thu_chi)
  DB.hopDong.forEach(function(h){if(h.tt!=='hoan_thanh')return;var m=getMY(h.ngay||h.ngay_di||'');if(m)allYms[m]=1;});
  DB.thuChi.forEach(function(t){var m=getMY(t.ngay);if(m)allYms[m]=1;});
  var otherVals=Object.keys(allYms).filter(function(k){return k!==ym;}).map(function(k){return getMonthTotals(k);});
  var maxThu=otherVals.length?Math.max.apply(null,otherVals.map(function(v){return v.thu;})):0;
  var minThu=otherVals.filter(function(v){return v.thu>0;}).length?Math.min.apply(null,otherVals.filter(function(v){return v.thu>0;}).map(function(v){return v.thu;})):0;
  var maxLN=otherVals.length?Math.max.apply(null,otherVals.map(function(v){return v.thu-v.chi;})):0;

  function cmpLine(cur,ref,label){if(!ref)return'';var d=cur-ref;var col=d>=0?'var(--green)':'var(--red)';var arrow=d>=0?'▲':'▼';return'<div style="display:flex;justify-content:space-between;font-size:.67rem;margin-top:2px"><span style="color:var(--text3)">'+label+'</span><span style="color:'+col+';font-weight:600">'+arrow+' '+fmtM(Math.abs(d))+'</span></div>';}

  var kpiData=[
    {cls:'c-green',ic:'ic-green',ico:'💰',lbl:'Doanh thu',val:fmtM(cur.thu),color:'green',
      detail:cmpLine(cur.thu,prev.thu,'vs tháng trước')+cmpLine(cur.thu,ly.thu,'vs cùng kỳ LY')+(maxThu?'<div style="font-size:.65rem;color:var(--text3);margin-top:3px">📈 Cao nhất: '+fmtM(maxThu)+(minThu?' · Thấp nhất: '+fmtM(minThu):'')+'</div>':'')},
    {cls:'c-red',ic:'ic-red',ico:'💸',lbl:'Chi phí',val:fmtM(cur.chi),color:'red',
      detail:cmpLine(cur.chi,prev.chi,'vs tháng trước')+cmpLine(cur.chi,ly.chi,'vs cùng kỳ LY')},
    {cls:'c-blue',ic:'ic-blue',ico:'📈',lbl:'Lợi nhuận',val:fmtM(lnCur),color:'accent',
      detail:cmpLine(lnCur,lnPrev,'vs tháng trước')+cmpLine(lnCur,lnLY,'vs cùng kỳ LY')+(maxLN?'<div style="font-size:.65rem;color:var(--text3);margin-top:3px">🏆 Cao nhất: '+fmtM(maxLN)+'</div>':'')},
  ];
  var kpiActions=[
    'showDBDoanhThu(\''+ym+'\')',
    'showDBChiPhi(\''+ym+'\')',
    'showDBLoiNhuan(\''+ym+'\')'
  ];
  document.getElementById('db-kpi').innerHTML=kpiData.map(function(c,i){
    return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s;cursor:pointer;transition:transform .15s,box-shadow .15s" onmouseenter="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(0,0,0,.12)\'" onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'\'" onclick="'+kpiActions[i]+'">'
      +'<div class="kpi-header"><div class="kpi-label">'+c.lbl+' T'+mm+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div>'
      +'<div class="kpi-value" style="color:var(--'+c.color+')">'+c.val+'</div>'
      +c.detail
      +'<div style="font-size:.65rem;color:var(--text3);margin-top:4px;opacity:.7">🔍 Bấm để xem chi tiết</div>'
      +'</div>';
  }).join('');

  // KPI trạng thái HĐ
  var hdDang=DB.hopDong.filter(function(h){return h.tt==='dang_chay';}).length;
  // Công nợ = số HĐ hoàn thành chưa thu đủ tiền (bao gồm cho_thanh_toan cũ)
  var congNo=DB.hopDong.filter(function(h){return (h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan')&&h.giatri>h.dathu;}).length;
  var hdHT=DB.hopDong.filter(function(h){return getMY(h.ngay||h.ngay_di||'')===ym&&(h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan');}).length;
  var hdChoXe=DB.hopDong.filter(function(h){return h.tt==='cho_xe';}).length;
  var hdStatusEl=document.getElementById('db-hd-status');
  if(hdStatusEl){hdStatusEl.innerHTML=[
    {cls:'c-blue',ic:'ic-blue',ico:'🚌',lbl:'Đang thực hiện',val:hdDang,sub:'Chuyến đang chạy',color:'accent'},
    {cls:'c-orange',ic:'ic-orange',ico:'💳',lbl:'Công nợ',val:congNo,sub:'HĐ hoàn thành chưa thu đủ',color:'orange'},
    {cls:'c-green',ic:'ic-green',ico:'✅',lbl:'Hoàn thành T'+mm,val:hdHT,sub:'Đã thanh toán xong',color:'green'},
    {cls:'c-purple',ic:'ic-purple',ico:'📋',lbl:'Chờ thực hiện',val:hdChoXe,sub:'Chưa khởi hành',color:'purple'},
  ].map(function(c,i){var ttMap=['dang_chay','cong_no','hoan_thanh','cho_xe'];return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s;cursor:pointer" onclick="navToHD(\''+ttMap[i]+'\')"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+c.color+')">'+c.val+' HĐ</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');}

  // Biểu đồ 6 tháng
  var months6=[];var d0=new Date(yyyy,mm-1,1);
  for(var i=5;i>=0;i--){var dd=new Date(d0.getFullYear(),d0.getMonth()-i,1);var mmStr=String(dd.getMonth()+1).padStart(2,'0');months6.push({l:'T'+(dd.getMonth()+1),ym:mmStr+'/'+dd.getFullYear(),cur:i===0});}
  var bd=months6.map(function(m){var t=getMonthTotals(m.ym);return{l:m.l,ym:m.ym,thu:t.thu,chi:t.chi,cur:m.cur};});
  var mx=Math.max.apply(null,bd.map(function(b){return Math.max(b.thu,b.chi);}));mx=mx||1;
  document.getElementById('db-bar').innerHTML=bd.map(function(b){var th=Math.max(3,Math.round(b.thu/mx*100));var ch=Math.max(b.chi?3:0,Math.round(b.chi/mx*100));var lp=Math.max(b.thu-b.chi>0?3:0,Math.round((b.thu-b.chi)/mx*100));return'<div class="bar-group"><div class="bars"><div class="bar" title="Thu '+b.l+': '+fmtM(b.thu)+' — Bấm để xem chi tiết" style="height:'+th+'%;background:'+(b.cur?'#15803d':'#86efac')+';cursor:pointer" onclick="navToTC(\''+b.ym+'\',\'thu\')"></div><div class="bar" title="Chi '+b.l+': '+fmtM(b.chi)+' — Bấm để xem chi tiết" style="height:'+ch+'%;background:'+(b.cur?'#ef4444':'#fca5a5')+';cursor:pointer" onclick="navToTC(\''+b.ym+'\',\'chi\')"></div><div class="bar" style="height:'+lp+'%;background:'+(b.cur?'#64748b':'#cbd5e1')+'"></div></div><div class="bar-lbl" style="'+(b.cur?'color:var(--green);font-weight:700':'')+'">'+b.l+(b.cur?' ●':'')+'</div></div>';}).join('');

  // Cơ cấu chi phí — dynamic theo tháng đang xem
  var chiItems=DB.thuChi.filter(function(t){return getMY(t.ngay)===ym&&t.type==='chi';});
  var catTotals={};chiItems.forEach(function(t){catTotals[t.loai]=(catTotals[t.loai]||0)+t.sotien;});
  var totalChi=chiItems.reduce(function(s,t){return s+t.sotien;},0)||1;
  var catColors={'Nhiên liệu':'var(--accent)','Lương tài xế':'var(--green)','Sửa chữa':'var(--orange)','Cầu đường':'var(--yellow)','Bảo dưỡng':'var(--purple)'};
  var cats=Object.keys(catTotals).sort(function(a,b){return catTotals[b]-catTotals[a];}).slice(0,5).map(function(k){return{n:k,p:Math.round(catTotals[k]/totalChi*100),c:catColors[k]||'#94a3b8'};});
  if(!cats.length)cats=[{n:'Chưa có chi phí',p:0,c:'#94a3b8'}];
  var catSub=document.getElementById('db-cat-sub');if(catSub)catSub.textContent='Tháng '+mm+'/'+yyyy+' · Phân bổ theo danh mục';
  document.getElementById('db-cat').innerHTML=cats.map(function(c){return'<div><div class="cat-header"><span class="cat-name">'+c.n+'</span><span class="cat-val" style="color:'+c.c+'">'+c.p+'%</span></div><div class="cat-bar"><div class="cat-fill" style="width:'+c.p+'%;background:'+c.c+'"></div></div></div>';}).join('');

  // HĐ gần nhất
  document.getElementById('db-hd').innerHTML=DB.hopDong.slice(0,5).map(function(h){return'<tr onclick="openHDDetail(\''+h.id+'\')" style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'"><td><span class="mono" style="color:var(--blue)">'+h.so+'</span></td><td style="font-weight:500">'+h.kh+'</td><td><span class="amt-pos">+'+fmtM(h.giatri)+'</span></td><td>'+(TTMAP[h.tt]||'')+'</td></tr>';}).join('');

  // Tình trạng xe — suy luận động từ hop_dong thay vì đọc x.tt tĩnh
  var xeST={dang_chay:{lbl:'Đang chạy',cls:'xs-busy',ico:'🚌'},san_sang:{lbl:'Sẵn sàng',cls:'xs-ok',ico:'✅'},bao_duong:{lbl:'Bảo dưỡng',cls:'xs-warn',ico:'🔧'},cho_xe:{lbl:'Có lịch',cls:'xs-warn',ico:'📅'}};
  // Build map: bien_so → trạng thái HĐ đang active
  var xeHDMap={};
  DB.hopDong.forEach(function(h){
    if(!h.xe) return;
    if(h.tt==='dang_chay'){
      xeHDMap[h.xe]='dang_chay'; // ưu tiên đang chạy
    } else if(h.tt==='cho_xe' && xeHDMap[h.xe]!=='dang_chay'){
      xeHDMap[h.xe]='cho_xe';    // có lịch nhưng chưa chạy
    }
  });
  document.getElementById('db-xe').innerHTML=DB.xe.map(function(x){
    // Bảo dưỡng: ưu tiên flag thủ công
    var derivedTT = x.tt==='bao_duong' ? 'bao_duong' : (xeHDMap[x.bien]||'san_sang');
    var st=xeST[derivedTT]||{lbl:derivedTT,cls:'xs-ok',ico:'❓'};
    var dk=Math.round((new Date(x.dangKiem)-new Date())/864e5);
    // Tên HĐ đang gán (nếu có)
    var activeHD=DB.hopDong.find(function(h){return h.xe===x.bien&&(h.tt==='dang_chay'||h.tt==='cho_xe');});
    var hdBadge=activeHD?'<div style="font-size:.64rem;color:var(--text3);margin-top:1px">'+activeHD.so+' · '+activeHD.kh+'</div>':'';
    return'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'" onclick="openXeDetail(\''+x.id+'\')" title="Xem chi tiết '+x.bien+'">'
      +'<div><div style="font-weight:600;font-size:.8rem">'+x.bien+'</div><div style="font-size:.68rem;color:var(--text3)">'+x.loai+'</div>'+hdBadge+'</div>'
      +'<div style="text-align:right"><span class="xe-status '+st.cls+'">'+st.ico+' '+st.lbl+'</span>'+(dk<60?'<div style="font-size:.65rem;color:var(--orange);margin-top:2px">⚠ ĐK: '+dk+' ngày</div>':'')+'</div>'
      +'</div>';
  }).join('');

  // Top tài xế
  _dashYM=ym; // lưu lại để showAllDriverRank() dùng
  var driverEl=document.getElementById('db-driver-rank');
  var subEl=document.getElementById('db-driver-sub');if(subEl)subEl.textContent='Theo tháng '+mm+'/'+yyyy;
  if(driverEl){
    var txRank=DB.taiXe.map(function(tx){var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&getMY(h.ngay)===ym;});return{id:tx.id,ten:tx.ten,chuyen:hds.length,rev:hds.reduce(function(s,h){return s+h.giatri;},0)};}).sort(function(a,b){return b.rev-a.rev;});
    if(!txRank.length||txRank[0].rev===0){driverEl.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:.82rem">Chưa có dữ liệu tháng '+mm+'/'+yyyy+'</div>';}
    else{var maxRev=txRank[0].rev||1;var rIco=['🥇','🥈','🥉'];
      driverEl.innerHTML=txRank.slice(0,5).map(function(tx,i){return'<div class="rank-item" style="cursor:pointer" title="Xem chi tiết '+tx.ten+'" onclick="openTXDetail(\''+encodeURIComponent(tx.ten)+'\',\''+ym+'\')"><div class="rank-num '+(i<3?'r'+(i+1):'rn')+'">'+(rIco[i]||i+1)+'</div><div class="rank-info"><div class="rank-name">'+tx.ten+'</div><div class="rank-meta">'+tx.chuyen+' chuyến</div></div><div style="flex:1;padding:0 16px"><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:'+Math.round(tx.rev/maxRev*100)+'%;background:var(--green)"></div></div><div class="mini-pct">'+Math.round(tx.rev/maxRev*100)+'%</div></div></div><div class="rank-amount">'+fmtM(tx.rev)+'</div></div>';}).join('');}
  }
}

// ── Dashboard: Bảng xếp hạng tài xế đầy đủ ─────────────────────────────────
var _dashYM='';
function showAllDriverRank(){
  var ym=_dashYM||getMY(new Date().toISOString().slice(0,10).replace(/-/g,'/').slice(0,7));
  var parts=ym.split('/');var mm=parts[0],yyyy=parts[1];
  // Xây danh sách tất cả tài xế + tính doanh thu tháng
  var txRank=DB.taiXe.map(function(tx){
    var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&getMY(h.ngay_di||h.ngay||'')===ym;});
    var hoanthanh=hds.filter(function(h){return _isCompleted(h);});
    return{id:tx.id,ten:tx.ten,chuyen:hds.length,hoanThanh:hoanthanh.length,rev:hoanthanh.reduce(function(s,h){return s+h.giatri;},0)};
  }).filter(function(tx){return tx.chuyen>0||tx.rev>0;}).sort(function(a,b){return b.rev-a.rev;});
  var total=txRank.reduce(function(s,t){return s+t.rev;},0)||1;
  var maxRev=txRank.length?txRank[0].rev||1:1;
  var rIco=['🥇','🥈','🥉'];
  // Tháng selector (6 tháng gần đây)
  var months6=[];var d0=new Date();
  for(var i=0;i<6;i++){var dd=new Date(d0.getFullYear(),d0.getMonth()-i,1);months6.push(String(dd.getMonth()+1).padStart(2,'0')+'/'+dd.getFullYear());}
  var monthSel='<select id="rank-ym-sel" style="font-size:.78rem;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer" onchange="showAllDriverRankForYM(this.value)">'+months6.map(function(m){return'<option value="'+m+'"'+(m===ym?' selected':'')+'>Tháng '+m+'</option>';}).join('')+'</select>';
  var body='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
    +'<div style="font-size:.82rem;color:var(--text2)">Doanh thu từ <strong>'+txRank.length+'</strong> tài xế có chuyến trong tháng</div>'
    +monthSel
    +'</div>';
  if(!txRank.length){
    body+='<div style="padding:40px;text-align:center;color:var(--text3)">Không có dữ liệu tháng '+mm+'/'+yyyy+'</div>';
  } else {
    body+='<div id="rank-list">'
      +txRank.map(function(tx,i){
        var pct=Math.round(tx.rev/maxRev*100);
        var share=Math.round(tx.rev/total*100);
        return'<div style="display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;border-radius:6px" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'" onclick="closeModal();setTimeout(function(){openTXDetail(\''+encodeURIComponent(tx.ten)+'\',\''+ym+'\')},120)">'
          +'<div style="width:28px;text-align:center;font-size:'+(i<3?'.9':'0.78')+'rem;font-weight:700;flex-shrink:0">'+(rIco[i]||'<span style="color:var(--text3)">'+(i+1)+'</span>')+'</div>'
          +'<div style="flex:1;min-width:0">'
            +'<div style="font-weight:600;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tx.ten+'</div>'
            +'<div style="font-size:.68rem;color:var(--text3);margin-top:1px">'+tx.chuyen+' chuyến · '+tx.hoanThanh+' hoàn thành</div>'
          +'</div>'
          +'<div style="flex:2;padding:0 12px">'
            +'<div style="display:flex;align-items:center;gap:6px">'
              +'<div style="flex:1;height:6px;background:var(--surface2);border-radius:3px"><div style="width:'+pct+'%;height:100%;background:var(--green);border-radius:3px;transition:width .3s"></div></div>'
              +'<span style="font-size:.68rem;color:var(--text3);width:32px;text-align:right">'+share+'%</span>'
            +'</div>'
          +'</div>'
          +'<div style="font-weight:700;font-size:.82rem;color:var(--green);font-family:\'DM Mono\',monospace;flex-shrink:0;min-width:60px;text-align:right">'+fmtM(tx.rev)+'</div>'
        +'</div>';
      }).join('')
    +'</div>';
    body+='<div style="margin-top:12px;padding:10px 4px;display:flex;justify-content:space-between;align-items:center;border-top:2px solid var(--border)">'
      +'<span style="font-size:.78rem;font-weight:700;color:var(--text2)">Tổng doanh thu (HĐ hoàn thành)</span>'
      +'<span style="font-weight:700;font-size:.88rem;color:var(--green);font-family:\'DM Mono\',monospace">'+fmtM(txRank.reduce(function(s,t){return s+t.rev;},0))+'</span>'
    +'</div>';
  }
  showModal('🏆 Bảng xếp hạng Tài xế','Tháng '+mm+'/'+yyyy,body,'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>');
}
function showAllDriverRankForYM(ym){ _dashYM=ym; showAllDriverRank(); }

// ── Dashboard KPI drill-down modals ─────────────────────────────────────────
function showDBDoanhThu(ym){
  var parts=ym.split('/');var mm=parseInt(parts[0]),yyyy=parts[1];
  var hds=DB.hopDong.filter(function(h){
    return _isCompleted(h)&&getMY(h.ngay_di||h.ngay||'')===ym;
  }).sort(function(a,b){return b.giatri-a.giatri;});
  var total=hds.reduce(function(s,h){return s+h.giatri;},0);
  var daThu=hds.reduce(function(s,h){return s+h.dathu;},0);
  var conNo=total-daThu;
  var rows=hds.length?hds.map(function(h){
    var pct=h.giatri?Math.round(h.dathu/h.giatri*100):100;
    var con=h.giatri-h.dathu;
    return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" style="cursor:pointer" title="Xem HĐ '+h.so+'">'
      +'<td><span class="mono" style="color:var(--blue);font-size:.75rem;font-weight:600">'+h.so+'</span>'
      +'<div style="font-size:.64rem;color:var(--text3)">'+fmtD(h.ngay_di||h.ngay||'')+'</div></td>'
      +'<td style="font-size:.8rem;font-weight:500">'+h.kh+'</td>'
      +'<td style="font-size:.74rem;color:var(--text2)">'+h.tuyen+'</td>'
      +'<td style="text-align:right"><span class="amt-pos">+'+fmtM(h.giatri)+'</span></td>'
      +'<td style="text-align:right">'
        +'<div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">'
        +'<div style="width:40px;height:4px;background:var(--surface2);border-radius:2px"><div style="width:'+pct+'%;height:100%;background:var(--green);border-radius:2px"></div></div>'
        +(con>0?'<span style="font-size:.72rem;color:var(--orange)">còn '+fmtM(con)+'</span>':'<span style="font-size:.72rem;color:var(--green)">✓ Đủ</span>')
        +'</div></td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text3)">Không có hợp đồng hoàn thành trong tháng này</td></tr>';
  var body=''
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">'
      +'<div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">'
        +'<div style="font-size:1.1rem;font-weight:700;color:var(--green)">'+fmtM(total)+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3)">Tổng doanh thu</div></div>'
      +'<div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">'
        +'<div style="font-size:1.1rem;font-weight:700;color:var(--accent)">'+fmtM(daThu)+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3)">Đã thu</div></div>'
      +'<div style="background:'+(conNo>0?'#fef2f2':'var(--surface2)')+';border-radius:8px;padding:10px;text-align:center">'
        +'<div style="font-size:1.1rem;font-weight:700;color:'+(conNo>0?'var(--orange)':'var(--text3)')+'">'+fmtM(conNo)+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3)">Còn công nợ</div></div>'
    +'</div>'
    +'<div class="table-wrap" style="max-height:400px;overflow-y:auto;border-radius:6px;border:1px solid var(--border)">'
      +'<table class="dt" style="width:100%;font-size:.8rem">'
        +'<thead><tr><th>Số HĐ</th><th>Khách hàng</th><th>Tuyến đường</th><th style="text-align:right">Giá trị</th><th style="text-align:right">Thanh toán</th></tr></thead>'
        +'<tbody>'+rows+'</tbody>'
      +'</table>'
    +'</div>';
  showModal('💰 Doanh thu tháng '+mm+'/'+yyyy,hds.length+' hợp đồng hoàn thành',body,
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
    +'<button class="btn btn-blue" onclick="closeModal();navTo(\'baocao\')">📊 Xem báo cáo →</button>');
}

function showDBChiPhi(ym){
  var parts=ym.split('/');var mm=parseInt(parts[0]),yyyy=parts[1];
  var items=DB.thuChi.filter(function(t){
    return t.type==='chi'&&getMY(t.ngay)===ym&&_shouldCountChi(t);
  }).sort(function(a,b){return b.sotien-a.sotien;});
  var total=items.reduce(function(s,t){return s+t.sotien;},0);
  // Tổng hợp theo danh mục
  var byCat={};
  items.forEach(function(t){byCat[t.loai]=(byCat[t.loai]||0)+t.sotien;});
  var catColors={'Nhiên liệu':'var(--accent)','Lương tài xế':'var(--green)','Sửa chữa':'var(--orange)','Cầu đường':'#f59e0b','Bảo dưỡng':'var(--purple)','Đăng kiểm':'#0ea5e9','Bảo hiểm':'#14b8a6','Định vị':'#8b5cf6','Phù hiệu':'#ec4899','Chi khác':'#94a3b8'};
  var catRows=Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a];}).map(function(k){
    var pct=total?Math.round(byCat[k]/total*100):0;
    var clr=catColors[k]||'#94a3b8';
    return'<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:'+clr+';flex-shrink:0"></div>'
      +'<span style="font-size:.78rem;flex:1">'+k+'</span>'
      +'<div style="width:80px;height:4px;background:var(--surface2);border-radius:2px"><div style="width:'+pct+'%;height:100%;background:'+clr+';border-radius:2px"></div></div>'
      +'<span style="font-size:.7rem;color:var(--text3);width:24px;text-align:right">'+pct+'%</span>'
      +'<span style="font-size:.78rem;font-weight:600;color:var(--red);min-width:70px;text-align:right">-'+fmtM(byCat[k])+'</span>'
      +'</div>';
  }).join('');
  var rows=items.length?items.map(function(t){
    var hdLink='';
    if(t.hd_id){var hd=DB.hopDong.find(function(h){return h.id===t.hd_id;});if(hd)hdLink='<div style="font-size:.64rem;color:var(--blue);margin-top:1px">'+hd.so+' · '+hd.kh+'</div>';}
    return'<tr onclick="closeModal();setTimeout(function(){openTCDetail(\''+t.id+'\')},120)" style="cursor:pointer">'
      +'<td><span class="mono" style="font-size:.72rem">'+fmtD(t.ngay)+'</span></td>'
      +'<td>'+badgeHTML(t.loai,'chi')+'</td>'
      +'<td style="font-size:.76rem">'+(t.mota||t.kh||'—')+hdLink+'</td>'
      +'<td style="font-size:.74rem;color:var(--text2)">'+(t.xe||(t.taixe?'👤 '+t.taixe:'')||'—')+'</td>'
      +'<td style="text-align:right"><span class="amt-neg">-'+fmtM(t.sotien)+'</span></td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text3)">Không có chi phí ghi nhận</td></tr>';
  var body=''
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fef2f2;border-radius:8px;margin-bottom:12px">'
      +'<span style="font-size:.8rem;color:var(--text3)">'+items.length+' khoản chi · Tháng '+mm+'/'+yyyy+'</span>'
      +'<span style="font-weight:700;font-size:1.05rem;color:var(--red)">-'+fmtM(total)+'</span>'
    +'</div>'
    +(catRows?'<div style="margin-bottom:14px;padding:0 2px">'+catRows+'</div>':'')
    +'<div style="font-weight:600;font-size:.78rem;color:var(--text2);margin-bottom:6px">📋 Chi tiết từng phiếu</div>'
    +'<div class="table-wrap" style="max-height:280px;overflow-y:auto;border-radius:6px;border:1px solid var(--border)">'
      +'<table class="dt" style="width:100%;font-size:.78rem">'
        +'<thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Xe / Tài xế</th><th style="text-align:right">Số tiền</th></tr></thead>'
        +'<tbody>'+rows+'</tbody>'
      +'</table>'
    +'</div>';
  showModal('💸 Chi phí tháng '+mm+'/'+yyyy,items.length+' khoản chi ghi nhận',body,
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
    +'<button class="btn btn-blue" onclick="closeModal();navToTC(\''+ym+'\',\'chi\')">Xem trong Thu Chi →</button>');
}

function showDBLoiNhuan(ym){
  // Navigate sang báo cáo Theo HĐ với kỳ tháng đang xem
  closeModal();
  navTo('baocao');
  setTimeout(function(){
    // Switch sang tab Theo HĐ
    var tabEl=document.querySelector('#page-baocao .tab[onclick*="hopdong"]');
    if(tabEl)tabEl.click();
  },150);
}

// ═══════════════════════════════════════
// SKELETON LOADER + PAGINATION
// ═══════════════════════════════════════
var PAGE_SIZE = 20;                  // page size mặc định cho KH, TC
var HD_PAGE_SIZE = 10;               // page size riêng cho HĐ (mặc định 10)
var PAGES = { hd: 1, tc: 1, kh: 1 };

function setHDPageSize(val){
  HD_PAGE_SIZE = parseInt(val) || 0; // 0 = hiển thị tất cả
  PAGES.hd = 1;                      // reset về trang 1
  renderHD();
}

function skelRows(cols, n) {
  var widths = [55, 90, 70, 50, 80];
  var cells = Array.apply(null, Array(cols)).map(function(_, i) {
    return '<td><div class="skel" style="width:' + widths[i % 5] + '%"></div></td>';
  }).join('');
  var row = '<tr>' + cells + '</tr>';
  return Array.apply(null, Array(n || 6)).map(function() { return row; }).join('');
}

function showSkel(tbodyId, cols) {
  var el = document.getElementById(tbodyId);
  if (el) el.innerHTML = skelRows(cols, 7);
}

function renderPager(containerId, total, page, onPageFn) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { el.innerHTML = ''; return; }
  var start = Math.max(1, Math.min(page - 2, pages - 4));
  var end = Math.min(pages, start + 4);
  var btns = '';
  if (page > 1) btns += '<button class="btn btn-ghost btn-sm" onclick="' + onPageFn + '(' + (page - 1) + ')">‹ Trước</button>';
  for (var p = start; p <= end; p++) {
    btns += '<button class="btn btn-sm" style="' + (p === page ? 'background:var(--accent);color:#fff' : 'background:transparent;border:1px solid var(--border)') + '" onclick="' + onPageFn + '(' + p + ')">' + p + '</button>';
  }
  if (page < pages) btns += '<button class="btn btn-ghost btn-sm" onclick="' + onPageFn + '(' + (page + 1) + ')">Tiếp ›</button>';
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-top:1px solid var(--border)">' +
    '<span style="font-size:.74rem;color:var(--text3)">Trang ' + page + '/' + pages + ' · ' + total + ' dòng</span>' +
    '<div style="display:flex;gap:5px">' + btns + '</div></div>';
}

// Pager riêng cho HĐ (hỗ trợ HD_PAGE_SIZE động)
function renderPagerHD(containerId, total, page, pages){
  var el = document.getElementById(containerId);
  if(!el) return;
  if(pages <= 1){ el.innerHTML = ''; return; }
  var start = Math.max(1, Math.min(page-2, pages-4));
  var end   = Math.min(pages, start+4);
  var btns  = '';
  if(page > 1)    btns += '<button class="btn btn-ghost btn-sm" onclick="goHDPage('+(page-1)+')">‹</button>';
  for(var p=start; p<=end; p++){
    btns += '<button class="btn btn-sm" style="'+(p===page?'background:var(--accent);color:#fff':'background:transparent;border:1px solid var(--border)')+'" onclick="goHDPage('+p+')">'+p+'</button>';
  }
  if(page < pages) btns += '<button class="btn btn-ghost btn-sm" onclick="goHDPage('+(page+1)+')">›</button>';
  if(page > 1)           btns = '<button class="btn btn-ghost btn-sm" onclick="goHDPage(1)">«</button>' + btns;
  if(page < pages)       btns += '<button class="btn btn-ghost btn-sm" onclick="goHDPage('+pages+')">»</button>';
  el.innerHTML = '<div style="display:flex;gap:4px;align-items:center">'+btns+'</div>';
}

// ═══════════════════════════════════════
// HỢP ĐỒNG
// ═══════════════════════════════════════
function goHDPage(p) { PAGES.hd = p; renderHD(); }
function populateHDMonthFilter(){
  var sel=document.getElementById('hd-filter-month');
  if(!sel) return;
  var cur=sel.value;
  // Tập hợp tất cả tháng có HĐ (dùng ngay_di hoặc ngay)
  var months={};
  DB.hopDong.forEach(function(h){
    var d=h.ngay_di||h.ngay||'';
    if(d.length>=7) months[d.slice(0,7)]=true;
  });
  var sorted=Object.keys(months).sort().reverse();
  sel.innerHTML='<option value="">Tất cả tháng</option>'
    +sorted.map(function(m){
      var p=m.split('-');
      return '<option value="'+m+'"'+(m===cur?' selected':'')+'>Tháng '+p[1]+'/'+p[0]+'</option>';
    }).join('');
}

function renderHD() {
  var q = document.getElementById('hd-search').value.toLowerCase();
  var tt = document.getElementById('hd-filter-tt').value;
  var mo = (document.getElementById('hd-filter-month')||{}).value||'';
  var rows = DB.hopDong.filter(function(h) {
    var ttMatch = !tt || (tt==='cong_no' ? (h.tt==='hoan_thanh' && h.giatri > h.dathu) : h.tt===tt);
    var moMatch = !mo || (h.ngay_di||h.ngay||'').startsWith(mo);
    return (!q || [h.so,h.kh,h.tuyen,h.xe,h.taixe].join(' ').toLowerCase().includes(q)) && ttMatch && moMatch;
  }).sort(function(a, b) { return b.ngay.localeCompare(a.ngay); });

  var total = rows.length;
  var page  = PAGES.hd;
  var ps    = HD_PAGE_SIZE;                          // 0 = hiển thị tất cả
  var slice = ps ? rows.slice((page-1)*ps, page*ps) : rows;
  var pages = ps ? Math.ceil(total/ps) : 1;

  // Dòng thông tin "Hiển thị X–Y / Z hợp đồng"
  document.getElementById('hd-count').textContent = total + ' hợp đồng';
  var infoEl = document.getElementById('hd-page-info');
  if(infoEl){
    if(ps && total > ps){
      var from = (page-1)*ps+1, to = Math.min(page*ps, total);
      infoEl.textContent = 'Hiển thị '+from+'–'+to+' / '+total+' hợp đồng';
    } else {
      infoEl.textContent = total ? 'Hiển thị '+total+' / '+total+' hợp đồng' : '';
    }
  }

  document.getElementById('hd-body').innerHTML = slice.length ? slice.map(function(h) {
    var cn = h.giatri - h.dathu;
    return '<tr onclick="openHDDetail(\'' + h.id + '\')">' +
      '<td><span class="mono" style="font-weight:600">' + h.so + '</span></td>' +
      '<td style="font-weight:500">' + h.kh + '</td>' +
      '<td style="color:var(--text2);font-size:.74rem">' + h.tuyen + '</td>' +
      '<td><span class="mono">' + fmtD(h.ngay_di||h.ngay) + '</span>' + (calcDuration(h.ngay_di||h.ngay,h.ngay_ve) ? '<div style="font-size:.65rem;font-weight:700;color:#2563eb">'+calcDuration(h.ngay_di||h.ngay,h.ngay_ve)+'</div>' : '') + '</td>' +
      '<td><div style="font-size:.75rem">' + (h.xe || '—') + '</div><div style="font-size:.67rem;color:var(--text3)">' + (h.taixe || '—') + '</div></td>' +
      '<td><span style="font-weight:700;font-family:\'DM Mono\',monospace">' + fmtM(h.giatri) + '</span></td>' +
      '<td><div class="amt-pos">+' + fmtM(h.dathu) + '</div>' + (cn > 0 ? '<div style="font-size:.67rem;color:var(--orange)">Còn: ' + fmtM(cn) + '</div>' : '') + '</td>' +
      '<td>' + (TTMAP[h.tt] || '') + '</td>' +
      '<td>' + (isAdmin() ? '<div class="row-acts"><button class="ic-btn" onclick="event.stopPropagation();openHDModal(\'' + h.id + '\')">✏️</button><button class="ic-btn del" onclick="event.stopPropagation();askDelete(\'Xóa HĐ ' + h.so + '?\',\'\',function(){deleteHD(\'' + h.id + '\')})">🗑️</button></div>' : '') + '</td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text3)">Không có hợp đồng nào</td></tr>';

  // Render nút phân trang vào div riêng (không ghi đè info text)
  renderPagerHD('hd-pager-btns', total, page, pages);
}
function openHDDetail(id) {
  var h = DB.hopDong.find(function(x) { return x.id === id; }); if (!h) return;
  var cn = h.giatri - h.dathu;
  var dur = calcDuration(h.ngay_di||h.ngay, h.ngay_ve);
  var durBadge = dur ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:rgba(37,99,235,.1);border-radius:20px;font-size:.72rem;font-weight:700;color:#2563eb;margin-left:6px">🗓 '+dur+'</span>' : '';
  var ngayRows = h.ngay_di
    ? [['Ngày đi', fmtD(h.ngay_di)+durBadge],['Ngày về', h.ngay_ve?fmtD(h.ngay_ve):'—']]
    : [['Ngày', fmtD(h.ngay)]];
  // Tên tài xế dạng link có thể click → mở detail tài xế
  var txLink = h.taixe
    ? '<span onclick="event.stopPropagation();closeModal();setTimeout(function(){openTXDetailByName(\''+encodeURIComponent(h.taixe)+'\')},120)" '
      +'style="color:var(--blue);cursor:pointer;text-decoration:underline;text-underline-offset:2px" '
      +'title="Xem thông tin tài xế">'+h.taixe+' 🔗</span>'
    : '—';
  showModal('Chi tiết HĐ', h.so,
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">' +
    [['Khách hàng',h.kh],['Tuyến đường',h.tuyen]].concat(ngayRows).concat([['Xe',h.xe||'—'],['Tài xế',txLink],['Trạng thái',TTMAP[h.tt]||h.tt]]).map(function(p){return'<div class="detail-item"><label>'+p[0]+'</label><div class="dv">'+p[1]+'</div></div>';}).join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">' +
    [['Giá trị',fmtM(h.giatri),'var(--text)'],['Đã thu','+'+fmtM(h.dathu),'var(--green)'],['Còn lại',cn>0?fmtM(cn):'Đã đủ',cn>0?'var(--orange)':'var(--green)']].map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:.65rem;color:var(--text3);margin-bottom:4px">'+p[0]+'</div><div style="font-size:.9rem;font-weight:700;font-family:\'DM Mono\',monospace;color:'+p[2]+'">'+p[1]+'</div></div>';}).join('') + '</div>' +
    '<div id="fuel-summary" style="margin-top:16px;display:none"></div>'+
    baoCaoSectionHTML(h.so),
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
    +'<button class="btn btn-ghost" style="color:var(--blue);border-color:var(--blue)" onclick="duplicateHD(\''+h.id+'\')">📋 Nhân đôi</button>'
    +'<button class="btn btn-accent" onclick="closeModal();openHDModal(\''+h.id+'\')">✏️ Sửa</button>');
  // Async load ảnh báo cáo:
  // - Ưu tiên: BC có hd_so khớp với HĐ này
  // - Fallback: BC từ xe đó nhưng chưa gán hd_so (BC cũ trước khi có tính năng liên kết HĐ)
  (function loadBaoCaoHD(){
    var promises = [];
    if(h.so) promises.push(fetchBaoCao('hd_so', h.so));
    // Fallback bien_xe CHỈ lấy BC chưa có hd_so → tránh trùng với HĐ khác
    if(h.xe) promises.push(fetchBaoCao('bien_xe', h.xe, 'hd_so=is.null'));
    if(!promises.length){ renderBaoCaoSection([], h.taixe); return; }
    Promise.all(promises).then(function(results){
      var seen = {}, combined = [];
      results.forEach(function(rows){ rows.forEach(function(r){ if(!seen[r.id]){ seen[r.id]=true; combined.push(r); } }); });
      combined.sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); });
      renderBaoCaoSection(combined, h.taixe);
      var xeObj = h.xe ? DB.xe.find(function(v){ return v.bien === h.xe; }) : null;
      renderFuelSummary(combined, xeObj); // ← hiển thị tóm tắt nhiên liệu
    });
  })();
}
function openHDModal(id) {
  if (!requireAdmin()) return;
  var h = id ? DB.hopDong.find(function(x) { return x.id === id; }) : null; if (!h) h = {};
  var xeOpts = [''].concat(DB.xe.map(function(x){return x.bien;}));
  var xeSel = xeOpts.map(function(v){return'<option'+(v===h.xe?' selected':'')+'>'+(v||'-- Chọn xe --')+'</option>';}).join('');
  var txSel = [''].concat(DB.taiXe.map(function(t){return t.ten;})).map(function(v){return'<option'+(v===h.taixe?' selected':'')+'>'+(v||'-- Chọn --')+'</option>';}).join('');
  var khList     = DB.khachHang.map(function(k){return'<option value="'+k.ten+'">';}).join('');
  // Datalist mã KH: value = mã, text hiển thị = "KH-001 – Tên KH"
  var khCodeList = DB.khachHang.filter(function(k){return k.maKH;}).map(function(k){return'<option value="'+k.maKH+'">'+k.maKH+' – '+k.ten+'</option>';}).join('');
  // Gợi ý điểm đi / điểm đến từ các HĐ đã có
  var seen={di:{},den:{}};
  DB.hopDong.forEach(function(hd){
    var p=parseTuyen(hd.tuyen);
    if(p.di)  seen.di[p.di]=1;
    if(p.den) seen.den[p.den]=1;
  });
  var diList  = Object.keys(seen.di).map(function(v){return'<option value="'+v+'">';}).join('');
  var denList = Object.keys(seen.den).map(function(v){return'<option value="'+v+'">';}).join('');
  var pt = parseTuyen(h.tuyen);   // parse tuyến cũ khi edit
  var today = new Date().toISOString().slice(0,10);
  showModal(id?'Sửa HĐ':'Thêm HĐ mới', id?h.so:'',
    '<datalist id="kh-list">'+khList+'</datalist>'+
    '<datalist id="kh-code-list">'+khCodeList+'</datalist>'+
    '<datalist id="diem-di-list">'+diList+'</datalist>'+
    '<datalist id="diem-den-list">'+denList+'</datalist>'+
    '<div class="form-row"><div class="fg"><label class="fl">Số HĐ</label><input class="fc" id="f-so" value="'+(h.so||genHDSo())+'"></div><div class="fg"><label class="fl">Ngày ký</label><input type="date" class="fc" id="f-ngay" value="'+(h.ngay||today)+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Ngày đi <span class="req">*</span></label><input type="date" class="fc" id="f-ngay-di" value="'+(h.ngay_di||today)+'" oninput="updateDurationBadge()"></div><div class="fg"><label class="fl">Ngày về</label><input type="date" class="fc" id="f-ngay-ve" value="'+(h.ngay_ve||'')+'" oninput="updateDurationBadge()"></div></div>'+
    '<div id="duration-badge" style="margin:-6px 0 10px;font-size:.75rem;font-weight:700;color:#2563eb;min-height:18px"></div>'+
    '<div class="form-row">'+
      '<div class="fg" style="max-width:140px"><label class="fl">Mã KH</label>'+
        '<input class="fc" id="f-ma-kh-hd" placeholder="KH-..." list="kh-code-list" autocomplete="off" style="font-family:monospace;font-weight:700;color:var(--blue)" oninput="fillKHFromCode(this.value)" onchange="fillKHFromCode(this.value)">'+
      '</div>'+
      '<div class="fg"><label class="fl">Khách hàng <span class="req">*</span></label><input class="fc" id="f-kh" value="'+(h.kh||'')+'" placeholder="Gõ tên hoặc chọn từ mã KH..." list="kh-list" autocomplete="off" oninput="fillCodeFromKH(this.value)" onchange="fillCodeFromKH(this.value)"></div>'+
    '</div>'+
    '<div id="kh-sync-hint" style="margin:-8px 0 8px;font-size:.75rem;color:#ef4444;min-height:16px"></div>'+
    '<div class="form-row">'+
      '<div class="fg"><label class="fl">Điểm đi</label><input class="fc" id="f-diem-di" value="'+pt.di+'" placeholder="TP. Hồ Chí Minh" list="diem-di-list" autocomplete="off"></div>'+
      '<div class="fg"><label class="fl">Điểm đến</label><input class="fc" id="f-diem-den" value="'+pt.den+'" placeholder="Vũng Tàu" list="diem-den-list" autocomplete="off"></div>'+
    '</div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Xe</label><select class="fc" id="f-xe">'+xeSel+'</select></div><div class="fg"><label class="fl">Tài xế</label><select class="fc" id="f-taixe">'+txSel+'</select></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Giá trị (VNĐ) <span class="req">*</span></label><input type="text" inputmode="numeric" class="fc" id="f-giatri" value="'+(h.giatri?fmt(h.giatri):'')+'" placeholder="0" oninput="fmtInput(this)"></div><div class="fg"><label class="fl">Đã thu</label><input type="text" inputmode="numeric" class="fc" id="f-dathu" value="'+(h.dathu?fmt(h.dathu):'0')+'" placeholder="0" oninput="fmtInput(this)"></div></div>'+
    '<div class="fg"><label class="fl">Trạng thái</label><select class="fc" id="f-tt"><option value="cho_xe"'+(h.tt==='cho_xe'?' selected':'')+'>Chờ thực hiện</option><option value="dang_chay"'+(h.tt==='dang_chay'?' selected':'')+'>Đang thực hiện</option><option value="hoan_thanh"'+((h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan')?' selected':'')+'>Hoàn thành</option></select></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-accent" onclick="saveHD(\''+(id||'')+'\')">💾 Lưu</button>');
  // Hiển thị badge thời lượng ngay khi mở modal
  setTimeout(updateDurationBadge, 80);
  // Nếu đang edit và KH đã có → điền sẵn mã KH
  if(h.kh){
    var khObj = DB.khachHang.find(function(k){return k.ten===h.kh;});
    if(khObj&&khObj.maKH){
      setTimeout(function(){
        var el=document.getElementById('f-ma-kh-hd');
        if(el) el.value=khObj.maKH;
      },50);
    }
  }
}
function duplicateHD(id){
  if(!requireAdmin()) return;
  var src=DB.hopDong.find(function(x){return x.id===id;}); if(!src) return;
  var pt=parseTuyen(src.tuyen);
  closeModal();
  setTimeout(function(){
    // Mở form thêm mới (không truyền id → genHDSo tự động)
    openHDModal(null);
    setTimeout(function(){
      // Điền sẵn dữ liệu từ HĐ gốc
      var fSo   =document.getElementById('f-so');
      var fNgay =document.getElementById('f-ngay');
      var fNgayDi=document.getElementById('f-ngay-di');
      var fNgayVe=document.getElementById('f-ngay-ve');
      var fKH   =document.getElementById('f-kh');
      var fMaKH =document.getElementById('f-ma-kh-hd');
      var fDi   =document.getElementById('f-diem-di');
      var fDen  =document.getElementById('f-diem-den');
      var fXe   =document.getElementById('f-xe');
      var fTX   =document.getElementById('f-taixe');
      var fGT   =document.getElementById('f-giatri');
      var fDaThu=document.getElementById('f-dathu');
      var fTT   =document.getElementById('f-tt');
      // Số HĐ: giữ mã tự sinh (đã điền bởi genHDSo trong openHDModal)
      // Ngày ký: giữ hôm nay (đã điền)
      // Ngày đi / về: copy từ gốc để user chỉnh
      if(fNgayDi) fNgayDi.value=src.ngay_di||src.ngay||'';
      if(fNgayVe) fNgayVe.value=src.ngay_ve||'';
      // Khách hàng
      if(fKH) fKH.value=src.kh||'';
      // Mã KH
      if(fMaKH){
        var khObj=DB.khachHang.find(function(k){return k.ten===src.kh;});
        fMaKH.value=(khObj&&khObj.maKH)?khObj.maKH:'';
      }
      // Tuyến đường
      if(fDi)  fDi.value=pt.di||'';
      if(fDen) fDen.value=pt.den||'';
      // Xe + Tài xế
      if(fXe)  fXe.value=src.xe||'';
      if(fTX)  fTX.value=src.taixe||'';
      // Giá trị — copy; Đã thu reset về 0
      if(fGT)  fGT.value=src.giatri?fmt(src.giatri):'';
      if(fDaThu) fDaThu.value='0';
      // Trạng thái reset về Chờ thực hiện
      if(fTT)  fTT.value='cho_xe';
      // Cập nhật badge thời lượng
      updateDurationBadge();
      // Đổi tiêu đề modal thành nhân đôi
      var mTitle=document.querySelector('.modal-header h3');
      if(mTitle) mTitle.textContent='📋 Nhân đôi HĐ '+src.so;
      toast('📋 Đã copy thông tin từ HĐ '+src.so+' — kiểm tra & chỉnh sửa rồi lưu','info',4000);
    },80);
  },150);
}

function updateDurationBadge(){
  var el = document.getElementById('duration-badge'); if(!el) return;
  var di = (document.getElementById('f-ngay-di')||{}).value || '';
  var ve = (document.getElementById('f-ngay-ve')||{}).value || '';
  var dur = calcDuration(di, ve);
  el.textContent = dur ? '🗓 ' + dur : '';
}
function saveHD(id) {
  if (!requireAdmin()) return;
  var giatri = readMoney('f-giatri'), kh = document.getElementById('f-kh').value.trim();
  if (!kh || !giatri) { toast('Vui lòng nhập đủ thông tin!','error'); return; }
  // Kiểm tra mã KH và tên KH phải khớp nhau
  if (!validateKHSync()) { toast('⚠️ Mã KH và tên khách hàng không khớp!','error'); return; }
  var ngay_di  = (document.getElementById('f-ngay-di')||{}).value||'';
  var ngay_ve  = (document.getElementById('f-ngay-ve')||{}).value||'';
  var diemDi   = (document.getElementById('f-diem-di') ||{}).value||'';
  var diemDen  = (document.getElementById('f-diem-den')||{}).value||'';
  // Ghép thành "Điểm đi → Điểm đến"; nếu chỉ có một vế thì dùng vế đó
  var tuyen = diemDi && diemDen ? diemDi.trim()+' → '+diemDen.trim()
            : (diemDi||diemDen).trim();
  // Lấy mã KH từ ô f-ma-kh-hd hoặc tra cứu theo tên
  var maKHHD = ((document.getElementById('f-ma-kh-hd')||{}).value||'').trim();
  if(!maKHHD){
    var khObj = DB.khachHang.find(function(x){return x.ten===kh;});
    if(khObj) maKHHD = khObj.maKH||'';
  }
  var obj = {id:id||uid(),so:document.getElementById('f-so').value,kh:kh,maKH:maKHHD,tuyen:tuyen,ngay:document.getElementById('f-ngay').value||'',ngay_di:ngay_di,ngay_ve:ngay_ve,xe:document.getElementById('f-xe').value,taixe:document.getElementById('f-taixe').value,giatri:giatri,dathu:readMoney('f-dathu'),tt:document.getElementById('f-tt').value};
  var row = {so_hd:obj.so,khach_hang:obj.kh,ma_kh:maKHHD||null,tuyen_duong:obj.tuyen,ngay_th:obj.ngay||null,ngay_di:obj.ngay_di||null,ngay_ve:obj.ngay_ve||null,bien_so_xe:obj.xe,tai_xe:obj.taixe,gia_tri:obj.giatri,da_thu:obj.dathu,trang_thai:obj.tt};

  // ── Kiểm tra: cùng lúc không thể có 2 HĐ dang_chay cho cùng tài xế ──────
  if(obj.tt === 'dang_chay' && obj.taixe){
    var conflictHD = DB.hopDong.find(function(h){
      return h.tt === 'dang_chay' && h.taixe === obj.taixe && h.id !== id;
    });
    if(conflictHD){
      toast('⚠️ Tài xế '+obj.taixe+' đang thực hiện HĐ <strong>'+conflictHD.so+'</strong>.<br>Không thể có 2 hợp đồng chạy cùng lúc!','error',6000);
      return;
    }
  }

  (id ? sbPatch('hop_dong',id,row) : sbPost('hop_dong',row)).then(function(res) {
    if (id) DB.hopDong = DB.hopDong.map(function(x){return x.id===id?obj:x;});
    else { if(res&&res[0]&&res[0].id) obj.id=res[0].id; DB.hopDong.unshift(obj); }
    closeModal(); updateBadges(); renderHD(); toast(id?'✅ Đã cập nhật':'✅ Đã thêm HĐ mới','success');
  }).catch(function(e) { toast('❌ Lỗi: '+e.message,'error'); });
}
function deleteHD(id) {
  if (!requireAdmin()) return;
  var h = DB.hopDong.find(function(x){ return x.id === id; });
  if(!h) return;

  // Xóa theo thứ tự: bao_cao → unlink thu_chi → hop_dong
  var chain = Promise.resolve();

  // 1. Xóa tất cả bao_cao liên quan (theo hd_so)
  if(SB_URL && SB_KEY && h.so){
    chain = chain.then(function(){
      return fetch(SB_URL+'/rest/v1/bao_cao?hd_so=eq.'+encodeURIComponent(h.so),
        {method:'DELETE', headers:SB_H});
    });
  }

  // 2. Unlink thu_chi: set hd_id = null (giữ lịch sử tài chính, bỏ FK constraint)
  if(SB_URL && SB_KEY){
    chain = chain.then(function(){
      return fetch(SB_URL+'/rest/v1/thu_chi?hd_id=eq.'+id,
        {method:'PATCH', headers:Object.assign({},SB_H,{'Prefer':'return=minimal'}),
         body:JSON.stringify({hd_id: null})});
    }).then(function(){
      // Cập nhật local DB
      DB.thuChi.forEach(function(t){ if(t.hd_id === id){ t.hd_id = null; t.hd = ''; } });
    });
  }

  // 3. Xóa hop_dong
  chain = chain.then(function(){
    return sbDel('hop_dong', id);
  }).then(function(){
    DB.hopDong = DB.hopDong.filter(function(x){ return x.id !== id; });
    closeModal();
    updateBadges();
    renderHD();
    toast('🗑️ Đã xóa hợp đồng', 'info');
  }).catch(function(e){ toast('❌ ' + e.message, 'error'); });
}

// ═══════════════════════════════════════
// KHÁCH HÀNG
// ═══════════════════════════════════════
function goKHPage(p) { PAGES.kh = p; renderKH(); }
function renderKH() {
  var q = document.getElementById('kh-search').value.toLowerCase();
  var rows = DB.khachHang.filter(function(k){
    return !q || k.ten.toLowerCase().includes(q) || k.sdt.includes(q) || (k.maKH||'').toLowerCase().includes(q);
  }).map(function(k){
    var hds     = hdCuaKH(k);
    var doanhSo = hds.reduce(function(s,h){ return s + h.giatri; }, 0);
    return Object.assign({}, k, { hdCount: hds.length, doanhSo: doanhSo });
  }).sort(function(a,b){ return b.doanhSo - a.doanhSo; });
  document.getElementById('kh-count').textContent = rows.length + ' khách hàng';
  var slice = rows.slice((PAGES.kh-1)*PAGE_SIZE, PAGES.kh*PAGE_SIZE);
  document.getElementById('kh-body').innerHTML = slice.map(function(k){
    var maTag = k.maKH ? '<span style="font-family:monospace;font-size:.78rem;font-weight:700;color:var(--blue);background:var(--blue-light);padding:1px 6px;border-radius:4px">'+k.maKH+'</span>' : '<span style="color:var(--muted);font-size:.75rem">—</span>';
    var acts = isAdmin()
      ? '<div class="row-acts">'+
          '<button class="ic-btn" title="Sửa" onclick="event.stopPropagation();openKHEditModal(\''+k.id+'\')">✏️</button>'+
          '<button class="ic-btn del" title="Xóa" onclick="event.stopPropagation();askDelete(\'Xóa KH?\',\''+k.ten+'\',function(){deleteKH(\''+k.id+'\')})">🗑️</button>'+
        '</div>'
      : '';
    return '<tr style="cursor:pointer" onclick="openKHDetail(\''+k.id+'\')" title="Xem chi tiết">'+
      '<td>'+maTag+'</td>'+
      '<td style="font-weight:600">'+k.ten+'</td>'+
      '<td><span class="badge '+(k.loai==='Doanh nghiệp'?'b-blue':k.loai==='Trường học'?'b-green':'b-gray')+'">'+k.loai+'</span></td>'+
      '<td class="mono">'+k.sdt+'</td>'+
      '<td style="text-align:center;font-weight:600">'+k.hdCount+'</td>'+
      '<td><span class="amt-pos">+'+fmtM(k.doanhSo)+'</span></td>'+
      '<td>'+acts+'</td>'+
    '</tr>';
  }).join('');
  renderPager('kh-pager', rows.length, PAGES.kh, 'goKHPage');
}
function openKHModal() {
  if (!requireAdmin()) return;
  var maKH = genMaKH();
  showModal('Thêm Khách hàng','',
    '<div class="form-row"><div class="fg" style="max-width:140px"><label class="fl">Mã KH</label><input class="fc" id="f-ma-kh" value="'+maKH+'" readonly style="background:var(--bg2);color:var(--blue);font-weight:700;font-family:monospace;cursor:default"></div><div class="fg"><label class="fl">Tên <span class="req">*</span></label><input class="fc" id="f-ten" placeholder="Tên cá nhân / công ty"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Loại</label><select class="fc" id="f-loai"><option>Doanh nghiệp</option><option>Trường học</option><option>Cá nhân</option></select></div><div class="fg"><label class="fl">SĐT</label><input class="fc" id="f-sdt" placeholder="0xxx..."></div></div>'+
    '<div class="fg"><label class="fl">Địa chỉ</label><input class="fc" id="f-diachi" placeholder="Địa chỉ..."></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-accent" onclick="saveKH()">💾 Lưu</button>');
}
function saveKH() {
  if (!requireAdmin()) return;
  var ten = document.getElementById('f-ten').value.trim();
  if (!ten) { toast('Nhập tên!','error'); return; }
  var maKH = (document.getElementById('f-ma-kh')||{}).value || genMaKH();
  var row = {ma_kh:maKH,ten:ten,loai:document.getElementById('f-loai').value,so_dt:document.getElementById('f-sdt').value,dia_chi:document.getElementById('f-diachi').value};
  sbPost('khach_hang',row).then(function(res){
    var obj = {id:(res&&res[0]&&res[0].id)||uid(),maKH:maKH,ten:ten,loai:row.loai,sdt:row.so_dt,diaChi:row.dia_chi,hdCount:0,doanhSo:0};
    DB.khachHang.push(obj); closeModal(); renderKH(); toast('✅ Đã thêm KH '+maKH,'success');
  }).catch(function(e){toast('❌ '+e.message,'error');});
}
function deleteKH(id) {
  if (!requireAdmin()) return;
  sbDel('khach_hang',id).then(function(){DB.khachHang=DB.khachHang.filter(function(x){return x.id!==id;});renderKH();toast('🗑️ Đã xóa','info');}).catch(function(e){toast('❌ '+e.message,'error');});
}

// ─── Chi tiết khách hàng ────────────────────────────────────────────────────
function openKHDetail(id) {
  var k = DB.khachHang.find(function(x){return x.id===id;});
  if(!k) return;
  var hds      = hdCuaKH(k);
  var doanhThu = hds.reduce(function(s,h){return s+h.giatri;},0);
  var daThu    = hds.reduce(function(s,h){return s+h.dathu;},0);
  var conNo    = doanhThu - daThu;
  var loaiCls  = k.loai==='Doanh nghiệp'?'b-blue':k.loai==='Trường học'?'b-green':'b-gray';
  var ttMap    = {cho_xe:'Chờ TH',dang_chay:'Đang chạy',hoan_thanh:'Hoàn thành'};
  var ttCls    = {cho_xe:'b-gray',dang_chay:'b-blue',hoan_thanh:'b-green'};

  // ---- bảng HĐ gần nhất (tối đa 8) ----
  var recentHD = hds.slice().sort(function(a,b){return (b.ngay||'').localeCompare(a.ngay||'');}).slice(0,8);
  var hdRows = recentHD.length
    ? recentHD.map(function(h){
        return '<tr>'+
          '<td style="font-family:monospace;font-size:.78rem">'+h.so+'</td>'+
          '<td style="font-size:.8rem">'+fmtD(h.ngay)+'</td>'+
          '<td style="font-size:.8rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.tuyen||'—')+'</td>'+
          '<td style="text-align:right;font-size:.82rem;font-weight:600">'+fmtM(h.giatri)+'</td>'+
          '<td style="text-align:right;font-size:.82rem;color:'+(h.dathu>=h.giatri?'var(--green)':'var(--orange)')+'">'+fmtM(h.dathu)+'</td>'+
          '<td><span class="badge '+(ttCls[h.tt]||'b-gray')+'" style="font-size:.68rem">'+(ttMap[h.tt]||h.tt)+'</span></td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">Chưa có hợp đồng</td></tr>';

  var adminBtns = isAdmin()
    ? '<button class="btn btn-ghost" onclick="closeModal();openKHEditModal(\''+id+'\')">✏️ Sửa thông tin</button>'+
      '<button class="btn" style="background:var(--red-light);color:var(--red);border:1px solid #fecaca" onclick="closeModal();askDelete(\'Xóa khách hàng?\',\''+k.ten+'\',function(){deleteKH(\''+id+'\')})">🗑️ Xóa</button>'
    : '';

  showModal(
    'Chi tiết khách hàng',
    '',
    // ── Header ──
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">'+
      (k.maKH?'<span style="font-family:monospace;font-size:.9rem;font-weight:700;color:var(--blue);background:var(--blue-light);padding:3px 10px;border-radius:6px;white-space:nowrap">'+k.maKH+'</span>':'')+
      '<div style="flex:1">'+
        '<div style="font-size:1.05rem;font-weight:700;line-height:1.3">'+k.ten+'</div>'+
        '<div style="margin-top:3px"><span class="badge '+loaiCls+'">'+k.loai+'</span></div>'+
      '</div>'+
    '</div>'+
    // ── Thông tin liên lạc ──
    '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;font-size:.84rem;color:var(--text2)">'+
      '<div>📞 <span style="color:var(--text1);font-weight:500">'+(k.sdt||'—')+'</span></div>'+
      '<div>📍 <span style="color:var(--text1)">'+(k.diaChi||'Chưa có địa chỉ')+'</span></div>'+
    '</div>'+
    // ── 4 ô thống kê ──
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1.4rem;font-weight:700;color:var(--blue)">'+hds.length+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Hợp đồng</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:var(--text1)">'+fmtM(doanhThu)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Tổng doanh thu</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:var(--green)">'+fmtM(daThu)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Đã thu</div>'+
      '</div>'+
      '<div style="background:'+(conNo>0?'#fef2f2':'var(--bg2)')+';border-radius:8px;padding:10px;text-align:center;border:'+(conNo>0?'1px solid #fecaca':'1px solid transparent')+'">'+
        '<div style="font-size:1rem;font-weight:700;color:'+(conNo>0?'var(--red)':'var(--text3)')+'">'+fmtM(conNo)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">'+(conNo>0?'⚠️ Còn nợ':'Không nợ')+'</div>'+
      '</div>'+
    '</div>'+
    // ── Danh sách HĐ ──
    '<div style="font-weight:600;font-size:.83rem;margin-bottom:6px;color:var(--text2)">📋 Hợp đồng'+(hds.length>8?' ('+hds.length+' tổng, hiển thị 8 gần nhất)':' ('+hds.length+')')+'</div>'+
    '<div class="table-wrap" style="max-height:320px;overflow-y:auto;border-radius:6px;border:1px solid var(--border)">'+
      '<table class="dt" style="min-width:440px;font-size:.82rem">'+
        '<thead><tr><th>Số HĐ</th><th>Ngày</th><th>Tuyến</th><th style="text-align:right">Giá trị</th><th style="text-align:right">Đã thu</th><th>Trạng thái</th></tr></thead>'+
        '<tbody>'+hdRows+'</tbody>'+
      '</table>'+
    '</div>',
    // ── Footer buttons ──
    adminBtns + '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
  );
}

// ─── Sửa thông tin khách hàng ───────────────────────────────────────────────
function openKHEditModal(id) {
  if (!requireAdmin()) return;
  var k = DB.khachHang.find(function(x){return x.id===id;});
  if(!k) return;
  showModal('Sửa Khách hàng', k.maKH||'',
    '<div class="form-row">'+
      '<div class="fg" style="max-width:140px"><label class="fl">Mã KH</label>'+
        '<input class="fc" value="'+(k.maKH||'')+'" readonly style="background:var(--bg2);color:var(--blue);font-weight:700;font-family:monospace;cursor:default">'+
      '</div>'+
      '<div class="fg"><label class="fl">Tên <span class="req">*</span></label><input class="fc" id="ef-ten" value="'+k.ten+'" placeholder="Tên cá nhân / công ty"></div>'+
    '</div>'+
    '<div class="form-row">'+
      '<div class="fg"><label class="fl">Loại</label>'+
        '<select class="fc" id="ef-loai">'+
          '<option'+(k.loai==='Doanh nghiệp'?' selected':'')+'>Doanh nghiệp</option>'+
          '<option'+(k.loai==='Trường học'?' selected':'')+'>Trường học</option>'+
          '<option'+(k.loai==='Cá nhân'?' selected':'')+'>Cá nhân</option>'+
        '</select>'+
      '</div>'+
      '<div class="fg"><label class="fl">SĐT</label><input class="fc" id="ef-sdt" value="'+(k.sdt||'')+'" placeholder="0xxx..."></div>'+
    '</div>'+
    '<div class="fg"><label class="fl">Địa chỉ</label><input class="fc" id="ef-diachi" value="'+(k.diaChi||'')+'" placeholder="Địa chỉ..."></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button>'+
    '<button class="btn btn-accent" onclick="saveKHEdit(\''+id+'\')">💾 Lưu thay đổi</button>'
  );
}
function saveKHEdit(id) {
  if (!requireAdmin()) return;
  var ten = (document.getElementById('ef-ten')||{}).value;
  if(!ten||!ten.trim()){toast('Nhập tên KH!','error');return;}
  ten = ten.trim();

  // Lưu lại tên cũ trước khi sửa để đồng bộ hop_dong
  var khObj = DB.khachHang.find(function(x){return x.id===id;});
  var tenCu = khObj ? khObj.ten : '';
  var tenDoi = tenCu && tenCu !== ten; // true nếu tên thực sự thay đổi

  var row = {
    ten:     ten,
    loai:    document.getElementById('ef-loai').value,
    so_dt:   document.getElementById('ef-sdt').value,
    dia_chi: document.getElementById('ef-diachi').value
  };

  // Cập nhật khach_hang — chỉ cần sửa bảng KH, hop_dong tham chiếu qua ma_kh (bất biến)
  sbPatch('khach_hang', id, row)
  .then(function(){
    // Cập nhật local cache khach_hang
    DB.khachHang = DB.khachHang.map(function(x){
      return x.id===id ? Object.assign({},x,{ten:ten,loai:row.loai,sdt:row.so_dt,diaChi:row.dia_chi}) : x;
    });
    // Cập nhật tên hiển thị trong DB.hopDong cục bộ (chỉ để UI hiện đúng tên mới ngay)
    // Việc tìm HĐ vẫn dùng ma_kh nên đổi tên không ảnh hưởng liên kết
    if(tenDoi){
      DB.hopDong = DB.hopDong.map(function(h){
        return h.maKH && h.maKH===khObj.maKH ? Object.assign({},h,{kh:ten}) : h;
      });
    }
    closeModal();
    renderKH();
    var hdCount = hdCuaKH(DB.khachHang.find(function(x){return x.id===id;})||{}).length;
    toast('✅ Đã cập nhật' + (tenDoi ? ' · ' + hdCount + ' HĐ vẫn được giữ nguyên' : ''), 'success');
  })
  .catch(function(e){toast('❌ '+e.message,'error');});
}

// ═══════════════════════════════════════
// XE & TÀI XẾ
// ═══════════════════════════════════════
var xeTab='xe';
function switchXeTab(t,el){xeTab=t;document.getElementById('xe-panel').style.display=t==='xe'?'':'none';document.getElementById('taixe-panel').style.display=t==='taixe'?'':'none';document.querySelectorAll('#page-xe .tab').forEach(function(b){b.classList.remove('active');});el.classList.add('active');renderXe();}
function renderXe(){if(xeTab==='xe')renderXeGrid();else renderTaiXe();}
function renderXeGrid(){
  var st={dang_chay:{lbl:'Đang chạy',cls:'xs-busy',ico:'🚌'},san_sang:{lbl:'Sẵn sàng',cls:'xs-ok',ico:'✅'},bao_duong:{lbl:'Bảo dưỡng',cls:'xs-warn',ico:'🔧'}};
  document.getElementById('xe-grid').innerHTML=DB.xe.map(function(x){var s=st[x.tt]||{lbl:x.tt,cls:'xs-ok',ico:'❓'};var dk=Math.round((new Date(x.dangKiem)-new Date())/864e5);var thuCur=DB.thuChi.filter(function(t){return t.xe===x.bien&&t.type==='thu'&&getMY(t.ngay)===DB_MONTH;}).reduce(function(s,t){return s+t.sotien;},0);var hdCount=DB.hopDong.filter(function(h){return h.xe===x.bien;}).length;return'<div class="xe-card"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px"><div><div class="xe-plate">'+x.bien+'</div><div class="xe-type">'+x.loai+' · '+x.nam+'</div></div><span class="xe-status '+s.cls+'">'+s.ico+' '+s.lbl+'</span></div><div class="xe-stats"><div class="xe-stat"><div class="xe-stat-lbl">Km đã chạy</div><div class="xe-stat-val">'+fmt(x.km)+' km</div></div><div class="xe-stat"><div class="xe-stat-lbl">Đăng kiểm</div><div class="xe-stat-val" style="color:'+(dk<60?'var(--orange)':'inherit')+'">'+fmtD(x.dangKiem)+'</div></div><div class="xe-stat"><div class="xe-stat-lbl">Bảo hiểm</div><div class="xe-stat-val">'+fmtD(x.baoHiem)+'</div></div><div class="xe-stat"><div class="xe-stat-lbl">Tổng HĐ</div><div class="xe-stat-val">'+hdCount+' HĐ</div></div></div>'+(dk<60?'<div class="xe-alert">⚠️ Đăng kiểm còn '+dk+' ngày!</div>':'')+'<div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-accent btn-sm" style="flex:1" onclick="openXeDetail(\''+x.id+'\')">🔍 Chi tiết</button>'+(isAdmin()?'<button class="btn btn-ghost btn-sm" onclick="openXeModal(\''+x.id+'\')">✏️</button><button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #fecaca" onclick="askDelete(\'Xóa xe '+x.bien+'?\',\'Tất cả dữ liệu liên quan sẽ bị mất.\',function(){deleteXe(\''+x.id+'\')})">🗑️</button>':'')+'</div></div>';}).join('');}
function openXeModal(id){
  if(!requireAdmin())return;
  var x=id?DB.xe.find(function(v){return v.id===id;}):null;if(!x)x={};
  var ttOpts=['san_sang','dang_chay','bao_duong'].map(function(v){return'<option value="'+v+'"'+(x.tt===v?' selected':'')+'>'+{san_sang:'✅ Sẵn sàng',dang_chay:'🚌 Đang chạy',bao_duong:'🔧 Bảo dưỡng'}[v]+'</option>';}).join('');
  showModal(id?'Sửa thông tin xe':'Thêm xe mới',id?x.bien:'',
    '<div class="form-row"><div class="fg"><label class="fl">Biển số <span class="req">*</span></label><input class="fc" id="xf-bien" value="'+(x.bien||'')+'" placeholder="51B-12345"></div><div class="fg"><label class="fl">Loại xe <span class="req">*</span></label><input class="fc" id="xf-loai" value="'+(x.loai||'')+'" placeholder="Toyota Hiace"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Năm sản xuất</label><input type="number" class="fc" id="xf-nam" value="'+(x.nam||2020)+'"></div><div class="fg"><label class="fl">Km đã chạy</label><input type="text" inputmode="numeric" class="fc" id="xf-km" value="'+(x.km?fmt(x.km):'')+'" placeholder="0" oninput="fmtInput(this)"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Hạn đăng kiểm</label><input type="date" class="fc" id="xf-dk" value="'+(x.dangKiem||'')+'"></div><div class="fg"><label class="fl">Hạn bảo hiểm</label><input type="date" class="fc" id="xf-bh" value="'+(x.baoHiem||'')+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Km thay nhớt gần nhất</label><input type="text" inputmode="numeric" class="fc" id="xf-nhot" value="'+(x.kmThayNhot!=null?fmt(x.kmThayNhot):'')+'" placeholder="VD: 45000" oninput="fmtInput(this)"></div><div class="fg" style="display:flex;align-items:flex-end;padding-bottom:2px"><span style="font-size:.72rem;color:var(--text3)">Hạn thay nhớt tiếp theo = Km trên + 10.000 km</span></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Dung tích bình dầu (lít)</label><input type="number" class="fc" id="xf-binh" value="'+(x.dungTichBinh||'')+'" placeholder="VD: 200 (xe 45 chỗ)"></div><div class="fg" style="display:flex;align-items:flex-end;padding-bottom:2px"><span style="font-size:.72rem;color:var(--text3)">Dùng để tính mức dầu còn lại ước tính sau mỗi chuyến</span></div></div>'+
    '<div style="border-top:1px solid var(--border);margin:8px 0 10px;padding-top:10px"><div style="font-size:.72rem;font-weight:700;color:var(--text2);margin-bottom:8px">⛽ Định mức & giá dầu tham chiếu</div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Định mức tiêu hao <span style="font-size:.68rem;color:var(--text3)">(L/100km)</span></label><input type="number" step="0.1" class="fc" id="xf-dinhmuc" value="'+(x.dinhMuc||'')+'" placeholder="VD: 25 (xe 45 chỗ)"></div><div class="fg"><label class="fl">Giá dầu tham chiếu <span style="font-size:.68rem;color:var(--text3)">(đ/lít)</span></label><input type="text" inputmode="numeric" class="fc" id="xf-giadau" value="'+(x.giaDauTK?fmt(x.giaDauTK):'')+'" placeholder="VD: 22.000" oninput="fmtInput(this)"></div></div>'+
    '<div style="font-size:.7rem;color:var(--text3);margin-bottom:10px">💡 Dùng để ước tính chi phí nhiên liệu khi tài xế không báo cáo đổ dầu trong chuyến</div>'+
    '<div class="fg"><label class="fl">Trạng thái</label><select class="fc" id="xf-tt">'+ttOpts+'</select></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-accent" onclick="saveXe(\''+(id||'')+'\')">💾 Lưu</button>');
}
function saveXe(id){
  if(!requireAdmin())return;
  var bien=document.getElementById('xf-bien').value.trim(),loai=document.getElementById('xf-loai').value.trim();
  if(!bien||!loai){toast('Nhập biển số và loại xe!','error');return;}
  var kmNhotRaw=readMoney('xf-nhot');
  var binhRaw=parseInt((document.getElementById('xf-binh')||{}).value)||null;
  var dinhMucRaw=parseFloat((document.getElementById('xf-dinhmuc')||{}).value)||null;
  var giaDauRaw=readMoney('xf-giadau')||null;
  var obj={id:id||uid(),bien:bien,loai:loai,nam:parseInt(document.getElementById('xf-nam').value)||2020,km:readMoney('xf-km'),dangKiem:document.getElementById('xf-dk').value,baoHiem:document.getElementById('xf-bh').value,kmThayNhot:kmNhotRaw||null,dungTichBinh:binhRaw,dinhMuc:dinhMucRaw,giaDauTK:giaDauRaw,tt:document.getElementById('xf-tt').value};
  var row={bien_so:bien,loai_xe:loai,nam_sx:obj.nam,km_chay:obj.km,han_dk:obj.dangKiem||null,han_bh:obj.baoHiem||null,km_thay_nhot:obj.kmThayNhot,dung_tich_binh:obj.dungTichBinh,dinh_muc_l100km:obj.dinhMuc,gia_dau_tk:obj.giaDauTK,trang_thai:obj.tt};
  (id?sbPatch('xe',id,row):sbPost('xe',row)).then(function(res){
    if(id)DB.xe=DB.xe.map(function(x){return x.id===id?obj:x;});
    else{if(res&&res[0]&&res[0].id)obj.id=res[0].id;DB.xe.push(obj);}
    closeModal();renderXeGrid();toast(id?'✅ Đã cập nhật xe':'✅ Đã thêm xe mới','success');
  }).catch(function(e){toast('❌ '+e.message,'error');});
}
function deleteXe(id){if(!requireAdmin())return;sbDel('xe',id).then(function(){DB.xe=DB.xe.filter(function(x){return x.id!==id;});renderXeGrid();toast('🗑️ Đã xóa xe','info');}).catch(function(e){toast('❌ '+e.message,'error');});}
function renderTaiXe(){
  document.getElementById('taixe-body').innerHTML=DB.taiXe.map(function(t){
    var hdList=DB.hopDong.filter(function(h){return h.taixe===t.ten;});
    var hdMonth=hdList.filter(function(h){return getMY(h.ngay)===DB_MONTH;});
    var revMonth=hdMonth.reduce(function(s,h){return s+h.giatri;},0);
    return'<tr onclick="openTXDetailById(\''+t.id+'\')" style="cursor:pointer"><td><div style="display:flex;align-items:center;gap:8px"><div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700">'+t.ten.split(' ').pop()[0]+'</div><div><div style="font-weight:600">'+t.ten+'</div><div style="font-size:.68rem;color:var(--text3)">'+t.sdt+'</div></div></div></td><td class="mono">'+t.cmnd+'</td><td><span class="badge b-blue">'+t.bangLai+'</span></td><td style="text-align:center;font-weight:600">'+hdMonth.length+'<div style="font-size:.65rem;color:var(--text3);font-weight:400">T'+parseInt(DB_MONTH.slice(0,2))+'</div></td><td><span class="amt-pos">+'+fmtM(revMonth)+'</span></td><td>'+fmtM(t.luong)+'</td><td><div class="row-acts"><button class="ic-btn" onclick="event.stopPropagation();openTXDetailById(\''+t.id+'\')">🔍</button>'+(isAdmin()?'<button class="ic-btn" onclick="event.stopPropagation();openTXModal(\''+t.id+'\')">✏️</button><button class="ic-btn del" onclick="event.stopPropagation();askDelete(\'Xóa tài xế '+t.ten+'?\',\'\',function(){deleteTX(\''+t.id+'\')})">🗑️</button>':'')+'</div></td></tr>';
  }).join('');}
function openTXModal(id){
  if(!requireAdmin())return;
  var t=id?DB.taiXe.find(function(x){return x.id===id;}):null;if(!t)t={};
  showModal(id?'Sửa tài xế':'Thêm tài xế mới',id?t.ten:'',
    '<div class="form-row"><div class="fg"><label class="fl">Họ tên <span class="req">*</span></label><input class="fc" id="tf-ten" value="'+(t.ten||'')+'" placeholder="Nguyễn Văn A"></div><div class="fg"><label class="fl">Số điện thoại</label><input class="fc" id="tf-sdt" value="'+(t.sdt||'')+'" placeholder="09xx..."></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">CMND/CCCD</label><input class="fc" id="tf-cmnd" value="'+(t.cmnd||'')+'" placeholder="0790xxxxxxx"></div><div class="fg"><label class="fl">Ngày sinh</label><input type="date" class="fc" id="tf-ngaysinh" value="'+(t.ngaySinh||'')+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Hạng bằng lái</label><select class="fc" id="tf-bang">'+['B2','C','D','E','F'].map(function(v){return'<option'+(t.bangLai===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div><div class="fg"><label class="fl">Lương cơ bản (VNĐ)</label><input type="text" inputmode="numeric" class="fc" id="tf-luong" value="'+(t.luong?fmt(t.luong):'')+'" placeholder="0" oninput="fmtInput(this)"></div></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-accent" onclick="saveTX(\''+(id||'')+'\')">💾 Lưu</button>');
}
function saveTX(id){
  if(!requireAdmin())return;
  var ten=document.getElementById('tf-ten').value.trim();
  if(!ten){toast('Nhập họ tên tài xế!','error');return;}
  var obj={id:id||uid(),ten:ten,sdt:document.getElementById('tf-sdt').value,cmnd:document.getElementById('tf-cmnd').value,ngaySinh:document.getElementById('tf-ngaysinh').value,bangLai:document.getElementById('tf-bang').value,luong:readMoney('tf-luong'),chuyen:0,doanhThu:0};
  var row={ho_ten:ten,so_dt:obj.sdt,cmnd:obj.cmnd,bang_lai:obj.bangLai,ngay_sinh:obj.ngaySinh||null,luong_cb:obj.luong};
  (id?sbPatch('tai_xe',id,row):sbPost('tai_xe',row)).then(function(res){
    if(id)DB.taiXe=DB.taiXe.map(function(x){return x.id===id?Object.assign({},x,obj):x;});
    else{if(res&&res[0]&&res[0].id)obj.id=res[0].id;DB.taiXe.push(obj);}
    closeModal();renderTaiXe();toast(id?'✅ Đã cập nhật':'✅ Đã thêm tài xế mới','success');
  }).catch(function(e){toast('❌ '+e.message,'error');});
}
function deleteTX(id){if(!requireAdmin())return;sbDel('tai_xe',id).then(function(){DB.taiXe=DB.taiXe.filter(function(x){return x.id!==id;});renderTaiXe();toast('🗑️ Đã xóa tài xế','info');}).catch(function(e){toast('❌ '+e.message,'error');});}

// ─── Chi tiết tài xế (dùng từ Dashboard & Báo cáo) ──────────────────────────
// ten: tên tài xế (plain string); filterYM: "MM/YYYY" nếu muốn lọc theo tháng, null = tất cả
function openTXDetail(tenEncoded, filterYM){
  var ten=decodeURIComponent(tenEncoded);
  var txInfo=DB.taiXe.find(function(x){return x.ten===ten;})||{ten:ten};
  var allHDs=DB.hopDong.filter(function(h){return h.taixe===ten;});
  var hds=filterYM?allHDs.filter(function(h){return getMY(h.ngay||h.ngay_di||'')===filterYM;}):allHDs;
  hds=hds.slice().sort(function(a,b){return(b.ngay||'').localeCompare(a.ngay||'');});
  var doanhThu=hds.reduce(function(s,h){return s+h.giatri;},0);
  var daThu=hds.reduce(function(s,h){return s+h.dathu;},0);
  var conNo=doanhThu-daThu;
  var ttMap={cho_xe:'Chờ TH',dang_chay:'Đang chạy',hoan_thanh:'Hoàn thành'};
  var ttCls={cho_xe:'b-gray',dang_chay:'b-blue',hoan_thanh:'b-green'};
  var scopeLbl=filterYM?'Tháng '+filterYM:'Toàn bộ';
  var hdRows=hds.length
    ?hds.map(function(h){
        return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" '
          +'style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'">'+
          '<td style="font-family:monospace;font-size:.78rem;color:var(--blue)">'+h.so+'</td>'+
          '<td style="font-size:.8rem">'+fmtD(h.ngay)+'</td>'+
          '<td style="font-size:.8rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.kh||'—')+'</td>'+
          '<td style="font-size:.8rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.tuyen||'—')+'</td>'+
          '<td style="font-size:.78rem;color:var(--text2)">'+(h.xe||'—')+'</td>'+
          '<td style="text-align:right;font-size:.82rem;font-weight:600">'+fmtM(h.giatri)+'</td>'+
          '<td style="text-align:right;font-size:.82rem;color:'+(h.dathu>=h.giatri?'var(--green)':'var(--orange)')+'">'+fmtM(h.dathu)+'</td>'+
          '<td><span class="badge '+(ttCls[h.tt]||'b-gray')+'" style="font-size:.68rem">'+(ttMap[h.tt]||h.tt)+'</span></td>'+
        '</tr>';
      }).join('')
    :'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Không có hợp đồng'+(filterYM?' trong '+filterYM:'')+'</td></tr>';
  showModal(
    '🧑‍✈️ '+ten,
    scopeLbl+' · '+(txInfo.sdt||txInfo.phone?'📞 '+(txInfo.sdt||txInfo.phone||''):'Tài xế'),
    // ── Header thống kê ──
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1.4rem;font-weight:700;color:var(--blue)">'+hds.length+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Số chuyến</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:var(--text1)">'+fmtM(doanhThu)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Tổng doanh thu</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:var(--green)">'+fmtM(daThu)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Đã thu</div>'+
      '</div>'+
      '<div style="background:'+(conNo>0?'#fef2f2':'var(--bg2)')+';border-radius:8px;padding:10px;text-align:center;border:'+(conNo>0?'1px solid #fecaca':'1px solid transparent')+'">'+
        '<div style="font-size:1rem;font-weight:700;color:'+(conNo>0?'var(--red)':'var(--text3)')+'">'+fmtM(conNo)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">'+(conNo>0?'⚠️ Còn nợ':'Không nợ')+'</div>'+
      '</div>'+
    '</div>'+
    // ── Thông tin bổ sung ──
    (txInfo.bangLai||txInfo.xe?
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:.82rem;color:var(--text2)">'+
        (txInfo.bangLai?'<div>📄 Bằng lái: <span style="color:var(--text1);font-weight:600">'+txInfo.bangLai+'</span></div>':'')+
        (txInfo.xe?'<div>🚌 Xe phụ trách: <span style="color:var(--text1);font-weight:600">'+txInfo.xe+'</span></div>':'')+
        (allHDs.length!==hds.length?'<div style="color:var(--text3)">Tổng tất cả: <b>'+allHDs.length+'</b> chuyến</div>':'')+
      '</div>':'') +
    // ── Bảng HĐ ──
    '<div style="font-weight:600;font-size:.83rem;margin-bottom:6px;color:var(--text2)">📋 Hợp đồng'+
      (filterYM?' tháng '+filterYM:'')+' ('+hds.length+')</div>'+
    '<div class="table-wrap" style="max-height:360px;overflow-y:auto;border-radius:6px;border:1px solid var(--border)">'+
      '<table class="dt" style="min-width:560px;font-size:.82rem">'+
        '<thead><tr><th>Số HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Tuyến</th><th>Xe</th><th style="text-align:right">Giá trị</th><th style="text-align:right">Đã thu</th><th>Trạng thái</th></tr></thead>'+
        '<tbody>'+hdRows+'</tbody>'+
      '</table>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
  );
}

// ═══════════════════════════════════════
// THU CHI
// ═══════════════════════════════════════
var tcTab='all';
function switchTCTab(t,el){tcTab=t;document.querySelectorAll('#page-thuchi .tab').forEach(function(b){b.classList.remove('active');});el.classList.add('active');PAGES.tc=1;renderTC();}
function onTCMonthChange(){var v=document.getElementById('tc-month').value;var dr=document.getElementById('tc-date-range');if(v==='custom'){dr.style.display='flex';var now=new Date();var y=now.getFullYear();var m=String(now.getMonth()+1).padStart(2,'0');document.getElementById('tc-from').value=y+'-'+m+'-01';document.getElementById('tc-to').value=y+'-'+m+'-'+new Date(y,now.getMonth()+1,0).getDate();}else{dr.style.display='none';}PAGES.tc=1;renderTCAll();}
function clearDateRange(){document.getElementById('tc-month').value='04/2026';document.getElementById('tc-date-range').style.display='none';PAGES.tc=1;renderTCAll();}
function getTCFilter(){var v=document.getElementById('tc-month').value;if(v==='custom'){var from=document.getElementById('tc-from').value;var to=document.getElementById('tc-to').value;return function(t){return(!from||t.ngay>=from)&&(!to||t.ngay<=to);};}return function(t){return getMY(t.ngay)===v;};}
function getTCLabel(){var v=document.getElementById('tc-month').value;if(v==='custom'){var from=document.getElementById('tc-from').value;var to=document.getElementById('tc-to').value;return fmtD(from)+' → '+fmtD(to);}return 'Tháng '+v;}
function renderTCAll(){renderTCKPI();renderTCBar();renderTCDonut();renderTC();}
function renderTCKPI(){
  var f=getTCFilter();var tc=DB.thuChi.filter(f);
  var thu=tc.filter(function(t){return t.type==='thu';}).reduce(function(s,t){return s+t.sotien;},0);
  var chi=tc.filter(function(t){return t.type==='chi';}).reduce(function(s,t){return s+t.sotien;},0);
  var prev=DB.thuChi.filter(function(t){return getMY(t.ngay)==='03/2026';});
  var thu3=prev.filter(function(t){return t.type==='thu';}).reduce(function(s,t){return s+t.sotien;},0);
  var chi3=prev.filter(function(t){return t.type==='chi';}).reduce(function(s,t){return s+t.sotien;},0);
  var cong=DB.hopDong.filter(function(h){return h.giatri>h.dathu;}).reduce(function(s,h){return s+(h.giatri-h.dathu);},0);
  var kpis=[{cls:'c-green',ic:'ic-green',ico:'💰',lbl:'Tổng thu',val:fmtM(thu),chg:pct(thu,thu3),sub:'vs tháng 3'},{cls:'c-red',ic:'ic-red',ico:'💸',lbl:'Tổng chi',val:fmtM(chi),chg:pct(chi,chi3),sub:'vs tháng 3'},{cls:'c-blue',ic:'ic-blue',ico:'📈',lbl:'Lợi nhuận',val:fmtM(thu-chi),chg:pct(thu-chi,thu3-chi3),sub:'vs tháng 3'},{cls:'c-orange',ic:'ic-orange',ico:'⏳',lbl:'Công nợ',val:fmtM(cong),chg:'0',sub:DB.hopDong.filter(function(h){return h.giatri>h.dathu;}).length+' HĐ'}];
  var kpiActions=['switchTCTab(\'thu\',document.querySelector(\'#page-thuchi .tab-thu\'))','switchTCTab(\'chi\',document.querySelector(\'#page-thuchi .tab-chi\'))','switchTCTab(\'all\',document.querySelector(\'#page-thuchi .tab:first-child\'))','showCongNoModal()'];
  document.getElementById('tc-kpi').innerHTML=kpis.map(function(c,i){var up=parseFloat(c.chg)>=0;var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':c.cls==='c-blue'?'accent':'orange';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s;cursor:pointer" onclick="'+kpiActions[i]+'" title="Bấm để xem chi tiết"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="tag '+(up?'tag-up':'tag-down')+'">'+(up?'▲':'▼')+' '+Math.abs(c.chg)+'%</span><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');}
function showCongNoModal(){
  var list=DB.hopDong.filter(function(h){return h.giatri>h.dathu;}).sort(function(a,b){return(b.giatri-b.dathu)-(a.giatri-a.dathu);});
  var total=list.reduce(function(s,h){return s+(h.giatri-h.dathu);},0);
  if(!list.length){showModal('Công nợ chưa thu','Tất cả hợp đồng','<div style="text-align:center;padding:40px;color:var(--text3);font-size:.85rem">✅ Không có công nợ nào cần thu</div>','<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>');return;}
  var rows=list.map(function(h){
    var con=h.giatri-h.dathu;
    var pct=h.giatri?Math.round(h.dathu/h.giatri*100):0;
    var urgent=con>20e6;
    return'<tr style="cursor:pointer" onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" title="Xem chi tiết HĐ '+h.so+'">'
      +'<td><span class="mono" style="color:var(--blue);font-size:.75rem">'+h.so+'</span></td>'
      +'<td style="font-size:.78rem;font-weight:500">'+h.kh+'</td>'
      +'<td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:5px;background:var(--surface2);border-radius:3px"><div style="width:'+pct+'%;height:100%;background:var(--green);border-radius:3px"></div></div><span style="font-size:.67rem;color:var(--text3);min-width:28px">'+pct+'%</span></div></td>'
      +'<td style="text-align:right"><span style="font-size:.72rem;color:var(--text3)">'+fmtM(h.dathu)+'</span><span style="color:var(--text3);font-size:.68rem"> / '+fmtM(h.giatri)+'</span></td>'
      +'<td style="text-align:right"><span style="font-weight:700;color:'+(urgent?'var(--red)':'var(--orange)')+'">'+fmtM(con)+'</span>'+(urgent?'<span style="font-size:.6rem;background:var(--red);color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px">!</span>':'')+'</td>'
      +'<td>'+((TTMAP&&TTMAP[h.tt])||h.tt)+'</td>'
      +'</tr>';
  }).join('');
  var body='<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'
    +'<span style="font-size:.78rem;color:var(--text3)">'+list.length+' hợp đồng còn nợ</span>'
    +'<span style="font-weight:700;color:var(--orange);font-size:.9rem">Tổng: '+fmtM(total)+'</span>'
    +'</div>'
    +'<div style="overflow-x:auto"><table class="dt" style="width:100%;font-size:.75rem">'
    +'<thead><tr><th>Số HĐ</th><th>Khách hàng</th><th style="min-width:80px">Đã thu</th><th style="text-align:right">Giá trị / Đã thu</th><th style="text-align:right">Còn lại</th><th>Trạng thái</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>';
  showModal('💳 Công nợ chưa thu','Danh sách hợp đồng còn dư — bấm để mở chi tiết',body,'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button><button class="btn btn-blue" onclick="closeModal();navToHD(\'cong_no\')">Xem trong HĐ →</button>');
}
function renderTCBar(){var months=[{l:'T11',ym:'11/2025'},{l:'T12',ym:'12/2025'},{l:'T1',ym:'01/2026'},{l:'T2',ym:'02/2026'},{l:'T3',ym:'03/2026'},{l:'T4',ym:'04/2026'}];var cur=document.getElementById('tc-month').value;var bd=months.map(function(m){var tc=DB.thuChi.filter(function(t){return getMY(t.ngay)===m.ym;});return{l:m.l,thu:tc.filter(function(t){return t.type==='thu';}).reduce(function(s,t){return s+t.sotien;},0),chi:tc.filter(function(t){return t.type==='chi';}).reduce(function(s,t){return s+t.sotien;},0),cur:m.ym===cur};});var mx=Math.max.apply(null,bd.map(function(b){return Math.max(b.thu,b.chi);}));mx=mx||1;document.getElementById('tc-bar').innerHTML=bd.map(function(b){var th=Math.max(3,Math.round(b.thu/mx*100));var ch=Math.max(b.chi?3:0,Math.round(b.chi/mx*100));return'<div class="bar-group"><div class="bars"><div class="bar" style="height:'+th+'%;background:'+(b.cur?'#15803d':'#86efac')+'"></div><div class="bar" style="height:'+ch+'%;background:'+(b.cur?'#ef4444':'#fca5a5')+'"></div></div><div class="bar-lbl" style="'+(b.cur?'color:var(--green);font-weight:700':'')+'">'+b.l+(b.cur?' ●':'')+'</div></div>';}).join('');}
function renderTCDonut(){var f=getTCFilter();var chi=DB.thuChi.filter(function(t){return t.type==='chi'&&f(t);});var total=chi.reduce(function(s,t){return s+t.sotien;},0);var cats={};chi.forEach(function(t){cats[t.loai]=(cats[t.loai]||0)+t.sotien;});var sorted=Object.entries(cats).sort(function(a,b){return b[1]-a[1];});var colors=['#2563eb','#16a34a','#ea580c','#ca8a04','#94a3b8'];document.getElementById('tc-donut-val').textContent=fmtM(total);if(!sorted.length){document.getElementById('tc-donut').style.background='var(--surface2)';document.getElementById('tc-donut-legend').innerHTML='<div style="color:var(--text3);font-size:.75rem">Chưa có dữ liệu</div>';return;}var conic='',acc=0;sorted.forEach(function(entry,i){var p=Math.round(entry[1]/total*100);conic+=colors[i%5]+' '+acc+'% '+(acc+p)+'%'+(i<sorted.length-1?',':'');acc+=p;});document.getElementById('tc-donut').style.background='conic-gradient('+conic+')';document.getElementById('tc-donut-legend').innerHTML=sorted.map(function(entry,i){return'<div class="dl-item"><div class="dl-dot" style="background:'+colors[i%5]+'"></div><span class="dl-name">'+entry[0]+'</span><span class="dl-val">'+fmtM(entry[1])+'</span><span class="dl-pct">'+Math.round(entry[1]/total*100)+'%</span></div>';}).join('');}
function goTCPage(p){PAGES.tc=p;renderTC();}
function renderTC(){
  var f=getTCFilter();var q=document.getElementById('tc-search').value.toLowerCase();var cat=document.getElementById('tc-cat').value;
  var rows=DB.thuChi.filter(function(t){return f(t)&&(tcTab==='all'||t.type===tcTab)&&(!q||[t.mota,t.kh,t.xe,t.loai,t.hd].join(' ').toLowerCase().includes(q))&&(!cat||t.loai===cat);}).sort(function(a,b){return b.ngay.localeCompare(a.ngay)||b.gio.localeCompare(a.gio);});
  var allM=DB.thuChi.filter(f);
  var sumThu=allM.filter(function(t){return t.type==='thu';}).reduce(function(s,t){return s+t.sotien;},0);
  var sumChi=allM.filter(function(t){return t.type==='chi';}).reduce(function(s,t){return s+t.sotien;},0);
  document.getElementById('tc-summary').innerHTML='<span style="color:var(--text3);font-size:.7rem;font-weight:400">'+getTCLabel()+'</span><span style="color:var(--green)">↑ '+fmtM(sumThu)+'</span><span style="color:var(--border)">|</span><span style="color:var(--red)">↓ '+fmtM(sumChi)+'</span>';
  document.getElementById('tc-info').textContent=rows.length+' giao dịch';
  document.getElementById('tc-page-info').textContent='Hiển thị '+Math.min(rows.length,PAGES.tc*PAGE_SIZE)+'/'+rows.length+' giao dịch · '+getTCLabel();
  var slice=rows.slice((PAGES.tc-1)*PAGE_SIZE,PAGES.tc*PAGE_SIZE);
  document.getElementById('tc-body').innerHTML=slice.length?slice.map(function(t){var isThu=t.type==='thu';return'<tr onclick="openTCDetail(\''+t.id+'\')"><td><div>'+fmtD(t.ngay)+'</div><div style="font-size:.67rem;color:var(--text3)">'+t.gio+'</div></td><td>'+badgeHTML(t.loai,t.type)+'</td><td><div style="font-weight:500">'+(t.mota||'—')+'</div><div style="font-size:.68rem;color:var(--text3)">'+(t.kh||'—')+'</div></td><td><span class="mono">'+(t.hd||'—')+'</span></td><td><div style="font-size:.75rem">'+(t.xe||'—')+'</div><div style="font-size:.67rem;color:var(--text3)">'+(t.taixe||'—')+'</div></td><td><span class="badge '+(t.httt==='Tiền mặt'?'b-green':'b-blue')+'">'+t.httt+'</span></td><td><span class="'+(isThu?'amt-pos':'amt-neg')+'">'+(isThu?'+':'-')+fmt(t.sotien)+' ₫</span></td><td><div class="row-acts"><button class="ic-btn" onclick="event.stopPropagation();openTCDetail(\''+t.id+'\')">👁️</button><button class="ic-btn del" onclick="event.stopPropagation();askDelete(\'Xóa giao dịch?\',\'\',function(){deleteTC(\''+t.id+'\')})">🗑️</button></div></td></tr>';}).join(''):'<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Không có giao dịch nào</td></tr>';
  renderPager('tc-pager',rows.length,PAGES.tc,'goTCPage');
}
function openTCDetail(id){
  var t=DB.thuChi.find(function(x){return x.id===id;});
  if(!t)return;
  var isThu=t.type==='thu';
  // Tra cứu HĐ liên kết: ưu tiên hd_id, fallback sang t.hd (text)
  var linkedHD=t.hd_id?DB.hopDong.find(function(h){return h.id===t.hd_id;}):null;
  var hdSo=linkedHD?linkedHD.so:(t.hd||'');
  var hdDisplay=linkedHD
    ?('<span onclick="closeModal();setTimeout(function(){openHDDetail(\''+linkedHD.id+'\')},120)" style="color:var(--blue);cursor:pointer;text-decoration:underline;font-weight:600">'+hdSo+'</span>'
      +'<span style="font-size:.72rem;color:var(--text3);margin-left:6px">'+linkedHD.kh+'</span>'
      +'<div style="font-size:.7rem;color:var(--text3);margin-top:2px">'+linkedHD.tuyen+'</div>')
    :(hdSo||'<span style="color:var(--text3)">—</span>');
  var rows=[
    ['Loại',badgeHTML(t.loai,t.type)],
    ['Hình thức',t.httt],
    ['Ngày giờ',fmtD(t.ngay)+' · '+t.gio],
    ['Hợp đồng',hdDisplay],
    ['Xe',t.xe||'—'],
    ['Tài xế',t.taixe||'—'],
    ['Đối tác',t.kh||'—'],
    ['Mô tả',t.mota||'—']
  ];
  var footer=''
    +'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
    +'<button class="btn btn-ghost" style="color:var(--red);border-color:var(--red)" onclick="askDelete(\'Xóa phiếu này?\',\'Thao tác này không thể hoàn tác\',function(){deleteTC(\''+t.id+'\')})">🗑️ Xóa</button>'
    +'<button class="btn" style="background:var(--accent);color:#fff" onclick="closeModal();setTimeout(function(){openTCEdit(\''+t.id+'\')},120)">✏️ Sửa</button>';
  if(linkedHD) footer+='<button class="btn btn-blue" onclick="closeModal();setTimeout(function(){openHDDetail(\''+linkedHD.id+'\')},120)">📄 Xem HĐ '+hdSo+'</button>';
  showModal('Chi tiết giao dịch',fmtD(t.ngay)+' · '+t.gio,
    '<div class="detail-amount '+(isThu?'thu-amt':'chi-amt')+'">'+(isThu?'+ ':' − ')+fmt(t.sotien)+' ₫</div>'
    +'<div class="detail-grid">'+rows.map(function(p){
      return'<div class="detail-item"'+(p[0]==='Đối tác'||p[0]==='Mô tả'||p[0]==='Hợp đồng'?' style="grid-column:1/-1"':'')+'>\'<label>'+p[0]+'</label><div class="dv">'+p[1]+'</div></div>';
    }).join('')+'</div>',
    footer);
}
var _tcModalType='thu'; // lưu type để tcFilterHDByKH biết mode
var _tcEditId=null;     // null = tạo mới; có ID = đang sửa
function openTCModal(type){
  _tcModalType=type;
  _tcEditId=null; // reset về chế độ tạo mới mỗi khi mở modal
  var isThu=type==='thu';
  var loaiOpts=isThu
    ?'<option>Thu hợp đồng</option><option>Đặt cọc</option><option>Thu khác</option>'
    :'<optgroup label="Chi phí hợp đồng"><option>Nhiên liệu</option><option>Cầu đường</option><option>Chi khác</option></optgroup>'
     +'<optgroup label="Chi phí xe (không theo HĐ)"><option>Lương tài xế</option><option>Bảo dưỡng</option><option>Sửa chữa</option><option>Đăng kiểm</option><option>Bảo hiểm</option><option>Định vị</option><option>Phù hiệu</option></optgroup>';
  var xeOpts='<option value="">—</option>'+DB.xe.map(function(x){return'<option value="'+x.bien+'">'+x.bien+'</option>';}).join('');
  var txOpts='<option value="">—</option>'+DB.taiXe.map(function(t){return'<option value="'+t.ten+'">'+t.ten+'</option>';}).join('');
  var today=new Date().toISOString().slice(0,10);var timeNow=new Date().toTimeString().slice(0,5);

  // KH datalist — gợi ý cả tên và mã KH
  var khDatalist='<datalist id="tc-kh-list">'+DB.khachHang.map(function(k){return'<option value="'+k.ten+'">'+(k.maKH?k.maKH+' – ':'')+k.ten+'</option>';}).join('')+'</datalist>';

  // HĐ ban đầu: Thu → chỉ HĐ còn công nợ; Chi → tất cả HĐ
  var hdInitOpts=isThu
    ?('<option value="">— Chọn hợp đồng —</option>'+DB.hopDong.filter(function(h){return h.giatri>h.dathu;}).map(function(h){var con=h.giatri-h.dathu;return'<option value="'+h.id+'">'+h.so+' · '+h.kh+' (còn '+fmtM(con)+')</option>';}).join(''))
    :('<option value="">— Chọn hợp đồng —</option>'+DB.hopDong.map(function(h){return'<option value="'+h.id+'">'+h.so+' · '+h.kh+'</option>';}).join(''));

  // Cả Thu và Chi đều có autocomplete KH + oninput lọc HĐ
  var khLabel=isThu?'Khách hàng':'Đối tác / Khách hàng';
  var khField='<div class="fg" id="tc-fg-kh"><label class="fl">'+khLabel+'</label>'+khDatalist
    +'<input class="fc" id="f-kh" list="tc-kh-list" placeholder="Gõ tên hoặc mã KH để gợi ý..." oninput="tcFilterHDByKH()" autocomplete="off"></div>';

  var hdLabel=isThu
    ?'Hợp đồng liên kết <span style="font-size:.67rem;font-weight:400;color:var(--orange);margin-left:4px">★ chỉ HĐ còn công nợ</span>'
    :'Hợp đồng liên kết <span style="font-size:.67rem;font-weight:400;color:var(--text3);margin-left:4px">Lọc theo KH đã chọn</span>';

  var loaiOnChange=isThu?'':'onchange="tcOnLoaiChange()"';

  showModal(isThu?'💰 Ghi nhận Thu':'💸 Ghi nhận Chi','',
    '<div class="fg"><label class="fl">Loại <span class="req">*</span></label><select class="fc" id="f-loai" '+loaiOnChange+'>'+loaiOpts+'</select></div>'
    +'<div class="form-row"><div class="fg"><label class="fl">Ngày <span class="req">*</span></label><input type="date" class="fc" id="f-ngay" value="'+today+'"></div><div class="fg"><label class="fl">Giờ</label><input type="time" class="fc" id="f-gio" value="'+timeNow+'"></div></div>'
    +'<div class="fg"><label class="fl">Số tiền (VNĐ) <span class="req">*</span></label><input type="text" inputmode="numeric" class="fc" id="f-sotien" placeholder="0" oninput="fmtInput(this)"></div>'
    +khField
    +'<div class="form-row" id="tc-fg-hd-row">'
      +'<div class="fg" id="tc-fg-hd"><label class="fl">'+hdLabel+'</label>'
        +'<select class="fc" id="f-hd" onchange="tcOnHDChange()">'+hdInitOpts+'</select>'
        +'<div id="tc-hd-info" style="display:none;margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:6px;font-size:.72rem;line-height:1.6"></div>'
      +'</div>'
      +'<div class="fg"><label class="fl">Hình thức TT</label><select class="fc" id="f-httt"><option>Chuyển khoản</option><option>Tiền mặt</option></select></div>'
    +'</div>'
    +(isThu?'':'<div id="tc-xe-hint" style="display:none;margin:-6px 0 8px;padding:8px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:7px;font-size:.76rem;color:#166534">🔧 Chi phí này gắn theo xe, không cần điền hợp đồng hay khách hàng.</div>')
    +'<div class="form-row">'
      +'<div class="fg"><label class="fl">Xe'+(isThu?'':'<span id="tc-xe-req-star" style="display:none" class="req"> *</span>')+'</label><select class="fc" id="f-xe" onchange="tcCheckXeMatch()">'+xeOpts+'</select></div>'
      +'<div class="fg" id="tc-fg-taixe"><label class="fl">Tài xế</label><select class="fc" id="f-taixe" onchange="tcCheckXeMatch()">'+txOpts+'</select></div>'
    +'</div>'
    +'<div id="tc-xe-warn" style="display:none;margin:-4px 0 8px;padding:9px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:7px;font-size:.76rem;color:#92400e">⚠️ Xe và tài xế đang chọn không khớp với hợp đồng này, cần xem lại!</div>'
    +'<div class="fg"><label class="fl">Mô tả</label><textarea class="fc" id="f-mota" rows="2" style="resize:vertical"></textarea></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn" id="tc-save-btn" style="background:'+(isThu?'var(--green)':'var(--red)')+';color:#fff" onclick="saveOrUpdateTC(\''+type+'\')">💾 Lưu</button>');
}
// Danh sách loại chi phí xe — không liên quan đến HĐ/KH
var TC_XE_COSTS=['Lương tài xế','Bảo dưỡng','Sửa chữa','Đăng kiểm','Bảo hiểm','Định vị','Phù hiệu'];
function tcOnLoaiChange(){
  var loai=(document.getElementById('f-loai')||{}).value||'';
  var isXeCost=TC_XE_COSTS.indexOf(loai)>-1;
  var isLuong=loai==='Lương tài xế';

  // KH field: mờ nếu chi phí xe
  var fgKH=document.getElementById('tc-fg-kh');
  var fgHD=document.getElementById('tc-fg-hd');
  var fgHDRow=document.getElementById('tc-fg-hd-row');
  var hint=document.getElementById('tc-xe-hint');
  var xeStar=document.getElementById('tc-xe-req-star');
  var fgTX=document.getElementById('tc-fg-taixe');

  function setDim(el,dim){if(!el)return;el.style.opacity=dim?'0.35':'';el.style.pointerEvents=dim?'none':'';if(el.querySelector('input'))el.querySelector('input').disabled=dim;if(el.querySelector('select'))el.querySelector('select').disabled=dim;}

  if(isXeCost){
    setDim(fgKH,true);
    setDim(fgHD,true);
    // Xóa giá trị KH và HĐ để không lưu nhầm
    var khEl=document.getElementById('f-kh');if(khEl){khEl.value='';}
    var hdEl=document.getElementById('f-hd');if(hdEl){hdEl.value='';}
    var hdInfo=document.getElementById('tc-hd-info');if(hdInfo)hdInfo.style.display='none';
    var warn=document.getElementById('tc-xe-warn');if(warn)warn.style.display='none';
    if(hint)hint.style.display='';
    if(xeStar)xeStar.style.display='';
    // Tài xế: hiện bình thường cho Lương tài xế, mờ cho còn lại
    setDim(fgTX,!isLuong);
    if(!isLuong){var txEl=document.getElementById('f-taixe');if(txEl)txEl.value='';}
  } else {
    setDim(fgKH,false);
    setDim(fgHD,false);
    setDim(fgTX,false);
    if(hint)hint.style.display='none';
    if(xeStar)xeStar.style.display='none';
  }
}
function tcFilterHDByKH(){
  var q=(document.getElementById('f-kh').value||'').trim().toLowerCase();
  var sel=document.getElementById('f-hd');if(!sel)return;
  var isThu=_tcModalType==='thu';
  // Tìm KH khớp chính xác (tên hoặc mã)
  var matchKH=DB.khachHang.find(function(k){return k.ten.toLowerCase()===q||(k.maKH&&k.maKH.toLowerCase()===q);});
  var filtered=DB.hopDong.filter(function(h){
    // Thu: chỉ lấy HĐ còn công nợ; Chi: lấy tất cả
    if(isThu&&h.giatri<=h.dathu)return false;
    // Nếu chưa gõ KH → hiện tất cả (theo mode)
    if(!q)return true;
    // Lọc theo KH: khớp chính xác tên hoặc mã, nếu không thì contains
    if(matchKH)return h.kh===matchKH.ten;
    return h.kh.toLowerCase().includes(q)||(h.maKH&&h.maKH.toLowerCase().includes(q));
  });
  sel.innerHTML='<option value="">— Chọn hợp đồng —</option>'+filtered.map(function(h){
    var extra=isThu?' (còn '+fmtM(h.giatri-h.dathu)+')':'';
    return'<option value="'+h.id+'">'+h.so+' · '+h.kh+extra+'</option>';
  }).join('');
  var info=document.getElementById('tc-hd-info');if(info)info.style.display='none';
  var warn=document.getElementById('tc-xe-warn');if(warn)warn.style.display='none';
  // Nếu chỉ còn 1 HĐ → tự chọn luôn
  if(filtered.length===1){sel.value=filtered[0].id;tcOnHDChange();}
}
function tcOnHDChange(){
  var hdId=document.getElementById('f-hd').value;
  var info=document.getElementById('tc-hd-info');
  var warn=document.getElementById('tc-xe-warn');
  if(!hdId){if(info)info.style.display='none';if(warn)warn.style.display='none';return;}
  var h=DB.hopDong.find(function(x){return x.id===hdId;});if(!h)return;
  // Hiển thị thông tin HĐ
  if(info){
    var isThuMode=_tcModalType==='thu';
    var infoHTML='<div style="display:flex;justify-content:space-between;margin-bottom:5px">'
      +'<span style="font-weight:600">'+h.so+'</span>'
      +'<span style="color:var(--text3);font-size:.68rem">'+h.kh+(h.xe?' · '+h.xe:'')+'</span>'
      +'</div>';
    if(isThuMode){
      var con=h.giatri-h.dathu;var pct=h.giatri?Math.round(h.dathu/h.giatri*100):0;
      infoHTML+='<div style="display:flex;align-items:center;gap:8px">'
        +'<div style="flex:1;height:5px;background:#e2e8f0;border-radius:3px"><div style="width:'+pct+'%;height:100%;background:var(--green);border-radius:3px"></div></div>'
        +'<span style="color:var(--text3);font-size:.68rem">Đã thu '+pct+'% · '+fmtM(h.dathu)+' / '+fmtM(h.giatri)+'</span>'
        +'<span style="color:var(--orange);font-weight:700;font-size:.72rem">Còn: '+fmtM(con)+'</span>'
        +'</div>';
    } else {
      infoHTML+='<span style="font-size:.68rem;color:var(--text3)">Tuyến: '+(h.tuyen||'—')+(h.taixe?' · Tài xế: '+h.taixe:'')+'</span>';
    }
    info.innerHTML=infoHTML;info.style.display='';
  }
  // Auto-fill xe và tài xế từ HĐ
  var xeSel=document.getElementById('f-xe');var txSel=document.getElementById('f-taixe');
  if(xeSel&&h.xe){for(var i=0;i<xeSel.options.length;i++){if(xeSel.options[i].value===h.xe){xeSel.value=h.xe;break;}}}
  if(txSel&&h.taixe){for(var j=0;j<txSel.options.length;j++){if(txSel.options[j].value===h.taixe){txSel.value=h.taixe;break;}}}
  if(warn)warn.style.display='none';
}
function tcCheckXeMatch(){
  var hdId=(document.getElementById('f-hd')||{}).value;
  var warn=document.getElementById('tc-xe-warn');if(!warn)return;
  if(!hdId){warn.style.display='none';return;}
  var h=DB.hopDong.find(function(x){return x.id===hdId;});if(!h){warn.style.display='none';return;}
  var xeVal=(document.getElementById('f-xe')||{}).value||'';
  var txVal=(document.getElementById('f-taixe')||{}).value||'';
  var mismatch=(h.xe&&xeVal&&xeVal!==h.xe)||(h.taixe&&txVal&&txVal!==h.taixe);
  warn.style.display=mismatch?'':'none';
}
function saveTC(type){
  var raw=document.getElementById('f-sotien').value.replace(/[.,\s]/g,'');
  var sotien=parseInt(raw);
  if(!sotien||sotien<=0){toast('Nhập số tiền hợp lệ!','error');return;}
  // Validate: chi phí xe bắt buộc phải chọn xe
  var loai=document.getElementById('f-loai').value;
  if(type==='chi'&&TC_XE_COSTS.indexOf(loai)>-1){
    var xeVal=(document.getElementById('f-xe')||{}).value||'';
    if(!xeVal){toast('⚠️ Chi phí <strong>'+loai+'</strong> cần chọn số xe!','error',4000);return;}
  }
  var hdId=document.getElementById('f-hd').value||null;
  var hdSo='';if(hdId){var foundHD=DB.hopDong.find(function(h){return h.id===hdId;});hdSo=foundHD?foundHD.so:'';}
  var obj={id:uid(),type:type,loai:document.getElementById('f-loai').value,ngay:document.getElementById('f-ngay').value,gio:document.getElementById('f-gio').value,sotien:sotien,hd:hdSo,hd_id:hdId,httt:document.getElementById('f-httt').value,xe:document.getElementById('f-xe').value,taixe:document.getElementById('f-taixe').value,kh:document.getElementById('f-kh').value,mota:document.getElementById('f-mota').value};
  var row={loai_gd:type,danh_muc:obj.loai,ngay_gd:obj.ngay,gio_gd:obj.gio,so_tien:sotien,hd_id:hdId,hinh_thuc:obj.httt,bien_so_xe:obj.xe||null,tai_xe:obj.taixe||null,doi_tac:obj.kh||null,mo_ta:obj.mota||null};
  sbPost('thu_chi',row).then(function(res){
    if(res&&res[0]&&res[0].id)obj.id=res[0].id;
    DB.thuChi.unshift(obj);closeModal();renderTCAll();toast('✅ Đã ghi '+(type==='thu'?'thu':'chi')+': '+fmt(sotien)+' ₫','success');
  }).catch(function(e){toast('❌ '+e.message,'error');});
}
function deleteTC(id){sbDel('thu_chi',id).then(function(){DB.thuChi=DB.thuChi.filter(function(x){return x.id!==id;});renderTCAll();toast('🗑️ Đã xóa','info');}).catch(function(e){toast('❌ '+e.message,'error');});}

// Dispatcher: tạo mới hoặc cập nhật tùy theo _tcEditId
function saveOrUpdateTC(type){
  if(_tcEditId) updateTC(_tcEditId,type);
  else saveTC(type);
}

// Cập nhật phiếu thu/chi đã có
function updateTC(id,type){
  var raw=document.getElementById('f-sotien').value.replace(/[.,\s]/g,'');
  var sotien=parseInt(raw);
  if(!sotien||sotien<=0){toast('Nhập số tiền hợp lệ!','error');return;}
  var loai=document.getElementById('f-loai').value;
  if(type==='chi'&&TC_XE_COSTS.indexOf(loai)>-1){
    var xeVal=(document.getElementById('f-xe')||{}).value||'';
    if(!xeVal){toast('⚠️ Chi phí <strong>'+loai+'</strong> cần chọn số xe!','error',4000);return;}
  }
  var hdId=document.getElementById('f-hd').value||null;
  var hdSo='';if(hdId){var fHD=DB.hopDong.find(function(h){return h.id===hdId;});hdSo=fHD?fHD.so:'';}
  var patch={danh_muc:loai,ngay_gd:document.getElementById('f-ngay').value,gio_gd:document.getElementById('f-gio').value,so_tien:sotien,hd_id:hdId,hinh_thuc:document.getElementById('f-httt').value,bien_so_xe:document.getElementById('f-xe').value||null,tai_xe:document.getElementById('f-taixe').value||null,doi_tac:document.getElementById('f-kh').value||null,mo_ta:document.getElementById('f-mota').value||null};
  sbPatch('thu_chi',id,patch).then(function(){
    var idx=DB.thuChi.findIndex(function(x){return x.id===id;});
    if(idx>-1){
      DB.thuChi[idx]=Object.assign({},DB.thuChi[idx],{loai:loai,ngay:patch.ngay_gd,gio:patch.gio_gd,sotien:sotien,hd:hdSo,hd_id:hdId,httt:patch.hinh_thuc,xe:patch.bien_so_xe||'',taixe:patch.tai_xe||'',kh:patch.doi_tac||'',mota:patch.mo_ta||''});
    }
    _tcEditId=null;
    closeModal();renderTCAll();
    toast('✅ Đã cập nhật phiếu '+(type==='thu'?'thu':'chi'),'success');
  }).catch(function(e){toast('❌ '+e.message,'error');});
}

// Mở form sửa phiếu thu/chi — pre-fill toàn bộ dữ liệu cũ
function openTCEdit(id){
  var t=DB.thuChi.find(function(x){return x.id===id;});
  if(!t)return;
  openTCModal(t.type);    // build form (reset _tcEditId=null)
  _tcEditId=id;           // set edit mode SAU khi openTCModal đã reset
  // Đổi tiêu đề modal
  setTimeout(function(){
    var titleEl=document.querySelector('.modal-title');
    if(titleEl)titleEl.textContent=(t.type==='thu'?'✏️ Sửa phiếu Thu':'✏️ Sửa phiếu Chi');
    var saveBtn=document.getElementById('tc-save-btn');
    if(saveBtn)saveBtn.textContent='💾 Cập nhật';
    // Loại
    var loaiSel=document.getElementById('f-loai');
    if(loaiSel){for(var i=0;i<loaiSel.options.length;i++){if(loaiSel.options[i].value===t.loai||loaiSel.options[i].text===t.loai){loaiSel.selectedIndex=i;break;}}
      if(t.type==='chi')tcOnLoaiChange();}
    // Ngày / Giờ
    var ngayEl=document.getElementById('f-ngay');if(ngayEl)ngayEl.value=t.ngay||'';
    var gioEl=document.getElementById('f-gio');if(gioEl)gioEl.value=t.gio||'00:00';
    // Số tiền — hiển thị dạng formatted
    var stEl=document.getElementById('f-sotien');if(stEl){stEl.value=fmt(t.sotien);}
    // Khách hàng
    var khEl=document.getElementById('f-kh');if(khEl)khEl.value=t.kh||'';
    // Hợp đồng liên kết
    var hdSel=document.getElementById('f-hd');
    if(hdSel&&t.hd_id){
      var found=false;
      for(var j=0;j<hdSel.options.length;j++){if(hdSel.options[j].value===t.hd_id){hdSel.selectedIndex=j;found=true;break;}}
      if(!found){
        var lhd=DB.hopDong.find(function(h){return h.id===t.hd_id;});
        if(lhd){var opt=document.createElement('option');opt.value=lhd.id;opt.textContent=lhd.so+' · '+lhd.kh;hdSel.appendChild(opt);hdSel.value=lhd.id;}
      }
      if(hdSel.value)tcOnHDChange();
    }
    // Hình thức TT
    var htttSel=document.getElementById('f-httt');
    if(htttSel){for(var k=0;k<htttSel.options.length;k++){if(htttSel.options[k].value===t.httt||htttSel.options[k].text===t.httt){htttSel.selectedIndex=k;break;}}}
    // Xe / Tài xế
    var xeSel=document.getElementById('f-xe');if(xeSel)xeSel.value=t.xe||'';
    var txSel=document.getElementById('f-taixe');if(txSel)txSel.value=t.taixe||'';
    // Mô tả
    var motaEl=document.getElementById('f-mota');if(motaEl)motaEl.value=t.mota||'';
  },60);
}

// ═══════════════════════════════════════
// CHỐT LƯƠNG THÁNG
// ═══════════════════════════════════════
function chotLuongThang(){
  var now=new Date();
  // Mặc định tháng hiện tại, format YYYY-MM để dùng với input[type=month]
  var defaultMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  function _buildModal(selMonth){
    var parts=selMonth.split('-');
    var y=parseInt(parts[0]),m=parseInt(parts[1]);
    var ym=String(m).padStart(2,'0')+'/'+y; // MM/YYYY cho getMY
    var lastDay=new Date(y,m,0).getDate();
    var ngayChi=y+'-'+String(m).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');

    // Tài xế có lương > 0
    var dsTX=DB.taiXe.filter(function(tx){return tx.luong>0;});

    // Kiểm tra đã phát sinh lương chưa (có bản ghi Lương tài xế trong tháng đó)
    var rows=dsTX.map(function(tx){
      var daCoPhieu=DB.thuChi.some(function(t){
        return t.type==='chi'&&t.loai==='Lương tài xế'&&t.taixe===tx.ten&&getMY(t.ngay)===ym;
      });
      return{tx:tx,daCoPhieu:daCoPhieu};
    });

    var chuaPhieu=rows.filter(function(r){return!r.daCoPhieu;});
    var daPhieu=rows.filter(function(r){return r.daCoPhieu;});

    var tableHTML='<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:.78rem;color:var(--text3)">Ngày chi: <strong>'+ngayChi.split('-').reverse().join('/')+'</strong></span>'
      +'<span style="font-size:.78rem;color:var(--green);font-weight:600">Tổng: '+fmtM(chuaPhieu.reduce(function(s,r){return s+r.tx.luong;},0))+'</span>'
      +'</div>';

    if(!dsTX.length){
      tableHTML+='<div style="padding:24px;text-align:center;color:var(--text3);font-size:.83rem">Chưa có tài xế nào có lương cơ bản. Vào mục Tài xế để cập nhật lương.</div>';
    } else {
      tableHTML+='<table class="dt" style="width:100%;font-size:.78rem"><thead><tr>'
        +'<th style="width:32px"><input type="checkbox" id="luong-chk-all" onchange="document.querySelectorAll(\'.luong-chk\').forEach(function(c){if(!c.disabled)c.checked=this.checked;}.bind(this))"></th>'
        +'<th>Tài xế</th><th style="text-align:right">Lương CB</th><th>Trạng thái</th></tr></thead><tbody>';

      rows.forEach(function(r){
        var disabled=r.daCoPhieu;
        tableHTML+='<tr style="'+(disabled?'opacity:.5':'')+'"><td>'
          +'<input type="checkbox" class="luong-chk" data-ten="'+r.tx.ten+'" '
          +(!disabled?'checked':'')+' '+(disabled?'disabled':'')
          +' onchange="chotLuongUpdateTotal()">'
          +'</td>'
          +'<td style="font-weight:500">'+r.tx.ten+'</td>'
          +'<td>'+(disabled
            ?'<span style="font-family:\'DM Mono\',monospace;font-size:.78rem">'+fmt(r.tx.luong)+' ₫</span>'
            :'<input type="text" inputmode="numeric" class="fc luong-amt" data-ten="'+r.tx.ten+'"'
              +' value="'+fmt(r.tx.luong)+'"'
              +' style="padding:4px 8px;font-size:.78rem;font-family:\'DM Mono\',monospace;text-align:right;width:130px"'
              +' oninput="fmtInput(this);chotLuongUpdateTotal()">')
          +'</td>'
          +'<td>'+(disabled
            ?'<span style="font-size:.68rem;background:var(--surface2);color:var(--text3);padding:2px 7px;border-radius:4px">✓ Đã phát sinh</span>'
            :'<span style="font-size:.68rem;background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:4px">Chưa phát sinh</span>')
          +'</td></tr>';
      });
      tableHTML+='</tbody></table>';
    }

    return{html:tableHTML,ngayChi:ngayChi,ym:ym,chuaPhieu:chuaPhieu.length};
  }

  function _openModal(selMonth){
    var built=_buildModal(selMonth);
    var body='<div class="fg" style="margin-bottom:12px">'
      +'<label class="fl">Chọn tháng</label>'
      +'<input type="month" class="fc" id="luong-month" value="'+selMonth+'" onchange="chotLuongThangRefresh(this.value)" style="max-width:180px">'
      +'</div>'+built.html;
    var footer='<button class="btn btn-ghost" onclick="closeModal()">Hủy</button>'
      +(built.chuaPhieu>0
        ?'<button class="btn btn-green" onclick="chotLuongConfirm(\''+selMonth+'\')">💰 Tạo '+built.chuaPhieu+' phiếu chi lương</button>'
        :'<span style="font-size:.78rem;color:var(--text3);padding:0 12px">Tất cả đã được phát sinh</span>');
    showModal('💰 Chốt lương tháng','Kiểm tra và xác nhận phiếu chi lương tài xế',body,footer);
  }

  _openModal(defaultMonth);
  // Lưu hàm refresh vào global để onchange gọi được
  window.chotLuongThangRefresh=function(v){_openModal(v);};
}

function chotLuongUpdateTotal(){
  var total=0;
  document.querySelectorAll('.luong-chk:checked:not(:disabled)').forEach(function(chk){
    var ten=chk.dataset.ten;
    var inp=document.querySelector('.luong-amt[data-ten="'+ten+'"]');
    if(inp){var v=parseInt((inp.value||'').replace(/[.,\s]/g,''))||0;total+=v;}
  });
  var btn=document.querySelector('#mainModal .btn-green');
  var count=document.querySelectorAll('.luong-chk:checked:not(:disabled)').length;
  if(btn){btn.textContent='💰 Tạo '+count+' phiếu · '+fmtM(total);}
}
function chotLuongConfirm(selMonth){
  var checkboxes=document.querySelectorAll('.luong-chk:checked:not(:disabled)');
  if(!checkboxes.length){toast('Không có tài xế nào được chọn','error');return;}
  var parts=selMonth.split('-');
  var y=parseInt(parts[0]),m=parseInt(parts[1]);
  var lastDay=new Date(y,m,0).getDate();
  var ngayChi=y+'-'+String(m).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
  var ym=String(m).padStart(2,'0')+'/'+y;
  var moTaThang='Tháng '+m+'/'+y;

  // Đọc số tiền từ input (cho phép người dùng đã sửa)
  var tasks=[];
  checkboxes.forEach(function(chk){
    var ten=chk.dataset.ten;
    var inp=document.querySelector('.luong-amt[data-ten="'+ten+'"]');
    var luong=inp?parseInt((inp.value||'').replace(/[.,\s]/g,''))||0:0;
    if(luong>0)tasks.push({ten:ten,luong:luong});
  });
  if(!tasks.length){toast('Số tiền lương không hợp lệ','error');return;}

  closeModal();
  toast('⏳ Đang tạo '+tasks.length+' phiếu chi lương...','info',2000);

  var done=0;var errors=0;
  tasks.forEach(function(task){
    var obj={id:uid(),type:'chi',loai:'Lương tài xế',ngay:ngayChi,gio:'23:59',
      sotien:task.luong,hd:'',hd_id:null,httt:'Chuyển khoản',
      xe:'',taixe:task.ten,kh:'',mota:'Lương cố định '+moTaThang+' · '+task.ten};
    var row={loai_gd:'chi',danh_muc:'Lương tài xế',ngay_gd:ngayChi,gio_gd:'23:59',
      so_tien:task.luong,hinh_thuc:'Chuyển khoản',tai_xe:task.ten,
      mo_ta:obj.mota,hd_id:null,bien_so_xe:null,doi_tac:null};
    sbPost('thu_chi',row).then(function(res){
      if(res&&res[0]&&res[0].id)obj.id=res[0].id;
      DB.thuChi.unshift(obj);done++;
      if(done+errors===tasks.length){
        renderTCAll();
        toast('✅ Đã tạo '+done+' phiếu chi lương '+moTaThang+(errors?' ('+errors+' lỗi)':''),'success',5000);
      }
    }).catch(function(){
      errors++;
      if(done+errors===tasks.length){
        renderTCAll();
        toast((done?'✅ '+done+' phiếu OK · ':'')+'❌ '+errors+' phiếu lỗi','error',5000);
      }
    });
  });
}

// ═══════════════════════════════════════
// BÁO CÁO
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// PHÂN BỔ CHI PHÍ CỐ ĐỊNH VÀO HỢP ĐỒNG
// ═══════════════════════════════════════
// Danh sách chi phí xe không liên quan HĐ (đã khai báo ở openTCModal)
// TC_XE_COSTS = ['Lương tài xế','Bảo dưỡng','Sửa chữa','Đăng kiểm','Bảo hiểm','Định vị','Phù hiệu']
var TC_XE_LOAI = ['Bảo dưỡng','Sửa chữa','Đăng kiểm','Bảo hiểm','Định vị','Phù hiệu']; // chi phí xe thuần
var TC_TX_LOAI = ['Lương tài xế']; // chi phí tài xế

// Số ngày thực hiện hợp đồng (tối thiểu 1)
function getContractDays(h){
  var from=h.ngay_di||h.ngay||'';
  var to=h.ngay_ve||h.ngay_di||h.ngay||'';
  if(!from)return 1;
  var diff=Math.round((new Date(to)-new Date(from))/864e5)+1;
  return Math.max(1,diff);
}

// Tính chi phí phân bổ cho 1 hợp đồng
function calcAllocatedCost(h){
  var ym=getMY(h.ngay_di||h.ngay||'');
  if(!ym||(!h.xe&&!h.taixe))return{xeCost:0,luongCost:0,total:0,ym:ym};
  var days=getContractDays(h);

  // ── Chi phí xe cố định (Bảo dưỡng, Sửa chữa, Đăng kiểm...) ──
  var xeFixedTotal=h.xe?DB.thuChi.filter(function(t){
    return t.type==='chi'&&t.xe===h.xe&&getMY(t.ngay)===ym&&TC_XE_LOAI.indexOf(t.loai)>-1;
  }).reduce(function(s,t){return s+t.sotien;},0):0;

  // Mẫu số: chỉ tính HĐ HOÀN THÀNH của xe này trong tháng
  var xeTotalDays=h.xe?DB.hopDong.filter(function(hh){
    return hh.xe===h.xe&&_isCompleted(hh)&&getMY(hh.ngay_di||hh.ngay||'')===ym;
  }).reduce(function(s,hh){return s+getContractDays(hh);},0):0;

  var xeCost=(xeTotalDays>0&&xeFixedTotal>0)?Math.round(xeFixedTotal*days/xeTotalDays):0;

  // ── Lương tài xế ──
  var luongTotal=h.taixe?DB.thuChi.filter(function(t){
    return t.type==='chi'&&t.taixe===h.taixe&&getMY(t.ngay)===ym&&TC_TX_LOAI.indexOf(t.loai)>-1;
  }).reduce(function(s,t){return s+t.sotien;},0):0;

  // Mẫu số: chỉ tính HĐ HOÀN THÀNH của tài xế này trong tháng
  var txTotalDays=h.taixe?DB.hopDong.filter(function(hh){
    return hh.taixe===h.taixe&&_isCompleted(hh)&&getMY(hh.ngay_di||hh.ngay||'')===ym;
  }).reduce(function(s,hh){return s+getContractDays(hh);},0):0;

  var luongCost=(txTotalDays>0&&luongTotal>0)?Math.round(luongTotal*days/txTotalDays):0;

  return{xeCost:xeCost,luongCost:luongCost,total:xeCost+luongCost,ym:ym,days:days};
}

var bcTab='tongquan';
var bcPeriod='thang';
function switchBCTab(t,el){bcTab=t;document.querySelectorAll('#page-baocao .tab').forEach(function(b){b.classList.remove('active');});el.classList.add('active');['tongquan','hopdong','xe','taixe'].forEach(function(p){var panel=document.getElementById('bc-panel-'+p);if(panel)panel.style.display=t===p?'':'none';});if(t==='hopdong')renderBCHopDong();if(t==='xe')renderBCXe();if(t==='taixe')renderBCTaiXe();}
function renderBCHopDong(){
  var q=(document.getElementById('bc-hd-search').value||'').toLowerCase();
  var tt=document.getElementById('bc-hd-tt').value;
  var sort=document.getElementById('bc-hd-sort').value;
  // Lọc theo kỳ đang xem (Tháng / Quý / Năm)
  var d=buildBC()[bcPeriod];
  var ymList=d.ymList;
  function _inP(h){return ymList.indexOf((h.ngay_di||h.ngay||'').slice(0,7))>=0;}
  // Chỉ hiển thị HĐ đã HOÀN THÀNH trong kỳ (hoan_thanh hoặc cho_thanh_toan)
  var rows=DB.hopDong.filter(function(h){return _isCompleted(h)&&_inP(h);}).map(function(h){
    // Doanh thu = giá trị HĐ (HĐ đã được lọc hoàn thành rồi)
    var doanhThu=h.giatri;
    // Chi trực tiếp: phiếu chi có liên kết HĐ này
    var chiTrucTiep=DB.thuChi.filter(function(t){return t.type==='chi'&&t.hd_id===h.id;}).reduce(function(s,t){return s+t.sotien;},0);
    // Chi phí phân bổ từ chi phí xe/tài xế cố định
    var alloc=calcAllocatedCost(h);
    var chiPhanBo=alloc.total;
    var tongChi=chiTrucTiep+chiPhanBo;
    // Lãi gộp (chỉ trừ chi trực tiếp)
    var laiGop=doanhThu-chiTrucTiep;
    var tsGop=doanhThu>0?Math.round(laiGop/doanhThu*100):0;
    // Lợi nhuận thực (trừ cả phân bổ)
    var lnThuc=doanhThu-tongChi;
    var tsThuc=doanhThu>0?Math.round(lnThuc/doanhThu*100):0;
    return Object.assign({},h,{chiTrucTiep:chiTrucTiep,chiPhanBo:chiPhanBo,chiXe:alloc.xeCost,chiLuong:alloc.luongCost,tongChi:tongChi,doanhThu:doanhThu,laiGop:laiGop,tsGop:tsGop,ln:lnThuc,ts:tsThuc,days:alloc.days||1});
  }).filter(function(h){return(!q||[h.so,h.kh,h.tuyen].join(' ').toLowerCase().includes(q))&&(!tt||h.tt===tt);})
    .sort(function(a,b){if(sort==='ln_desc')return b.ln-a.ln;if(sort==='ln_asc')return a.ln-b.ln;if(sort==='gt_desc')return b.giatri-a.giatri;return b.ngay.localeCompare(a.ngay);});

  var tongThu=rows.reduce(function(s,h){return s+h.doanhThu;},0);
  var tongChiTT=rows.reduce(function(s,h){return s+h.chiTrucTiep;},0);
  var tongChiPB=rows.reduce(function(s,h){return s+h.chiPhanBo;},0);
  var tongLNThuc=rows.reduce(function(s,h){return s+h.ln;},0);
  var tongConLai=rows.reduce(function(s,h){return s+(h.giatri-h.dathu);},0);

  document.getElementById('bc-hd-kpi').innerHTML=[
    {cls:'c-green',ic:'ic-green',ico:'💰',lbl:'Tổng doanh thu',val:fmtM(tongThu),sub:rows.length+' HĐ hoàn thành · '+d.lbl},
    {cls:'c-red',ic:'ic-red',ico:'💸',lbl:'Chi trực tiếp',val:fmtM(tongChiTT),sub:'Chi có liên kết HĐ'},
    {cls:'c-purple',ic:'ic-purple',ico:'🔧',lbl:'Chi phí phân bổ',val:fmtM(tongChiPB),sub:'Xe + lương tài xế'},
    {cls:'c-blue',ic:'ic-blue',ico:'📈',lbl:'Lợi nhuận thực',val:fmtM(tongLNThuc),sub:tongThu>0?((tongLNThuc/tongThu*100).toFixed(1)+'% tỷ suất'):''},
  ].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':c.cls==='c-blue'?'accent':c.cls==='c-purple'?'purple':'orange';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');

  document.getElementById('bc-hd-count').textContent=rows.length+' hợp đồng';
  document.getElementById('bc-hd-summary').innerHTML=
    '<span style="color:var(--green)">↑ '+fmtM(tongThu)+'</span>'
    +'<span style="color:var(--border)">|</span>'
    +'<span style="color:var(--red)">↓ '+fmtM(tongChiTT+tongChiPB)+'</span>'
    +'<span style="color:var(--border)">|</span>'
    +'<span style="color:var(--accent);font-weight:700">= '+fmtM(tongLNThuc)+'</span>';

  document.getElementById('bc-hd-body').innerHTML=rows.length?rows.map(function(h){
    var tsColor=h.ts>=30?'var(--green)':h.ts>=15?'var(--accent)':h.ts>=0?'var(--orange)':'var(--red)';
    var gopColor=h.tsGop>=40?'var(--green)':h.tsGop>=20?'var(--accent)':'var(--orange)';
    var barW=Math.min(100,Math.max(0,h.ts));
    var phanBoTip=h.chiPhanBo>0?'Xe: '+fmtM(h.chiXe)+' · Lương: '+fmtM(h.chiLuong):'—';
    return'<tr onclick="openHDDetail(\''+h.id+'\')" style="cursor:pointer">'
      +'<td><span class="mono" style="font-weight:600">'+h.so+'</span><div style="font-size:.65rem;color:var(--text3)">'+h.days+'N</div></td>'
      +'<td style="font-weight:500">'+h.kh+'</td>'
      +'<td style="color:var(--text2);font-size:.74rem">'+h.tuyen+'</td>'
      +'<td><span class="mono">'+fmtD(h.ngay)+'</span></td>'
      +'<td><span class="amt-pos">+'+fmt(h.doanhThu)+'</span>'+(h.dathu<h.giatri?'<div style="font-size:.67rem;color:var(--orange)">Đã thu: '+fmtM(h.dathu)+'</div>':'<div style="font-size:.67rem;color:var(--green)">Đã thu đủ</div>')+'</td>'
      +'<td>'+(h.chiTrucTiep>0?'<span class="amt-neg">-'+fmtM(h.chiTrucTiep)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td>'
      +'<td title="'+phanBoTip+'">'+(h.chiPhanBo>0?'<span style="color:var(--purple)">-'+fmtM(h.chiPhanBo)+'</span><div style="font-size:.64rem;color:var(--text3)">'+phanBoTip+'</div>':'<span style="color:var(--text3)">—</span>')+'</td>'
      +'<td><span style="font-weight:700;color:'+gopColor+'">'+fmt(h.laiGop)+'</span><div style="font-size:.64rem;color:var(--text3)">'+h.tsGop+'%</div></td>'
      +'<td><span style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+(h.ln>=0?'+':'')+fmt(h.ln)+'</span><div style="display:flex;align-items:center;gap:4px;margin-top:2px"><div style="width:40px;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+tsColor+'"></div></div><span style="font-size:.64rem;color:'+tsColor+'">'+h.ts+'%</span></div></td>'
      +'<td>'+(TTMAP[h.tt]||'')+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text3)">Không có hợp đồng nào</td></tr>';
}
function renderBCXe(){
  var q=(document.getElementById('bc-xe-search').value||'').toLowerCase();
  var sort=(document.getElementById('bc-xe-sort')||{}).value||'ln_desc';
  // Lọc theo kỳ hiện tại
  var d=buildBC()[bcPeriod];var ymList=d.ymList;
  function _inP(dateStr){return ymList.indexOf((dateStr||'').slice(0,7))>=0;}
  // Build per-vehicle stats — chỉ HĐ HOÀN THÀNH trong kỳ
  var xeMap={};
  DB.hopDong.filter(function(h){return h.xe&&_isCompleted(h)&&_inP(h.ngay_di||h.ngay||'');}).forEach(function(h){
    if(!xeMap[h.xe])xeMap[h.xe]={bien:h.xe,loai:'',chuyen:0,doanhThu:0,chiPhi:0,hds:[]};
    var v=xeMap[h.xe];
    v.chuyen++;
    v.doanhThu+=h.giatri||0;
    v.hds.push(h.so);
  });
  // Chi phí xe gắn trực tiếp HĐ trong kỳ
  DB.thuChi.filter(function(t){return t.type==='chi'&&t.xe&&_inP(t.ngay||'')&&_shouldCountChi(t);}).forEach(function(t){
    if(!xeMap[t.xe])xeMap[t.xe]={bien:t.xe,loai:'',chuyen:0,doanhThu:0,chiPhi:0,hds:[]};
    xeMap[t.xe].chiPhi+=t.sotien;
  });
  // Enrich with xe master data
  DB.xe.forEach(function(x){
    if(xeMap[x.bien])xeMap[x.bien].loai=x.loai||'';
    else xeMap[x.bien]={bien:x.bien,loai:x.loai||'',chuyen:0,doanhThu:0,chiPhi:0,hds:[]};
  });
  var rows=Object.values(xeMap).map(function(v){
    v.ln=v.doanhThu-v.chiPhi;v.ts=v.doanhThu>0?Math.round(v.ln/v.doanhThu*100):0;return v;
  }).filter(function(v){return(v.chuyen>0||v.chiPhi>0)&&(!q||[v.bien,v.loai].join(' ').toLowerCase().includes(q));})
    .sort(function(a,b){if(sort==='ln_asc')return a.ln-b.ln;if(sort==='dt_desc')return b.doanhThu-a.doanhThu;if(sort==='chuyen_desc')return b.chuyen-a.chuyen;return b.ln-a.ln;});
  var tDT=rows.reduce(function(s,r){return s+r.doanhThu;},0);
  var tChi=rows.reduce(function(s,r){return s+r.chiPhi;},0);
  var tLN=tDT-tChi;
  document.getElementById('bc-xe-kpi').innerHTML=[
    {cls:'c-blue',ico:'🚌',lbl:'Số xe hoạt động',val:rows.filter(function(r){return r.chuyen>0;}).length+' xe',sub:d.lbl},
    {cls:'c-green',ico:'💰',lbl:'Tổng doanh thu',val:fmtM(tDT),sub:'Theo giá trị HĐ'},
    {cls:'c-red',ico:'💸',lbl:'Tổng chi phí',val:fmtM(tChi),sub:'Trực tiếp theo xe'},
    {cls:'c-blue',ico:'📈',lbl:'Tổng lợi nhuận',val:fmtM(tLN),sub:tDT>0?((tLN/tDT*100).toFixed(1)+'% tỷ suất'):''}
  ].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':'accent';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon ic-blue">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
  document.getElementById('bc-xe-count').textContent=rows.length+' xe';
  document.getElementById('bc-xe-summary').innerHTML='<span style="color:var(--green)">↑ '+fmtM(tDT)+'</span><span style="color:var(--border)">|</span><span style="color:var(--red)">↓ '+fmtM(tChi)+'</span><span style="color:var(--border)">|</span><span style="color:var(--accent);font-weight:700">= '+fmtM(tLN)+'</span>';
  document.getElementById('bc-xe-body').innerHTML=rows.length?rows.map(function(v){var tsColor=v.ts>=30?'var(--green)':v.ts>=15?'var(--accent)':v.ts>=0?'var(--orange)':'var(--red)';var barW=Math.min(100,Math.max(0,v.ts));return'<tr onclick="openXeDetailBC(\''+encodeURIComponent(v.bien)+'\')" style="cursor:pointer" title="Xem chi tiết HĐ của '+v.bien+'"><td><div style="font-weight:700;font-size:.82rem;letter-spacing:.5px">'+v.bien+'</div><div style="font-size:.68rem;color:var(--text3)">'+v.loai+'</div></td><td><span class="mono" style="font-weight:600">'+v.chuyen+'</span><div style="font-size:.67rem;color:var(--text3)">chuyến</div></td><td><span class="amt-pos">+'+fmtM(v.doanhThu)+'</span></td><td>'+(v.chiPhi>0?'<span class="amt-neg">-'+fmtM(v.chiPhi)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td><td><span style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+(v.ln>=0?'+':'')+fmtM(v.ln)+'</span></td><td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+tsColor+';border-radius:3px"></div></div><span style="font-size:.72rem;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+v.ts+'%</span></div></td><td><span style="font-size:.73rem;padding:3px 8px;border-radius:6px;background:var(--surface2);color:var(--text2)">'+(v.chuyen>0?'Đang hoạt động':'Chưa dùng')+'</span></td></tr>';}).join(''):'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Chưa có dữ liệu xe</td></tr>';
}

// ─── Chi tiết xe theo kỳ báo cáo ────────────────────────────────────────────
function openXeDetailBC(bienEncoded){
  var bien=decodeURIComponent(bienEncoded);
  var d=buildBC()[bcPeriod];
  var ymList=d.ymList;
  var periodLbl=d.lbl;
  var xeInfo=DB.xe.find(function(x){return x.bien===bien;})||{bien:bien,loai:''};
  function _isDone(h){return h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan';}
  function _inP(h){return ymList.indexOf((h.ngay||h.ngay_di||'').slice(0,7))>=0;}
  // Tất cả HĐ xe này trong kỳ
  var allHds=DB.hopDong.filter(function(h){return h.xe===bien&&_inP(h);}).sort(function(a,b){return(b.ngay||'').localeCompare(a.ngay||'');});
  // Doanh thu chỉ tính HĐ hoàn thành
  var doanhThu=allHds.filter(_isDone).reduce(function(s,h){return s+h.giatri;},0);
  var daThu=allHds.filter(_isDone).reduce(function(s,h){return s+h.dathu;},0);
  var conNo=doanhThu-daThu;
  var chiPhi=DB.thuChi.filter(function(tc){return tc.type==='chi'&&tc.xe===bien&&ymList.indexOf((tc.ngay||'').slice(0,7))>=0;}).reduce(function(s,tc){return s+tc.sotien;},0);
  var loiNhuan=doanhThu-chiPhi;
  var ttMap={cho_xe:'Chờ TH',dang_chay:'Đang chạy',hoan_thanh:'Hoàn thành',cho_thanh_toan:'Hoàn thành'};
  var ttCls={cho_xe:'b-gray',dang_chay:'b-blue',hoan_thanh:'b-green',cho_thanh_toan:'b-green'};
  var hdRows=allHds.length
    ?allHds.map(function(h){
        return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" '
          +'style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'">'+
          '<td style="font-family:monospace;font-size:.78rem;color:var(--blue)">'+h.so+'</td>'+
          '<td style="font-size:.8rem">'+fmtD(h.ngay||h.ngay_di||'')+'</td>'+
          '<td style="font-size:.8rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.kh||'—')+'</td>'+
          '<td style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.tuyen||'—')+'</td>'+
          '<td style="font-size:.78rem;color:var(--text2)">'+(h.taixe||'—')+'</td>'+
          '<td style="text-align:right;font-size:.82rem;font-weight:600">'+((_isDone(h)?'+':'')+fmtM(h.giatri))+'</td>'+
          '<td style="text-align:right;font-size:.82rem;color:'+(h.dathu>=h.giatri?'var(--green)':'var(--orange)')+'">'+fmtM(h.dathu)+'</td>'+
          '<td><span class="badge '+(ttCls[h.tt]||'b-gray')+'" style="font-size:.68rem">'+(ttMap[h.tt]||h.tt)+'</span></td>'+
        '</tr>';
      }).join('')
    :'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Không có hợp đồng trong kỳ này</td></tr>';
  showModal(
    '🚌 '+bien,
    periodLbl+(xeInfo.loai?' · '+xeInfo.loai:''),
    // ── 4 ô thống kê ──
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1.4rem;font-weight:700;color:var(--blue)">'+allHds.length+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Số chuyến</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:var(--green)">'+fmtM(doanhThu)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Doanh thu (HĐ xong)</div>'+
      '</div>'+
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:1rem;font-weight:700;color:'+(chiPhi>0?'var(--red)':'var(--text3)')+'">'+fmtM(chiPhi)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Chi phí</div>'+
      '</div>'+
      '<div style="background:'+(conNo>0?'#fef2f2':'var(--bg2)')+';border-radius:8px;padding:10px;text-align:center;border:'+(conNo>0?'1px solid #fecaca':'1px solid transparent')+'">'+
        '<div style="font-size:1rem;font-weight:700;color:'+(conNo>0?'var(--red)':loiNhuan>=0?'var(--accent)':'var(--red)')+'">'+fmtM(loiNhuan)+'</div>'+
        '<div style="font-size:.72rem;color:var(--text3);margin-top:2px">Lợi nhuận</div>'+
      '</div>'+
    '</div>'+
    // ── Bảng HĐ ──
    '<div style="font-weight:600;font-size:.83rem;margin-bottom:6px;color:var(--text2)">📋 Hợp đồng trong '+periodLbl+' ('+allHds.length+')</div>'+
    '<div class="table-wrap" style="max-height:360px;overflow-y:auto;border-radius:6px;border:1px solid var(--border)">'+
      '<table class="dt" style="min-width:580px;font-size:.82rem">'+
        '<thead><tr><th>Số HĐ</th><th>Ngày</th><th>Khách hàng</th><th>Tuyến</th><th>Tài xế</th><th style="text-align:right">Giá trị</th><th style="text-align:right">Đã thu</th><th>Trạng thái</th></tr></thead>'+
        '<tbody>'+hdRows+'</tbody>'+
      '</table>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'
  );
}

function renderBCTaiXe(){
  var q=(document.getElementById('bc-tx-search').value||'').toLowerCase();
  var sort=(document.getElementById('bc-tx-sort')||{}).value||'ln_desc';
  // Lọc theo kỳ hiện tại
  var d=buildBC()[bcPeriod];var ymList=d.ymList;
  function _inP(dateStr){return ymList.indexOf((dateStr||'').slice(0,7))>=0;}
  // Build per-driver stats — chỉ HĐ HOÀN THÀNH trong kỳ
  var txMap={};
  DB.hopDong.filter(function(h){return h.taixe&&_isCompleted(h)&&_inP(h.ngay_di||h.ngay||'');}).forEach(function(h){
    if(!txMap[h.taixe])txMap[h.taixe]={ten:h.taixe,chuyen:0,doanhThu:0,chiPhi:0,tuyen:{}};
    var v=txMap[h.taixe];
    v.chuyen++;
    v.doanhThu+=h.giatri||0;
    if(h.tuyen)v.tuyen[h.tuyen]=(v.tuyen[h.tuyen]||0)+1;
  });
  // Chi phí tài xế trong kỳ (lương + chi có gắn tài xế)
  DB.thuChi.filter(function(t){return t.type==='chi'&&t.taixe&&_inP(t.ngay||'')&&_shouldCountChi(t);}).forEach(function(t){
    if(!txMap[t.taixe])txMap[t.taixe]={ten:t.taixe,chuyen:0,doanhThu:0,chiPhi:0,tuyen:{}};
    txMap[t.taixe].chiPhi+=t.sotien;
  });
  // Enrich with taiXe master data
  DB.taiXe.forEach(function(tx){
    var key=tx.ten;
    if(!txMap[key])txMap[key]={ten:key,chuyen:0,doanhThu:0,chiPhi:0,tuyen:{}};
    txMap[key].phone=tx.sdt||tx.phone||'';
    txMap[key].xe=tx.xe||tx.bien||'';
  });
  var rows=Object.values(txMap).map(function(v){
    v.ln=v.doanhThu-v.chiPhi;v.ts=v.doanhThu>0?Math.round(v.ln/v.doanhThu*100):0;
    var tuyenArr=Object.entries(v.tuyen||{}).sort(function(a,b){return b[1]-a[1];});
    v.topTuyen=tuyenArr.length?tuyenArr[0][0]:'—';return v;
  }).filter(function(v){return(v.chuyen>0||v.chiPhi>0)&&(!q||v.ten.toLowerCase().includes(q));})
    .sort(function(a,b){if(sort==='ln_asc')return a.ln-b.ln;if(sort==='dt_desc')return b.doanhThu-a.doanhThu;if(sort==='chuyen_desc')return b.chuyen-a.chuyen;return b.ln-a.ln;});
  var tDT=rows.reduce(function(s,r){return s+r.doanhThu;},0);
  var tChi=rows.reduce(function(s,r){return s+r.chiPhi;},0);
  var tLN=tDT-tChi;
  var tChuyen=rows.reduce(function(s,r){return s+r.chuyen;},0);
  document.getElementById('bc-tx-kpi').innerHTML=[
    {cls:'c-blue',ico:'👤',lbl:'Số tài xế',val:rows.filter(function(r){return r.chuyen>0;}).length+' người',sub:d.lbl},
    {cls:'c-green',ico:'💰',lbl:'Tổng doanh thu',val:fmtM(tDT),sub:'Theo giá trị HĐ'},
    {cls:'c-orange',ico:'🚗',lbl:'Tổng số chuyến',val:tChuyen+' chuyến',sub:'Bình quân '+(rows.filter(function(r){return r.chuyen>0;}).length?Math.round(tChuyen/rows.filter(function(r){return r.chuyen>0;}).length):0)+'/người'},
    {cls:'c-blue',ico:'📈',lbl:'Tổng lợi nhuận',val:fmtM(tLN),sub:tDT>0?((tLN/tDT*100).toFixed(1)+'% tỷ suất'):''}
  ].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-orange'?'orange':'accent';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon ic-blue">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
  document.getElementById('bc-tx-count').textContent=rows.length+' tài xế';
  document.getElementById('bc-tx-summary').innerHTML='<span style="color:var(--green)">↑ '+fmtM(tDT)+'</span><span style="color:var(--border)">|</span><span style="color:var(--accent);font-weight:700">= '+fmtM(tLN)+'</span>';
  document.getElementById('bc-tx-body').innerHTML=rows.length?rows.map(function(v,i){var tsColor=v.ts>=30?'var(--green)':v.ts>=15?'var(--accent)':v.ts>=0?'var(--orange)':'var(--red)';var barW=Math.min(100,Math.max(0,v.ts));var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';return'<tr onclick="openTXDetail(\''+encodeURIComponent(v.ten)+'\')" style="cursor:pointer"><td><div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.1rem">'+medal+'</span><div><div style="font-weight:600;font-size:.83rem">'+v.ten+'</div><div style="font-size:.67rem;color:var(--text3)">'+(v.xe||v.phone||'')+'</div></div></div></td><td><span class="mono" style="font-weight:600">'+v.chuyen+'</span><div style="font-size:.67rem;color:var(--text3)">chuyến</div></td><td><span class="amt-pos">+'+fmtM(v.doanhThu)+'</span></td><td>'+(v.chiPhi>0?'<span class="amt-neg">-'+fmtM(v.chiPhi)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td><td><span style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+(v.ln>=0?'+':'')+fmtM(v.ln)+'</span></td><td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+tsColor+';border-radius:3px"></div></div><span style="font-size:.72rem;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+v.ts+'%</span></div></td><td style="font-size:.73rem;color:var(--text2);max-width:140px;white-space:normal;line-height:1.35">'+v.topTuyen+'</td></tr>';}).join(''):'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Chưa có dữ liệu tài xế</td></tr>';
}

function exportBCXe(){
  toast('⏳ Đang tạo file Excel...','info');
  setTimeout(function(){
    try{
      var rows=[];
      DB.xe.forEach(function(x){
        var hds=DB.hopDong.filter(function(h){return h.xe===x.bien;});
        var dt=hds.filter(function(h){return h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan';}).reduce(function(s,h){return s+h.giatri;},0);
        var chi=DB.thuChi.filter(function(t){return t.type==='chi'&&t.xe===x.bien;}).reduce(function(s,t){return s+t.sotien;},0);
        var ln=dt-chi;var ts=dt>0?Math.round(ln/dt*100):0;
        rows.push([x.bien,x.loai||'',hds.length,dt,chi,ln,ts+'%',(hds.length>0?'Hoạt động':'Chưa dùng')]);
      });
      var ws=[['Biển số','Loại xe','Số chuyến','Doanh thu','Chi phí','Lợi nhuận','Tỷ suất','Trạng thái']].concat(rows);
      buildXlsx([{name:'Báo cáo theo Xe',rows:ws}],'BC_Xe_'+DB_MONTH.replace('/','_')+'.xlsx');
      toast('✅ Đã xuất báo cáo xe!','success');
    }catch(e){toast('❌ Lỗi: '+e.message,'error');}
  },100);
}

function exportBCTaiXe(){
  toast('⏳ Đang tạo file Excel...','info');
  setTimeout(function(){
    try{
      var rows=[];
      DB.taiXe.forEach(function(tx){
        var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten;});
        var dt=hds.filter(function(h){return h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan';}).reduce(function(s,h){return s+h.giatri;},0);
        var chi=DB.thuChi.filter(function(t){return t.type==='chi'&&t.taixe===tx.ten;}).reduce(function(s,t){return s+t.sotien;},0);
        var ln=dt-chi;var ts=dt>0?Math.round(ln/dt*100):0;
        var topT=Object.entries(hds.reduce(function(m,h){m[h.tuyen||'']=(m[h.tuyen||'']||0)+1;return m;},{})).sort(function(a,b){return b[1]-a[1];})[0];
        rows.push([tx.ten,tx.sdt||'',tx.xe||'',hds.length,dt,chi,ln,ts+'%',topT?topT[0]:'—']);
      });
      var ws=[['Tài xế','SĐT','Xe phụ trách','Số chuyến','Doanh thu','Chi phí','Lợi nhuận','Tỷ suất','Tuyến chính']].concat(rows);
      buildXlsx([{name:'Báo cáo theo Tài xế',rows:ws}],'BC_TaiXe_'+DB_MONTH.replace('/','_')+'.xlsx');
      toast('✅ Đã xuất báo cáo tài xế!','success');
    }catch(e){toast('❌ Lỗi: '+e.message,'error');}
  },100);
}

// ── Helpers tổng hợp dữ liệu thực theo kỳ ──────────────────────────────────
function _ymStr(y,m){return y+'-'+String(m+1).padStart(2,'0');}

// Doanh thu: chỉ HĐ đã HOÀN THÀNH, lấy giá trị HĐ, theo ngày khởi hành
function _isCompleted(h){return h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan';}
function _sumDoanhThuThang(ymStr){
  return DB.hopDong.filter(function(h){
    return _isCompleted(h)&&(h.ngay_di||h.ngay||'').slice(0,7)===ymStr;
  }).reduce(function(s,h){return s+h.giatri;},0);
}
// Chi phí: overhead luôn tính; chi trực tiếp (có hd_id) chỉ tính khi HĐ hoàn thành
function _shouldCountChi(tc){
  if(!tc.hd_id) return true; // overhead (lương, bảo dưỡng...) → luôn tính
  var hd=DB.hopDong.find(function(h){return h.id===tc.hd_id;});
  return hd&&_isCompleted(hd);
}
function _sumChiThang(ymStr){
  return DB.thuChi.filter(function(tc){
    return tc.type==='chi'&&(tc.ngay||'').slice(0,7)===ymStr&&_shouldCountChi(tc);
  }).reduce(function(s,tc){return s+tc.sotien;},0);
}

function buildBC(){
  var now=new Date(),nowY=now.getFullYear(),nowM=now.getMonth();

  // ── 6 tháng gần nhất (push → oldest first, current last) ──
  var mBars=[];
  for(var mi=5;mi>=0;mi--){
    (function(off){
      var d2=new Date(nowY,nowM-off,1),y=d2.getFullYear(),m=d2.getMonth(),ym=_ymStr(y,m);
      mBars.push({l:'T'+(m+1),thu:_sumDoanhThuThang(ym)/1e6,chi:_sumChiThang(ym)/1e6,cur:off===0,ym:ym});
    })(mi);
  }
  mBars.reverse(); // sau reverse: oldest[0] → current[last]

  // ── 6 quý gần nhất ──
  var curQIdx=Math.floor(nowM/3);
  var qBars=[];
  for(var qi=5;qi>=0;qi--){
    (function(off){
      var totalQ=nowY*4+curQIdx-off,qY=Math.floor(totalQ/4),qI=totalQ%4;
      var thu=0,chi=0;
      for(var qm=0;qm<3;qm++){var ym2=_ymStr(qY,qI*3+qm);thu+=_sumDoanhThuThang(ym2);chi+=_sumChiThang(ym2);}
      qBars.push({l:"Q"+(qI+1)+"'"+(String(qY).slice(-2)),thu:thu/1e6,chi:chi/1e6,cur:off===0});
    })(qi);
  }
  qBars.reverse();

  // ── 5 năm gần nhất ──
  var yBars=[];
  for(var yi=4;yi>=0;yi--){
    (function(off){
      var year=nowY-off,thu=0,chi=0;
      for(var m3=0;m3<12;m3++){var ym3=_ymStr(year,m3);thu+=_sumDoanhThuThang(ym3);chi+=_sumChiThang(ym3);}
      yBars.push({l:String(year),thu:thu/1e6,chi:chi/1e6,cur:off===0});
    })(yi);
  }
  yBars.reverse();

  // ymList cho donut (tháng hiện tại / các tháng trong quý / YTD)
  // Sau reverse(): mBars[0] = current, mBars[last] = oldest → lấy [0].ym
  var mYmList=[mBars[0].ym];
  var qYmList=(function(){var l=[];for(var i=0;i<3;i++)l.push(_ymStr(nowY,Math.floor(nowM/3)*3+i));return l;})();
  var yYmList=(function(){var l=[];for(var i=0;i<=nowM;i++)l.push(_ymStr(nowY,i));return l;})();

  return{
    thang:{lbl:'Tháng '+(nowM+1)+'/'+nowY, sub:'6 tháng gần nhất', bars:mBars, ymList:mYmList},
    quy:  {lbl:'Quý '+(curQIdx+1)+'/'+nowY, sub:'6 quý gần nhất',  bars:qBars, ymList:qYmList},
    nam:  {lbl:'Năm '+nowY,                 sub:'So sánh theo năm', bars:yBars, ymList:yYmList}
  };
}

// ── Cơ cấu chi phí thực theo danh mục ──────────────────────────────────────
var _CAT_COLORS={'Nhiên liệu':'#2563eb','Lương tài xế':'#16a34a','Sửa chữa':'#ea580c','Cầu đường':'#ca8a04','Bảo dưỡng':'#7c3aed','Khác':'#94a3b8'};
function _chiCats(ymList){
  var totals={};
  DB.thuChi.forEach(function(tc){
    if(tc.type!=='chi') return;
    if(ymList.indexOf((tc.ngay||'').slice(0,7))<0) return;
    var cat=tc.loai||'Khác';
    totals[cat]=(totals[cat]||0)+tc.sotien;
  });
  var total=0;
  var keys=Object.keys(totals);
  keys.forEach(function(k){total+=totals[k];});
  if(!total) return [];
  return keys.map(function(n){
    return{n:n,v:totals[n],p:Math.round(totals[n]/total*100),c:_CAT_COLORS[n]||'#94a3b8'};
  }).sort(function(a,b){return b.v-a.v;});
}
function setBCPeriod(p,el){
  bcPeriod=p;
  document.querySelectorAll('#page-baocao .ptab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  renderBC(); // Tổng quan luôn re-render
  // Re-render tab đang active nếu không phải Tổng quan
  if(bcTab==='hopdong')renderBCHopDong();
  else if(bcTab==='xe')renderBCXe();
  else if(bcTab==='taixe')renderBCTaiXe();
}
function renderBC(){
  var d=buildBC()[bcPeriod];
  document.getElementById('bc-period-lbl').textContent=d.lbl;
  document.getElementById('bc-chart-sub').textContent=d.sub;
  document.getElementById('bc-xe-sub').textContent=d.lbl;
  // ── KPI: tính TRỰC TIẾP từ DB theo ymList của kỳ được chọn ──────────────────
  // doanh thu = giá trị HĐ đã HOÀN THÀNH trong kỳ
  function _inPeriod(dateStr,ymList){return ymList.indexOf((dateStr||'').slice(0,7))>=0;}
  var thu=DB.hopDong.filter(function(h){return _isCompleted(h)&&_inPeriod(h.ngay_di||h.ngay||'',d.ymList);}).reduce(function(s,h){return s+h.giatri;},0);
  var chi=DB.thuChi.filter(function(tc){return tc.type==='chi'&&_inPeriod(tc.ngay||'',d.ymList)&&_shouldCountChi(tc);}).reduce(function(s,tc){return s+tc.sotien;},0);
  var ln=thu-chi;
  // prev period: bars[0]=current, bars[1]=kỳ trước (sau reverse)
  var prev=d.bars[1]||{thu:0,chi:0};
  var thu2=prev.thu*1e6,chi2=prev.chi*1e6,ln2=(prev.thu-prev.chi)*1e6;
  var kpis=[{cls:'c-green',ic:'ic-green',ico:'💰',lbl:'Doanh thu',val:fmtM(thu),chg:pct(thu,thu2),sub:'vs kỳ trước'},{cls:'c-red',ic:'ic-red',ico:'💸',lbl:'Chi phí',val:fmtM(chi),chg:pct(chi,chi2),sub:'vs kỳ trước'},{cls:'c-blue',ic:'ic-blue',ico:'📈',lbl:'Lợi nhuận',val:fmtM(ln),chg:pct(ln,ln2),sub:'vs kỳ trước'},{cls:'c-purple',ic:'ic-purple',ico:'📊',lbl:'Tỷ suất LN',val:(thu>0?((ln/thu)*100).toFixed(1):'0')+'%',chg:pct(ln/thu,ln2/thu2),sub:d.lbl}];
  document.getElementById('bc-kpi').innerHTML=kpis.map(function(c,i){var up=parseFloat(c.chg)>=0;var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':c.cls==='c-blue'?'accent':'purple';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="tag '+(up?'tag-up':'tag-down')+'">'+(up?'▲':'▼')+' '+Math.abs(c.chg)+'%</span><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
  var mx=Math.max.apply(null,d.bars.map(function(b){return Math.max(b.thu,b.chi);}));mx=mx||1;
  document.getElementById('bc-bar').innerHTML=d.bars.map(function(b){var th=Math.max(b.thu>0?3:0,Math.round(b.thu/mx*100));var ch=Math.max(b.chi>0?3:0,Math.round(b.chi/mx*100));var lp=Math.max(b.thu-b.chi>0?3:0,Math.round((b.thu-b.chi)/mx*100));return'<div class="bar-group"><div class="bars"><div class="bar" style="height:'+th+'%;background:'+(b.cur?'#15803d':'#86efac')+'"></div><div class="bar" style="height:'+ch+'%;background:'+(b.cur?'#ef4444':'#fca5a5')+'"></div><div class="bar" style="height:'+lp+'%;background:'+(b.cur?'#64748b':'#cbd5e1')+'"></div></div><div class="bar-lbl" style="'+(b.cur?'color:var(--green);font-weight:700':'')+'">'+b.l+(b.cur?' ●':'')+'</div></div>';}).join('');
  // ── Cơ cấu chi phí — dữ liệu THỰC từ DB.thuChi ──
  var cats=_chiCats(d.ymList);
  if(cats.length===0){
    document.getElementById('bc-donut').style.background='#e2e8f0';
    document.getElementById('bc-donut-val').textContent='0đ';
    document.getElementById('bc-donut-legend').innerHTML='<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:.8rem">Chưa có chi phí ghi nhận trong kỳ này</div>';
  } else {
    var conic2='',acc2=0;
    cats.forEach(function(c,i){conic2+=c.c+' '+acc2+'% '+(acc2+c.p)+'%'+(i<cats.length-1?',':'');acc2+=c.p;});
    document.getElementById('bc-donut').style.background='conic-gradient('+conic2+')';
    document.getElementById('bc-donut-val').textContent=fmtM(chi);
    document.getElementById('bc-donut-legend').innerHTML=cats.map(function(c){return'<div class="dl-item"><div class="dl-dot" style="background:'+c.c+'"></div><span class="dl-name">'+c.n+'</span><span class="dl-val">'+fmtM(c.v)+'</span><span class="dl-pct">'+c.p+'%</span></div>';}).join('');
  }
  // ── Xe table: giatri tất cả HĐ trong kỳ, lọc theo ymList ────────────────────
  var veh=DB.xe.map(function(x){
    var hdsXe=DB.hopDong.filter(function(h){return h.xe===x.bien&&_inPeriod(h.ngay_di||h.ngay||'',d.ymList);});
    var t=hdsXe.reduce(function(s,h){return s+h.giatri;},0);
    var c=DB.thuChi.filter(function(tc){return tc.type==='chi'&&tc.xe===x.bien&&_inPeriod(tc.ngay||'',d.ymList)&&_shouldCountChi(tc);}).reduce(function(s,tc){return s+tc.sotien;},0);
    return{b:x.bien,l:x.loai||'',t:t,c:c,n:hdsXe.length};
  }).filter(function(v){return v.t>0||v.c>0||v.n>0;}).sort(function(a,b){return b.t-a.t;});
  document.getElementById('bc-xe-table').innerHTML=veh.length?veh.map(function(v){var ln2=v.t-v.c,ts=v.t>0?Math.round(ln2/v.t*100):0;var bc=ts>=30?'var(--green)':ts>=20?'var(--accent)':'var(--orange)';return'<tr style="cursor:pointer" title="Xem chi tiết HĐ của '+v.b+'" onclick="openXeDetailBC(\''+encodeURIComponent(v.b)+'\')"><td><div style="font-weight:600;font-size:.78rem">'+v.b+'</div><div style="font-size:.67rem;color:var(--text3)">'+v.l+'</div></td><td><span class="amt-pos">'+fmtM(v.t)+'</span><div style="font-size:.65rem;color:var(--text3)">'+v.n+' HĐ</div></td><td>'+(v.c>0?'<span class="amt-neg">-'+fmtM(v.c)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td><td style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+(ln2>=0?'var(--accent)':'var(--red)')+'">'+fmtM(ln2)+'</td><td><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:'+ts+'%;background:'+bc+'"></div></div><span class="mini-pct">'+ts+'%</span></div></td></tr>';}).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;font-size:.8rem">Chưa có HĐ hoàn thành trong kỳ này</td></tr>';
  // ── Driver rank: giatri tất cả HĐ trong kỳ, lọc theo ymList ─────────────────
  var drivers=DB.taiXe.map(function(tx){
    var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&_inPeriod(h.ngay_di||h.ngay||'',d.ymList);});
    var t=hds.reduce(function(s,h){return s+h.giatri;},0);
    var allHds=hds;
    var lastXe=allHds.length?allHds[allHds.length-1].xe:'—';
    return{n:tx.ten,b:lastXe,c:allHds.length,t:t};
  }).filter(function(d2){return d2.c>0;}).sort(function(a,b){return b.t-a.t||b.c-a.c;});
  document.getElementById('bc-driver-rank').innerHTML=drivers.length?drivers.map(function(d2,i){return'<div class="rank-item" style="cursor:pointer" title="Xem chi tiết '+d2.n+'" onclick="openTXDetail(\''+encodeURIComponent(d2.n)+'\')"><div class="rank-num '+(['r1','r2','r3'][i]||'rn')+'">'+(['🥇','🥈','🥉'][i]||i+1)+'</div><div class="rank-info"><div class="rank-name">'+d2.n+'</div><div class="rank-meta">'+d2.b+' · '+d2.c+' chuyến</div></div><div style="text-align:right"><div class="rank-amount">+'+fmtM(d2.t)+'</div></div></div>';}).join(''):'<div style="padding:24px;text-align:center;color:var(--text3);font-size:.82rem">Chưa có dữ liệu tài xế trong kỳ này</div>';
}

// ═══════════════════════════════════════
// THÔNG BÁO
// ═══════════════════════════════════════
var readIds=new Set();
try{var _saved=localStorage.getItem('nk_read');if(_saved)readIds=new Set(JSON.parse(_saved));}catch(e){}
function buildNotifs(){
  var now=new Date();var items=[];
  DB.xe.forEach(function(x){
    if(!x.dangKiem)return;
    var d=Math.round((new Date(x.dangKiem)-now)/864e5);
    if(d<=60)items.push({id:'dk_'+x.id,type:d<=7?'urgent':d<=30?'warn':'info',ico:d<=7?'🚨':'⚠️',title:'Đăng kiểm sắp hết hạn',body:x.bien+' ('+x.loai+') — còn '+(d<=0?'đã hết hạn!':d+' ngày'),tag:'Đăng kiểm',page:'xe',ts:d});
    var d2=Math.round((new Date(x.baoHiem)-now)/864e5);
    if(x.baoHiem&&d2<=60)items.push({id:'bh_'+x.id,type:d2<=7?'urgent':d2<=30?'warn':'info',ico:d2<=7?'🚨':'🛡️',title:'Bảo hiểm sắp hết hạn',body:x.bien+' — còn '+(d2<=0?'đã hết hạn!':d2+' ngày'),tag:'Bảo hiểm',page:'xe',ts:d2});
  });
  DB.hopDong.filter(function(h){return h.giatri>h.dathu&&h.tt!=='cho_xe';}).forEach(function(h){items.push({id:'cn_'+h.id,type:h.giatri-h.dathu>20e6?'warn':'info',ico:'💰',title:'Công nợ chưa thu',body:h.so+' · '+h.kh+' — còn '+fmtM(h.giatri-h.dathu),tag:'Công nợ',page:'hopdong',ts:999});});
  return items.filter(function(i){return!readIds.has(i.id);}).sort(function(a,b){return a.ts-b.ts;});
}
function renderNotifPanel(){
  renderNotifPendingSection(); // Cập nhật section BC chờ duyệt trong panel
  var items=buildNotifs();var unreadCount=items.length;
  document.getElementById('notifDot').style.display=unreadCount?'':'none';
  var typeColor={urgent:'var(--red)',warn:'var(--orange)',info:'var(--accent)'};
  var typeBg={urgent:'var(--red-light)',warn:'var(--orange-light)',info:'var(--accent-light)'};
  document.getElementById('notifList').innerHTML=items.length?items.map(function(it){
    window['_notif_'+it.id.replace(/[^a-z0-9]/gi,'_')]=function(){readIds.add(it.id);try{localStorage.setItem('nk_read',JSON.stringify(Array.from(readIds)));}catch(e){}closeNotifPanel();navTo(it.page);renderNotifPanel();};
    return'<div onclick="_notif_'+it.id.replace(/[^a-z0-9]/gi,'_')+'()" style="display:flex;gap:12px;padding:13px 18px;border-bottom:1px solid var(--border);cursor:pointer"><div style="width:36px;height:36px;border-radius:10px;background:'+typeBg[it.type]+';display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">'+it.ico+'</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><div style="font-size:.8rem;font-weight:700;color:var(--text)">'+it.title+'</div><span style="font-size:.65rem;padding:2px 7px;border-radius:5px;background:'+typeBg[it.type]+';color:'+typeColor[it.type]+';font-weight:600;white-space:nowrap">'+it.tag+'</span></div><div style="font-size:.73rem;color:var(--text2);margin-top:2px">'+it.body+'</div></div><div style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></div></div>';
  }).join('')+'<div style="padding:14px;text-align:center;font-size:.75rem;color:var(--text3)">'+unreadCount+' thông báo chưa đọc</div>':'<div style="padding:40px;text-align:center;color:var(--text3);font-size:.82rem">✅ Không có thông báo mới</div>';
}
function toggleNotifPanel(){var p=document.getElementById('notifPanel');if(p.style.display==='none'){renderNotifPanel();p.style.display='block';}else p.style.display='none';}
function closeNotifPanel(){document.getElementById('notifPanel').style.display='none';}
function markAllRead(){buildNotifs().forEach(function(it){readIds.add(it.id);});try{localStorage.setItem('nk_read',JSON.stringify(Array.from(readIds)));}catch(e){}renderNotifPanel();}
document.addEventListener('click',function(e){var p=document.getElementById('notifPanel');var btn=document.getElementById('notifBtn');if(p&&p.style.display!=='none'&&!p.contains(e.target)&&btn&&!btn.contains(e.target))closeNotifPanel();});

// ═══════════════════════════════════════
// DUYỆT BÁO CÁO (APPROVAL WORKFLOW)
// ═══════════════════════════════════════
var PENDING_BC = [];           // cache danh sách BC chờ duyệt
var PENDING_EXPAND = null;     // id đang mở rộng
var SELECTED_BC_IDS = new Set(); // ids đang được chọn để duyệt hàng loạt

// Fetch danh sách báo cáo chờ duyệt từ Supabase
function checkPendingBaoCao(){
  if(!isAdmin() || !SB_URL || !SB_KEY) return;
  sbFetch('bao_cao',
    'trang_thai=eq.cho_duyet&order=created_at.desc&limit=50'
    +'&select=id,loai,tai_xe_ten,tai_xe_sdt,bien_xe,hd_so,ghi_chu,anh_urls,so_km,so_lit,tong_tien,da_do_day_binh,created_at'
  ).then(function(rows){
    PENDING_BC = rows || [];
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
  }).catch(function(e){
    console.warn('checkPendingBaoCao:', e.message);
    // Cột trang_thai chưa tồn tại → vẫn hiện trang nhưng báo cần migration
    PENDING_BC = [];
    var sub = document.getElementById('duyet-bc-sub');
    if(sub) sub.textContent = 'Cần chạy SQL migration — xem Cài đặt → SQL Guide';
    var content = document.getElementById('duyet-bc-content');
    if(content) content.innerHTML = '<div style="padding:32px;text-align:center;color:var(--orange);font-size:.82rem">'
      +'⚠️ Tính năng duyệt báo cáo cần cập nhật cơ sở dữ liệu.<br><br>'
      +'Vào <strong>Cài đặt → SQL Guide</strong>, copy và chạy đoạn SQL để kích hoạt.'
      +'</div>';
  });
}

// Cập nhật badge trên topbar + sidebar nav
function updatePendingBadge(){
  var cnt = PENDING_BC.length;
  // Nút topbar
  var btn = document.getElementById('pending-bc-btn');
  var badge = document.getElementById('pending-bc-badge');
  if(btn){ btn.style.display = cnt ? 'inline-flex' : 'none'; btn.style.alignItems = 'center'; }
  if(badge) badge.textContent = cnt;
  // Nav sidebar — chỉ hiện khi admin
  var navItem = document.getElementById('nav-duyet-bc');
  var navBadge = document.getElementById('duyetBcBadge');
  if(navItem) navItem.style.display = isAdmin() ? '' : 'none';
  if(navBadge){ navBadge.style.display = cnt ? '' : 'none'; navBadge.textContent = cnt; }
  // Nếu đang ở trang duyet-bc thì reload
  if(currentPage === 'duyet-bc') renderDuyetBCContent();
}

// Hiển thị section BC chờ duyệt trong notification panel
function renderNotifPendingSection(){
  var sec = document.getElementById('notif-pending-section');
  if(!sec) return;
  var cnt = PENDING_BC.length;
  if(!cnt){ sec.style.display='none'; return; }
  sec.style.display = 'block';
  sec.innerHTML = '<div onclick="closeNotifPanel();navTo(\'duyet-bc\')" style="display:flex;align-items:center;gap:12px;padding:13px 18px;cursor:pointer;background:#fef2f2">'
    +'<div style="width:36px;height:36px;border-radius:10px;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">📋</div>'
    +'<div style="flex:1"><div style="font-size:.8rem;font-weight:700;color:#dc2626">'+cnt+' báo cáo chờ duyệt</div>'
    +'<div style="font-size:.72rem;color:#ef4444;margin-top:2px">Bấm để xem và duyệt</div></div>'
    +'<span style="font-size:.68rem;padding:2px 8px;border-radius:5px;background:#fee2e2;color:#dc2626;font-weight:700">Cần duyệt</span>'
    +'</div>';
}

// Trang Duyệt BC (được gọi khi navTo('duyet-bc'))
function renderDuyetBC(){
  // Nếu chưa có data, fetch trước
  if(!PENDING_BC.length && SB_URL && SB_KEY){
    var sub = document.getElementById('duyet-bc-sub');
    if(sub) sub.textContent = 'Đang tải...';
    checkPendingBaoCao();
  } else {
    renderDuyetBCContent();
  }
}

// Render nội dung vào trang (và cập nhật modal nếu đang mở)
function renderDuyetBCContent(){
  _renderPendingInto('duyet-bc-content', 'duyet-bc-sub');
  // Cập nhật modal nếu đang mở
  var modal = document.getElementById('pending-bc-modal');
  if(modal && modal.style.display !== 'none') _renderPendingInto('pending-bc-list', 'pending-bc-subtitle');
}

// Mở/đóng modal (vẫn giữ cho notifPanel access)
function openPendingModal(){
  var el = document.getElementById('pending-bc-modal');
  if(!el) return;
  el.style.display = 'flex';
  _renderPendingInto('pending-bc-list', 'pending-bc-subtitle');
}
function closePendingModal(){
  var el = document.getElementById('pending-bc-modal');
  if(el) el.style.display = 'none';
}
document.addEventListener('click', function(e){
  var modal = document.getElementById('pending-bc-modal');
  if(!modal || modal.style.display === 'none') return;
  if(e.target === modal) closePendingModal();
});

// ── Hàm render chung (dùng cho cả trang lẫn modal) ──────────────────────────
function renderPendingBCList(){ _renderPendingInto('pending-bc-list','pending-bc-subtitle'); }

function _renderPendingInto(containerId, subtitleId){
  var sub  = document.getElementById(subtitleId);
  var list = document.getElementById(containerId);
  if(!list) return;
  var cnt = PENDING_BC.length;
  var selCnt = SELECTED_BC_IDS.size;
  if(sub) sub.textContent = cnt ? cnt + ' báo cáo đang chờ xem xét' : 'Không có báo cáo nào chờ duyệt';
  if(!cnt){
    SELECTED_BC_IDS.clear();
    list.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text3);font-size:.85rem">✅ Tất cả báo cáo đã được duyệt</div>';
    return;
  }

  var loaiLabel = {km_dau:'🔢 KM Đầu', km_cuoi:'🏁 KM Cuối', do_dau:'⛽ Đổ dầu', hoan_thanh:'✅ Hoàn thành', thay_nhot:'🔧 Thay nhớt', bao_cao_khac:'📄 Báo cáo khác'};
  var loaiBg    = {km_dau:'#eff6ff', km_cuoi:'#f0fdf4', do_dau:'#fffbeb', hoan_thanh:'#f0fdf4', thay_nhot:'#f5f3ff', bao_cao_khac:'#f8fafc'};
  var loaiClr   = {km_dau:'#1d4ed8', km_cuoi:'#16a34a', do_dau:'#d97706', hoan_thanh:'#16a34a', thay_nhot:'#7c3aed', bao_cao_khac:'#64748b'};

  var allSelected = selCnt === cnt;

  // ── Toolbar chọn tất cả + duyệt hàng loạt ──────────────────────────────
  var toolbar = '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px 12px">'
    // Checkbox "Chọn tất cả"
    +'<div onclick="toggleSelectAllBC()" style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">'
    +'<div style="width:18px;height:18px;border-radius:4px;border:2px solid '+(allSelected?'#2563eb':'#d1d5db')+';background:'+(allSelected?'#2563eb':'#fff')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">'
    +(allSelected?'<span style="color:#fff;font-size:.7rem;font-weight:700;line-height:1">✓</span>':'')
    +'</div>'
    +'<span style="font-size:.78rem;color:var(--text2);font-weight:600">'+(allSelected?'Bỏ chọn tất cả':'Chọn tất cả')+'</span>'
    +'</div>'
    +'<div style="flex:1"></div>';

  if(selCnt > 0){
    toolbar += '<button class="btn btn-accent btn-sm" onclick="bulkApproveBaoCao()" style="gap:6px">'
      +'✅ Duyệt '+selCnt+' báo cáo đã chọn'
      +'</button>'
      +'<button class="btn btn-ghost btn-sm" onclick="bulkSkipBaoCao()" style="font-size:.72rem">'
      +'⏭️ Bỏ qua '+selCnt
      +'</button>';
  }
  toolbar += '</div>';

  // ── Danh sách từng dòng ─────────────────────────────────────────────────
  var rows = PENDING_BC.map(function(bc){
    var isOpen     = PENDING_EXPAND === bc.id;
    var isChecked  = SELECTED_BC_IDS.has(bc.id);
    var dt = bc.created_at ? new Date(bc.created_at) : null;
    var dtStr = dt ? (dt.getDate().toString().padStart(2,'0')+'/'+(dt.getMonth()+1).toString().padStart(2,'0')+'/'+dt.getFullYear()
      +' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0')) : '—';
    var info = [];
    if(bc.so_km)    info.push('KM: '+bc.so_km.toLocaleString('vi-VN'));
    if(bc.so_lit)   info.push(bc.so_lit.toLocaleString('vi-VN',{maximumFractionDigits:1})+' L');
    if(bc.tong_tien) info.push(fmtM(bc.tong_tien));
    var infoStr = info.join(' · ') || 'Chưa có số liệu';
    var lbl = loaiLabel[bc.loai] || bc.loai;
    var bg  = loaiBg[bc.loai]   || '#f8fafc';
    var clr = loaiClr[bc.loai]  || '#64748b';
    var rowBorder = isChecked ? '2px solid #2563eb' : '1px solid var(--border)';
    var rowBg     = isChecked ? '#eff6ff' : '';

    // ── Chi tiết (expand) ─────────────────────────────────────────────────
    var detailHtml = '';
    if(isOpen){
      var anhHtml = '';
      if(bc.anh_urls && bc.anh_urls.length){
        anhHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
          + bc.anh_urls.map(function(u){
              return '<a href="'+u+'" target="_blank"><img src="'+u+'" style="width:100px;height:75px;object-fit:cover;border-radius:8px;border:2px solid var(--border);cursor:zoom-in"></a>';
            }).join('')+'</div>';
      } else {
        anhHtml = '<div style="font-size:.72rem;color:var(--text3);margin-bottom:10px">📷 Không có ảnh đính kèm</div>';
      }
      var fieldsHtml = '';
      if(bc.loai === 'km_dau' || bc.loai === 'km_cuoi'){
        fieldsHtml = '<div class="form-row"><div class="fg"><label class="fl">Số KM (đồng hồ ODO)</label>'
          +'<input type="text" inputmode="numeric" class="fc" id="pbc-km-'+bc.id+'" '
          +'value="'+(bc.so_km ? bc.so_km.toLocaleString('vi-VN') : '')+'" placeholder="VD: 90.000" oninput="fmtInput(this)"></div></div>';
      } else if(bc.loai === 'do_dau'){
        fieldsHtml = '<div class="form-row">'
          +'<div class="fg"><label class="fl">Số lít</label>'
          +'<input type="text" inputmode="decimal" class="fc" id="pbc-lit-'+bc.id+'" '
          +'value="'+(bc.so_lit!=null ? bc.so_lit.toLocaleString('vi-VN',{maximumFractionDigits:1}).replace('.',',') : '')+'" placeholder="VD: 66,5" oninput="fmtLitInput(this)"></div>'
          +'<div class="fg"><label class="fl">Tổng tiền</label>'
          +'<input type="text" inputmode="numeric" class="fc" id="pbc-tien-'+bc.id+'" '
          +'value="'+(bc.tong_tien ? bc.tong_tien.toLocaleString('vi-VN') : '')+'" placeholder="VD: 1.452.000" oninput="fmtInput(this)"></div></div>';
      }
      if(bc.ghi_chu){
        fieldsHtml += '<div class="fg" style="margin-top:6px"><label class="fl">Ghi chú tài xế</label>'
          +'<div style="padding:8px 12px;background:var(--surface2);border-radius:8px;font-size:.78rem;color:var(--text2)">'+bc.ghi_chu+'</div></div>';
      }
      if(bc.loai === 'do_dau'){
        fieldsHtml += '<div style="font-size:.7rem;color:#16a34a;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 12px;margin-top:8px">'
          +'💡 <strong>Khi duyệt</strong>: phiếu chi nhiên liệu sẽ tự động được tạo từ số tiền trên.</div>';
      }
      detailHtml = '<div style="padding:14px;background:#f8fafc;border-top:1px solid var(--border)">'
        + anhHtml + fieldsHtml
        +'<div style="display:flex;gap:8px;margin-top:14px">'
        +'<button id="approve-btn-'+bc.id+'" class="btn btn-accent btn-sm" style="flex:1" onclick="approveBaoCao(\''+bc.id+'\')">✅ Duyệt</button>'
        +'<button class="btn btn-ghost btn-sm" onclick="skipBaoCao(\''+bc.id+'\')">⏭️ Bỏ qua</button>'
        +'<button class="btn btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5" onclick="rejectBaoCao(\''+bc.id+'\')">🗑️ Từ chối</button>'
        +'</div></div>';
    }

    return '<div style="border:'+rowBorder+';border-radius:10px;margin-bottom:8px;overflow:hidden;background:'+rowBg+';transition:border .15s,background .15s">'
      // ── Header dòng ─────────────────────────────────────────────────────
      +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px">'
      // Checkbox
      +'<div onclick="event.stopPropagation();toggleBCSelect(\''+bc.id+'\')" '
      +'style="width:20px;height:20px;border-radius:5px;border:2px solid '+(isChecked?'#2563eb':'#d1d5db')+';'
      +'background:'+(isChecked?'#2563eb':'#fff')+';display:flex;align-items:center;justify-content:center;'
      +'flex-shrink:0;cursor:pointer;transition:all .15s">'
      +(isChecked?'<span style="color:#fff;font-size:.75rem;font-weight:700">✓</span>':'')
      +'</div>'
      // Type badge + info (click để expand)
      +'<div onclick="togglePendingExpand(\''+bc.id+'\')" style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;min-width:0">'
      +'<div style="padding:4px 9px;border-radius:6px;font-size:.7rem;font-weight:700;background:'+bg+';color:'+clr+';white-space:nowrap;flex-shrink:0">'+lbl+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.8rem;font-weight:600">'+(bc.tai_xe_ten||'—')+' · <span style="color:var(--text3)">'+(bc.bien_xe||'—')+'</span></div>'
      +'<div style="font-size:.7rem;color:var(--text3)">'+(bc.hd_so||'Chưa gắn HĐ')+' · '+infoStr+'</div>'
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0">'
      +'<div style="font-size:.68rem;color:var(--text3)">'+dtStr+'</div>'
      +'<div style="font-size:.72rem;color:var(--accent);margin-top:2px">'+(isOpen?'▲ Thu gọn':'▼ Chi tiết')+'</div>'
      +'</div>'
      +'</div>'
      +'</div>'
      + detailHtml
      +'</div>';
  }).join('');

  list.innerHTML = toolbar + rows;
}

// Toggle expand một row — re-render cả trang lẫn modal nếu đang mở
function togglePendingExpand(id){
  PENDING_EXPAND = (PENDING_EXPAND === id) ? null : id;
  renderDuyetBCContent();
}

// ── Helper: PATCH bao_cao dùng return=minimal (tránh lỗi JSON parse khi 204) ──
function patchBaoCao(bcId, body){
  return fetch(SB_URL+'/rest/v1/bao_cao?id=eq.'+bcId, {
    method:  'PATCH',
    headers: {
      'apikey':        SB_KEY,
      'Authorization': 'Bearer '+SB_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(body),
  }).then(function(r){
    if(!r.ok) return r.text().then(function(e){ throw new Error(r.status+': '+e); });
    // 204 No Content → ok, return null
    return null;
  });
}

// ── Duyệt báo cáo ────────────────────────────────────────────────────────────
function approveBaoCao(bcId){
  var bc = PENDING_BC.find(function(x){ return x.id === bcId; });
  if(!bc){ toast('Không tìm thấy báo cáo','error'); return; }

  // Đọc giá trị đã chỉnh sửa từ form
  var patch = { trang_thai: 'da_duyet' };
  if(bc.loai === 'km_dau' || bc.loai === 'km_cuoi'){
    var kmV = readMoney('pbc-km-'+bcId);
    if(kmV) patch.so_km = kmV;
  } else if(bc.loai === 'do_dau'){
    var litEl  = document.getElementById('pbc-lit-'+bcId);
    var tienEl = document.getElementById('pbc-tien-'+bcId);
    if(litEl){ var litV = readLit(litEl.value); if(litV != null) patch.so_lit = litV; }
    if(tienEl){ var tienV = parseInt((tienEl.value||'').replace(/\D/g,'')); if(tienV) patch.tong_tien = tienV; }
  }

  // Disable nút đang bấm
  var btnEl = document.getElementById('approve-btn-'+bcId);
  if(btnEl){ btnEl.disabled = true; btnEl.textContent = '⏳ Đang duyệt...'; }

  // 1. Patch trang_thai trên bao_cao
  patchBaoCao(bcId, patch).then(function(){

    // 2. Nếu là do_dau có tiền → tạo phiếu chi
    var tienFinal = patch.tong_tien != null ? patch.tong_tien : bc.tong_tien;
    var litFinal  = patch.so_lit    != null ? patch.so_lit    : bc.so_lit;

    if(bc.loai === 'do_dau' && tienFinal){
      var dt      = bc.created_at ? new Date(bc.created_at) : new Date();
      var dateStr = dt.getFullYear()+'-'+(dt.getMonth()+1).toString().padStart(2,'0')+'-'+dt.getDate().toString().padStart(2,'0');
      var timeStr = dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0');
      var hdRec   = bc.hd_so ? DB.hopDong.find(function(h){ return h.so === bc.hd_so; }) : null;
      var chiPayload = {
        loai_gd:    'chi',
        danh_muc:   'Nhiên liệu',
        ngay_gd:    dateStr,
        gio_gd:     timeStr,
        so_tien:    tienFinal,
        hd_id:      hdRec ? hdRec.id : null,
        bien_so_xe: bc.bien_xe    || null,
        tai_xe:     bc.tai_xe_ten || null,
        hinh_thuc:  'Tiền mặt',
        doi_tac:    'Cây xăng',
        mo_ta:      'Nhiên liệu' + (litFinal ? ' '+litFinal+'L' : '') + (bc.hd_so ? ' — '+bc.hd_so : ''),
      };
      console.log('[approveBaoCao] Inserting thu_chi:', chiPayload);
      return sbPost('thu_chi', chiPayload).then(function(tcRes){
        console.log('[approveBaoCao] thu_chi insert OK, tcRes:', tcRes);
        var newId = (tcRes && tcRes[0] && tcRes[0].id) ? tcRes[0].id : ('local-'+Date.now());
        var mapped = mapTC(Object.assign({id: newId}, chiPayload));
        console.log('[approveBaoCao] mapped TC:', mapped, 'DB.thuChi.length before:', DB.thuChi.length);
        DB.thuChi.unshift(mapped);
        console.log('[approveBaoCao] DB.thuChi.length after:', DB.thuChi.length);
        toast('✅ Đã duyệt + tạo phiếu chi '+fmtM(tienFinal), 'success');
      });
    } else {
      toast('✅ Đã duyệt báo cáo', 'success');
      return Promise.resolve();
    }

  }).then(function(){
    // 3. Cập nhật cache & UI
    PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
    SELECTED_BC_IDS.delete(bcId);
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    // Nếu đang ở trang thu-chi thì refresh ngay
    if(currentPage === 'thuchi') renderTCAll();

  }).catch(function(e){
    console.error('approveBaoCao error:', e);
    toast('❌ Duyệt thất bại: ' + (e.message || 'Lỗi không xác định'), 'error');
    if(btnEl){ btnEl.disabled = false; btnEl.textContent = '✅ Duyệt'; }
  });
}

// Bỏ qua (mark da_duyet, không tạo phiếu chi)
function skipBaoCao(bcId){
  patchBaoCao(bcId, { trang_thai: 'da_duyet' }).then(function(){
    PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    toast('⏭️ Đã bỏ qua báo cáo', 'info');
  }).catch(function(e){ toast('❌ '+e.message,'error'); });
}

// Từ chối (mark tu_choi)
function rejectBaoCao(bcId){
  if(!confirm('Từ chối báo cáo này? Báo cáo sẽ bị đánh dấu không hợp lệ.')) return;
  patchBaoCao(bcId, { trang_thai: 'tu_choi' }).then(function(){
    PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    toast('🗑️ Đã từ chối báo cáo', 'info');
  }).catch(function(e){ toast('❌ '+e.message,'error'); });
}

// ── Bulk selection helpers ────────────────────────────────────────────────────
function toggleBCSelect(id){
  if(SELECTED_BC_IDS.has(id)) SELECTED_BC_IDS.delete(id);
  else SELECTED_BC_IDS.add(id);
  renderDuyetBCContent();
}

function toggleSelectAllBC(){
  if(SELECTED_BC_IDS.size === PENDING_BC.length){
    SELECTED_BC_IDS.clear();
  } else {
    PENDING_BC.forEach(function(bc){ SELECTED_BC_IDS.add(bc.id); });
  }
  renderDuyetBCContent();
}

// Duyệt hàng loạt — xử lý tuần tự từng ID đã chọn
function bulkApproveBaoCao(){
  var ids = Array.from(SELECTED_BC_IDS);
  if(!ids.length){ toast('Chưa chọn báo cáo nào','error'); return; }

  var total = ids.length;
  var done  = 0;
  var failed = 0;

  // Hiện nút loading tạm
  toast('⏳ Đang duyệt '+total+' báo cáo...', 'info');

  var chain = Promise.resolve();
  ids.forEach(function(bcId){
    chain = chain.then(function(){
      return patchBaoCao(bcId, { trang_thai: 'da_duyet' }).then(function(){
        // Nếu là do_dau có tiền → tạo phiếu chi
        var bc = PENDING_BC.find(function(x){ return x.id === bcId; });
        if(bc && bc.loai === 'do_dau' && bc.tong_tien){
          var dt      = bc.created_at ? new Date(bc.created_at) : new Date();
          var dateStr = dt.getFullYear()+'-'+(dt.getMonth()+1).toString().padStart(2,'0')+'-'+dt.getDate().toString().padStart(2,'0');
          var timeStr = dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0');
          var hdRec   = bc.hd_so ? DB.hopDong.find(function(h){ return h.so === bc.hd_so; }) : null;
          var chiPayload = {
            loai_gd:    'chi',
            danh_muc:   'Nhiên liệu',
            ngay_gd:    dateStr,
            gio_gd:     timeStr,
            so_tien:    bc.tong_tien,
            hd_id:      hdRec ? hdRec.id : null,
            bien_so_xe: bc.bien_xe    || null,
            tai_xe:     bc.tai_xe_ten || null,
            hinh_thuc:  'Tiền mặt',
            doi_tac:    'Cây xăng',
            mo_ta:      'Nhiên liệu'+(bc.so_lit?' '+bc.so_lit+'L':'')+(bc.hd_so?' — '+bc.hd_so:''),
          };
          return sbPost('thu_chi', chiPayload).then(function(tcRes){
            var newId = (tcRes && tcRes[0] && tcRes[0].id) ? tcRes[0].id : ('local-'+Date.now());
            DB.thuChi.unshift(mapTC(Object.assign({id: newId}, chiPayload)));
          }).catch(function(e){ console.warn('bulkApprove: tạo phiếu chi lỗi', e.message); });
        }
      }).then(function(){
        done++;
        PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
        SELECTED_BC_IDS.delete(bcId);
      }).catch(function(e){
        failed++;
        console.error('bulkApproveBaoCao: lỗi id='+bcId, e.message);
      });
    });
  });

  chain.then(function(){
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    if(currentPage === 'thuchi') renderTCAll();
    if(failed === 0){
      toast('✅ Đã duyệt '+done+' báo cáo', 'success');
    } else {
      toast('⚠️ Duyệt xong: '+done+' thành công, '+failed+' lỗi', 'error');
    }
  });
}

// Bỏ qua hàng loạt — mark da_duyet không tạo phiếu chi
function bulkSkipBaoCao(){
  var ids = Array.from(SELECTED_BC_IDS);
  if(!ids.length){ toast('Chưa chọn báo cáo nào','error'); return; }

  var total = ids.length;
  toast('⏳ Đang bỏ qua '+total+' báo cáo...', 'info');

  var chain = Promise.resolve();
  ids.forEach(function(bcId){
    chain = chain.then(function(){
      return patchBaoCao(bcId, { trang_thai: 'da_duyet' }).then(function(){
        PENDING_BC = PENDING_BC.filter(function(x){ return x.id !== bcId; });
        SELECTED_BC_IDS.delete(bcId);
      }).catch(function(e){ console.warn('bulkSkip lỗi id='+bcId, e.message); });
    });
  });

  chain.then(function(){
    PENDING_EXPAND = null;
    updatePendingBadge();
    renderNotifPendingSection();
    renderDuyetBCContent();
    toast('⏭️ Đã bỏ qua '+total+' báo cáo', 'info');
  });
}

// ═══════════════════════════════════════
// [REMOVED: Portal Tài xế — xem driver.html]
// ═══════════════════════════════════════

function renderDriverPortal(){
  var sel='';try{sel=localStorage.getItem(DRIVER_KEY)||'';}catch(e){}

  // Badge sidebar: số chuyến đang chạy (tất cả tài xế)
  var activeCnt=DB.hopDong.filter(function(h){return h.tt==='dang_chay';}).length;
  var badge=document.getElementById('driverActiveBadge');
  if(badge){badge.style.display=activeCnt?'':'none';badge.textContent=activeCnt;}

  var txOpts='<option value="">— Chọn tên tài xế —</option>'
    +DB.taiXe.map(function(t){return'<option value="'+t.ten+'"'+(t.ten===sel?' selected':'')+'>'+t.ten+'</option>';}).join('');

  var content='';
  if(!sel){
    content='<div style="text-align:center;padding:70px 20px;color:var(--text3)">'
      +'<div style="font-size:3.5rem;margin-bottom:14px">🚗</div>'
      +'<div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:8px">Chọn tên tài xế để xem lịch trình</div>'
      +'<div style="font-size:.83rem;line-height:1.6">Tài xế bấm chọn tên mình ở góc trên để xem hợp đồng<br>và gửi báo cáo hoàn thành chuyến đi.</div>'
      +'</div>';
  } else {
    var today=new Date();today.setHours(0,0,0,0);
    var myHDs=DB.hopDong.filter(function(h){return h.taixe===sel;});

    // Đang thực hiện: dang_chay, HOẶC cho_xe mà ngay_di đã đến
    var active=myHDs.filter(function(h){
      if(h.tt==='dang_chay')return true;
      if(h.tt==='cho_xe'){var d=new Date(h.ngay_di||h.ngay||'');d.setHours(0,0,0,0);return d<=today;}
      return false;
    });

    // Chờ thực hiện: cho_xe mà ngay_di CHƯA đến
    var upcoming=myHDs.filter(function(h){
      if(h.tt!=='cho_xe')return false;
      var d=new Date(h.ngay_di||h.ngay||'');d.setHours(0,0,0,0);return d>today;
    }).sort(function(a,b){return(a.ngay_di||a.ngay||'').localeCompare(b.ngay_di||b.ngay||'');});

    // Đã hoàn thành gần nhất
    var done=myHDs.filter(function(h){return _isCompleted(h);})
      .sort(function(a,b){return(b.ngay_di||b.ngay||'').localeCompare(a.ngay_di||a.ngay||'');})
      .slice(0,5);

    // ── Section: Đang thực hiện ──
    var activeHTML=active.length?active.map(function(h){
      var ngayVe=h.ngay_ve||h.ngay_di||h.ngay||'';
      var veD=new Date(ngayVe);veD.setHours(0,0,0,0);
      var overdue=ngayVe&&veD<today;
      var dateTxt=fmtD(h.ngay_di||h.ngay||'')+(ngayVe&&ngayVe!==(h.ngay_di||h.ngay)?'&nbsp;→&nbsp;'+fmtD(ngayVe):'');
      return'<div class="card" style="margin-bottom:14px;border-left:4px solid '+(overdue?'var(--orange)':'var(--green)')+';padding:0">'
        +'<div style="padding:16px 18px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
            +'<span class="mono" style="font-weight:700;color:var(--blue);font-size:.9rem">'+h.so+'</span>'
            +(overdue
              ?'<span style="font-size:.65rem;background:var(--orange);color:#fff;border-radius:4px;padding:2px 8px">⚠ Quá ngày về</span>'
              :'<span style="font-size:.65rem;background:#dcfce7;color:#15803d;border-radius:4px;padding:2px 8px">🚌 Đang chạy</span>')
          +'</div>'
          +'<div style="font-weight:700;font-size:1rem;margin-bottom:5px">'+h.kh+'</div>'
          +'<div style="font-size:.8rem;color:var(--text2);margin-bottom:4px">📍 '+h.tuyen+'</div>'
          +'<div style="font-size:.75rem;color:var(--text3);margin-bottom:14px">🗓 '+dateTxt+' &nbsp;·&nbsp; 🚌 '+h.xe+'</div>'
          +'<button class="btn" style="width:100%;background:var(--green);color:#fff;padding:11px;font-size:.88rem;font-weight:600" onclick="driverConfirmComplete(\''+h.id+'\')">'
            +'✅&nbsp; Gửi báo cáo hoàn thành'
          +'</button>'
        +'</div>'
      +'</div>';
    }).join('')
    :'<div style="text-align:center;padding:28px;color:var(--text3);font-size:.82rem">Không có chuyến đang thực hiện</div>';

    // ── Section: Chờ thực hiện ──
    var upcomingHTML=upcoming.length?upcoming.map(function(h){
      var diD=new Date(h.ngay_di||h.ngay||'');diD.setHours(0,0,0,0);
      var days=Math.round((diD-today)/864e5);
      return'<div style="display:flex;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer" onclick="openHDDetail(\''+h.id+'\')">'
        +'<div style="width:46px;height:46px;border-radius:10px;background:var(--accent-light,#eff6ff);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">'
          +'<div style="font-size:1.2rem;font-weight:800;color:var(--accent);line-height:1">'+days+'</div>'
          +'<div style="font-size:.56rem;color:var(--accent);font-weight:600">ngày nữa</div>'
        +'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h.kh+'</div>'
          +'<div style="font-size:.74rem;color:var(--text2);margin-top:2px">'+h.tuyen+'</div>'
          +'<div style="font-size:.7rem;color:var(--text3);margin-top:2px">🗓 '+fmtD(h.ngay_di||h.ngay||'')+(h.ngay_ve&&h.ngay_ve!==(h.ngay_di||h.ngay)?'&nbsp;→&nbsp;'+fmtD(h.ngay_ve):'')+'</div>'
        +'</div>'
        +'<span class="mono" style="font-size:.7rem;color:var(--text3);align-self:center;white-space:nowrap">'+h.so+'</span>'
      +'</div>';
    }).join('')
    :'<div style="padding:20px;text-align:center;color:var(--text3);font-size:.82rem">Không có chuyến sắp tới</div>';

    // ── Section: Đã hoàn thành ──
    var doneHTML=done.length?done.map(function(h){
      return'<div style="display:flex;gap:12px;padding:11px 16px;border-bottom:1px solid var(--border);cursor:pointer;opacity:.75" onclick="openHDDetail(\''+h.id+'\')">'
        +'<span style="font-size:1.1rem;align-self:center">✅</span>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:.83rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h.kh+'</div>'
          +'<div style="font-size:.7rem;color:var(--text3)">'+h.tuyen+' &nbsp;·&nbsp; '+fmtD(h.ngay_di||h.ngay||'')+'</div>'
        +'</div>'
        +'<span class="mono" style="font-size:.7rem;color:var(--text3);align-self:center">'+h.so+'</span>'
      +'</div>';
    }).join('')
    :'<div style="padding:20px;text-align:center;color:var(--text3);font-size:.82rem">Chưa có chuyến hoàn thành</div>';

    content=''
      // Active
      +'<div style="margin-bottom:22px">'
        +'<div style="font-size:.75rem;font-weight:700;color:var(--green);letter-spacing:.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">'
          +'<span>🚌</span> ĐANG THỰC HIỆN'
          +(active.length?'<span style="background:var(--green);color:#fff;border-radius:20px;padding:1px 8px;font-size:.68rem">'+active.length+'</span>':'')
        +'</div>'
        +activeHTML
      +'</div>'
      // Upcoming
      +'<div style="margin-bottom:22px">'
        +'<div style="font-size:.75rem;font-weight:700;color:var(--accent);letter-spacing:.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">'
          +'<span>📋</span> CHUYẾN SẮP TỚI'
          +(upcoming.length?'<span style="background:var(--accent);color:#fff;border-radius:20px;padding:1px 8px;font-size:.68rem">'+upcoming.length+'</span>':'')
        +'</div>'
        +'<div class="card" style="padding:0;overflow:hidden">'+upcomingHTML+'</div>'
      +'</div>'
      // Done
      +'<div>'
        +'<div style="font-size:.75rem;font-weight:700;color:var(--text3);letter-spacing:.8px;margin-bottom:10px">✅ ĐÃ HOÀN THÀNH GẦN ĐÂY</div>'
        +'<div class="card" style="padding:0;overflow:hidden">'+doneHTML+'</div>'
      +'</div>';
  }

  document.getElementById('driver-portal-content').innerHTML=''
    // Header chọn tài xế
    +'<div class="card" style="margin-bottom:20px;padding:0">'
      +'<div style="padding:14px 20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:10px">'
        +'<div style="font-size:2.2rem;line-height:1">🚗</div>'
        +'<div style="flex:1;min-width:120px">'
          +'<div style="font-weight:700;font-size:.9rem">Portal Tài xế</div>'
          +'<div style="font-size:.72rem;color:var(--text3)">Xem lịch trình &amp; báo cáo hoàn thành chuyến</div>'
        +'</div>'
        +'<select class="fc" style="max-width:200px;min-width:140px;margin:0" onchange="driverSelect(this.value)">'+txOpts+'</select>'
      +'</div>'
      +(sel?'<div style="padding:8px 20px;background:var(--surface2);font-size:.75rem;color:var(--text2)">Đang xem lịch trình của <strong>'+sel+'</strong></div>':'')
    +'</div>'
    +content;
}

function driverSelect(val){
  try{localStorage.setItem(DRIVER_KEY,val);}catch(e){}
  renderDriverPortal();
}

function driverConfirmComplete(hdId){
  var h=DB.hopDong.find(function(x){return x.id===hdId;});
  if(!h)return;
  askConfirm({
    icon:'✅',
    title:'Xác nhận hoàn thành chuyến?',
    msg:h.so+' · '+h.kh+' · '+h.tuyen+'\n\nBấm xác nhận để gửi báo cáo. Hợp đồng sẽ chuyển sang Hoàn thành ngay lập tức.',
    btnLabel:'Xác nhận hoàn thành',
    btnClass:'btn-accent'
  },function(){
    sbPatch('hop_dong',hdId,{trang_thai:'hoan_thanh'}).then(function(){
      var idx=DB.hopDong.findIndex(function(x){return x.id===hdId;});
      if(idx>-1)DB.hopDong[idx].tt='hoan_thanh';
      renderDriverPortal();
      updateBadges();
      toast('✅ Đã gửi báo cáo hoàn thành · '+h.so,'success',4000);
    }).catch(function(e){toast('❌ '+e.message,'error');});
  });
}

// ═══════════════════════════════════════
// QUẢN LÝ TÀI KHOẢN TÀI XẾ
// ═══════════════════════════════════════
function loadDriverAccounts(){
  var el = document.getElementById('driver-accounts-list');
  if(!el) return;
  if(!SB_URL || !SB_KEY){
    el.innerHTML = '<div style="padding:16px;font-size:.8rem;color:var(--text3)">⚠️ Chưa kết nối Supabase — không thể quản lý tài khoản.</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:.82rem">⏳ Đang tải...</div>';

  sbFetch('tai_xe','select=id,ho_ten,so_dt,cmnd,mat_khau&order=ho_ten.asc').then(function(rows){
    if(!rows || !rows.length){
      el.innerHTML = '<div style="padding:16px;font-size:.8rem;color:var(--text3)">Chưa có tài xế nào trong hệ thống.</div>';
      return;
    }

    var html = '<div style="font-size:.72rem;color:var(--text3);margin-bottom:12px;padding-top:4px">'
      +'Tài xế đăng nhập bằng <strong>Số điện thoại</strong> làm tên tài khoản. '
      +'Mật khẩu mặc định là <strong>4 số cuối CCCD</strong> nếu chưa được thiết lập.'
      +'</div>';

    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    rows.forEach(function(tx){
      var hasPw   = !!(tx.mat_khau && tx.mat_khau.toString().trim());
      var fallback = (tx.cmnd||'').toString().slice(-4);
      var badge = hasPw
        ? '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #86efac;border-radius:20px;padding:2px 10px;font-size:.67rem;font-weight:700">✅ Đã có MK</span>'
        : (fallback
            ? '<span style="background:#fffbeb;color:#92400e;border:1px solid #fcd34d;border-radius:20px;padding:2px 10px;font-size:.67rem;font-weight:700">⚠️ Dùng MK mặc định</span>'
            : '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:20px;padding:2px 10px;font-size:.67rem;font-weight:700">🚫 Chưa có MK</span>');

      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;'
        +'background:var(--surface2);border-radius:10px;border:1px solid var(--border)">'
        // Avatar
        +'<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;'
        +'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0">'
        +(tx.ho_ten||'?').substring(0,2).toUpperCase()+'</div>'
        // Info
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(tx.ho_ten||'—')+'</div>'
        +'<div style="font-size:.72rem;color:var(--text3);margin-top:1px">📱 '+(tx.so_dt||'Chưa có SĐT')+'</div>'
        +'</div>'
        // Badge
        +'<div style="flex-shrink:0">'+badge+'</div>'
        // Button
        +'<button class="btn btn-ghost btn-sm" style="flex-shrink:0;white-space:nowrap" '
        +'onclick="openSetPassModal(\''+tx.id+'\',\''+encodeURIComponent(tx.ho_ten||'')+'\',\''+encodeURIComponent(tx.so_dt||'')+'\')">'
        +'🔑 Cấp MK</button>'
        +'</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }).catch(function(e){
    el.innerHTML = '<div style="padding:16px;font-size:.8rem;color:var(--red)">❌ Lỗi: '+e.message+'</div>';
  });
}

function openSetPassModal(id, tenEncoded, sdtEncoded){
  var ten = decodeURIComponent(tenEncoded);
  var sdt = decodeURIComponent(sdtEncoded);

  // Gợi ý mật khẩu tự động: 3 chữ cái đầu tên + 3 số cuối SĐT
  var autoSuggest = (function(){
    var parts = ten.trim().split(/\s+/);
    var last  = parts[parts.length - 1] || '';
    var prefix = last.substring(0,3).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/đ/g,'d').replace(/[^a-z]/g,'');
    var suffix = (sdt||'').replace(/\D/g,'').slice(-3);
    return prefix && suffix ? prefix + suffix : '';
  })();

  var body = '<div style="display:flex;flex-direction:column;gap:14px">'
    // Tên tài xế + tài khoản
    +'<div style="background:var(--surface2);border-radius:10px;padding:12px 14px">'
    +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:4px">Tài xế</div>'
    +'<div style="font-weight:700">'+ten+'</div>'
    +'<div style="font-size:.78rem;color:var(--text2);margin-top:2px">📱 Tên đăng nhập: <strong>'+sdt+'</strong></div>'
    +'</div>'
    // Gợi ý tự động
    +(autoSuggest
      ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">'
        +'<div><div style="font-size:.72rem;color:#166534;font-weight:600">💡 Gợi ý mật khẩu</div>'
        +'<div style="font-size:.92rem;font-weight:700;font-family:\'DM Mono\',monospace;color:#15803d;letter-spacing:2px;margin-top:2px">'+autoSuggest+'</div></div>'
        +'<button class="btn btn-sm" style="background:#dcfce7;color:#166534;border:1px solid #86efac" '
        +'onclick="document.getElementById(\'new-pass-input\').value=\''+autoSuggest+'\';'
        +'document.getElementById(\'confirm-pass-input\').value=\''+autoSuggest+'\';checkPassMatch()">Dùng gợi ý</button>'
        +'</div>'
      : '')
    // Nhập mật khẩu mới
    +'<div>'
    +'<label style="font-size:.75rem;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Mật khẩu mới <span style="color:var(--red)">*</span></label>'
    +'<div style="position:relative">'
    +'<input id="new-pass-input" type="password" class="fc" placeholder="Tối thiểu 4 ký tự" oninput="checkPassMatch()" style="padding-right:44px">'
    +'<button onclick="togglePassVis(\'new-pass-input\',\'tog1\')" id="tog1" '
    +'style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text3)">👁️</button>'
    +'</div></div>'
    // Xác nhận mật khẩu
    +'<div>'
    +'<label style="font-size:.75rem;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Xác nhận mật khẩu <span style="color:var(--red)">*</span></label>'
    +'<div style="position:relative">'
    +'<input id="confirm-pass-input" type="password" class="fc" placeholder="Nhập lại mật khẩu" oninput="checkPassMatch()" style="padding-right:44px">'
    +'<button onclick="togglePassVis(\'confirm-pass-input\',\'tog2\')" id="tog2" '
    +'style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text3)">👁️</button>'
    +'</div></div>'
    // Thông báo match
    +'<div id="pass-match-hint" style="font-size:.75rem;min-height:18px"></div>'
    +'</div>';

  showModal('🔑 Cấp mật khẩu', ten,
    body,
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button>'
    +'<button id="save-pass-btn" class="btn btn-accent" disabled onclick="saveDriverPass(\''+id+'\',\''+tenEncoded+'\')">💾 Lưu mật khẩu</button>'
  );
  setTimeout(function(){ var el=document.getElementById('new-pass-input'); if(el) el.focus(); }, 100);
}

function togglePassVis(inputId, btnId){
  var inp = document.getElementById(inputId);
  var btn = document.getElementById(btnId);
  if(!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if(btn) btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

function checkPassMatch(){
  var p1  = (document.getElementById('new-pass-input')||{}).value || '';
  var p2  = (document.getElementById('confirm-pass-input')||{}).value || '';
  var hint = document.getElementById('pass-match-hint');
  var btn  = document.getElementById('save-pass-btn');
  if(!p1){ if(hint) hint.textContent=''; if(btn) btn.disabled=true; return; }
  if(p1.length < 4){
    if(hint){ hint.textContent='⚠️ Mật khẩu phải có ít nhất 4 ký tự'; hint.style.color='var(--orange)'; }
    if(btn) btn.disabled = true; return;
  }
  if(!p2){ if(hint) hint.textContent=''; if(btn) btn.disabled=true; return; }
  if(p1 === p2){
    if(hint){ hint.textContent='✅ Mật khẩu khớp'; hint.style.color='var(--green)'; }
    if(btn) btn.disabled = false;
  } else {
    if(hint){ hint.textContent='❌ Mật khẩu không khớp'; hint.style.color='var(--red)'; }
    if(btn) btn.disabled = true;
  }
}

function saveDriverPass(id, tenEncoded){
  var ten = decodeURIComponent(tenEncoded);
  var pw  = (document.getElementById('new-pass-input')||{}).value || '';
  if(!pw || pw.length < 4){ toast('⚠️ Mật khẩu quá ngắn','error'); return; }
  var btn = document.getElementById('save-pass-btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang lưu...'; }
  sbPatch('tai_xe', id, {mat_khau: pw}).then(function(){
    closeModal();
    toast('✅ Đã cấp mật khẩu cho '+ten,'success');
    loadDriverAccounts(); // Cập nhật lại danh sách
  }).catch(function(e){
    toast('❌ Lỗi: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='💾 Lưu mật khẩu'; }
  });
}

// ═══════════════════════════════════════
// CÀI ĐẶT
// ═══════════════════════════════════════
var DEFAULT_CD={ten:'Công ty TNHH Nam Khang Transport',mst:'0123456789',sdt:'0908 123 456',email:'contact@namkhang.vn',diachi:'123 Nguyễn Văn Linh, Q.7, TP.HCM'};
function fillCaiDat(cd){document.getElementById('cd-ten').value=cd.ten||'';document.getElementById('cd-mst').value=cd.mst||'';document.getElementById('cd-sdt').value=cd.sdt||'';document.getElementById('cd-email').value=cd.email||'';document.getElementById('cd-diachi').value=cd.dia_chi||cd.diachi||'';}
function loadCaiDat(){
  loadDriverAccounts(); // Tải danh sách tài khoản tài xế
  fillCaiDat(DEFAULT_CD);
  if(!SB_URL){try{var raw=localStorage.getItem('nk_caidat_v1');if(raw)fillCaiDat(JSON.parse(raw));}catch(e){}return;}
  sbFetch('cai_dat','id=eq.company&limit=1').then(function(rows){if(rows&&rows.length)fillCaiDat(rows[0]);}).catch(function(e){
    console.warn('loadCaiDat:',e.message);
    try{var raw=localStorage.getItem('nk_caidat_v1');if(raw)fillCaiDat(JSON.parse(raw));}catch(e2){}
  });
}
function saveCaiDat(){
  var cd={ten:document.getElementById('cd-ten').value.trim(),mst:document.getElementById('cd-mst').value.trim(),sdt:document.getElementById('cd-sdt').value.trim(),email:document.getElementById('cd-email').value.trim(),dia_chi:document.getElementById('cd-diachi').value.trim(),updated_at:new Date().toISOString()};
  if(!SB_URL){try{localStorage.setItem('nk_caidat_v1',JSON.stringify(cd));}catch(e){}toast('💾 Đã lưu local','info');return;}
  fetch(SB_URL+'/rest/v1/cai_dat?id=eq.company',{method:'PATCH',headers:Object.assign({},SB_H,{'Prefer':'return=representation'}),body:JSON.stringify(cd)}).then(function(r){
    if(!r.ok)throw new Error(r.status);
    try{localStorage.setItem('nk_caidat_v1',JSON.stringify(cd));}catch(e){}
    toast('✅ Đã lưu thông tin công ty!','success');
  }).catch(function(e){try{localStorage.setItem('nk_caidat_v1',JSON.stringify(cd));}catch(e2){}toast('💾 Đã lưu local (Supabase: '+e.message+')','info');});
}

// ═══════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════
function exportExcel(){
  showModal('📊 Xuất Excel','Chọn dữ liệu muốn xuất',
    '<div style="display:flex;flex-direction:column;gap:10px">'+
    [['ex-thuchi','💸','Thu Chi','Toàn bộ giao dịch'],['ex-hopdong','📋','Hợp đồng','Danh sách hợp đồng'],['ex-khachhang','👥','Khách hàng','Danh sách đối tác'],['ex-xe','🚌','Xe & Tài xế','Phương tiện + tài xế'],['ex-all','📦','Tất cả (multi-sheet)','Xuất toàn bộ 1 file']].map(function(o){return'<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;cursor:pointer" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'"><input type="radio" name="ex-sheet" value="'+o[0]+'" style="accent-color:var(--accent)"'+(o[0]==='ex-all'?' checked':'')+'><span style="font-size:1.3rem">'+o[1]+'</span><div><div style="font-size:.83rem;font-weight:600">'+o[2]+'</div><div style="font-size:.7rem;color:var(--text3)">'+o[3]+'</div></div></label>';}).join('')+
    '</div><div style="margin-top:14px;padding:10px 14px;background:var(--accent-light);border-radius:8px;font-size:.75rem;color:var(--accent)">💡 File .xlsx mở được bằng Excel, Google Sheets, LibreOffice</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-green" onclick="doExport()">📥 Tải xuống</button>');
}
function doExport(){
  var sel=(document.querySelector('input[name="ex-sheet"]:checked')||{}).value||'ex-all';
  closeModal();toast('⏳ Đang tạo file Excel...','info');
  setTimeout(function(){
    try{
      if(sel==='ex-thuchi')xlsxDownload([{name:'Thu Chi',data:sheetThuChi()}],'NamKhang_ThuChi');
      else if(sel==='ex-hopdong')xlsxDownload([{name:'Hợp đồng',data:sheetHopDong()}],'NamKhang_HopDong');
      else if(sel==='ex-khachhang')xlsxDownload([{name:'Khách hàng',data:sheetKhachHang()}],'NamKhang_KhachHang');
      else if(sel==='ex-xe')xlsxDownload([{name:'Xe',data:sheetXe()},{name:'Tài xế',data:sheetTaiXe()}],'NamKhang_Xe');
      else xlsxDownload([{name:'Thu Chi',data:sheetThuChi()},{name:'Hợp đồng',data:sheetHopDong()},{name:'Khách hàng',data:sheetKhachHang()},{name:'Xe',data:sheetXe()},{name:'Tài xế',data:sheetTaiXe()}],'NamKhang_ToanBo');
      toast('✅ Đã tải xuống thành công!','success');
    }catch(e){toast('❌ Lỗi xuất file: '+e.message,'error');}
  },200);
}
function sheetThuChi(){var rows=[['Ngày','Giờ','Loại','Danh mục','Mô tả','Hợp đồng','Xe','Tài xế','Đối tác','Hình thức TT','Số tiền (VNĐ)']];DB.thuChi.forEach(function(t){rows.push([fmtD(t.ngay),t.gio,t.type==='thu'?'Thu':'Chi',t.loai,t.mota||'',t.hd||'',t.xe||'',t.taixe||'',t.kh||'',t.httt,(t.type==='thu'?1:-1)*t.sotien]);});return rows;}
function sheetHopDong(){var rows=[['Số HĐ','Khách hàng','Tuyến đường','Ngày','Xe','Tài xế','Giá trị','Đã thu','Còn lại','Trạng thái']];DB.hopDong.forEach(function(h){rows.push([h.so,h.kh,h.tuyen,fmtD(h.ngay),h.xe||'',h.taixe||'',h.giatri,h.dathu,h.giatri-h.dathu,{cho_xe:'Chờ thực hiện',dang_chay:'Đang thực hiện',hoan_thanh:'Hoàn thành',cho_thanh_toan:'Hoàn thành'}[h.tt]||h.tt]);});return rows;}
function sheetKhachHang(){var rows=[['Tên','Loại','Điện thoại','Số HĐ','Doanh số (VNĐ)']];DB.khachHang.forEach(function(k){rows.push([k.ten,k.loai,k.sdt,k.hdCount,k.doanhSo]);});return rows;}
function sheetXe(){var rows=[['Biển số','Loại xe','Năm SX','Km đã chạy','Hạn đăng kiểm','Hạn bảo hiểm','Trạng thái']];DB.xe.forEach(function(x){rows.push([x.bien,x.loai,x.nam,x.km,fmtD(x.dangKiem),fmtD(x.baoHiem),{san_sang:'Sẵn sàng',dang_chay:'Đang chạy',bao_duong:'Bảo dưỡng'}[x.tt]||x.tt]);});return rows;}
function sheetTaiXe(){var rows=[['Họ tên','SĐT','CMND/CCCD','Bằng lái','Lương CB (VNĐ)','Số chuyến T4','Doanh thu T4']];DB.taiXe.forEach(function(t){rows.push([t.ten,t.sdt,t.cmnd,t.bangLai,t.luong,t.chuyen,t.doanhThu]);});return rows;}
function xlsxDownload(sheets,filename){
  var cols='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function escXml(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function cellAddr(c,r){return cols[c]+(r+1);}
  var strs=[],strIdx={};
  function si(v){var s=String(v==null?'':v);if(strIdx[s]==null){strIdx[s]=strs.length;strs.push(s);}return strIdx[s];}
  var sheetXmls=[],sheetNames=[];
  sheets.forEach(function(sh){
    var xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    sh.data.forEach(function(row,r){xml+='<row r="'+(r+1)+'">';row.forEach(function(val,c){var addr=cellAddr(c,r);if(typeof val==='number'&&!isNaN(val)){xml+='<c r="'+addr+'" s="'+(r===0?1:0)+'"><v>'+val+'</v></c>';}else{xml+='<c r="'+addr+'" t="s" s="'+(r===0?1:0)+'"><v>'+si(val)+'</v></c>';}});xml+='</row>';});
    xml+='</sheetData></worksheet>';sheetXmls.push(xml);sheetNames.push(sh.name);
  });
  var sstXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+strs.length+'" uniqueCount="'+strs.length+'">'+strs.map(function(s){return'<si><t xml:space="preserve">'+escXml(s)+'</t></si>';}).join('')+'</sst>';
  var wbXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheetNames.map(function(n,i){return'<sheet name="'+escXml(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+2)+'"/>';}).join('')+'</sheets></workbook>';
  var wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'+sheetNames.map(function(_,i){return'<Relationship Id="rId'+(i+2)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';}).join('')+'</Relationships>';
  var stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/></font><font><b/><sz val="11"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>';
  var relsXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheetNames.map(function(_,i){return'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';}).join('')+'<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  var files={'[Content_Types].xml':contentTypes,'_rels/.rels':relsXml,'xl/workbook.xml':wbXml,'xl/_rels/workbook.xml.rels':wbRels,'xl/sharedStrings.xml':sstXml,'xl/styles.xml':stylesXml};
  sheetXmls.forEach(function(xml,i){files['xl/worksheets/sheet'+(i+1)+'.xml']=xml;});
  var enc=new TextEncoder();
  var CRC_TABLE=new Uint32Array(256);for(var i=0;i<256;i++){var cv=i;for(var j=0;j<8;j++)cv=cv&1?(0xEDB88320^(cv>>>1)):cv>>>1;CRC_TABLE[i]=cv;}
  function crc32(buf){var c=0xFFFFFFFF;for(var i=0;i<buf.length;i++)c=((c>>>8)^CRC_TABLE[(c^buf[i])&0xFF])>>>0;return(c^0xFFFFFFFF)>>>0;}
  function le2(n){return[n&0xFF,(n>>8)&0xFF];}function le4(n){return[n&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF];}
  function concat(){var total=0;for(var i=0;i<arguments.length;i++)total+=arguments[i].length;var r=new Uint8Array(total);var off=0;for(var i=0;i<arguments.length;i++){r.set(arguments[i],off);off+=arguments[i].length;}return r;}
  var entries=[],centralDir=[];var offset=0;
  Object.keys(files).forEach(function(name){var nameB=enc.encode(name);var dataB=enc.encode(files[name]);var crc=crc32(dataB);var lh=new Uint8Array([0x50,0x4B,0x03,0x04,20,0,0,0,0,0,0,0,0,0].concat(le4(crc)).concat(le4(dataB.length)).concat(le4(dataB.length)).concat(le2(nameB.length)).concat([0,0]));var localEntry=concat(lh,nameB,dataB);entries.push(localEntry);var cd=new Uint8Array([0x50,0x4B,0x01,0x02,20,0,20,0,0,0,0,0,0,0,0,0].concat(le4(crc)).concat(le4(dataB.length)).concat(le4(dataB.length)).concat(le2(nameB.length)).concat([0,0,0,0,0,0,0,0,0,0,0,0]).concat(le4(offset)));centralDir.push(concat(cd,nameB));offset+=localEntry.length;});
  var cdData=concat.apply(null,centralDir);var eocd=new Uint8Array([0x50,0x4B,0x05,0x06,0,0,0,0].concat(le2(entries.length)).concat(le2(entries.length)).concat(le4(cdData.length)).concat(le4(offset)).concat([0,0]));
  var zipBytes=concat.apply(null,entries.concat([cdData,eocd]));
  var blob=new Blob([zipBytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=filename+'_'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}

// ═══════════════════════════════════════
// QUICK EXPORTS
// ═══════════════════════════════════════
function exportDashboard(){
  var ym=DB_MONTH;var mm=parseInt(ym.slice(0,2)),yyyy=parseInt(ym.slice(3));
  var cur=getMonthTotals(ym);var prev=getMonthTotals(prevYM(ym));var ly=getMonthTotals(lastYearYM(ym));
  var hdMonth=DB.hopDong.filter(function(h){return getMY(h.ngay)===ym;});
  var tcMonth=DB.thuChi.filter(function(t){return getMY(t.ngay)===ym;});
  toast('⏳ Đang xuất Dashboard...','info');
  setTimeout(function(){
    try{
      xlsxDownload([
        {name:'Tổng quan T'+mm+'/'+yyyy,data:[
          ['Chỉ số','Tháng '+mm+'/'+yyyy,'vs Tháng trước','vs Cùng kỳ LY'],
          ['Doanh thu',cur.thu,cur.thu-prev.thu,cur.thu-ly.thu],
          ['Chi phí',cur.chi,cur.chi-prev.chi,cur.chi-ly.chi],
          ['Lợi nhuận',cur.thu-cur.chi,(cur.thu-cur.chi)-(prev.thu-prev.chi),(cur.thu-cur.chi)-(ly.thu-ly.chi)],
          ['','','',''],
          ['Trạng thái HĐ','Số lượng','',''],
          ['Đang thực hiện',DB.hopDong.filter(function(h){return h.tt==='dang_chay';}).length,'',''],
          ['Công nợ (chưa thu đủ)',DB.hopDong.filter(function(h){return h.tt==='hoan_thanh'&&h.giatri>h.dathu;}).length+' HĐ','',''],
          ['Hoàn thành T'+mm,DB.hopDong.filter(function(h){return getMY(h.ngay)===ym&&h.tt==='hoan_thanh';}).length,'',''],
          ['Chờ thực hiện',DB.hopDong.filter(function(h){return h.tt==='cho_xe';}).length,'',''],
        ]},
        {name:'HĐ tháng '+mm,data:[['Số HĐ','Khách hàng','Tuyến','Ngày','Giá trị','Đã thu','Trạng thái']].concat(hdMonth.map(function(h){return[h.so,h.kh,h.tuyen,fmtD(h.ngay),h.giatri,h.dathu,{cho_xe:'Chờ thực hiện',dang_chay:'Đang thực hiện',hoan_thanh:'Hoàn thành',cho_thanh_toan:'Hoàn thành'}[h.tt]||h.tt];}))},
        {name:'Thu Chi tháng '+mm,data:[['Ngày','Loại','Danh mục','Mô tả','Số tiền (VNĐ)']].concat(tcMonth.map(function(t){return[fmtD(t.ngay),t.type==='thu'?'Thu':'Chi',t.loai,t.mota||'',(t.type==='thu'?1:-1)*t.sotien];}))},
        {name:'Top tài xế',data:[['Hạng','Tài xế','Số chuyến','Doanh thu']].concat(DB.taiXe.map(function(tx){var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&getMY(h.ngay)===ym;});return[0,tx.ten,hds.length,hds.reduce(function(s,h){return s+h.giatri;},0)];}).sort(function(a,b){return b[3]-a[3];}).map(function(r,i){return[i+1,r[1],r[2],r[3]];}))},
      ],'NamKhang_Dashboard_T'+mm+'_'+yyyy);
      toast('✅ Đã xuất Dashboard!','success');
    }catch(e){toast('❌ Lỗi: '+e.message,'error');}
  },150);
}

function exportHD(){
  var q=(document.getElementById('hd-search')||{}).value||'';
  var tt=(document.getElementById('hd-filter-tt')||{}).value||'';
  var mo=(document.getElementById('hd-filter-month')||{}).value||'';
  var rows=DB.hopDong.filter(function(h){
    var ttMatch=!tt||(tt==='cong_no'?(h.tt==='hoan_thanh'&&h.giatri>h.dathu):h.tt===tt);
    var moMatch=!mo||(h.ngay_di||h.ngay||'').startsWith(mo);
    return (!q||[h.so,h.kh,h.tuyen,h.xe,h.taixe].join(' ').toLowerCase().includes(q.toLowerCase()))&&ttMatch&&moMatch;
  });
  var ttLbl={cho_xe:'Chờ thực hiện',dang_chay:'Đang thực hiện',hoan_thanh:'Hoàn thành',cho_thanh_toan:'Hoàn thành'};
  var sheetName = mo ? ('HĐ T'+mo.split('-')[1]+'-'+mo.split('-')[0]) : 'Hợp đồng';
  var fileName  = mo ? ('NamKhang_HopDong_'+mo.replace('-','')) : 'NamKhang_HopDong';
  toast('⏳ Đang xuất Excel'+( mo?' tháng '+mo.split('-')[1]+'/'+mo.split('-')[0]:'')+' ('+rows.length+' HĐ)...','info');
  setTimeout(function(){
    try{
      xlsxDownload([{name:sheetName,data:[['Số HĐ','Khách hàng','Tuyến đường','Ngày đi','Ngày về','Xe','Tài xế','Giá trị','Đã thu','Còn lại','Trạng thái']].concat(rows.map(function(h){return[h.so,h.kh,h.tuyen,fmtD(h.ngay_di||h.ngay),h.ngay_ve?fmtD(h.ngay_ve):'',h.xe||'',h.taixe||'',h.giatri,h.dathu,h.giatri-h.dathu,ttLbl[h.tt]||h.tt];}))}],fileName);
      toast('✅ Xuất thành công '+rows.length+' hợp đồng!','success');
    }catch(e){toast('❌ '+e.message,'error');}
  },100);
}

function exportKH(){
  toast('⏳ Đang xuất Excel Khách hàng...','info');
  setTimeout(function(){
    try{xlsxDownload([{name:'Khách hàng',data:sheetKhachHang()}],'NamKhang_KhachHang');toast('✅ Xuất thành công!','success');}catch(e){toast('❌ '+e.message,'error');}
  },100);
}

function exportTC(){
  var cat=(document.getElementById('tc-cat')||{}).value||'';
  var monthVal=(document.getElementById('tc-month')||{}).value||'';
  var rows=DB.thuChi.slice();
  if(tcTab&&tcTab!=='all')rows=rows.filter(function(t){return t.type===tcTab;});
  if(cat)rows=rows.filter(function(t){return t.loai===cat;});
  if(monthVal&&monthVal!=='custom')rows=rows.filter(function(t){return getMY(t.ngay)===monthVal;});
  toast('⏳ Đang xuất Excel Thu Chi...','info');
  setTimeout(function(){
    try{xlsxDownload([{name:'Thu Chi',data:[['Ngày','Giờ','Loại','Danh mục','Mô tả','Hợp đồng','Xe','Tài xế','Đối tác','Hình thức TT','Số tiền (VNĐ)']].concat(rows.map(function(t){return[fmtD(t.ngay),t.gio,t.type==='thu'?'Thu':'Chi',t.loai,t.mota||'',t.hd||'',t.xe||'',t.taixe||'',t.kh||'',t.httt,(t.type==='thu'?1:-1)*t.sotien];}))}],'NamKhang_ThuChi');toast('✅ Xuất thành công!','success');}catch(e){toast('❌ '+e.message,'error');}
  },100);
}

// ═══════════════════════════════════════
// XE & TÀI XẾ — DRILL-DOWN DETAIL
// ═══════════════════════════════════════
function openXeDetail(id){
  var x=DB.xe.find(function(v){return v.id===id;}); if(!x)return;
  var hdList=DB.hopDong.filter(function(h){return h.xe===x.bien;}).sort(function(a,b){return b.ngay.localeCompare(a.ngay);});
  var hdDone=hdList.filter(function(h){return h.tt==='hoan_thanh';});
  var tcList=DB.thuChi.filter(function(t){return t.xe===x.bien;});
  var totalRev=hdList.reduce(function(s,h){return s+h.giatri;},0);
  var totalChi=tcList.filter(function(t){return t.type==='chi';}).reduce(function(s,t){return s+t.sotien;},0);
  var dk=Math.round((new Date(x.dangKiem)-new Date())/864e5);
  var bh=Math.round((new Date(x.baoHiem)-new Date())/864e5);

  // Km display — base tĩnh, sẽ được cập nhật async từ bao_cao
  var kmBaseHTML = '<span id="xe-km-base">'+fmt(x.km)+' km</span>'
    +'<div id="xe-km-extra" style="font-size:.65rem;color:var(--text3);margin-top:2px">⏳ Đang tính...</div>';

  // Thay nhớt
  var nextNhotKm=x.kmThayNhot!=null?x.kmThayNhot+10000:null;
  var oilInfo=x.kmThayNhot!=null
    ?fmtD('')+'<div style="font-size:.65rem;color:var(--text3)">Lần cuối: '+fmt(x.kmThayNhot)+' km</div>'
     +'<div style="font-size:.65rem;color:'+(nextNhotKm&&x.km>=nextNhotKm-500?'var(--orange)':'var(--green)')+'">Tới hạn: '+fmt(nextNhotKm)+' km</div>'
    :'<span style="color:var(--text3)">Chưa có dữ liệu</span>';
  var infoRows=[
    ['🚌 Biển số',x.bien],
    ['🏭 Loại xe',x.loai],
    ['📅 Năm SX',x.nam],
    ['🛣️ Km đã chạy', kmBaseHTML],
    ['🔍 Đăng kiểm',fmtD(x.dangKiem)+(dk<60?'<div style="color:var(--orange);font-size:.65rem">⚠ Còn '+dk+' ngày</div>':'')],
    ['🛡️ Bảo hiểm',fmtD(x.baoHiem)+(bh<60?'<div style="color:var(--orange);font-size:.65rem">⚠ Còn '+bh+' ngày</div>':'')],
    ['🛢️ Thay nhớt',oilInfo],
  ];
  var body='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">'+infoRows.map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:.6rem;color:var(--text3);margin-bottom:3px">'+p[0]+'</div><div style="font-size:.78rem;font-weight:600">'+p[1]+'</div></div>';}).join('')+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">'+[['💰 Tổng doanh thu','<span class="amt-pos">+'+fmtM(totalRev)+'</span>'],['💸 Tổng chi phí','<span class="amt-neg">-'+fmtM(totalChi)+'</span>'],['📋 Số HĐ',hdList.length+' hợp đồng']].map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:.68rem;color:var(--text3);margin-bottom:4px">'+p[0]+'</div><div style="font-size:.9rem;font-weight:700;font-family:\'DM Mono\',monospace">'+p[1]+'</div></div>';}).join('')+'</div>'+
    // ── Tình trạng nhiên liệu ──
    '<div id="xe-fuel-status" style="margin-bottom:18px"><div style="font-size:.78rem;color:var(--text3);padding:10px 0">⏳ Đang tải tình trạng nhiên liệu...</div></div>'+
    // ── Lịch sử bảo dưỡng ──
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div style="font-weight:700;font-size:.82rem">🔧 Lịch sử bảo dưỡng</div>'
      +(isAdmin()?'<button class="btn btn-ghost btn-sm" onclick="openBaoDuongModal(\''+x.bien+'\')">+ Ghi nhận</button>':'')
    +'</div>'
    +'<div id="bd-history" style="margin-bottom:18px"><div style="font-size:.78rem;color:var(--text3);padding:12px 0">⏳ Đang tải...</div></div>'+
    // ── Lịch sử hợp đồng ──
    '<div style="font-weight:700;font-size:.82rem;margin-bottom:8px">📋 Lịch sử hợp đồng</div>'+
    '<div class="table-wrap"><table class="dt" style="min-width:480px"><thead><tr><th>Số HĐ</th><th>Khách hàng</th><th>Tuyến</th><th>Ngày</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>'+(hdList.length?hdList.map(function(h){return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'"><td><span class="mono" style="color:var(--blue)">'+h.so+'</span></td><td>'+h.kh+'</td><td style="color:var(--text2);font-size:.74rem">'+h.tuyen+'</td><td><span class="mono">'+fmtD(h.ngay)+'</span></td><td><span class="amt-pos">+'+fmtM(h.giatri)+'</span></td><td>'+(TTMAP[h.tt]||'')+'</td></tr>';}).join(''):'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Chưa có hợp đồng</td></tr>')+'</tbody></table></div>';
  showModal('Chi tiết Xe','Biển số: '+x.bien,body,'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>'+(isAdmin()?'<button class="btn btn-ghost" onclick="openBaoDuongModal(\''+x.bien+'\')">🔧 Ghi bảo dưỡng</button>':'')+'<button class="btn btn-green" onclick="closeModal();exportXeReport(\''+id+'\')">📥 Xuất BC</button>');
  // Async load bảo dưỡng history + km stats + fuel status
  loadBaoDuongHistory(x.bien);
  loadFuelStatus(x.bien, x.dungTichBinh);

  // ── Async: tính tổng km từ bao_cao (km_cuoi - km_dau theo từng HĐ) ──────
  loadXeKmStats(x.km, x.bien, hdDone.length);
}

// ─── Tình trạng nhiên liệu sau chuyến gần nhất ──────────────────────────────
function loadFuelStatus(bienSo, dungTichBinh){
  var el = document.getElementById('xe-fuel-status');
  if(!el) return;

  if(!SB_URL || !SB_KEY){
    el.innerHTML = '';
    return;
  }

  var bienEnc = encodeURIComponent(bienSo);

  // Fetch: km_cuoi, km_dau, do_dau gần nhất cho xe này
  Promise.all([
    sbFetch('bao_cao','bien_xe=eq.'+bienEnc+'&loai=eq.km_cuoi&so_km=not.is.null&select=so_km,hd_so,created_at&order=created_at.desc&limit=1'),
    sbFetch('bao_cao','bien_xe=eq.'+bienEnc+'&loai=eq.km_dau&so_km=not.is.null&select=so_km,hd_so,created_at&order=created_at.desc&limit=5'),
    sbFetch('bao_cao','bien_xe=eq.'+bienEnc+'&loai=eq.do_dau&select=so_lit,tong_tien,da_do_day_binh,hd_so,created_at&order=created_at.desc&limit=20'),
  ]).then(function(res){
    var cuoiRows = res[0] || [];
    var dauRows  = res[1] || [];
    var fillRows = res[2] || [];

    if(!cuoiRows.length){ el.innerHTML = ''; return; }

    var lastCuoi = cuoiRows[0];
    var hdSo     = lastCuoi.hd_so;
    var kmCuoi   = Number(lastCuoi.so_km);
    var cuoiDate = lastCuoi.created_at ? lastCuoi.created_at.slice(0,10) : '';

    // Tìm km_dau của cùng chuyến (cùng hd_so, hoặc gần nhất trước km_cuoi)
    var kmDauRec = hdSo
      ? dauRows.find(function(r){ return r.hd_so === hdSo; })
      : dauRows.find(function(r){ return r.created_at < lastCuoi.created_at; });
    var kmDau    = kmDauRec ? Number(kmDauRec.so_km) : null;
    var tongKm   = (kmDau != null) ? (kmCuoi - kmDau) : null;

    // Báo cáo đổ dầu của chuyến này
    var tripFills = hdSo
      ? fillRows.filter(function(r){ return r.hd_so === hdSo; })
      : [];
    var tongLit = 0, tongTienF = 0, coLit = false, coTien = false;
    tripFills.forEach(function(r){
      if(r.so_lit    != null){ tongLit   += Number(r.so_lit);   coLit  = true; }
      if(r.tong_tien != null){ tongTienF += Number(r.tong_tien); coTien = true; }
    });

    // Tiêu thụ ước tính = tổng KM / trung bình km/L (lấy từ toàn bộ lịch sử nếu thiếu)
    var consumed = coLit ? tongLit : null;

    // Tìm lần đổ đầy bình gần nhất (da_do_day_binh = true)
    var lastFullFill = fillRows.find(function(r){ return r.da_do_day_binh; });
    var endedFull    = lastFullFill && lastFullFill.hd_so === hdSo;

    // Tính km/L trung bình từ lịch sử (nếu có đủ dữ liệu)
    var avgKmPerLit = null;
    if(tongKm && consumed && consumed > 0) avgKmPerLit = tongKm / consumed;

    // Ước tính dầu còn lại
    var conLai = null, pct = null;
    if(endedFull && dungTichBinh){
      conLai = dungTichBinh; pct = 100; // vừa đổ đầy
    } else if(dungTichBinh && lastFullFill && avgKmPerLit){
      // Km đã chạy kể từ lần đổ đầy gần nhất
      var kmSinceFullFill = tongKm || 0;
      var usedSince = kmSinceFullFill / avgKmPerLit;
      conLai = Math.max(0, dungTichBinh - usedSince);
      pct    = Math.round(conLai / dungTichBinh * 100);
    } else if(dungTichBinh && consumed != null){
      // Fallback: dùng trực tiếp consumed
      conLai = Math.max(0, dungTichBinh - consumed);
      pct    = Math.round(conLai / dungTichBinh * 100);
    }

    // Màu thanh nhiên liệu
    var barColor = pct == null ? '#94a3b8'
      : pct >= 50 ? '#16a34a' : pct >= 25 ? '#f97316' : '#dc2626';

    function fmtN(n,d){ return n!=null?n.toLocaleString('vi-VN',{maximumFractionDigits:d||0}):'—'; }

    var hdLabel = hdSo ? (' · <span style="color:var(--blue);font-weight:700">'+hdSo+'</span>') : '';
    var dateLabel = cuoiDate ? fmtD(cuoiDate) : '';

    // Thanh % nhiên liệu
    var barHTML = '';
    if(pct != null){
      barHTML = '<div style="margin:10px 0 4px">'
        +'<div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--text3);margin-bottom:4px">'
        +'<span>Mức dầu ước tính</span>'
        +'<span style="font-weight:700;color:'+barColor+'">'+pct+'% · ~'+fmtN(conLai,0)+' lít</span>'
        +'</div>'
        +'<div style="background:var(--surface2);border-radius:20px;height:10px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:'+barColor+';border-radius:20px;transition:width .6s ease"></div>'
        +'</div>'
        +'</div>';
    }

    var endLabel = endedFull
      ? '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #86efac;border-radius:20px;padding:2px 8px;font-size:.68rem;font-weight:700">✅ Đã đổ đầy</span>'
      : '<span style="background:#fffbeb;color:#92400e;border:1px solid #fcd34d;border-radius:20px;padding:2px 8px;font-size:.68rem;font-weight:700">⚠️ Chưa đổ đầy</span>';

    var consumeRow = (tongKm || consumed)
      ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">'
        +[
          ['📏 KM chuyến', tongKm ? fmtN(tongKm)+' km' : '—'],
          ['🛢️ Đã đổ', coLit ? fmtN(tongLit,1)+' lít' : '—'],
          ['📊 Tiêu hao', avgKmPerLit ? fmtN(avgKmPerLit,1)+' km/L' : '—'],
        ].map(function(p){
          return '<div style="background:var(--surface2);border-radius:8px;padding:8px;text-align:center">'
            +'<div style="font-size:.6rem;color:var(--text3);margin-bottom:2px">'+p[0]+'</div>'
            +'<div style="font-size:.78rem;font-weight:700;font-family:\'DM Mono\',monospace">'+p[1]+'</div>'
            +'</div>';
        }).join('')
        +'</div>'
      : '';

    var html = '<div style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:4px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div style="font-weight:700;font-size:.82rem">⛽ Tình trạng nhiên liệu</div>'
      +'<div style="font-size:.7rem;color:var(--text3)">Sau chuyến '+dateLabel+hdLabel+'</div>'
      +'</div>'
      + endLabel
      + consumeRow
      + barHTML
      +(pct==null && dungTichBinh
        ? '<div style="font-size:.7rem;color:var(--text3);margin-top:8px">💡 Tick "Đổ đầy bình" ở báo cáo KM đầu/cuối để hiển thị mức dầu còn lại</div>'
        : '')
      +(pct==null && !dungTichBinh
        ? '<div style="font-size:.7rem;color:var(--text3);margin-top:8px">💡 Nhập dung tích bình dầu của xe để hiển thị % còn lại</div>'
        : '')
      +'</div>';

    el.innerHTML = html;
  }).catch(function(e){
    console.warn('loadFuelStatus:', e.message);
    el.innerHTML = '';
  });
}

// Tính tổng km từ cặp km_dau / km_cuoi trong bao_cao và cập nhật UI
function loadXeKmStats(baseKm, bienSo, hdDoneCount){
  var extraEl = document.getElementById('xe-km-extra');
  var baseEl  = document.getElementById('xe-km-base');
  if(!extraEl) return;

  if(!SB_URL){
    extraEl.textContent = '(Km đăng ký ban đầu)';
    return;
  }

  var bienEnc = encodeURIComponent(bienSo);

  // Lấy TẤT CẢ bản ghi km_dau và km_cuoi của xe này
  Promise.all([
    sbFetch('bao_cao','bien_xe=eq.'+bienEnc+'&loai=eq.km_dau&so_km=not.is.null&select=so_km,hd_so,created_at&order=created_at.asc'),
    sbFetch('bao_cao','bien_xe=eq.'+bienEnc+'&loai=eq.km_cuoi&so_km=not.is.null&select=so_km,hd_so,created_at&order=created_at.asc')
  ]).then(function(res){
    var dauRows  = res[0] || [];
    var cuoiRows = res[1] || [];

    // Ghép cặp theo hd_so (nếu có), hoặc theo thứ tự thời gian
    var totalKmHD = 0;
    var pairsCount = 0;

    if(dauRows.length && cuoiRows.length){
      // Nhóm theo hd_so
      var dauByHD = {}, cuoiByHD = {};
      dauRows.forEach(function(r){
        var key = r.hd_so || ('_t_'+r.created_at);
        if(!dauByHD[key]) dauByHD[key] = r;
      });
      cuoiRows.forEach(function(r){
        var key = r.hd_so || ('_t_'+r.created_at);
        if(!cuoiByHD[key]) cuoiByHD[key] = r;
      });
      // Tính km cho từng cặp có đủ dau + cuoi
      Object.keys(dauByHD).forEach(function(key){
        if(cuoiByHD[key]){
          var diff = Number(cuoiByHD[key].so_km) - Number(dauByHD[key].so_km);
          if(diff > 0){ totalKmHD += diff; pairsCount++; }
        }
      });
      // Fallback: nếu không ghép được theo hd_so, lấy max_cuoi - min_dau
      if(pairsCount === 0){
        var minDau  = Math.min.apply(null, dauRows.map(function(r){return Number(r.so_km);}));
        var maxCuoi = Math.max.apply(null, cuoiRows.map(function(r){return Number(r.so_km);}));
        if(maxCuoi > minDau){ totalKmHD = maxCuoi - minDau; pairsCount = 1; }
      }
    }

    if(!extraEl) return;  // modal đã đóng
    if(totalKmHD > 0){
      var total = baseKm + totalKmHD;
      baseEl.textContent = fmt(total) + ' km';
      extraEl.innerHTML =
        '<span style="color:var(--text3)">📌 Lúc đăng ký: '+fmt(baseKm)+' km</span><br>'
        +'<span style="color:var(--accent)">➕ Từ '+pairsCount+' HĐ (báo cáo): '+fmt(totalKmHD)+' km</span>';
    } else if(hdDoneCount > 0){
      // Có HĐ hoàn thành nhưng tài xế chưa báo cáo km
      extraEl.innerHTML = '<span style="color:var(--text3)">Km lúc đăng ký · '+hdDoneCount+' HĐ hoàn thành chưa có báo cáo km</span>';
    } else {
      extraEl.textContent = '(Km lúc đăng ký ban đầu)';
    }
  }).catch(function(){
    if(extraEl) extraEl.textContent = '(Km lúc đăng ký ban đầu)';
  });
}

// ── Lịch sử bảo dưỡng (bao_duong_lich_su) ──────────────────────────────────
var BD_LOAI_MAP={dang_kiem:'🔍 Đăng kiểm',bao_hiem:'🛡️ Bảo hiểm',thay_nhot:'🛢️ Thay nhớt',sua_chua:'🔧 Sửa chữa',khac:'📝 Khác'};

function loadBaoDuongHistory(bienSo){
  var el=document.getElementById('bd-history'); if(!el) return;
  if(!SB_URL){ el.innerHTML='<div style="font-size:.75rem;color:var(--text3)">Không có dữ liệu offline</div>'; return; }
  sbFetch('bao_duong_lich_su','bien_so_xe=eq.'+encodeURIComponent(bienSo)+'&order=ngay.desc&limit=20')
    .then(function(rows){
      var bdEl=document.getElementById('bd-history'); if(!bdEl) return;
      if(!rows||!rows.length){
        bdEl.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:8px 0">Chưa có lịch sử bảo dưỡng. Bấm "+ Ghi nhận" để thêm.</div>';
        return;
      }
      bdEl.innerHTML='<div class="table-wrap"><table class="dt" style="min-width:400px"><thead><tr><th>Ngày</th><th>Loại</th><th>Km</th><th>Ghi chú</th></tr></thead><tbody>'
        +rows.map(function(r){
          return'<tr><td><span class="mono">'+fmtD(r.ngay)+'</span></td>'
            +'<td>'+(BD_LOAI_MAP[r.loai]||r.loai)+'</td>'
            +'<td>'+(r.km?'<span class="mono">'+fmt(r.km)+' km</span>':'—')+'</td>'
            +'<td style="font-size:.75rem;color:var(--text2)">'+(r.ghi_chu||'—')+'</td>'
          +'</tr>';
        }).join('')
      +'</tbody></table></div>';
    })
    .catch(function(e){
      var bdEl=document.getElementById('bd-history'); if(!bdEl) return;
      // Bảng chưa tồn tại → hướng dẫn tạo
      if(e.message&&e.message.indexOf('42P01')>-1){
        bdEl.innerHTML='<div style="font-size:.74rem;color:var(--orange);padding:8px;background:var(--surface2);border-radius:6px">⚠️ Bảng <code>bao_duong_lich_su</code> chưa được tạo trên Supabase.<br>Vào mục Cài đặt → SQL Editor và chạy lệnh tạo bảng.</div>';
      } else {
        bdEl.innerHTML='<div style="font-size:.75rem;color:var(--text3)">'+e.message+'</div>';
      }
    });
}

function openBaoDuongModal(bienSo){
  if(!requireAdmin()) return;
  var today=new Date().toISOString().slice(0,10);
  var loaiOpts=Object.keys(BD_LOAI_MAP).map(function(v){return'<option value="'+v+'">'+BD_LOAI_MAP[v]+'</option>';}).join('');
  showModal('🔧 Ghi nhận bảo dưỡng',bienSo,
    '<div class="form-row"><div class="fg"><label class="fl">Loại <span class="req">*</span></label><select class="fc" id="bd-loai">'+loaiOpts+'</select></div>'
    +'<div class="fg"><label class="fl">Ngày <span class="req">*</span></label><input type="date" class="fc" id="bd-ngay" value="'+today+'"></div></div>'
    +'<div class="form-row"><div class="fg"><label class="fl">Số km đồng hồ xe</label><input type="text" inputmode="numeric" class="fc" id="bd-km" placeholder="VD: 45000" oninput="fmtInput(this)"></div>'
    +'<div class="fg"><label class="fl">Ghi chú</label><input class="fc" id="bd-note" placeholder="Nơi thực hiện, hạn mới..."></div></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button>'
    +'<button class="btn btn-accent" onclick="saveBaoDuong(\''+bienSo+'\')">💾 Lưu</button>'
  );
}

function saveBaoDuong(bienSo){
  if(!requireAdmin()) return;
  var loai=document.getElementById('bd-loai').value;
  var ngay=document.getElementById('bd-ngay').value;
  if(!loai||!ngay){ toast('Chọn loại và ngày!','error'); return; }
  var km=readMoney('bd-km')||null;
  var note=(document.getElementById('bd-note').value||'').trim()||null;
  var row={bien_so_xe:bienSo,loai:loai,ngay:ngay,km:km,ghi_chu:note};
  // Nếu thay nhớt → đồng thời cập nhật km_thay_nhot trong bảng xe
  var patchXe=(loai==='thay_nhot'&&km!=null)
    ? sbFetch('xe','bien_so=eq.'+encodeURIComponent(bienSo)+'&select=id&limit=1').then(function(rows){
        if(rows&&rows[0]&&rows[0].id) return sbPatch('xe',rows[0].id,{km_thay_nhot:km});
      })
    : Promise.resolve();
  Promise.all([
    sbPost('bao_duong_lich_su',row),
    patchXe
  ]).then(function(){
    // Cập nhật local DB nếu thay nhớt
    if(loai==='thay_nhot'&&km!=null){
      var xeObj=DB.xe.find(function(v){return v.bien===bienSo;});
      if(xeObj) xeObj.kmThayNhot=km;
    }
    closeModal();
    toast('✅ Đã ghi nhận bảo dưỡng','success');
  }).catch(function(e){
    if(e.message&&e.message.indexOf('42P01')>-1){
      toast('⚠️ Bảng bao_duong_lich_su chưa được tạo. Xem hướng dẫn trong mục Cài đặt.','error',6000);
    } else {
      toast('❌ '+e.message,'error');
    }
  });
}

function exportXeReport(id){
  var x=DB.xe.find(function(v){return v.id===id;}); if(!x)return;
  var hdList=DB.hopDong.filter(function(h){return h.xe===x.bien;});
  var tcList=DB.thuChi.filter(function(t){return t.xe===x.bien;});
  toast('⏳ Đang xuất...','info');
  setTimeout(function(){
    try{xlsxDownload([
      {name:'Thông tin xe',data:[['Biển số','Loại xe','Năm SX','Km chạy','Hạn ĐK','Hạn BH','Trạng thái'],[x.bien,x.loai,x.nam,x.km,fmtD(x.dangKiem),fmtD(x.baoHiem),x.tt]]},
      {name:'Lịch sử HĐ',data:[['Số HĐ','Khách hàng','Tuyến','Ngày','Giá trị','Đã thu','Trạng thái']].concat(hdList.map(function(h){return[h.so,h.kh,h.tuyen,fmtD(h.ngay),h.giatri,h.dathu,h.tt];}))},
      {name:'Thu Chi xe',data:[['Ngày','Loại','Danh mục','Mô tả','Số tiền']].concat(tcList.map(function(t){return[fmtD(t.ngay),t.type==='thu'?'Thu':'Chi',t.loai,t.mota||'',(t.type==='thu'?1:-1)*t.sotien];}))},
    ],'NamKhang_Xe_'+x.bien.replace(/[^a-z0-9]/gi,'_'));toast('✅ Xuất thành công!','success');}catch(e){toast('❌ '+e.message,'error');}
  },100);
}

// Mở detail tài xế từ tên (dùng khi click link từ openHDDetail)
function openTXDetailByName(tenEncoded){
  var ten=decodeURIComponent(tenEncoded);
  var tx=DB.taiXe.find(function(v){return v.ten===ten;});
  if(tx) openTXDetailById(tx.id);
  else openTXDetail(tenEncoded); // fallback dùng openTXDetail nếu chỉ có tên
}

function openTXDetailById(id){
  var tx=DB.taiXe.find(function(v){return v.id===id;}); if(!tx)return;
  var hdList=DB.hopDong.filter(function(h){return h.taixe===tx.ten;}).sort(function(a,b){return b.ngay.localeCompare(a.ngay);});
  var totalRev=hdList.reduce(function(s,h){return s+h.giatri;},0);
  var infoRows=[['👤 Họ tên',tx.ten],['📱 SĐT',tx.sdt||'—'],['🪪 CMND/CCCD',tx.cmnd||'—'],['🚗 Bằng lái',tx.bangLai||'—'],['💼 Tổng chuyến',hdList.length+' chuyến'],['💰 Tổng doanh thu','<span class="amt-pos">'+fmtM(totalRev)+'</span>']];
  // Các hàng HĐ có thể click để xem HĐ đó ngay
  var hdRowsHTML=hdList.length
    ?hdList.map(function(h){
        return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" '
          +'style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'">'
          +'<td><span class="mono" style="color:var(--blue)">'+h.so+'</span></td>'
          +'<td>'+h.kh+'</td>'
          +'<td style="color:var(--text2);font-size:.74rem">'+h.tuyen+'</td>'
          +'<td><span class="mono">'+fmtD(h.ngay)+'</span></td>'
          +'<td><span class="amt-pos">+'+fmtM(h.giatri)+'</span></td>'
          +'<td>'+(TTMAP[h.tt]||'')+'</td>'
        +'</tr>';
      }).join('')
    :'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Chưa có dữ liệu</td></tr>';
  var body='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'+infoRows.map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:.63rem;color:var(--text3);margin-bottom:3px">'+p[0]+'</div><div style="font-size:.8rem;font-weight:600">'+p[1]+'</div></div>';}).join('')+'</div>'+
    '<div style="font-weight:700;font-size:.82rem;margin-bottom:8px">📋 Lịch sử chuyến ('+hdList.length+' hợp đồng) <span style="font-size:.7rem;font-weight:400;color:var(--text3)">— click vào HĐ để xem chi tiết</span></div>'+
    '<div class="table-wrap"><table class="dt" style="min-width:500px"><thead><tr><th>Số HĐ</th><th>Khách hàng</th><th>Tuyến đường</th><th>Ngày</th><th>Doanh thu</th><th>Trạng thái</th></tr></thead><tbody>'+hdRowsHTML+'</tbody></table></div>'+
    baoCaoSectionHTML(tx.ten);
  showModal('Chi tiết Tài xế',tx.ten,body,'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button><button class="btn btn-green" onclick="closeModal();exportTXReport(\''+id+'\')">📥 Xuất báo cáo TX</button>');
  // Async load ảnh báo cáo theo SĐT tài xế
  if(tx.sdt) fetchBaoCao('tai_xe_sdt', tx.sdt).then(renderBaoCaoSection);
}

function exportTXReport(id){
  var tx=DB.taiXe.find(function(v){return v.id===id;}); if(!tx)return;
  var hdList=DB.hopDong.filter(function(h){return h.taixe===tx.ten;});
  toast('⏳ Đang xuất...','info');
  setTimeout(function(){
    try{xlsxDownload([
      {name:'Thông tin TX',data:[['Họ tên','SĐT','CMND/CCCD','Bằng lái','Lương CB (VNĐ)'],[tx.ten,tx.sdt||'',tx.cmnd||'',tx.bangLai||'',tx.luong]]},
      {name:'Lịch sử chuyến',data:[['Số HĐ','Khách hàng','Tuyến đường','Ngày','Giá trị HĐ','Đã thu','Trạng thái']].concat(hdList.sort(function(a,b){return b.ngay.localeCompare(a.ngay);}).map(function(h){return[h.so,h.kh,h.tuyen,fmtD(h.ngay),h.giatri,h.dathu,h.tt];}))},
    ],'NamKhang_TaiXe_'+tx.ten.replace(/\s+/g,'_'));toast('✅ Xuất thành công!','success');}catch(e){toast('❌ '+e.message,'error');}
  },100);
}

// ═══════════════════════════════════════
// BÁO CÁO TÀI XẾ — hiển thị trong modal
// ═══════════════════════════════════════
var BC_LOAI_LABEL={
  do_dau:'⛽ Đổ dầu', km_dau:'🔢 Km đầu', km_cuoi:'🏁 Km cuối',
  hoan_thanh:'✅ Hoàn thành', su_co:'⚠️ Sự cố', bao_cao_khac:'📄 Khác',
  hop_dong:'📋 Hợp đồng', hanh_khach:'👥 Hành khách',
};

// ─── Tóm tắt nhiên liệu cho chi tiết HĐ ────────────────────────────────────
function renderFuelSummary(rows, xe){
  var el = document.getElementById('fuel-summary');
  if(!el) return;

  // Lấy km_dau và km_cuoi từ báo cáo
  var kmDauRec  = rows.find(function(r){ return r.loai==='km_dau'  && r.so_km; });
  var kmCuoiRec = rows.find(function(r){ return r.loai==='km_cuoi' && r.so_km; });
  var kmDau  = kmDauRec  ? Number(kmDauRec.so_km)  : null;
  var kmCuoi = kmCuoiRec ? Number(kmCuoiRec.so_km) : null;

  // Kiểm tra phương pháp đổ đầy bình (để đánh giá độ chính xác)
  var daDayDau  = !!(kmDauRec  && kmDauRec.da_do_day_binh);
  var daDayCuoi = !!(kmCuoiRec && kmCuoiRec.da_do_day_binh);
  var doDauRows = rows.filter(function(r){ return r.loai==='do_dau'; });
  // Kiểm tra có lần đổ đầy bình nào trong chuyến (da_do_day_binh = true trên do_dau)
  if(!daDayCuoi){
    var lastFillRec = doDauRows.find(function(r){ return r.da_do_day_binh; });
    if(lastFillRec) daDayCuoi = true;
  }
  var isAccurate = daDayDau && daDayCuoi; // cả 2 đầu đều đổ đầy → chính xác

  // Brim-to-brim: chỉ tính các lần đổ dầu SAU km_dau (loại trừ lần đổ đầy trước chuyến)
  // Logic: lần đổ đầy bình trước chuyến (trước km_dau) chỉ là mốc khởi đầu, không phải tiêu hao
  var calcRows = doDauRows;
  if(isAccurate && kmDauRec && kmDauRec.created_at){
    var kmDauTime = new Date(kmDauRec.created_at).getTime();
    calcRows = doDauRows.filter(function(r){
      return r.created_at && new Date(r.created_at).getTime() > kmDauTime;
    });
  }

  // Tổng hợp từ các báo cáo đổ dầu (chỉ dùng calcRows)
  var tongLit = 0, tongTien = 0, coLit = false, coTien = false;
  calcRows.forEach(function(r){
    if(r.so_lit    != null){ tongLit  += Number(r.so_lit);   coLit  = true; }
    if(r.tong_tien != null){ tongTien += Number(r.tong_tien); coTien = true; }
  });

  // Ẩn section nếu chưa có dữ liệu nào liên quan
  if(!doDauRows.length && !kmDau && !kmCuoi){ el.style.display='none'; return; }

  var tongKm   = (kmDau != null && kmCuoi != null) ? (kmCuoi - kmDau) : null;
  var kmPerLit = (tongKm && coLit && tongLit > 0)  ? (tongKm / tongLit) : null;

  function fmtN(n,dec){ return n!=null ? n.toLocaleString('vi-VN',{maximumFractionDigits:dec||0}) : '—'; }

  // ── Chế độ tính toán ────────────────────────────────────────────────────
  // 3 chế độ: 'accurate' | 'estimated' | 'standard_rate'
  var calcMode;
  if(isAccurate && coLit){
    calcMode = 'accurate';      // brim-to-brim đầy đủ
  } else if(coLit){
    calcMode = 'estimated';     // có dữ liệu đổ nhưng không đủ brim-to-brim
  } else if(tongKm && tongKm > 0 && xe && xe.dinhMuc){
    calcMode = 'standard_rate'; // không có đổ dầu → tính theo định mức xe
  } else {
    calcMode = 'estimated';     // chỉ có km, không có gì để tính
  }

  // Chế độ định mức: tính lại tongLit và tongTien từ định mức xe
  var dinhMucNote = '';
  if(calcMode === 'standard_rate'){
    tongLit  = Math.round(tongKm * xe.dinhMuc / 100 * 10) / 10; // làm tròn 1 chữ số
    coLit    = true;
    if(xe.giaDauTK){
      tongTien = Math.round(tongLit * xe.giaDauTK);
      coTien   = true;
      dinhMucNote = 'Định mức '+xe.dinhMuc+' L/100km × '+fmtM(xe.giaDauTK)+'/lít';
    } else {
      dinhMucNote = 'Định mức '+xe.dinhMuc+' L/100km — chưa nhập giá dầu tham chiếu';
    }
  }

  // Mức tiêu hao: L/100km (thấp hơn = tốt hơn)
  var litPer100Km = (tongKm && tongKm > 0 && coLit && tongLit > 0)
    ? (calcMode === 'standard_rate' ? xe.dinhMuc : tongLit / tongKm * 100)
    : null;
  // Màu: xanh ≤20, cam 20–30, đỏ >30 (phù hợp xe 45 chỗ)
  var fuelColor = litPer100Km
    ? (litPer100Km <= 20 ? 'var(--green)' : litPer100Km <= 30 ? 'var(--orange)' : 'var(--red)')
    : 'var(--text)';

  // Badge độ chính xác
  var accuracyBadge = calcMode === 'accurate'
    ? '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #86efac;border-radius:20px;padding:2px 10px;font-size:.68rem;font-weight:700;margin-left:6px">✅ Chính xác</span>'
    : calcMode === 'standard_rate'
      ? '<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;border-radius:20px;padding:2px 10px;font-size:.68rem;font-weight:700;margin-left:6px">📊 Theo định mức</span>'
      : '<span style="background:#fffbeb;color:#92400e;border:1px solid #fcd34d;border-radius:20px;padding:2px 10px;font-size:.68rem;font-weight:700;margin-left:6px">⚠️ Ước tính</span>';

  // Số lần đổ dầu hiển thị (brim-to-brim chỉ tính trong chuyến)
  var displayRows = isAccurate ? calcRows : doDauRows;
  var soLanLabel = calcMode === 'standard_rate'
    ? '<span style="color:#6b7280;font-style:italic">—</span>'
    : displayRows.length + ' lần'
      + (isAccurate && calcRows.length < doDauRows.length
         ? ' <span style="font-size:.6rem;color:#6b7280">(trong chuyến)</span>' : '');

  // Bảng chi tiết từng lần đổ dầu (dùng cho toggle)
  var fillDetailHtml = '<div id="fuel-fill-detail" style="display:none;margin-top:10px;'
    +'border:1px solid var(--border);border-radius:8px;overflow:hidden">'
    +'<table style="width:100%;border-collapse:collapse;font-size:.72rem">'
    +'<thead><tr style="background:var(--surface2)">'
    +'<th style="padding:6px 8px;text-align:left;color:var(--text3);font-weight:600">Thời gian</th>'
    +'<th style="padding:6px 8px;text-align:right;color:var(--text3);font-weight:600">Số lít</th>'
    +'<th style="padding:6px 8px;text-align:right;color:var(--text3);font-weight:600">Số tiền</th>'
    +'<th style="padding:6px 8px;text-align:center;color:var(--text3);font-weight:600">Ghi chú</th>'
    +'</tr></thead><tbody>';

  // Hiển thị tất cả lần đổ (kể cả lần trước km_dau nếu có, đánh dấu mờ)
  doDauRows.forEach(function(r, i){
    var isPreTrip = isAccurate && kmDauRec && kmDauRec.created_at
      && r.created_at && new Date(r.created_at).getTime() <= new Date(kmDauRec.created_at).getTime();
    var dt = r.created_at ? new Date(r.created_at) : null;
    var dtStr = dt ? (dt.getDate().toString().padStart(2,'0')+'/'+(dt.getMonth()+1).toString().padStart(2,'0')
      +' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0')) : '—';
    var rowBg = isPreTrip ? '#f9fafb' : (i%2===0 ? '#fff' : '#fafafa');
    var rowClr = isPreTrip ? '#9ca3af' : 'var(--text)';
    var litVal = r.so_lit != null ? fmtN(Number(r.so_lit),1)+' L' : '—';
    var tienVal = r.tong_tien != null ? fmtM(Number(r.tong_tien)) : '—';
    var noteVal = '';
    if(r.da_do_day_binh) noteVal += '🔵 Đầy bình';
    if(isPreTrip) noteVal += (noteVal?' ':'')+'<span style="color:#9ca3af;font-style:italic">(trước chuyến)</span>';
    fillDetailHtml += '<tr style="background:'+rowBg+';color:'+rowClr+'">'
      +'<td style="padding:5px 8px">'+dtStr+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:\'DM Mono\',monospace">'+litVal+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:\'DM Mono\',monospace">'+tienVal+'</td>'
      +'<td style="padding:5px 8px;text-align:center">'+noteVal+'</td>'
      +'</tr>';
  });

  if(doDauRows.length === 0){
    fillDetailHtml += '<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--text3);font-style:italic">Chưa có báo cáo đổ dầu nào</td></tr>';
  }
  fillDetailHtml += '</tbody></table></div>';

  var cells = [
    { lbl:'Km đầu',        val: kmDau  ? fmtN(kmDau)+' km'  : '—', ico:'🔢' },
    { lbl:'Km cuối',       val: kmCuoi ? fmtN(kmCuoi)+' km' : '—', ico:'🏁' },
    { lbl:'Tổng KM chạy',  val: tongKm ? fmtN(tongKm)+' km' : '—', ico:'📏', bold:true },
    { lbl:'Số lần đổ dầu', val: soLanLabel, ico:'⛽', clickable: true },
    { lbl:'Tổng lít tiêu thụ', val: coLit ? fmtN(tongLit,1)+' lít' : '—', ico:'🛢️' },
    { lbl:'Mức tiêu hao',  val: litPer100Km ? fmtN(litPer100Km,1)+' L/100km' : '—',
      ico:'📊', bold:true, color: fuelColor },
    { lbl:'Chi phí nhiên liệu', val: coTien ? fmtM(tongTien) : '—',
      ico:'💰', span:3, bold:true },
  ];

  var html = '<div style="border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="display:flex;align-items:center;margin-bottom:10px">'
    +'<span style="font-weight:700;font-size:.82rem">⛽ Nhiên liệu chuyến đi</span>'
    + accuracyBadge
    +'</div>';

  if(calcMode === 'standard_rate'){
    html += '<div style="font-size:.7rem;color:#1d4ed8;background:#eff6ff;border:1px solid #93c5fd;'
      +'border-radius:8px;padding:8px 12px;margin-bottom:10px">'
      +'📊 <strong>Tính theo định mức:</strong> Không có dữ liệu đổ dầu trong chuyến. '
      + (dinhMucNote ? 'Áp dụng: '+dinhMucNote+'.' : '')
      +' Để có số liệu thực tế, tài xế báo cáo đổ dầu và tick <strong>"Đây là lần đổ đầy bình"</strong>.</div>';
  } else if(calcMode === 'estimated'){
    html += '<div style="font-size:.7rem;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;'
      +'border-radius:8px;padding:8px 12px;margin-bottom:10px">'
      +'💡 Để có kết quả chính xác: tài xế cần tick <strong>"Đổ đầy bình"</strong> ở báo cáo KM đầu <em>và</em> tick <strong>"Đây là lần đổ đầy bình"</strong> trong ít nhất một báo cáo đổ dầu cuối chuyến.</div>';
  }

  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
  cells.forEach(function(c){
    var spanStyle = c.span ? 'grid-column:span '+c.span+';' : '';
    var clr = c.color || 'var(--text)';
    var fw  = c.bold  ? '700' : '600';
    var clickStyle = c.clickable
      ? 'cursor:pointer;user-select:none;transition:background .15s;'
      : '';
    var clickAttr = c.clickable
      ? ' onclick="var d=document.getElementById(\'fuel-fill-detail\');if(d){d.style.display=d.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.fill-toggle\').textContent=d.style.display===\'none\'?\'▼\':\'▲\'}"'
      : '';
    var toggleIcon = c.clickable ? ' <span class="fill-toggle" style="font-size:.6rem;color:var(--text3)">▼</span>' : '';
    html += '<div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;'+spanStyle+clickStyle+'"'
      + clickAttr + '>'
      +'<div style="font-size:.62rem;color:var(--text3);margin-bottom:3px">'+c.ico+' '+c.lbl+'</div>'
      +'<div style="font-size:.85rem;font-weight:'+fw+';color:'+clr+';font-family:\'DM Mono\',monospace">'
      +c.val + toggleIcon
      +'</div>'
      +'</div>';
  });
  html += '</div>';
  html += fillDetailHtml;
  html += '</div>';

  el.innerHTML = html;
  el.style.display = 'block';
}

// Fetch danh sách báo cáo từ Supabase theo filter (hd_so | bien_xe | tai_xe_sdt)
// extraFilter: chuỗi query bổ sung, vd 'hd_so=is.null' để chỉ lấy BC chưa gán HĐ
async function fetchBaoCao(field, value, extraFilter){
  if(!SB_URL||!SB_KEY) return [];
  try{
    // Chỉ lấy BC đã duyệt: loại trừ 'cho_duyet', giữ lại NULL (dữ liệu cũ) và da_duyet
    var url=SB_URL+'/rest/v1/bao_cao?'+field+'=eq.'+encodeURIComponent(value)
      +'&or=(trang_thai.is.null,trang_thai.eq.da_duyet,trang_thai.eq.tu_choi)'
      +(extraFilter?'&'+extraFilter:'')
      +'&order=created_at.desc&limit=50'
      +'&select=id,loai,tai_xe_ten,tai_xe_sdt,bien_xe,hd_so,ghi_chu,anh_urls,gps_lat,gps_lng,so_km,so_lit,tong_tien,da_do_day_binh,created_at';
    var r=await fetch(url,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    if(!r.ok) throw new Error(r.status);
    return r.json();
  }catch(e){console.warn('fetchBaoCao:',e.message);return [];}
}

// Render HTML section ảnh báo cáo vào div#modal-baocao sau khi modal đã hiện
// hdTaiXe: tên tài xế của HĐ đang xem (để cảnh báo nếu BC gửi từ tài xế khác)
function renderBaoCaoSection(rows, hdTaiXe){
  var el=document.getElementById('modal-baocao');
  if(!el) return;
  if(!rows.length){
    el.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:.8rem">Chưa có ảnh báo cáo nào</div>';
    return;
  }
  var html='';
  rows.forEach(function(bc){
    var d=new Date(bc.created_at);
    var dStr=d.toLocaleDateString('vi-VN')+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    var gps=bc.gps_lat?('<a href="https://maps.google.com/?q='+bc.gps_lat+','+bc.gps_lng+'" target="_blank" style="font-size:.65rem;color:var(--accent)">📍 Xem bản đồ</a>'):'';
    // Cảnh báo: tên tài xế gửi BC ≠ tên tài xế trong HĐ
    var txMismatch = hdTaiXe && bc.tai_xe_ten
      && bc.tai_xe_ten.trim().toLowerCase() !== hdTaiXe.trim().toLowerCase();
    var mismatchBadge = txMismatch
      ? '<span title="Tài xế gửi BC ('+bc.tai_xe_ten+') khác tài xế HĐ ('+hdTaiXe+')" '
        +'style="display:inline-flex;align-items:center;gap:3px;font-size:.65rem;font-weight:700;'
        +'color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;padding:1px 6px;margin-left:6px;cursor:help">'
        +'⚠️ Tài xế khác</span>'
      : '';
    html+='<div style="margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:10px'
      +(txMismatch?';border:1px solid #fcd34d':'')+'">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div>'
      +'<span style="font-size:.75rem;font-weight:700;color:var(--text)">'+(BC_LOAI_LABEL[bc.loai]||bc.loai)+'</span>'
      +mismatchBadge
      +'<div style="font-size:.65rem;color:var(--text3);margin-top:1px">'+dStr+(bc.tai_xe_ten?' · '+bc.tai_xe_ten:'')+'</div>'
      +'</div>'+gps+'</div>';
    if(bc.ghi_chu){
      html+='<div style="font-size:.73rem;color:var(--text2);margin-bottom:8px;padding:8px;background:var(--bg);border-radius:7px">💬 '+bc.ghi_chu+'</div>';
    }
    if(bc.anh_urls&&bc.anh_urls.length){
      html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">';
      bc.anh_urls.forEach(function(url,ui){
        var safeUrl=url.replace(/'/g,"\\'");
        var safeId=bc.id;
        html+='<div data-bc-photo="'+safeUrl+'" style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--border)">'
          +'<a href="'+url+'" target="_blank" style="display:block;width:100%;height:100%">'
          +'<img src="'+url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy" '
          +'onerror="this.style.display=\'none\'">'
          +'</a>'
          // Nút xóa — chỉ hiển thị cho admin
          +(isAdmin()
            ? '<button onclick="event.preventDefault();deleteBaoCaoPhoto(\''+safeId+'\',\''+safeUrl+'\')" '
              +'style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;'
              +'background:rgba(220,38,38,.85);border:none;color:#fff;font-size:11px;cursor:pointer;'
              +'display:flex;align-items:center;justify-content:center;line-height:1;font-weight:700;'
              +'box-shadow:0 1px 4px rgba(0,0,0,.3)" title="Xóa ảnh này">✕</button>'
            : '')
          +'</div>';
      });
      html+='</div>';
    }
    html+='</div>';
  });
  el.innerHTML=html;
}

// Helper: fetch có check lỗi
async function sbFetchCheck(url, opts){
  var res = await fetch(url, opts);
  if(!res.ok){
    var body = ''; try{ body = await res.text(); }catch(e){}
    throw new Error('HTTP '+res.status+(body?' — '+body.slice(0,120):''));
  }
  return res;
}

// Xóa 1 ảnh khỏi bao_cao (admin only)
async function deleteBaoCaoPhoto(bcId, photoUrl){
  if(!requireAdmin()) return;
  askConfirm({icon:'🖼️',title:'Xóa ảnh này?',msg:'Ảnh sẽ bị xóa vĩnh viễn. Thao tác không thể hoàn tác.',btnLabel:'Xóa ảnh',btnClass:'btn-red'}, async function(){
    try{
      var H = {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};

      // 1. Lấy record hiện tại
      var r = await sbFetchCheck(SB_URL+'/rest/v1/bao_cao?id=eq.'+bcId+'&select=anh_urls', {headers:H});
      var rows = await r.json();
      if(!rows||!rows.length) throw new Error('Không tìm thấy record báo cáo (id: '+bcId+')');

      var oldUrls = rows[0].anh_urls || [];
      var newUrls = oldUrls.filter(function(u){ return u !== photoUrl; });

      // 2. Xóa file khỏi Supabase Storage (lỗi Storage không chặn bước 3)
      var pathMatch = photoUrl.match(/\/object\/public\/reports\/(.+)$/);
      if(pathMatch){
        try{
          await sbFetchCheck(SB_URL+'/storage/v1/object/reports/'+pathMatch[1],
            {method:'DELETE', headers:H});
        }catch(se){ console.warn('Storage DELETE:', se.message); }
      }

      // 3. Cập nhật hoặc xóa record trong DB
      if(newUrls.length === 0){
        await sbFetchCheck(SB_URL+'/rest/v1/bao_cao?id=eq.'+bcId,
          {method:'DELETE', headers:H});
      } else {
        await sbFetchCheck(SB_URL+'/rest/v1/bao_cao?id=eq.'+bcId, {
          method:'PATCH',
          headers:Object.assign({'Content-Type':'application/json','Prefer':'return=minimal'},H),
          body: JSON.stringify({anh_urls: newUrls})
        });
      }

      // 4. Xóa thumbnail khỏi DOM ngay
      document.querySelectorAll('#modal-baocao img').forEach(function(img){
        if(img.src===photoUrl||img.getAttribute('src')===photoUrl){
          var wrap = img.closest('[data-bc-photo]') || img.parentElement;
          if(wrap) wrap.remove();
        }
      });

      toast('🗑️ Đã xóa ảnh','info');
    }catch(e){
      console.error('deleteBaoCaoPhoto:', e);
      toast('❌ Xóa thất bại: '+e.message,'error');
    }
  });
}

// Hộp chứa section báo cáo — thêm vào cuối body của modal
function baoCaoSectionHTML(label){
  return '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px">'
    +'<div style="font-weight:700;font-size:.82rem;margin-bottom:10px">📸 Ảnh báo cáo từ tài xế'+(label?' — '+label:'')+'</div>'
    +'<div id="modal-baocao" style="min-height:40px">'
    +'<div style="text-align:center;padding:16px;color:var(--text3);font-size:.78rem">⏳ Đang tải...</div>'
    +'</div></div>';
}

// ═══════════════════════════════════════
// REALTIME NOTIFICATIONS (Supabase)
// ═══════════════════════════════════════
var _sbRTClient = null;
var _rtChannel  = null;
var _rtUnread   = 0;

/* Âm thanh thông báo — Web Audio API (không cần file ngoài) */
function playNotifChime(){
  try{
    var ctx = new (window.AudioContext||window.webkitAudioContext)();
    function note(freq,start,dur,gain){
      var o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type='sine'; o.frequency.value=freq;
      g.gain.setValueAtTime(0,ctx.currentTime+start);
      g.gain.linearRampToValueAtTime(gain,ctx.currentTime+start+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+start+dur);
      o.start(ctx.currentTime+start); o.stop(ctx.currentTime+start+dur+0.05);
    }
    note(880,0.00,0.18,0.18);
    note(1108,0.12,0.22,0.14);
    note(1320,0.26,0.28,0.12);
  }catch(e){}
}

/* Hiển thị card thông báo slide-in góc trên phải */
function showRTNotif(row){
  var stack=document.getElementById('rt-notif-stack');
  if(!stack) return;

  var loaiLabel={
    do_dau:'⛽ Báo cáo đổ dầu', km_dau:'🔢 Báo cáo Km đầu', km_cuoi:'🏁 Báo cáo Km cuối',
    hoan_thanh:'✅ Báo cáo hoàn thành', su_co:'⚠️ Báo cáo sự cố', bao_cao_khac:'📄 Báo cáo khác',
    hop_dong:'📋 Báo cáo hợp đồng', hanh_khach:'👥 Báo cáo hành khách'
  };

  var ten  = row.tai_xe_ten || row.tai_xe_sdt || 'Tài xế';
  var bien = row.bien_xe ? '· Xe '+row.bien_xe : '';
  var hdso = row.hd_so   ? '· HĐ '+row.hd_so  : '';
  var loai = loaiLabel[row.loai] || ('📋 '+row.loai);
  var ghiChu = row.ghi_chu ? (row.ghi_chu.length>80 ? row.ghi_chu.slice(0,80)+'…' : row.ghi_chu) : '';
  var now = new Date();
  var tStr = now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});

  var card = document.createElement('div');
  card.className = 'rt-notif';
  card.innerHTML =
    '<div class="rt-notif-head">'
      +'<div class="rt-notif-title">🔔 Báo cáo mới từ tài xế</div>'
      +'<button class="rt-notif-close" onclick="this.closest(\'.rt-notif\').classList.add(\'rt-hide\');setTimeout(function(){this.remove()}.bind(this.closest(\'.rt-notif\')),350)">✕</button>'
    +'</div>'
    +'<div class="rt-notif-body">'
      +'<strong>'+ten+'</strong>'
      +(bien?' <span style="color:var(--text3)">'+bien+'</span>':'')
      +(hdso?' <span style="color:var(--text3)">'+hdso+'</span>':'')
      +'<br>'+loai
      +(ghiChu?'<br><span style="color:var(--text2)">'+ghiChu+'</span>':'')
    +'</div>'
    +'<div class="rt-notif-meta">'+tStr+'</div>'
    +'<div class="rt-notif-progress"></div>';

  stack.appendChild(card);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ card.classList.add('rt-show'); });
  });

  /* Auto-dismiss sau 8 giây */
  var t = setTimeout(function(){
    card.classList.add('rt-hide');
    setTimeout(function(){ if(card.parentNode) card.remove(); }, 350);
  }, 8000);

  /* Click vào card → mở trang báo cáo hợp đồng nếu có hd_so */
  card.addEventListener('click', function(e){
    if(e.target.classList.contains('rt-notif-close')) return;
    clearTimeout(t);
    card.classList.add('rt-hide');
    setTimeout(function(){ if(card.parentNode) card.remove(); }, 350);
  });

  /* Cập nhật badge chuông */
  _rtUnread++;
  var dot = document.getElementById('notifDot');
  if(dot) dot.style.display='block';
}

/* Khởi tạo Supabase Realtime — gọi sau khi loadConfig() xong */
function initRealtime(){
  if(!SB_URL||!SB_KEY) return;
  if(typeof supabase==='undefined'||!supabase.createClient){
    console.warn('[Realtime] Supabase JS chưa load');
    return;
  }
  try{
    _sbRTClient = supabase.createClient(SB_URL, SB_KEY, {
      realtime:{ params:{ eventsPerSecond:10 } }
    });

    _rtChannel = _sbRTClient
      .channel('nkt_bao_cao_inserts')
      .on('postgres_changes',{
        event:'INSERT', schema:'public', table:'bao_cao'
      }, function(payload){
        if(!payload||!payload.new) return;
        playNotifChime();
        showRTNotif(payload.new);
      })
      .subscribe(function(status){
        if(status==='SUBSCRIBED'){
          console.log('[Realtime] ✅ Đã kết nối bao_cao INSERT');
        } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
          console.warn('[Realtime] ⚠️ Kết nối lỗi:',status);
        }
      });
  }catch(e){
    console.warn('[Realtime] Không khởi động được:',e.message);
  }
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async function(){
  if(!initAuth()) return;
  document.querySelectorAll('.nav-item[data-page]').forEach(function(n){
    n.addEventListener('click', function(){ navTo(n.dataset.page); });
  });
  document.getElementById('userCard').title='Nhấn để đăng xuất';
  document.getElementById('userCard').onclick=function(){
    askConfirm({icon:'👋',title:'Đăng xuất?',msg:'Bạn sẽ được chuyển về trang đăng nhập.',btnLabel:'Đăng xuất',btnClass:'btn-ghost'},function(){
      localStorage.removeItem('nk_session_v3');
      window.location.replace('/login.html');
    });
  };
  await loadConfig();
  initRealtime();   // Kết nối Supabase Realtime — nhận báo cáo tài xế real-time
  // Hiển thị skeleton khi đang tải Supabase
  showSkel('hd-body', 9);
  showSkel('tc-body', 8);
  showSkel('kh-body', 6);
  loadDB();
  setTimeout(renderNotifPanel, 1500);
});
