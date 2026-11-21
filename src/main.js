
import './style.css';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const KEY = 'tajb_data_v1';
const SESSION = 'tajb_user';

const rupiah = n => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
}).format(Number(n) || 0);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const uid = () => Date.now() + Math.floor(Math.random() * 10000);

const emptyData = () => ({
  transactions: [],
  goals: [],
  notes: [],
  debts: [],
  stocks: [],
  settings: {
    city: 'Jakarta',
    country: 'Indonesia',
    prayerEnabled: false,
    theme: 'dark'
  }
});

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...emptyData(), ...saved,
      settings: { ...emptyData().settings, ...(saved.settings || {}) }
    };
  } catch {
    return emptyData();
  }
}

let data = loadData();
let username = localStorage.getItem(SESSION) || '';
let currentPage = 'dashboard';
let calculatorValue = '0';
let calculatorPrevious = null;
let calculatorOperator = null;
let calculatorFresh = false;

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[c]);
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function totals() {
  const income = data.transactions.filter(t => t.type === 'income')
    .reduce((s,t) => s + Number(t.amount), 0);
  const expense = data.transactions.filter(t => t.type === 'expense')
    .reduce((s,t) => s + Number(t.amount), 0);

  return {
    income,
    expense,
    balance: income - expense,
    profit: income - expense,
    count: data.transactions.length
  };
}

function logo() {
  return `<img src="/tj.svg" alt="TJ" class="logo-img">`;
}

function loginScreen() {
  document.documentElement.dataset.theme = data.settings.theme;

  document.querySelector('#app').innerHTML = `
    <main class="login-screen">
      <section class="login-card">
        <div class="brand">
          <div class="brand-icon">${logo()}</div>
          <div>
            <strong>TABUNGAN ANAK JB</strong>
            <div class="muted small">PERSONAL FINANCE SYSTEM</div>
          </div>
        </div>

        <div class="login-heading">
          <div class="eyebrow">WELCOME BACK</div>
          <h1>Mulai kelola uangmu.</h1>
          <p class="muted">Masuk menggunakan username untuk membuka dashboard tabunganmu.</p>
        </div>

        <form id="loginForm">
          <div class="field">
            <label>USERNAME</label>
            <input id="username" maxlength="24"
              placeholder="Masukkan username..." required autocomplete="username">
          </div>
          <button class="primary-btn full">Masuk ke aplikasi →</button>
        </form>
        <p class="muted small login-note">Data disimpan secara lokal pada perangkat ini.</p>
      </section>
    </main>
  `;

  document.querySelector('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    username = document.querySelector('#username').value.trim();
    if (!username) return;
    localStorage.setItem(SESSION, username);
    render();
    toast(`Halo, ${username}!`);
  });
}

const navItems = [
  ['dashboard','⌂','Dashboard'],
  ['transactions','↕','Transaksi'],
  ['calculator','＋','Kalkulator'],
  ['savings','◎','Tabungan'],
  ['notes','▤','Catatan'],
  ['debts','⇄','Kasbon'],
  ['stocks','▦','Stok'],
  ['reports','▥','Laporan'],
  ['calendar','▦','Kalender'],
  ['settings','⚙','Pengaturan'],
  ['info','ⓘ','Info Aplikasi']
];

function navButton(item) {
  const [id, icon, label] = item;
  return `<button class="nav-btn ${currentPage === id ? 'active' : ''}" data-page="${id}">
    <span class="nav-icon">${icon}</span><span>${label}</span>
  </button>`;
}

function pageTitle() {
  return navItems.find(x => x[0] === currentPage)?.[2] || 'Dashboard';
}

function shell(content) {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand sidebar-brand">
          <div class="brand-icon">${logo()}</div>
          <div>
            <strong>TABUNGAN ANAK JB</strong>
            <div class="muted small">FINANCE MANAGER</div>
          </div>
        </div>

        <div class="nav-label">MENU UTAMA</div>
        ${navItems.slice(0,5).map(navButton).join('')}

        <div class="nav-label">MANAJEMEN</div>
        ${navItems.slice(5).map(navButton).join('')}

        <div class="sidebar-bottom">
          <button class="nav-btn" id="logoutBtn">↪ Keluar</button>
        </div>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div>
            <div class="eyebrow">TABUNGAN ANAK JB</div>
            <h2>${pageTitle()}</h2>
            <p>${new Date().toLocaleDateString('id-ID', {
              weekday:'long',day:'numeric',month:'long',year:'numeric'
            })}</p>
          </div>
          <div class="user-chip">
            <div class="avatar">${escapeHTML(username.charAt(0).toUpperCase())}</div>
            <span>${escapeHTML(username)}</span>
          </div>
        </header>
        ${content}
      </main>
    </div>

    <nav class="mobile-nav">
      ${[
        ['dashboard','⌂','Home'],
        ['transactions','↕','Transaksi'],
        ['calculator','＋','Hitung'],
        ['savings','◎','Tabungan'],
        ['settings','⚙','Setting']
      ].map(([id,icon,label]) => `
        <button data-page="${id}" class="${currentPage === id ? 'active' : ''}">
          <span>${icon}</span>${label}
        </button>
      `).join('')}
    </nav>
  `;
}

function statCard(icon,label,value,isCount=false) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${isCount ? Number(value).toLocaleString('id-ID') : rupiah(value)}</div>
    </div>
  `;
}

