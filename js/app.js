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
  if(!isAdmin()){
    var canh=document.querySelector('.nav-item[data-page="caidat"]');
    if(canh&&canh.closest('.nav-section'))canh.closest('.nav-section').remove();
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
function mapTC(r){return{id:r.id,type:r.loai_gd||'thu',loai:r.danh_muc||'',ngay:r.ngay_gd||'',gio:r.gio_gd||'00:00',sotien:Number(r.so_tien)||0,hd:r.hd_so||'',httt:r.hinh_thuc||'Tiền mặt',xe:r.bien_so_xe||'',taixe:r.tai_xe||'',kh:r.doi_tac||'',mota:r.mo_ta||''};}
function mapXe(r){return{id:r.id,bien:r.bien_so||'',loai:r.loai_xe||'',nam:Number(r.nam_sx)||0,km:Number(r.km_chay)||0,dangKiem:r.han_dk||'',baoHiem:r.han_bh||'',tt:r.trang_thai||'san_sang'};}
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
    updateBadges();
    renderCurrentPage();
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
    hdSearch:   (document.getElementById('hd-search')       ||{}).value||''
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
  thuchi:{title:'Thu Chi',sub:'Ghi nhận doanh thu & chi phí',actions:function(){return'<button class="btn btn-green" onclick="openTCModal(\'thu\')">＋ Ghi thu</button><button class="btn btn-red" onclick="openTCModal(\'chi\')">＋ Ghi chi</button><button class="btn btn-ghost btn-sm" onclick="exportTC()">📥 Xuất Excel</button>';}},
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
  var fns={dashboard:renderDashboard,hopdong:renderHD,khachhang:renderKH,xe:renderXe,thuchi:renderTCAll,baocao:renderBC,caidat:loadCaiDat};
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
  document.getElementById('db-kpi').innerHTML=kpiData.map(function(c,i){
    return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+' T'+mm+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+c.color+')">'+c.val+'</div>'+c.detail+'</div>';
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
  var bd=months6.map(function(m){var t=getMonthTotals(m.ym);return{l:m.l,thu:t.thu,chi:t.chi,cur:m.cur};});
  var mx=Math.max.apply(null,bd.map(function(b){return Math.max(b.thu,b.chi);}));mx=mx||1;
  document.getElementById('db-bar').innerHTML=bd.map(function(b){var th=Math.max(3,Math.round(b.thu/mx*100));var ch=Math.max(b.chi?3:0,Math.round(b.chi/mx*100));var lp=Math.max(b.thu-b.chi>0?3:0,Math.round((b.thu-b.chi)/mx*100));return'<div class="bar-group"><div class="bars"><div class="bar" style="height:'+th+'%;background:'+(b.cur?'#15803d':'#86efac')+'"></div><div class="bar" style="height:'+ch+'%;background:'+(b.cur?'#ef4444':'#fca5a5')+'"></div><div class="bar" style="height:'+lp+'%;background:'+(b.cur?'#64748b':'#cbd5e1')+'"></div></div><div class="bar-lbl" style="'+(b.cur?'color:var(--green);font-weight:700':'')+'">'+b.l+(b.cur?' ●':'')+'</div></div>';}).join('');

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

  // Tình trạng xe
  var xeST={dang_chay:{lbl:'Đang chạy',cls:'xs-busy',ico:'🚌'},san_sang:{lbl:'Sẵn sàng',cls:'xs-ok',ico:'✅'},bao_duong:{lbl:'Bảo dưỡng',cls:'xs-warn',ico:'🔧'}};
  document.getElementById('db-xe').innerHTML=DB.xe.map(function(x){var st=xeST[x.tt]||{lbl:x.tt,cls:'xs-ok',ico:'❓'};var dk=Math.round((new Date(x.dangKiem)-new Date())/864e5);return'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'" onclick="openXeDetail(\''+x.id+'\')" title="Xem chi tiết '+x.bien+'"><div><div style="font-weight:600;font-size:.8rem">'+x.bien+'</div><div style="font-size:.68rem;color:var(--text3)">'+x.loai+'</div></div><div style="text-align:right"><span class="xe-status '+st.cls+'">'+st.ico+' '+st.lbl+'</span>'+(dk<60?'<div style="font-size:.65rem;color:var(--orange);margin-top:2px">⚠ ĐK: '+dk+' ngày</div>':'')+'</div></div>';}).join('');

  // Top tài xế
  var driverEl=document.getElementById('db-driver-rank');
  var subEl=document.getElementById('db-driver-sub');if(subEl)subEl.textContent='Theo tháng '+mm+'/'+yyyy;
  if(driverEl){
    var txRank=DB.taiXe.map(function(tx){var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&getMY(h.ngay)===ym;});return{id:tx.id,ten:tx.ten,chuyen:hds.length,rev:hds.reduce(function(s,h){return s+h.giatri;},0)};}).sort(function(a,b){return b.rev-a.rev;});
    if(!txRank.length||txRank[0].rev===0){driverEl.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:.82rem">Chưa có dữ liệu tháng '+mm+'/'+yyyy+'</div>';}
    else{var maxRev=txRank[0].rev||1;var rIco=['🥇','🥈','🥉'];
      driverEl.innerHTML=txRank.slice(0,5).map(function(tx,i){return'<div class="rank-item" style="cursor:pointer" title="Xem chi tiết '+tx.ten+'" onclick="openTXDetail(\''+encodeURIComponent(tx.ten)+'\',\''+ym+'\')"><div class="rank-num '+(i<3?'r'+(i+1):'rn')+'">'+(rIco[i]||i+1)+'</div><div class="rank-info"><div class="rank-name">'+tx.ten+'</div><div class="rank-meta">'+tx.chuyen+' chuyến</div></div><div style="flex:1;padding:0 16px"><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:'+Math.round(tx.rev/maxRev*100)+'%;background:var(--green)"></div></div><div class="mini-pct">'+Math.round(tx.rev/maxRev*100)+'%</div></div></div><div class="rank-amount">'+fmtM(tx.rev)+'</div></div>';}).join('');}
  }
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
    baoCaoSectionHTML(h.so),
    '<button class="btn btn-ghost" onclick="closeModal()">Đóng</button><button class="btn btn-accent" onclick="closeModal();openHDModal(\'' + h.id + '\')">✏️ Sửa</button>');
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
  sbDel('hop_dong',id).then(function(){DB.hopDong=DB.hopDong.filter(function(x){return x.id!==id;});updateBadges();renderHD();toast('🗑️ Đã xóa','info');}).catch(function(e){toast('❌ '+e.message,'error');});
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
    '<div class="fg"><label class="fl">Trạng thái</label><select class="fc" id="xf-tt">'+ttOpts+'</select></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn btn-accent" onclick="saveXe(\''+(id||'')+'\')">💾 Lưu</button>');
}
function saveXe(id){
  if(!requireAdmin())return;
  var bien=document.getElementById('xf-bien').value.trim(),loai=document.getElementById('xf-loai').value.trim();
  if(!bien||!loai){toast('Nhập biển số và loại xe!','error');return;}
  var obj={id:id||uid(),bien:bien,loai:loai,nam:parseInt(document.getElementById('xf-nam').value)||2020,km:readMoney('xf-km'),dangKiem:document.getElementById('xf-dk').value,baoHiem:document.getElementById('xf-bh').value,tt:document.getElementById('xf-tt').value};
  var row={bien_so:bien,loai_xe:loai,nam_sx:obj.nam,km_chay:obj.km,han_dk:obj.dangKiem||null,han_bh:obj.baoHiem||null,trang_thai:obj.tt};
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
  document.getElementById('tc-kpi').innerHTML=kpis.map(function(c,i){var up=parseFloat(c.chg)>=0;var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':c.cls==='c-blue'?'accent':'orange';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="tag '+(up?'tag-up':'tag-down')+'">'+(up?'▲':'▼')+' '+Math.abs(c.chg)+'%</span><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');}
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
function openTCDetail(id){var t=DB.thuChi.find(function(x){return x.id===id;});if(!t)return;var isThu=t.type==='thu';showModal('Chi tiết giao dịch',fmtD(t.ngay)+' · '+t.gio,'<div class="detail-amount '+(isThu?'thu-amt':'chi-amt')+'">'+(isThu?'+ ':' − ')+fmt(t.sotien)+' ₫</div><div class="detail-grid">'+[['Loại',badgeHTML(t.loai,t.type)],['Hình thức',t.httt],['Ngày giờ',fmtD(t.ngay)+' · '+t.gio],['Hợp đồng',t.hd||'—'],['Xe',t.xe||'—'],['Tài xế',t.taixe||'—'],['Đối tác',t.kh||'—'],['Mô tả',t.mota||'—']].map(function(p){return'<div class="detail-item"'+(p[0]==='Đối tác'||p[0]==='Mô tả'?' style="grid-column:1/-1"':'')+'>\'<label>'+p[0]+'</label><div class="dv">'+p[1]+'</div></div>';}).join('')+'</div>','<button class="btn btn-ghost" onclick="closeModal()">Đóng</button>');}
function openTCModal(type){
  var isThu=type==='thu';
  var loaiOpts=isThu?'<option>Thu hợp đồng</option><option>Đặt cọc</option><option>Thu khác</option>':'<option>Nhiên liệu</option><option>Lương tài xế</option><option>Sửa chữa</option><option>Cầu đường</option><option>Bảo dưỡng</option><option>Khác</option>';
  var hdOpts='<option value="">—</option>'+DB.hopDong.map(function(h){return'<option value="'+h.id+'">'+h.so+' · '+h.kh+'</option>';}).join('');
  var xeOpts='<option value="">—</option>'+DB.xe.map(function(x){return'<option>'+x.bien+'</option>';}).join('');
  var txOpts='<option value="">—</option>'+DB.taiXe.map(function(t){return'<option>'+t.ten+'</option>';}).join('');
  var today=new Date().toISOString().slice(0,10);var timeNow=new Date().toTimeString().slice(0,5);
  showModal(isThu?'💰 Ghi nhận Thu':'💸 Ghi nhận Chi','',
    '<div class="fg"><label class="fl">Loại <span class="req">*</span></label><select class="fc" id="f-loai">'+loaiOpts+'</select></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Ngày <span class="req">*</span></label><input type="date" class="fc" id="f-ngay" value="'+today+'"></div><div class="fg"><label class="fl">Giờ</label><input type="time" class="fc" id="f-gio" value="'+timeNow+'"></div></div>'+
    '<div class="fg"><label class="fl">Số tiền (VNĐ) <span class="req">*</span></label><input type="text" inputmode="numeric" class="fc" id="f-sotien" placeholder="0" oninput="fmtInput(this)"></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Liên kết HĐ</label><select class="fc" id="f-hd">'+hdOpts+'</select></div><div class="fg"><label class="fl">Hình thức TT</label><select class="fc" id="f-httt"><option>Chuyển khoản</option><option>Tiền mặt</option></select></div></div>'+
    '<div class="form-row"><div class="fg"><label class="fl">Xe</label><select class="fc" id="f-xe">'+xeOpts+'</select></div><div class="fg"><label class="fl">Tài xế</label><select class="fc" id="f-taixe">'+txOpts+'</select></div></div>'+
    '<div class="fg"><label class="fl">Đối tác</label><input class="fc" id="f-kh" placeholder="Tên KH / nhà cung cấp"></div>'+
    '<div class="fg"><label class="fl">Mô tả</label><textarea class="fc" id="f-mota" rows="2" style="resize:vertical"></textarea></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Hủy</button><button class="btn" style="background:'+(isThu?'var(--green)':'var(--red)')+';color:#fff" onclick="saveTC(\''+type+'\')">💾 Lưu</button>');
}
function saveTC(type){
  var raw=document.getElementById('f-sotien').value.replace(/[.,\s]/g,'');
  var sotien=parseInt(raw);
  if(!sotien||sotien<=0){toast('Nhập số tiền hợp lệ!','error');return;}
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

// ═══════════════════════════════════════
// BÁO CÁO
// ═══════════════════════════════════════
var bcTab='tongquan';
var bcPeriod='thang';
function switchBCTab(t,el){bcTab=t;document.querySelectorAll('#page-baocao .tab').forEach(function(b){b.classList.remove('active');});el.classList.add('active');['tongquan','hopdong','xe','taixe'].forEach(function(p){var panel=document.getElementById('bc-panel-'+p);if(panel)panel.style.display=t===p?'':'none';});if(t==='hopdong')renderBCHopDong();if(t==='xe')renderBCXe();if(t==='taixe')renderBCTaiXe();}
function renderBCHopDong(){
  var q=(document.getElementById('bc-hd-search').value||'').toLowerCase();
  var tt=document.getElementById('bc-hd-tt').value;
  var sort=document.getElementById('bc-hd-sort').value;
  var rows=DB.hopDong.map(function(h){
    var chiTrucTiep=DB.thuChi.filter(function(t){return t.type==='chi'&&t.hd_id===h.id;}).reduce(function(s,t){return s+t.sotien;},0);
    var chiGianTiep=DB.thuChi.filter(function(t){return t.type==='chi'&&!t.hd_id&&((h.xe&&t.xe&&t.xe===h.xe)||(h.taixe&&t.taixe&&t.taixe===h.taixe));}).reduce(function(s,t){return s+t.sotien;},0);
    var tongChi=chiTrucTiep+chiGianTiep;var doanhThu=h.giatri;var ln=doanhThu-tongChi;var ts=doanhThu>0?Math.round(ln/doanhThu*100):0;
    return Object.assign({},h,{chiTrucTiep:chiTrucTiep,chiGianTiep:chiGianTiep,chiHD:tongChi,doanhThu:doanhThu,ln:ln,ts:ts});
  }).filter(function(h){return(!q||[h.so,h.kh,h.tuyen].join(' ').toLowerCase().includes(q))&&(!tt||h.tt===tt);}).sort(function(a,b){if(sort==='ln_desc')return b.ln-a.ln;if(sort==='ln_asc')return a.ln-b.ln;if(sort==='gt_desc')return b.giatri-a.giatri;return b.ngay.localeCompare(a.ngay);});
  var tongThu=rows.reduce(function(s,h){return s+h.doanhThu;},0);
  var tongChi=rows.reduce(function(s,h){return s+h.chiHD;},0);
  var tongLN=tongThu-tongChi;
  var tongGT=rows.reduce(function(s,h){return s+h.giatri;},0);
  var tongConLai=tongGT-tongThu;
  document.getElementById('bc-hd-kpi').innerHTML=[{cls:'c-green',ic:'ic-green',ico:'💰',lbl:'Tổng đã thu',val:fmtM(tongThu),sub:rows.length+' hợp đồng'},{cls:'c-red',ic:'ic-red',ico:'💸',lbl:'Tổng chi phí HĐ',val:fmtM(tongChi),sub:'Chi có liên kết HĐ'},{cls:'c-blue',ic:'ic-blue',ico:'📈',lbl:'Lợi nhuận HĐ',val:fmtM(tongLN),sub:tongThu>0?((tongLN/tongThu*100).toFixed(1)+'% tỷ suất'):''},{cls:'c-orange',ic:'ic-orange',ico:'⏳',lbl:'Công nợ còn lại',val:fmtM(tongConLai),sub:'Chưa thu'}].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':c.cls==='c-blue'?'accent':'orange';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon '+c.ic+'">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
  document.getElementById('bc-hd-count').textContent=rows.length+' hợp đồng';
  document.getElementById('bc-hd-summary').innerHTML='<span style="color:var(--green)">↑ '+fmtM(tongThu)+'</span><span style="color:var(--border)">|</span><span style="color:var(--red)">↓ '+fmtM(tongChi)+'</span><span style="color:var(--border)">|</span><span style="color:var(--accent);font-weight:700">= '+fmtM(tongLN)+'</span>';
  document.getElementById('bc-hd-body').innerHTML=rows.length?rows.map(function(h){var tsColor=h.ts>=30?'var(--green)':h.ts>=15?'var(--accent)':h.ts>=0?'var(--orange)':'var(--red)';var barW=Math.min(100,Math.max(0,h.ts));return'<tr onclick="openHDDetail(\''+h.id+'\')" style="cursor:pointer"><td><span class="mono" style="font-weight:600">'+h.so+'</span></td><td style="font-weight:500">'+h.kh+'</td><td style="color:var(--text2);font-size:.74rem">'+h.tuyen+'</td><td><span class="mono">'+fmtD(h.ngay)+'</span></td><td><span class="amt-pos">+'+fmt(h.doanhThu)+'</span>'+(h.dathu<h.giatri?'<div style="font-size:.67rem;color:var(--orange)">Đã thu: '+fmtM(h.dathu)+'</div>':'<div style="font-size:.67rem;color:var(--green)">Đã thu đủ</div>')+'</td><td>'+(h.chiHD>0?'<span class="amt-neg">-'+fmt(h.chiHD)+'</span><div style="font-size:.67rem;color:var(--text3)">TT: '+fmtM(h.chiTrucTiep)+' · GT: '+fmtM(h.chiGianTiep)+'</div>':'<span style="color:var(--text3)">—</span>')+'</td><td><span style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+(h.ln>=0?'+':'')+fmt(h.ln)+'</span></td><td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+tsColor+';border-radius:3px"></div></div><span style="font-size:.72rem;font-family:\'DM Mono\',monospace;color:'+tsColor+'">'+h.ts+'%</span></div></td><td>'+(TTMAP[h.tt]||'')+'</td></tr>';}).join(''):'<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text3)">Không có hợp đồng nào</td></tr>';
}
function renderBCXe(){
  var q=(document.getElementById('bc-xe-search').value||'').toLowerCase();
  var sort=(document.getElementById('bc-xe-sort')||{}).value||'ln_desc';
  // Build per-vehicle stats from hopDong + thuChi
  var xeMap={};
  DB.hopDong.forEach(function(h){
    if(!h.xe)return;
    if(!xeMap[h.xe])xeMap[h.xe]={bien:h.xe,loai:'',chuyen:0,doanhThu:0,chiPhi:0,hds:[]};
    var v=xeMap[h.xe];
    v.chuyen++;
    // Doanh thu = giatri HĐ hoàn thành (nhất quán với quy tắc ghi nhận doanh thu)
    if(h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan') v.doanhThu+=h.giatri||0;
    v.hds.push(h.so);
    var chi=DB.thuChi.filter(function(t){return t.type==='chi'&&(t.hd_id===h.id||t.hd===h.so)&&t.xe===h.xe;}).reduce(function(s,t){return s+t.sotien;},0);
    v.chiPhi+=chi;
  });
  // Also capture direct chi by xe (not linked to HD)
  DB.thuChi.filter(function(t){return t.type==='chi'&&t.xe&&t.xe!=='Tất cả'&&!t.hd;}).forEach(function(t){
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
  }).filter(function(v){return!q||[v.bien,v.loai].join(' ').toLowerCase().includes(q);})
    .sort(function(a,b){if(sort==='ln_asc')return a.ln-b.ln;if(sort==='dt_desc')return b.doanhThu-a.doanhThu;if(sort==='chuyen_desc')return b.chuyen-a.chuyen;return b.ln-a.ln;});
  var tDT=rows.reduce(function(s,r){return s+r.doanhThu;},0);
  var tChi=rows.reduce(function(s,r){return s+r.chiPhi;},0);
  var tLN=tDT-tChi;
  document.getElementById('bc-xe-kpi').innerHTML=[{cls:'c-blue',ico:'🚌',lbl:'Số xe hoạt động',val:rows.filter(function(r){return r.chuyen>0;}).length+' xe',sub:rows.length+' tổng số'},{cls:'c-green',ico:'💰',lbl:'Tổng doanh thu',val:fmtM(tDT),sub:'Từ hợp đồng'},{cls:'c-red',ico:'💸',lbl:'Tổng chi phí',val:fmtM(tChi),sub:'Trực tiếp + gián tiếp'},{cls:'c-blue',ico:'📈',lbl:'Tổng lợi nhuận',val:fmtM(tLN),sub:tDT>0?((tLN/tDT*100).toFixed(1)+'% tỷ suất'):''}].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-red'?'red':'accent';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon ic-blue">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
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
  // Build per-driver stats
  var txMap={};
  DB.hopDong.forEach(function(h){
    if(!h.taixe)return;
    if(!txMap[h.taixe])txMap[h.taixe]={ten:h.taixe,chuyen:0,doanhThu:0,chiPhi:0,tuyen:{}};
    var v=txMap[h.taixe];
    v.chuyen++;
    // Doanh thu = giatri HĐ hoàn thành (nhất quán với quy tắc ghi nhận doanh thu)
    if(h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan') v.doanhThu+=h.giatri||0;
    if(h.tuyen)v.tuyen[h.tuyen]=(v.tuyen[h.tuyen]||0)+1;
    var chi=DB.thuChi.filter(function(t){return t.type==='chi'&&(t.hd_id===h.id||t.hd===h.so)&&t.taixe===h.taixe;}).reduce(function(s,t){return s+t.sotien;},0);
    v.chiPhi+=chi;
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
  }).filter(function(v){return!q||v.ten.toLowerCase().includes(q);})
    .sort(function(a,b){if(sort==='ln_asc')return a.ln-b.ln;if(sort==='dt_desc')return b.doanhThu-a.doanhThu;if(sort==='chuyen_desc')return b.chuyen-a.chuyen;return b.ln-a.ln;});
  var tDT=rows.reduce(function(s,r){return s+r.doanhThu;},0);
  var tChi=rows.reduce(function(s,r){return s+r.chiPhi;},0);
  var tLN=tDT-tChi;
  var tChuyen=rows.reduce(function(s,r){return s+r.chuyen;},0);
  document.getElementById('bc-tx-kpi').innerHTML=[{cls:'c-blue',ico:'👤',lbl:'Số tài xế',val:rows.filter(function(r){return r.chuyen>0;}).length+' người',sub:rows.length+' tổng số'},{cls:'c-green',ico:'💰',lbl:'Tổng doanh thu',val:fmtM(tDT),sub:'Từ hợp đồng đã thu'},{cls:'c-orange',ico:'🚗',lbl:'Tổng số chuyến',val:tChuyen+' chuyến',sub:'Bình quân '+( rows.length?Math.round(tChuyen/rows.length):0)+'/người'},{cls:'c-blue',ico:'📈',lbl:'Tổng lợi nhuận',val:fmtM(tLN),sub:tDT>0?((tLN/tDT*100).toFixed(1)+'% tỷ suất'):''}].map(function(c,i){var color=c.cls==='c-green'?'green':c.cls==='c-orange'?'orange':'accent';return'<div class="kpi-card '+c.cls+'" style="animation-delay:'+((i+1)*0.05)+'s"><div class="kpi-header"><div class="kpi-label">'+c.lbl+'</div><div class="kpi-icon ic-blue">'+c.ico+'</div></div><div class="kpi-value" style="color:var(--'+color+')">'+c.val+'</div><div class="kpi-footer"><span class="kpi-sub">'+c.sub+'</span></div></div>';}).join('');
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

// Doanh thu: tính HĐ HOÀN THÀNH trong tháng (ymStr = "2026-04"), bao gồm cho_thanh_toan cũ
function _sumDoanhThuThang(ymStr){
  return DB.hopDong.filter(function(h){
    return (h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan') && (h.ngay||h.ngay_di||'').slice(0,7)===ymStr;
  }).reduce(function(s,h){return s+h.giatri;},0);
}
// Chi phí: từ thu_chi.type='chi'
function _sumChiThang(ymStr){
  return DB.thuChi.filter(function(tc){
    return tc.type==='chi'&&(tc.ngay||'').slice(0,7)===ymStr;
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
function setBCPeriod(p,el){bcPeriod=p;document.querySelectorAll('#page-baocao .ptab').forEach(function(t){t.classList.remove('active');});el.classList.add('active');renderBC();}
function renderBC(){
  var d=buildBC()[bcPeriod];
  document.getElementById('bc-period-lbl').textContent=d.lbl;
  document.getElementById('bc-chart-sub').textContent=d.sub;
  document.getElementById('bc-xe-sub').textContent=d.lbl;
  // ── KPI: tính TRỰC TIẾP từ DB theo ymList của kỳ được chọn ──────────────────
  // doanh thu = giatri của HĐ hoàn thành (hoan_thanh hoặc cho_thanh_toan cũ)
  function _isCompleted(h){return h.tt==='hoan_thanh'||h.tt==='cho_thanh_toan';}
  function _inPeriod(dateStr,ymList){return ymList.indexOf((dateStr||'').slice(0,7))>=0;}
  var thu=DB.hopDong.filter(function(h){return _isCompleted(h)&&_inPeriod(h.ngay||h.ngay_di||'',d.ymList);}).reduce(function(s,h){return s+h.giatri;},0);
  var chi=DB.thuChi.filter(function(tc){return tc.type==='chi'&&_inPeriod(tc.ngay||'',d.ymList);}).reduce(function(s,tc){return s+tc.sotien;},0);
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
  // ── Xe table: giatri của HĐ hoàn thành trong kỳ, lọc theo ymList ────────────
  var veh=DB.xe.map(function(x){
    var hdsXe=DB.hopDong.filter(function(h){return h.xe===x.bien&&_isCompleted(h)&&_inPeriod(h.ngay||h.ngay_di||'',d.ymList);});
    var t=hdsXe.reduce(function(s,h){return s+h.giatri;},0);
    var c=DB.thuChi.filter(function(tc){return tc.type==='chi'&&tc.xe===x.bien&&_inPeriod(tc.ngay||'',d.ymList);}).reduce(function(s,tc){return s+tc.sotien;},0);
    return{b:x.bien,l:x.loai||'',t:t,c:c,n:hdsXe.length};
  }).filter(function(v){return v.t>0||v.c>0||v.n>0;}).sort(function(a,b){return b.t-a.t;});
  document.getElementById('bc-xe-table').innerHTML=veh.length?veh.map(function(v){var ln2=v.t-v.c,ts=v.t>0?Math.round(ln2/v.t*100):0;var bc=ts>=30?'var(--green)':ts>=20?'var(--accent)':'var(--orange)';return'<tr style="cursor:pointer" title="Xem chi tiết HĐ của '+v.b+'" onclick="openXeDetailBC(\''+encodeURIComponent(v.b)+'\')"><td><div style="font-weight:600;font-size:.78rem">'+v.b+'</div><div style="font-size:.67rem;color:var(--text3)">'+v.l+'</div></td><td><span class="amt-pos">'+fmtM(v.t)+'</span><div style="font-size:.65rem;color:var(--text3)">'+v.n+' HĐ</div></td><td>'+(v.c>0?'<span class="amt-neg">-'+fmtM(v.c)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td><td style="font-weight:700;font-family:\'DM Mono\',monospace;color:'+(ln2>=0?'var(--accent)':'var(--red)')+'">'+fmtM(ln2)+'</td><td><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:'+ts+'%;background:'+bc+'"></div></div><span class="mini-pct">'+ts+'%</span></div></td></tr>';}).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;font-size:.8rem">Chưa có HĐ hoàn thành trong kỳ này</td></tr>';
  // ── Driver rank: giatri của HĐ hoàn thành trong kỳ, lọc theo ymList ─────────
  var drivers=DB.taiXe.map(function(tx){
    var hds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&_isCompleted(h)&&_inPeriod(h.ngay||h.ngay_di||'',d.ymList);});
    var t=hds.reduce(function(s,h){return s+h.giatri;},0);
    var allHds=DB.hopDong.filter(function(h){return h.taixe===tx.ten&&_inPeriod(h.ngay||h.ngay_di||'',d.ymList);});
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
// CÀI ĐẶT
// ═══════════════════════════════════════
var DEFAULT_CD={ten:'Công ty TNHH Nam Khang Transport',mst:'0123456789',sdt:'0908 123 456',email:'contact@namkhang.vn',diachi:'123 Nguyễn Văn Linh, Q.7, TP.HCM'};
function fillCaiDat(cd){document.getElementById('cd-ten').value=cd.ten||'';document.getElementById('cd-mst').value=cd.mst||'';document.getElementById('cd-sdt').value=cd.sdt||'';document.getElementById('cd-email').value=cd.email||'';document.getElementById('cd-diachi').value=cd.dia_chi||cd.diachi||'';}
function loadCaiDat(){
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

  var infoRows=[
    ['🚌 Biển số',x.bien],
    ['🏭 Loại xe',x.loai],
    ['📅 Năm SX',x.nam],
    ['🛣️ Km đã chạy', kmBaseHTML],
    ['🔍 Đăng kiểm',fmtD(x.dangKiem)+(dk<60?'<div style="color:var(--orange);font-size:.65rem">⚠ Còn '+dk+' ngày</div>':'')],
    ['🛡️ Bảo hiểm',fmtD(x.baoHiem)+(bh<60?'<div style="color:var(--orange);font-size:.65rem">⚠ Còn '+bh+' ngày</div>':'')]
  ];
  var body='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'+infoRows.map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:.63rem;color:var(--text3);margin-bottom:3px">'+p[0]+'</div><div style="font-size:.8rem;font-weight:600">'+p[1]+'</div></div>';}).join('')+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">'+[['💰 Tổng doanh thu','<span class="amt-pos">+'+fmtM(totalRev)+'</span>'],['💸 Tổng chi phí','<span class="amt-neg">-'+fmtM(totalChi)+'</span>'],['📋 Số HĐ',hdList.length+' hợp đồng']].map(function(p){return'<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:.68rem;color:var(--text3);margin-bottom:4px">'+p[0]+'</div><div style="font-size:.9rem;font-weight:700;font-family:\'DM Mono\',monospace">'+p[1]+'</div></div>';}).join('')+'</div>'+
    '<div style="font-weight:700;font-size:.82rem;margin-bottom:8px">📋 Lịch sử hợp đồng</div>'+
    '<div class="table-wrap"><table class="dt" style="min-width:480px"><thead><tr><th>Số HĐ</th><th>Khách hàng</th><th>Tuyến</th><th>Ngày</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>'+(hdList.length?hdList.map(function(h){return'<tr onclick="closeModal();setTimeout(function(){openHDDetail(\''+h.id+'\')},120)" style="cursor:pointer" title="Xem chi tiết HĐ '+h.so+'"><td><span class="mono" style="color:var(--blue)">'+h.so+'</span></td><td>'+h.kh+'</td><td style="color:var(--text2);font-size:.74rem">'+h.tuyen+'</td><td><span class="mono">'+fmtD(h.ngay)+'</span></td><td><span class="amt-pos">+'+fmtM(h.giatri)+'</span></td><td>'+(TTMAP[h.tt]||'')+'</td></tr>';}).join(''):'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Chưa có hợp đồng</td></tr>')+'</tbody></table></div>'+
    baoCaoSectionHTML(x.bien);
  showModal('Chi tiết Xe','Biển số: '+x.bien,body,'<button class="btn btn-ghost" onclick="closeModal()">Đóng</button><button class="btn btn-green" onclick="closeModal();exportXeReport(\''+id+'\')">📥 Xuất báo cáo xe</button>');

  // ── Async: tính tổng km từ bao_cao (km_cuoi - km_dau theo từng HĐ) ──────
  loadXeKmStats(x.km, x.bien, hdDone.length);

  // Async load ảnh báo cáo theo biển số
  fetchBaoCao('bien_xe', x.bien).then(renderBaoCaoSection);
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

// Fetch danh sách báo cáo từ Supabase theo filter (hd_so | bien_xe | tai_xe_sdt)
// extraFilter: chuỗi query bổ sung, vd 'hd_so=is.null' để chỉ lấy BC chưa gán HĐ
async function fetchBaoCao(field, value, extraFilter){
  if(!SB_URL||!SB_KEY) return [];
  try{
    var url=SB_URL+'/rest/v1/bao_cao?'+field+'=eq.'+encodeURIComponent(value)
      +(extraFilter?'&'+extraFilter:'')
      +'&order=created_at.desc&limit=50'
      +'&select=id,loai,tai_xe_ten,tai_xe_sdt,bien_xe,hd_so,ghi_chu,anh_urls,gps_lat,gps_lng,created_at';
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
