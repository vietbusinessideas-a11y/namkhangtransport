// ─── Config ────────────────────────────────────────────────────────────────
// SB_URL / SB_KEY được load từ /api/config (Vercel env vars).
// Không hardcode key trực tiếp trong source code.
let SB_URL = '', SB_KEY = '';
let CONFIG_LOADED = false;

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error('config ' + r.status);
    const cfg = await r.json();
    SB_URL = cfg.url;
    SB_KEY = cfg.key;
    CONFIG_LOADED = true;
  } catch (e) {
    console.warn('Không tải được config từ server:', e.message);
    CONFIG_LOADED = false;
  }
}

// ─── Tài khoản offline/mock (fallback khi Supabase không có network) ────────
// Không lưu mật khẩu plaintext — so sánh hash đơn giản
const MOCK_USERS = {
  'admin@namkhang.vn': { pwHash: 'b0f0c3d9e4a2f1', role: 'admin',    name: 'Quản trị viên' },
  'nv@namkhang.vn':    { pwHash: '3e2a1f8c7d6b05', role: 'nhanvien', name: 'Nhân viên'      },
};
// Hàm hash đơn giản cho offline mode (không dùng cho production auth)
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).slice(0, 14);
}

const SK = 'nk_session_v3';

function saveSession(user){try{localStorage.setItem(SK,JSON.stringify({user,exp:Date.now()+3600000}));}catch{}}
function loadSession(){try{const raw=localStorage.getItem(SK);if(!raw)return null;const s=JSON.parse(raw);if(Date.now()>s.exp){localStorage.removeItem(SK);return null;}return s.user;}catch{return null;}}

window.addEventListener('load', async () => {
  // Kiểm tra session cũ trước
  const saved = loadSession();
  if (saved) { window.location.href = '/index.html'; return; }

  // Load config từ server (ẩn credentials)
  await loadConfig();

  // Hiển thị form đăng nhập
  setTimeout(() => {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('auth').style.display = 'flex';
    // Hiện footer tài xế
    var df = document.getElementById('driver-footer');
    if(df) df.style.display = 'block';
  }, 800);
});

const TITLES={
  login:['Chào mừng trở lại','Đăng nhập để truy cập hệ thống'],
  register:['Tạo tài khoản','Đăng ký tài khoản nhân viên mới'],
  forgot:['Quên mật khẩu','Đặt lại mật khẩu qua email'],
};
function switchTab(t){
  ['login','register','forgot'].forEach(k=>{
    document.getElementById('f'+k.charAt(0).toUpperCase()+k.slice(1)).className='form'+(k===t?' show':'');
  });
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',['login','register','forgot'][i]===t));
  document.getElementById('authTitle').textContent=TITLES[t][0];
  document.getElementById('authSub').textContent=TITLES[t][1];
  clearAlert();
}

function showAlert(msg,type='err'){const el=document.getElementById('alertBox');el.className=`alert a-${type} show`;el.innerHTML=`<span>${type==='err'?'❌':type==='ok'?'✅':'💡'}</span><span>${msg}</span>`;}
function clearAlert(){document.getElementById('alertBox').className='alert';}
function setBtnLoading(id,on,def){const btn=document.getElementById(id);btn.disabled=on;btn.innerHTML=on?'<span class="spin">⟳</span><span>Đang xử lý...</span>':def;}
function fillDemoEmail(e) {
  document.getElementById('lemail').value = e;
  document.getElementById('lpass').value = '';
  document.getElementById('lpass').focus();
  switchTab('login');
  showAlert('Đã điền email. Vui lòng nhập mật khẩu.', 'info');
}