function feature(id,icon,title,description) {
  return `<button class="feature-card" data-page="${id}">
    <div class="feature-icon">${icon}</div>
    <strong>${title}</strong>
    <span>${description}</span>
  </button>`;
}

function transactionTable(items) {
  if (!items.length) return `<div class="empty-state">Belum ada transaksi.</div>`;

  return `<div class="table-wrap"><table>
    <thead><tr><th>Keterangan</th><th>Kategori</th><th>Tanggal</th><th>Nominal</th><th>Aksi</th></tr></thead>
    <tbody>${items.map(t => `
      <tr>
        <td>${escapeHTML(t.description)}</td>
        <td>${escapeHTML(t.category)}</td>
        <td>${escapeHTML(t.date)}</td>
        <td class="${t.type === 'income' ? 'income':'expense'}">
          ${t.type === 'income' ? '+':'-'}${rupiah(t.amount)}
        </td>
        <td><button class="danger-btn small-btn" data-delete-transaction="${t.id}">Hapus</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function dashboardPage() {
  const t = totals();
  const recent = [...data.transactions].sort((a,b) => b.createdAt-a.createdAt).slice(0,5);

  return `
    <section class="hero-card">
      <div class="eyebrow">PERSONAL FINANCE OVERVIEW</div>
      <h1>Halo, ${escapeHTML(username)}!</h1>
      <div class="balance-label">Total saldo kamu saat ini</div>
      <div class="balance-value">${rupiah(t.balance)}</div>
      <div class="hero-actions">
        <button class="primary-btn" data-page="transactions">+ Tambah transaksi</button>
        <button class="secondary-btn" data-page="reports">Lihat laporan</button>
      </div>
    </section>

    <section class="stats-grid">
      ${statCard('↗','Total pemasukan',t.income)}
      ${statCard('↘','Total pengeluaran',t.expense)}
      ${statCard('◆','Keuntungan bersih',t.profit)}
      ${statCard('#','Jumlah transaksi',t.count,true)}
    </section>

    <div class="section-title">
      <h3>Workspace</h3><span class="badge">11 FITUR</span>
    </div>

    <section class="feature-grid">
      ${feature('transactions','↕','Transaksi','Pemasukan & pengeluaran')}
      ${feature('calculator','＋','Kalkulator','Hitung nominal dan MC')}
      ${feature('savings','◎','Target tabungan','Pantau tujuanmu')}
      ${feature('notes','▤','Catatan','Simpan catatan penting')}
      ${feature('debts','⇄','Kasbon','Catat utang dan piutang')}
      ${feature('stocks','▦','Manajemen stok','Pantau barang')}
      ${feature('reports','▥','Laporan','Ringkasan keuangan')}
      ${feature('calendar','▦','Kalender','Jadwal transaksi')}
      ${feature('settings','⚙','Pengaturan','Profil & notifikasi')}
      ${feature('info','ⓘ','Info aplikasi','Seluruh informasi aplikasi')}
      ${feature('backup','⇧','Backup data','Simpan cadangan data')}
    </section>

    <div class="section-title">
      <h3>Transaksi terbaru</h3>
      <button class="ghost-btn" data-page="transactions">Lihat semua</button>
    </div>
    <section class="panel">${transactionTable(recent)}</section>
  `;
}

function transactionsPage() {
  const items = [...data.transactions].sort((a,b) => b.createdAt-a.createdAt);
  return `
    <section class="panel">
      <h3>Tambah transaksi</h3>
      <form id="transactionForm">
        <div class="panel-grid">
          <div class="field"><label>JENIS TRANSAKSI</label>
            <select name="type"><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select>
          </div>
          <div class="field"><label>NOMINAL (RP)</label>
            <input name="amount" type="number" min="1" placeholder="50000" required>
          </div>
          <div class="field"><label>KETERANGAN</label>
            <input name="description" maxlength="80" placeholder="Penjualan barang" required>
          </div>
          <div class="field"><label>KATEGORI</label>
            <select name="category">
              <option>Penjualan</option><option>Top Up</option><option>Tabungan</option>
              <option>Modal</option><option>Makanan</option><option>Transportasi</option><option>Lainnya</option>
            </select>
          </div>
          <div class="field"><label>TANGGAL</label><input name="date" type="date" value="${today()}" required></div>
        </div>
        <button class="primary-btn">Simpan transaksi</button>
      </form>
    </section>
    <section class="panel">
      <div class="section-title"><h3>Riwayat transaksi</h3><span class="badge">${items.length} DATA</span></div>
      <input id="transactionSearch" class="search-input" placeholder="Cari transaksi...">
      <div id="transactionList">${transactionTable(items)}</div>
    </section>
  `;
}

function calculatorPage() {
  return `
    <section class="panel">
      <h3>Kalkulator umum</h3>
      <div class="calc-display" id="calcDisplay">${calculatorValue}</div>
      <div class="calc-grid">
        ${['AC','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(key => `
          <button data-calc="${key}" class="${['÷','×','−','+','%'].includes(key)?'operator':''} ${key==='='?'equal':''}">${key}</button>
        `).join('')}
      </div>
    </section>

    <section class="panel">
      <h3>Kalkulator MC / keuntungan</h3>
      <form id="mcForm">
        <div class="panel-grid">
          <div class="field"><label>JUMLAH ITEM</label><input name="quantity" type="number" min="0" required></div>
          <div class="field"><label>HARGA JUAL PER ITEM</label><input name="price" type="number" min="0" required></div>
          <div class="field"><label>MODAL TOTAL</label><input name="capital" type="number" min="0" value="0" required></div>
        </div>
        <button class="primary-btn">Hitung keuntungan</button>
      </form>
      <div id="mcResult"></div>
    </section>
  `;
}

function savingsPage() {
  return `
    <section class="panel">
      <h3>Buat target tabungan</h3>
      <form id="goalForm">
        <div class="panel-grid">
          <div class="field"><label>NAMA TARGET</label><input name="name" required placeholder="Contoh: Beli HP"></div>
          <div class="field"><label>TARGET NOMINAL</label><input name="target" type="number" min="1" required></div>
        </div>
        <button class="primary-btn">Buat target</button>
      </form>
    </section>
    <div class="section-title"><h3>Target kamu</h3></div>
    ${data.goals.length ? data.goals.map(g => {
      const percent = Math.min(100,Math.round(g.saved/g.target*100));
      return `<section class="panel">
        <div class="section-title"><strong>${escapeHTML(g.name)}</strong><span class="badge">${percent}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <p class="muted small">${rupiah(g.saved)} dari ${rupiah(g.target)}</p>
        <form data-save-goal="${g.id}" class="toolbar">
          <input name="amount" type="number" min="1" class="search-input" placeholder="Tambah tabungan" required>
          <button class="primary-btn">Tambah</button>
        </form>
        <button class="danger-btn" data-delete-goal="${g.id}">Hapus target</button>
      </section>`;
    }).join('') : `<section class="panel empty-state">Belum ada target.</section>`}
  `;
}

function notesPage() {
  return `
    <section class="panel">
      <h3>Catatan baru</h3>
      <form id="noteForm">
        <div class="field"><label>JUDUL</label><input name="title" required></div>
        <div class="field"><label>ISI CATATAN</label><textarea name="body" required></textarea></div>
        <button class="primary-btn">Simpan catatan</button>
      </form>
    </section>
    ${data.notes.map(n => `<section class="panel">
      <div class="section-title"><strong>${escapeHTML(n.title)}</strong><span class="muted small">${escapeHTML(n.date)}</span></div>
      <p>${escapeHTML(n.body)}</p>
      <button class="danger-btn" data-delete-note="${n.id}">Hapus</button>
    </section>`).join('') || `<section class="panel empty-state">Belum ada catatan.</section>`}
  `;
}

function debtsPage() {
  return `
    <section class="panel">
      <h3>Tambah kasbon</h3>
      <form id="debtForm">
        <div class="panel-grid">
          <div class="field"><label>NAMA ORANG</label><input name="person" required></div>
          <div class="field"><label>JENIS</label>
            <select name="type"><option value="receivable">Piutang</option><option value="payable">Utang</option></select>
          </div>
          <div class="field"><label>NOMINAL</label><input name="amount" type="number" min="1" required></div>
          <div class="field"><label>JATUH TEMPO</label><input name="due" type="date"></div>
        </div>
        <button class="primary-btn">Simpan kasbon</button>
      </form>
    </section>
    ${data.debts.map(d => `<section class="panel">
      <div class="section-title"><strong>${escapeHTML(d.person)}</strong><span class="badge">${d.type==='receivable'?'PIUTANG':'UTANG'}</span></div>
      <div class="stat-value">${rupiah(d.amount)}</div>
      <p class="muted small">Jatuh tempo: ${escapeHTML(d.due || '-')}</p>
      <button class="secondary-btn" data-paid-debt="${d.id}">Tandai lunas</button>
      <button class="danger-btn" data-delete-debt="${d.id}">Hapus</button>
    </section>`).join('') || `<section class="panel empty-state">Belum ada kasbon.</section>`}
  `;
}

function stocksPage() {
  return `
    <section class="panel">
      <h3>Tambah barang</h3>
      <form id="stockForm">
        <div class="panel-grid">
          <div class="field"><label>NAMA BARANG</label><input name="name" required></div>
          <div class="field"><label>JUMLAH STOK</label><input name="quantity" type="number" min="0" required></div>
          <div class="field"><label>MODAL PER UNIT</label><input name="price" type="number" min="0" required></div>
        </div>
        <button class="primary-btn">Tambah stok</button>
      </form>
    </section>
    <section class="panel">
      <h3>Daftar stok</h3>
      ${data.stocks.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Barang</th><th>Jumlah</th><th>Modal/unit</th><th>Aksi</th></tr></thead>
        <tbody>${data.stocks.map(s => `<tr>
          <td>${escapeHTML(s.name)}</td><td>${s.quantity}</td><td>${rupiah(s.price)}</td>
          <td><button class="danger-btn small-btn" data-delete-stock="${s.id}">Hapus</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div class="empty-state">Belum ada stok barang.</div>`}
    </section>
  `;
}

function reportsPage() {
  const t = totals();
  const month = today().slice(0,7);
  const monthly = data.transactions.filter(x => x.date.startsWith(month));
  const mi = monthly.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount),0);
  const me = monthly.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount),0);

  return `
    <section class="stats-grid">
      ${statCard('↗','Pemasukan bulan ini',mi)}
      ${statCard('↘','Pengeluaran bulan ini',me)}
      ${statCard('◆','Saldo keseluruhan',t.balance)}
      ${statCard('#','Jumlah transaksi',t.count,true)}
    </section>
    <section class="panel">
      <h3>Ringkasan keuangan</h3>
      <div class="setting-row"><strong>Total pemasukan</strong><strong class="income">${rupiah(t.income)}</strong></div>
      <div class="setting-row"><strong>Total pengeluaran</strong><strong class="expense">${rupiah(t.expense)}</strong></div>
      <div class="setting-row"><strong>Saldo bersih</strong><strong>${rupiah(t.balance)}</strong></div>
      <div class="form-actions">
        <button class="primary-btn" id="exportCsv">Ekspor CSV</button>
        <button class="secondary-btn" id="backupBtn">Backup JSON</button>
      </div>
    </section>
  `;
}

function calendarPage() {
  const month = today().slice(0,7);
  const items = data.transactions.filter(t=>t.date.startsWith(month));
  return `<section class="panel">
    <h3>Kalender transaksi</h3>
    <div class="field"><label>PILIH BULAN</label><input id="calendarMonth" type="month" value="${month}"></div>
    <div id="calendarItems">${calendarList(items)}</div>
  </section>`;
}

function calendarList(items) {
  if (!items.length) return `<div class="empty-state">Tidak ada transaksi pada bulan ini.</div>`;
  return [...items].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>`
    <div class="setting-row">
      <div><strong>${escapeHTML(t.date)}</strong><p>${escapeHTML(t.description)}</p></div>
      <strong class="${t.type==='income'?'income':'expense'}">${rupiah(t.amount)}</strong>
    </div>`).join('');
}

function settingsPage() {
  return `
    <section class="panel">
      <h3>Tampilan aplikasi</h3>
      <div class="setting-row">
        <div><strong>Tema tampilan</strong><p>Pilih tema aplikasi</p></div>
        <select id="themeSelect">
          <option value="dark" ${data.settings.theme==='dark'?'selected':''}>Dark</option>
          <option value="light" ${data.settings.theme==='light'?'selected':''}>Light</option>
          <option value="green" ${data.settings.theme==='green'?'selected':''}>Green</option>
        </select>
      </div>
    </section>

    <section class="panel">
      <h3>Profil pengguna</h3>
      <div class="setting-row"><div><strong>Username</strong><p>${escapeHTML(username)}</p></div><span class="badge">AKTIF</span></div>
      <div class="setting-row"><div><strong>Penyimpanan</strong><p>Data lokal perangkat</p></div><span class="badge">LOCAL</span></div>
      <div class="setting-row"><div><strong>Versi aplikasi</strong><p>1.1.0</p></div></div>
    </section>

    <section class="panel">
      <h3>Pengingat waktu sholat</h3>
      <p class="muted small">Aktifkan notifikasi Android untuk pengingat di luar aplikasi.</p>
      <form id="prayerForm">
        <div class="panel-grid">
          <div class="field"><label>KOTA</label><input name="city" value="${escapeHTML(data.settings.city)}" required></div>
          <div class="field"><label>NEGARA</label><input name="country" value="${escapeHTML(data.settings.country)}" required></div>
        </div>
        <button class="primary-btn">Aktifkan pengingat sholat</button>
        <button class="secondary-btn" type="button" id="disablePrayer">Matikan pengingat</button>
      </form>
      <p class="muted small">Jadwal diambil dari AlAdhan. Periksa pengaturan baterai Android jika notifikasi terlambat.</p>
    </section>

    <section class="panel">
      <h3>Data aplikasi</h3>
      <div class="form-actions">
        <button class="secondary-btn" id="backupBtn">Backup data</button>
        <button class="secondary-btn" id="restoreBtn">Restore data</button>
        <input type="file" id="restoreFile" accept="application/json" hidden>
      </div>
    </section>

    <section class="panel">
      <h3>Pembuat / Developer</h3>
      <div class="setting-row">
        <div><strong>ZORA STORE</strong><p>Developer TABUNGAN ANAK JB</p></div>
        <span class="badge">DEV</span>
      </div>
    </section>

    <section class="panel">
      <button class="danger-btn full" id="logoutBtn">Keluar dari akun</button>
    </section>
  `;
}