async function doLogin() {
  const email = document.getElementById('lemail').value.trim().toLowerCase();
  const pass  = document.getElementById('lpass').value;
  if (!email || !pass) { showAlert('Vui lòng nhập email và mật khẩu'); return; }
  clearAlert();
  setBtnLoading('loginBtn', true, '<span>🔑</span><span>Đăng nhập</span>');

  let loggedIn = false;

  // ── Thử đăng nhập qua Supabase ────────────────────────────────────────────
  if (CONFIG_LOADED && SB_URL && SB_KEY) {
    try {
      const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (r.ok) {
        const data = await r.json();
        const meta = data.user?.user_metadata || {};

        // ✅ Role lấy từ user_metadata trong Supabase — không suy diễn từ email
        // Để set role: Supabase Dashboard → Authentication → Users → Edit → user_metadata: {"role":"admin"}
        const role = meta.role || 'nhanvien';
        const name = meta.full_name || meta.name || email.split('@')[0];
        const initial = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        saveSession({ email, name, role, initial, token: data.access_token });
        loggedIn = true;
      } else {
        const err = await r.json().catch(() => ({}));
        // Sai mật khẩu (Supabase trả 400) → báo lỗi ngay, không fallback mock
        if (r.status === 400) {
          showAlert(err.error_description || 'Email hoặc mật khẩu không đúng');
          setBtnLoading('loginBtn', false, '<span>🔑</span><span>Đăng nhập</span>');
          return;
        }
      }
    } catch (e) {
      console.warn('Supabase auth lỗi — thử offline mode:', e.message);
    }
  }

  // ── Fallback: offline/mock (chỉ dùng khi mất mạng hoặc chưa cấu hình) ───
  if (!loggedIn) {
    const found = MOCK_USERS[email];
    const pwHash = simpleHash(pass);
    if (!found || found.pwHash !== pwHash) {
      showAlert('Email hoặc mật khẩu không đúng');
      setBtnLoading('loginBtn', false, '<span>🔑</span><span>Đăng nhập</span>');
      return;
    }
    const name = found.name;
    const initial = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    saveSession({ email, name, role: found.role, initial });
    loggedIn = true;
  }

  if (loggedIn) {
    toast('✅ Xin chào! Đang chuyển trang...', 'success');
    setTimeout(() => { window.location.href = '/index.html'; }, 800);
  }
  setBtnLoading('loginBtn', false, '<span>🔑</span><span>Đăng nhập</span>');
}

async function doRegister() {
  const name  = document.getElementById('rname').value.trim();
  const email = document.getElementById('remail').value.trim();
  const pass  = document.getElementById('rpass').value;
  const pass2 = document.getElementById('rpass2').value;
  if (!name || !email || !pass) { showAlert('Vui lòng điền đầy đủ thông tin'); return; }
  if (pass.length < 8) { showAlert('Mật khẩu tối thiểu 8 ký tự'); return; }
  if (pass !== pass2) { showAlert('Mật khẩu xác nhận không khớp'); return; }
  clearAlert();
  setBtnLoading('regBtn', true, '<span>✨</span><span>Tạo tài khoản</span>');

  if (!CONFIG_LOADED) {
    showAlert('Không thể kết nối server. Vui lòng thử lại sau.');
    setBtnLoading('regBtn', false, '<span>✨</span><span>Tạo tài khoản</span>');
    return;
  }
  try {
    // Mặc định tạo mới với role = 'nhanvien' — Admin có thể nâng quyền sau
    const r = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, data: { full_name: name, role: 'nhanvien' } }),
    });
    const d = await r.json();
    if (r.ok) {
      showAlert(`✅ Tạo tài khoản thành công! Kiểm tra email ${email} để xác nhận.`, 'ok');
      setTimeout(() => { switchTab('login'); }, 3000);
    } else {
      const msg = d.msg || d.error_description || 'Đăng ký thất bại';
      showAlert(msg.includes('already') ? 'Email này đã được đăng ký' : msg);
    }
  } catch (e) {
    showAlert('Lỗi kết nối. Vui lòng thử lại.');
  }
  setBtnLoading('regBtn', false, '<span>✨</span><span>Tạo tài khoản</span>');
}

async function doForgot() {
  const email = document.getElementById('femail').value.trim();
  if (!email) { showAlert('Vui lòng nhập email'); return; }
  clearAlert();
  setBtnLoading('forgotBtn', true, '<span>📧</span><span>Gửi link đặt lại</span>');
  if (CONFIG_LOADED && SB_URL && SB_KEY) {
    try {
      await fetch(`${SB_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (e) { /* Im lặng — luôn hiển thị thông báo thành công để tránh email enumeration */ }
  }
  document.getElementById('fForgot').innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:2.5rem;margin-bottom:12px">📬</div>
      <div style="color:#86efac;font-weight:700;font-size:.95rem;margin-bottom:8px">Đã gửi!</div>
      <div style="color:rgba(255,255,255,.6);font-size:.8rem;line-height:1.6">
        Kiểm tra hộp thư <strong style="color:#fff">${email}</strong><br>(kể cả thư mục spam)
      </div>
      <button onclick="switchTab('login')" style="margin-top:16px;padding:9px 20px;border-radius:8px;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit">
        Quay lại đăng nhập
      </button>
    </div>`;
}

function toast(msg,type='info'){const wrap=document.getElementById('tw');const t=document.createElement('div');t.className=`toast t-${type}`;t.textContent=msg;wrap.appendChild(t);requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},3200);}