function infoPage() {
  const features = [
    ['Dashboard','Ringkasan saldo, pemasukan, pengeluaran, dan transaksi terbaru.'],
    ['Transaksi','Pencatatan pemasukan dan pengeluaran.'],
    ['Kalkulator','Kalkulator umum dan perhitungan MC.'],
    ['Target tabungan','Membuat target dan memantau progres.'],
    ['Catatan','Menyimpan catatan pribadi.'],
    ['Kasbon','Mencatat utang dan piutang.'],
    ['Manajemen stok','Mencatat barang, jumlah, dan modal per unit.'],
    ['Laporan','Ringkasan keuangan dan ekspor CSV.'],
    ['Kalender','Melihat transaksi berdasarkan bulan.'],
    ['Backup & Restore','Mencadangkan dan memulihkan data JSON.'],
    ['Pengingat sholat','Pengingat waktu salat melalui notifikasi Android.'],
    ['Tema','Pilihan Dark, Light, dan Green.']
  ];

  return `
    <section class="panel info-hero">
      <div class="info-logo">${logo()}</div>
      <div>
        <div class="eyebrow">APPLICATION INFORMATION</div>
        <h1>TABUNGAN ANAK JB</h1>
        <p class="muted">Personal Finance Manager</p>
        <span class="badge">VERSION 1.1.0</span>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card"><div class="stat-label">Versi</div><div class="stat-value">1.1.0</div></div>
      <div class="stat-card"><div class="stat-label">Platform</div><div class="stat-value">Android / Web</div></div>
      <div class="stat-card"><div class="stat-label">Penyimpanan</div><div class="stat-value">Lokal</div></div>
      <div class="stat-card"><div class="stat-label">Developer</div><div class="stat-value">ZORA STORE</div></div>
    </section>

    <section class="panel">
      <h3>Seluruh fitur aplikasi</h3>
      ${features.map(([name,detail],i)=>`
        <div class="setting-row info-feature">
          <div class="info-number">${String(i+1).padStart(2,'0')}</div>
          <div><strong>${name}</strong><p class="muted small">${detail}</p></div>
        </div>`).join('')}
    </section>

    <section class="panel">
      <h3>Informasi teknis</h3>
      <div class="setting-row"><strong>Application ID</strong><span>com.zorastore.tabungananakjb</span></div>
      <div class="setting-row"><strong>Teknologi</strong><span>Vite · JavaScript · Capacitor 7</span></div>
      <div class="setting-row"><strong>Penyimpanan</strong><span>Local Storage</span></div>
      <p class="muted small">Data tidak otomatis tersinkron ke cloud. Gunakan backup secara berkala. Login username saja bukan sistem keamanan akun.</p>
    </section>

    <section class="panel">
      <h3>Developer</h3>
      <div class="setting-row"><div><strong>ZORA STORE</strong><p class="muted small">Pengembang aplikasi</p></div><span class="badge">DEVELOPER</span></div>
    </section>
  `;
}

function backupData() {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;
  a.download=`tabungan-anak-jb-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup berhasil dibuat.');
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const restored = JSON.parse(reader.result);
      if (!restored || !Array.isArray(restored.transactions)) throw new Error();
      data = {
        ...emptyData(),...restored,
        settings:{...emptyData().settings,...(restored.settings||{})}
      };
      save();render();toast('Data berhasil dipulihkan.');
    } catch {
      toast('File backup tidak valid.');
    }
  };
  reader.readAsText(file);
}

function exportCSV() {
  const rows=[
    ['Tanggal','Jenis','Keterangan','Kategori','Nominal'],
    ...data.transactions.map(t=>[t.date,t.type,t.description,t.category,t.amount])
  ];
  const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`laporan-tabungan-${today()}.csv`;a.click();
  URL.revokeObjectURL(url);
}

function calculate(a,b,op) {
  if(op==='+') return a+b;
  if(op==='−') return a-b;
  if(op==='×') return a*b;
  if(op==='÷') return b===0?NaN:a/b;
  return b;
}

function calculatorInput(key) {
  if(key==='AC') {
    calculatorValue='0';calculatorPrevious=null;calculatorOperator=null;calculatorFresh=false;
  } else if(key==='⌫') {
    calculatorValue=calculatorValue.length>1?calculatorValue.slice(0,-1):'0';
  } else if(key==='±') {
    calculatorValue=String(Number(calculatorValue)*-1);
  } else if(key==='%') {
    calculatorValue=String(Number(calculatorValue)/100);
  } else if(['+','−','×','÷'].includes(key)) {
    calculatorPrevious=Number(calculatorValue);calculatorOperator=key;calculatorFresh=true;
  } else if(key==='=') {
    if(calculatorPrevious!==null && calculatorOperator) {
      const result=calculate(calculatorPrevious,Number(calculatorValue),calculatorOperator);
      calculatorValue=Number.isFinite(result)?String(Number(result.toFixed(8))):'Error';
      calculatorPrevious=null;calculatorOperator=null;calculatorFresh=true;
    }
  } else if(key==='.') {
    if(!calculatorValue.includes('.')) calculatorValue+='.';
  } else if(/^\d$/.test(key)) {
    calculatorValue=calculatorFresh||calculatorValue==='0'?key:calculatorValue+key;
    calculatorFresh=false;
  }
  const display=document.querySelector('#calcDisplay');
  if(display) display.textContent=calculatorValue;
}

async function fetchPrayerTimes(city,country) {
  const url=`https://api.aladhan.com/v1/timingsByCity/${today()}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=20`;
  const response=await fetch(url);
  if(!response.ok) throw new Error('Tidak bisa mengambil jadwal salat.');
  const json=await response.json();
  if(json.code!==200) throw new Error('Jadwal salat tidak tersedia.');
  return json.data.timings;
}

async function syncPrayerNotifications() {
  if(!Capacitor.isNativePlatform() || !data.settings.prayerEnabled) return;

  try {
    let permission=await LocalNotifications.checkPermissions();
    if(permission.display!=='granted') {
      permission=await LocalNotifications.requestPermissions();
    }
    if(permission.display!=='granted') {
      toast('Izin notifikasi belum diberikan.');
      return;
    }

    const timings=await fetchPrayerTimes(data.settings.city,data.settings.country);
    const names=[
      ['Fajr','Subuh'],
      ['Dhuhr','Dzuhur'],
      ['Asr','Ashar'],
      ['Maghrib','Maghrib'],
      ['Isha','Isya']
    ];

    await LocalNotifications.cancel({notifications:names.map((_,i)=>({id:8100+i}))});

    const notifications=[];
    for(const [index,[key,label]] of names.entries()) {
      const [hour,minute]=timings[key].split(':').map(Number);
      const at=new Date();
      at.setHours(hour,minute,0,0);
      if(at.getTime()<=Date.now()) at.setDate(at.getDate()+1);
      notifications.push({
        id:8100+index,
        title:`Halo, ${username}!`,
        body:`Waktunya sholat ${label}. Jangan tinggalkan ibadahmu demi hal-hal yang tidak penting.`,
        schedule:{at,allowWhileIdle:true},
        smallIcon:'ic_stat_icon_config_sample'
      });
    }

    await LocalNotifications.schedule({notifications});
    toast('Pengingat salat berhasil dijadwalkan.');
  } catch(error) {
    console.error(error);
    toast('Gagal menjadwalkan pengingat salat.');
  }
}

async function enablePrayer() {
  if(!Capacitor.isNativePlatform()) {
    toast('Pengingat di luar aplikasi tersedia setelah APK dipasang.');
    return;
  }
  data.settings.prayerEnabled=true;
  save();
  await syncPrayerNotifications();
}

function render() {
  document.documentElement.dataset.theme=data.settings.theme||'dark';

  if(!username) {
    loginScreen();
    return;
  }

  let content='';
  switch(currentPage) {
    case 'dashboard':content=dashboardPage();break;
    case 'transactions':content=transactionsPage();break;
    case 'calculator':content=calculatorPage();break;
    case 'savings':content=savingsPage();break;
    case 'notes':content=notesPage();break;
    case 'debts':content=debtsPage();break;
    case 'stocks':content=stocksPage();break;
    case 'reports':content=reportsPage();break;
    case 'calendar':content=calendarPage();break;
    case 'settings':content=settingsPage();break;
    case 'info':content=infoPage();break;
    case 'backup':content=`<section class="panel"><h3>Backup data</h3><button class="primary-btn" id="backupBtn">Download backup</button></section>`;break;
    default:currentPage='dashboard';content=dashboardPage();
  }

  document.querySelector('#app').innerHTML=shell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(button=>{
    button.addEventListener('click',()=>{
      currentPage=button.dataset.page;
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });

  document.querySelectorAll('#logoutBtn').forEach(button=>{
    button.addEventListener('click',()=>{
      if(!confirm('Keluar dari aplikasi?')) return;
      localStorage.removeItem(SESSION);
      username='';
      currentPage='dashboard';
      render();
    });
  });

  document.querySelector('#themeSelect')?.addEventListener('change',e=>{
    const theme=['dark','light','green'].includes(e.target.value)?e.target.value:'dark';
    data.settings.theme=theme;
    save();
    document.documentElement.dataset.theme=theme;
    toast('Tema berhasil diubah.');
  });

  document.querySelector('#transactionForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const amount=Number(f.get('amount'));
    if(!Number.isFinite(amount)||amount<=0) return toast('Nominal tidak valid.');
    data.transactions.push({
      id:uid(),type:f.get('type'),amount,
      description:f.get('description').trim(),
      category:f.get('category'),date:f.get('date'),createdAt:Date.now()
    });
    save();render();toast('Transaksi berhasil disimpan.');
  });

  document.querySelector('#transactionSearch')?.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    const filtered=data.transactions.filter(t=>
      `${t.description} ${t.category} ${t.date}`.toLowerCase().includes(q)
    ).sort((a,b)=>b.createdAt-a.createdAt);
    document.querySelector('#transactionList').innerHTML=transactionTable(filtered);
    bindDeleteTransaction();
  });

  bindDeleteTransaction();

  function bindDeleteTransaction() {
    document.querySelectorAll('[data-delete-transaction]').forEach(button=>{
      button.addEventListener('click',()=>{
        if(!confirm('Hapus transaksi ini?')) return;
        data.transactions=data.transactions.filter(t=>t.id!==Number(button.dataset.deleteTransaction));
        save();render();toast('Transaksi dihapus.');
      });
    });
  }

  document.querySelectorAll('[data-calc]').forEach(button=>{
    button.addEventListener('click',()=>calculatorInput(button.dataset.calc));
  });

  document.querySelector('#mcForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const quantity=Number(f.get('quantity'));
    const price=Number(f.get('price'));
    const capital=Number(f.get('capital'));
    const revenue=quantity*price;
    const profit=revenue-capital;

    document.querySelector('#mcResult').innerHTML=`
      <div class="setting-row"><span>Jumlah item</span><strong>${quantity}</strong></div>
      <div class="setting-row"><span>Total omzet</span><strong>${rupiah(revenue)}</strong></div>
      <div class="setting-row"><span>Modal</span><strong>${rupiah(capital)}</strong></div>
      <div class="setting-row"><span>Keuntungan bersih</span><strong class="${profit>=0?'income':'expense'}">${rupiah(profit)}</strong></div>
      <button class="secondary-btn" id="saveMC">Simpan hasil</button>
    `;
    document.querySelector('#saveMC').addEventListener('click',()=>{
      data.transactions.push({
        id:uid(),type:'income',amount:revenue,
        description:'Hasil kalkulator MC',category:'Penjualan',
        date:today(),createdAt:Date.now()
      });
      if(capital>0) data.transactions.push({
        id:uid(),type:'expense',amount:capital,
        description:'Modal MC',category:'Modal',
        date:today(),createdAt:Date.now()
      });
      save();toast('Hasil MC dicatat.');
    });
  });

  document.querySelector('#goalForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    data.goals.push({id:uid(),name:f.get('name').trim(),target:Number(f.get('target')),saved:0});
    save();render();toast('Target tabungan dibuat.');
  });

  document.querySelectorAll('[data-save-goal]').forEach(form=>{
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const goal=data.goals.find(g=>g.id===Number(form.dataset.saveGoal));
      const amount=Number(new FormData(form).get('amount'));
      if(!goal||amount<=0) return;
      goal.saved+=amount;save();render();toast('Tabungan ditambahkan.');
    });
  });

  document.querySelectorAll('[data-delete-goal]').forEach(button=>{
    button.addEventListener('click',()=>{
      data.goals=data.goals.filter(g=>g.id!==Number(button.dataset.deleteGoal));
      save();render();
    });
  });

  document.querySelector('#noteForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    data.notes.unshift({id:uid(),title:f.get('title').trim(),body:f.get('body').trim(),date:today()});
    save();render();toast('Catatan disimpan.');
  });

  document.querySelectorAll('[data-delete-note]').forEach(button=>{
    button.addEventListener('click',()=>{
      data.notes=data.notes.filter(n=>n.id!==Number(button.dataset.deleteNote));
      save();render();
    });
  });

  document.querySelector('#debtForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    data.debts.push({
      id:uid(),person:f.get('person').trim(),type:f.get('type'),
      amount:Number(f.get('amount')),due:f.get('due'),paid:false
    });
    save();render();toast('Kasbon disimpan.');
  });

  document.querySelectorAll('[data-paid-debt]').forEach(button=>{
    button.addEventListener('click',()=>{
      const id=Number(button.dataset.paidDebt);
      data.debts=data.debts.filter(d=>d.id!==id);
      save();render();toast('Kasbon ditandai lunas dan diarsipkan.');
    });
  });

  document.querySelectorAll('[data-delete-debt]').forEach(button=>{
    button.addEventListener('click',()=>{
      data.debts=data.debts.filter(d=>d.id!==Number(button.dataset.deleteDebt));
      save();render();
    });
  });

  document.querySelector('#stockForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    data.stocks.push({
      id:uid(),name:f.get('name').trim(),
      quantity:Number(f.get('quantity')),price:Number(f.get('price'))
    });
    save();render();toast('Barang ditambahkan.');
  });

  document.querySelectorAll('[data-delete-stock]').forEach(button=>{
    button.addEventListener('click',()=>{
      data.stocks=data.stocks.filter(s=>s.id!==Number(button.dataset.deleteStock));
      save();render();
    });
  });

  document.querySelector('#exportCsv')?.addEventListener('click',exportCSV);
  document.querySelector('#backupBtn')?.addEventListener('click',backupData);

  document.querySelector('#restoreBtn')?.addEventListener('click',()=>document.querySelector('#restoreFile')?.click());
  document.querySelector('#restoreFile')?.addEventListener('change',e=>{
    if(e.target.files[0]) restoreData(e.target.files[0]);
  });

  document.querySelector('#calendarMonth')?.addEventListener('change',e=>{
    const items=data.transactions.filter(t=>t.date.startsWith(e.target.value));
    document.querySelector('#calendarItems').innerHTML=calendarList(items);
  });

  document.querySelector('#prayerForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    data.settings.city=f.get('city').trim();
    data.settings.country=f.get('country').trim();
    save();
    await enablePrayer();
  });

  document.querySelector('#disablePrayer')?.addEventListener('click',async()=>{
    data.settings.prayerEnabled=false;
    save();
    if(Capacitor.isNativePlatform()) {
      const ids=[8100,8101,8102,8103,8104];
      await LocalNotifications.cancel({notifications:ids.map(id=>({id}))});
    }
    toast('Pengingat salat dimatikan.');
  });
}

render();

if(username && data.settings.prayerEnabled) {
  syncPrayerNotifications();
}
