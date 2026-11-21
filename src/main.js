
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

const today = () => new Date().toISOString().slice(0, 10);
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
    prayerEnabled: false
  }
});

function loadData() {
  try {
    return {
      ...emptyData(),
      ...JSON.parse(localStorage.getItem(KEY) || '{}')
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
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
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
  const income = data.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expense = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    income,
    expense,
    balance: income - expense,
    profit: income - expense,
    count: data.transactions.length
  };
}

function loginScreen() {
  document.querySelector('#app').innerHTML = `
    <main class="login-screen">
      <section class="login-card">
        <div class="brand">
          <div class="brand-icon">TJ</div>
          <div>
            <div>TABUNGAN ANAK JB</div>
            <div class="muted small">PERSONAL FINANCE SYSTEM</div>
          </div>
        </div>

        <h1>Mulai kelola uangmu.</h1>
        <p class="muted">Masuk menggunakan username untuk membuka dashboard tabunganmu.</p>

        <form id="loginForm">
          <div class="field">
            <label for="username">USERNAME</label>
            <input id="username" maxlength="24"
              placeholder="Masukkan username..."
              autocomplete="username" required>
          </div>
          <button class="primary-btn full" type="submit">
            Masuk ke aplikasi →
          </button>
        </form>

        <p class="muted small" style="margin-top:22px">
          Data disimpan secara lokal pada perangkat ini.
        </p>
      </section>
    </main>
  `;

  document.querySelector('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const value = document.querySelector('#username').value.trim();
    if (!value) return;
    username = value;
    localStorage.setItem(SESSION, username);
    render();
    toast(`Selamat datang, ${username}!`);
  });
}

const navItems = [
  ['dashboard', '⌂', 'Dashboard'],
  ['transactions', '↕', 'Transaksi'],
  ['calculator', '＋', 'Kalkulator'],
  ['savings', '◎', 'Tabungan'],
  ['notes', '▤', 'Catatan'],
  ['debts', '⇄', 'Kasbon'],
  ['stocks', '▦', 'Stok'],
  ['reports', '▥', 'Laporan'],
  ['calendar', '▦', 'Kalender'],
  ['settings', '⚙', 'Pengaturan']
];

function navButton(item) {
  const [id, icon, label] = item;
  return `
    <button class="nav-btn ${currentPage === id ? 'active' : ''}"
      data-page="${id}">
      <span>${icon}</span>${label}
    </button>
  `;
}

function shell(content) {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">TJ</div>
          <div>
            <div>TABUNGAN ANAK JB</div>
            <div class="muted small">FINANCE MANAGER</div>
          </div>
        </div>

        <div class="nav-label">MENU UTAMA</div>
        ${navItems.slice(0, 5).map(navButton).join('')}

        <div class="nav-label">MANAJEMEN</div>
        ${navItems.slice(5).map(navButton).join('')}

        <div class="sidebar-bottom">
          <button class="nav-btn" data-page="settings">
            ⚙ Pengaturan
          </button>
          <button class="nav-btn" id="logoutBtn">↪ Keluar</button>
        </div>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div>
            <h2>${pageTitle()}</h2>
            <p>${new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}</p>
          </div>
          <div class="user-chip">
            <div class="avatar">${escapeHTML(username.charAt(0).toUpperCase())}</div>
            <span class="user-name">${escapeHTML(username)}</span>
          </div>
        </header>
        ${content}
      </main>
    </div>

    <nav class="mobile-nav">
      ${[
        ['dashboard', '⌂', 'Home'],
        ['transactions', '↕', 'Transaksi'],
        ['calculator', '＋', 'Hitung'],
        ['savings', '◎', 'Tabungan'],
        ['settings', '⚙', 'Setting']
      ].map(([id, icon, label]) => `
        <button data-page="${id}" class="${currentPage === id ? 'active' : ''}">
          <span>${icon}</span>${label}
        </button>
      `).join('')}
    </nav>
  `;
}

function pageTitle() {
  return navItems.find(item => item[0] === currentPage)?.[2] || 'Dashboard';
}

function statCard(icon, label, value) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${rupiah(value)}</div>
    </div>
  `;
}

function feature(id, icon, title, description) {
  return `
    <button class="feature-card" data-page="${id}">
      <div class="feature-icon">${icon}</div>
      <strong>${title}</strong>
      <span>${description}</span>
    </button>
  `;
}

function dashboardPage() {
  const t = totals();
  const recent = [...data.transactions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return `
    <section class="hero-card">
      <div class="eyebrow">PERSONAL FINANCE OVERVIEW</div>
      <h1>Halo, ${escapeHTML(username)}!</h1>
      <div class="balance-label">Total saldo kamu saat ini</div>
      <div class="balance-value">${rupiah(t.balance)}</div>
      <div class="hero-actions">
        <button class="primary-btn" data-page="transactions">
          + Tambah transaksi
        </button>
        <button class="secondary-btn" data-page="reports">
          Lihat laporan
        </button>
      </div>
    </section>

    <section class="stats-grid">
      ${statCard('↗', 'Total pemasukan', t.income)}
      ${statCard('↘', 'Total pengeluaran', t.expense)}
      ${statCard('◆', 'Keuntungan bersih', t.profit)}
      ${statCard('#', 'Jumlah transaksi', t.count)}
    </section>

    <div class="section-title">
      <h3>Workspace</h3>
      <span class="badge">10 FITUR</span>
    </div>

    <section class="feature-grid">
      ${feature('transactions', '↕', 'Transaksi', 'Pemasukan & pengeluaran')}
      ${feature('calculator', '＋', 'Kalkulator', 'Hitung nominal dan MC')}
      ${feature('savings', '◎', 'Target tabungan', 'Pantau tujuanmu')}
      ${feature('notes', '▤', 'Catatan', 'Simpan catatan penting')}
      ${feature('debts', '⇄', 'Kasbon', 'Catat utang dan piutang')}
      ${feature('stocks', '▦', 'Manajemen stok', 'Pantau barang')}
      ${feature('reports', '▥', 'Laporan', 'Ringkasan keuangan')}
      ${feature('calendar', '▦', 'Kalender', 'Jadwal transaksi')}
      ${feature('settings', '⚙', 'Pengaturan', 'Profil & notifikasi')}
      ${feature('backup', '⇧', 'Backup data', 'Simpan cadangan data')}
    </section>

    <div class="section-title">
      <h3>Transaksi terbaru</h3>
      <button class="ghost-btn" data-page="transactions">Lihat semua</button>
    </div>

    <section class="panel">
      ${transactionTable(recent)}
    </section>
  `;
}

function transactionTable(items) {
  if (!items.length) {
    return `<div class="empty-state">Belum ada transaksi. Tambahkan transaksi pertamamu.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Keterangan</th>
            <th>Kategori</th>
            <th>Tanggal</th>
            <th>Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(t => `
            <tr>
              <td>${escapeHTML(t.description)}</td>
              <td>${escapeHTML(t.category)}</td>
              <td>${escapeHTML(t.date)}</td>
              <td class="${t.type === 'income' ? 'income' : 'expense'}">
                ${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function transactionsPage() {
  const items = [...data.transactions]
    .sort((a, b) => b.createdAt - a.createdAt);

  return `
    <section class="panel">
      <h3>Tambah transaksi</h3>
      <form id="transactionForm">
        <div class="panel-grid">
          <div class="field">
            <label>JENIS TRANSAKSI</label>
            <select name="type" required>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </div>
          <div class="field">
            <label>NOMINAL (RP)</label>
            <input name="amount" type="number" min="1" step="1"
              placeholder="Contoh: 50000" required>
          </div>
          <div class="field">
            <label>KETERANGAN</label>
            <input name="description" maxlength="80"
              placeholder="Contoh: Penjualan akun" required>
          </div>
          <div class="field">
            <label>KATEGORI</label>
            <select name="category">
              <option>Penjualan</option>
              <option>Top Up</option>
              <option>Tabungan</option>
              <option>Modal</option>
              <option>Makanan</option>
              <option>Transportasi</option>
              <option>Lainnya</option>
            </select>
          </div>
          <div class="field">
            <label>TANGGAL</label>
            <input name="date" type="date" value="${today()}" required>
          </div>
        </div>
        <div class="form-actions">
          <button class="primary-btn">Simpan transaksi</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="section-title" style="margin-top:0">
        <h3>Riwayat transaksi</h3>
        <span class="badge">${items.length} DATA</span>
      </div>
      <input id="transactionSearch" class="search-input"
        placeholder="Cari transaksi atau kategori...">
      <div id="transactionList">${transactionTable(items)}</div>
    </section>
  `;
}

function calculatorPage() {
  return `
    <div class="panel">
      <h3>Kalkulator umum</h3>
      <div class="calc-display" id="calcDisplay">${calculatorValue}</div>
      <div class="calc-grid">
        ${['AC','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(key => `
          <button data-calc="${key}"
            class="${['÷','×','−','+','%'].includes(key) ? 'operator' : ''} ${key === '=' ? 'equal' : ''}"
            style="${key === '0' ? 'grid-column:span 2' : ''}">
            ${key}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Kalkulator MC / keuntungan</h3>
      <form id="mcForm">
        <div class="panel-grid">
          <div class="field">
            <label>JUMLAH ITEM</label>
            <input type="number" name="quantity" min="0" step="1"
              placeholder="Jumlah" required>
          </div>
          <div class="field">
            <label>HARGA PER ITEM</label>
            <input type="number" name="price" min="0"
              placeholder="Harga jual" required>
          </div>
          <div class="field">
            <label>MODAL TOTAL</label>
            <input type="number" name="capital" min="0"
              placeholder="Total modal" value="0" required>
          </div>
        </div>
        <button class="primary-btn">Hitung keuntungan</button>
      </form>
      <div id="mcResult" style="margin-top:16px"></div>
    </div>
  `;
}

function savingsPage() {
  return `
    <section class="panel">
      <h3>Buat target tabungan</h3>
      <form id="goalForm">
        <div class="panel-grid">
          <div class="field">
            <label>NAMA TARGET</label>
            <input name="name" placeholder="Contoh: Beli HP" required>
          </div>
          <div class="field">
            <label>TARGET NOMINAL</label>
            <input name="target" type="number" min="1" placeholder="1000000" required>
          </div>
        </div>
        <button class="primary-btn">Buat target</button>
      </form>
    </section>

    <div class="section-title"><h3>Target kamu</h3></div>
    ${data.goals.length ? data.goals.map(g => {
      const percent = Math.min(100, Math.round(g.saved / g.target * 100));
      return `
        <section class="panel">
          <div class="section-title" style="margin-top:0">
            <strong>${escapeHTML(g.name)}</strong>
            <span class="badge">${percent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
          <p class="muted small">${rupiah(g.saved)} dari ${rupiah(g.target)}</p>
          <form data-save-goal="${g.id}" class="toolbar">
            <input name="amount" type="number" min="1"
              class="search-input" placeholder="Tambah tabungan" required>
            <button class="primary-btn">Tambah</button>
          </form>
          <button class="danger-btn" data-delete-goal="${g.id}">Hapus target</button>
        </section>
      `;
    }).join('') : `<div class="panel empty-state">Belum ada target tabungan.</div>`}
  `;
}

function notesPage() {
  return `
    <section class="panel">
      <h3>Catatan baru</h3>
      <form id="noteForm">
        <div class="field">
          <label>JUDUL</label>
          <input name="title" placeholder="Judul catatan" required>
        </div>
        <div class="field">
          <label>ISI CATATAN</label>
          <textarea name="body" placeholder="Tulis catatanmu..." required></textarea>
        </div>
        <button class="primary-btn">Simpan catatan</button>
      </form>
    </section>
    ${data.notes.length ? data.notes.map(n => `
      <section class="panel">
        <div class="section-title" style="margin-top:0">
          <strong>${escapeHTML(n.title)}</strong>
          <span class="muted small">${escapeHTML(n.date)}</span>
        </div>
        <p class="muted">${escapeHTML(n.body)}</p>
        <button class="danger-btn" data-delete-note="${n.id}">Hapus</button>
      </section>
    `).join('') : `<div class="panel empty-state">Belum ada catatan.</div>`}
  `;
}

function debtsPage() {
  return `
    <section class="panel">
      <h3>Tambah kasbon</h3>
      <form id="debtForm">
        <div class="panel-grid">
          <div class="field">
            <label>NAMA ORANG</label>
            <input name="person" required placeholder="Nama">
          </div>
          <div class="field">
            <label>JENIS</label>
            <select name="type">
              <option value="receivable">Piutang (orang berutang ke kamu)</option>
              <option value="payable">Utang (kamu berutang)</option>
            </select>
          </div>
          <div class="field">
            <label>NOMINAL</label>
            <input name="amount" type="number" min="1" required>
          </div>
          <div class="field">
            <label>JATUH TEMPO</label>
            <input name="due" type="date">
          </div>
        </div>
        <button class="primary-btn">Simpan kasbon</button>
      </form>
    </section>
    ${data.debts.length ? data.debts.map(d => `
      <section class="panel">
        <div class="section-title" style="margin-top:0">
          <strong>${escapeHTML(d.person)}</strong>
          <span class="badge">${d.type === 'receivable' ? 'PIUTANG' : 'UTANG'}</span>
        </div>
        <div class="stat-value">${rupiah(d.amount)}</div>
        <p class="muted small">Jatuh tempo: ${escapeHTML(d.due || '-')}</p>
        <button class="secondary-btn" data-paid-debt="${d.id}">Tandai lunas</button>
        <button class="danger-btn" data-delete-debt="${d.id}">Hapus</button>
      </section>
    `).join('') : `<div class="panel empty-state">Belum ada data kasbon.</div>`}
  `;
}

function stocksPage() {
  return `
    <section class="panel">
      <h3>Tambah barang</h3>
      <form id="stockForm">
        <div class="panel-grid">
          <div class="field">
            <label>NAMA BARANG</label>
            <input name="name" required placeholder="Nama barang">
          </div>
          <div class="field">
            <label>JUMLAH STOK</label>
            <input name="quantity" type="number" min="0" required>
          </div>
          <div class="field">
            <label>HARGA MODAL / UNIT</label>
            <input name="price" type="number" min="0" required>
          </div>
        </div>
        <button class="primary-btn">Tambah stok</button>
      </form>
    </section>
    <section class="panel">
      <h3>Daftar stok</h3>
      ${data.stocks.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Barang</th><th>Jumlah</th><th>Modal/unit</th><th>Aksi</th></tr></thead>
            <tbody>
              ${data.stocks.map(s => `
                <tr>
                  <td>${escapeHTML(s.name)}</td>
                  <td>${s.quantity}</td>
                  <td>${rupiah(s.price)}</td>
                  <td><button class="danger-btn" data-delete-stock="${s.id}">Hapus</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state">Belum ada stok barang.</div>`}
    </section>
  `;
}

function reportsPage() {
  const t = totals();
  const month = today().slice(0, 7);
  const monthly = data.transactions.filter(x => x.date.startsWith(month));
  const monthlyIncome = monthly.filter(x => x.type === 'income')
    .reduce((s, x) => s + Number(x.amount), 0);
  const monthlyExpense = monthly.filter(x => x.type === 'expense')
    .reduce((s, x) => s + Number(x.amount), 0);

  return `
    <section class="stats-grid">
      ${statCard('↗', 'Pemasukan bulan ini', monthlyIncome)}
      ${statCard('↘', 'Pengeluaran bulan ini', monthlyExpense)}
      ${statCard('◆', 'Saldo keseluruhan', t.balance)}
      ${statCard('#', 'Total transaksi', t.count)}
    </section>
    <section class="panel">
      <h3>Ringkasan keuangan</h3>
      <div class="setting-row">
        <div><strong>Total pemasukan</strong></div>
        <strong class="income">${rupiah(t.income)}</strong>
      </div>
      <div class="setting-row">
        <div><strong>Total pengeluaran</strong></div>
        <strong class="expense">${rupiah(t.expense)}</strong>
      </div>
      <div class="setting-row">
        <div><strong>Saldo bersih</strong></div>
        <strong>${rupiah(t.balance)}</strong>
      </div>
      <div class="form-actions">
        <button class="primary-btn" id="exportCsv">Ekspor CSV</button>
        <button class="secondary-btn" id="backupBtn">Backup JSON</button>
      </div>
    </section>
  `;
}

function calendarPage() {
  const month = today().slice(0, 7);
  const items = data.transactions.filter(t => t.date.startsWith(month));
  return `
    <section class="panel">
      <h3>Kalender transaksi</h3>
      <div class="field">
        <label>PILIH BULAN</label>
        <input id="calendarMonth" type="month" value="${month}">
      </div>
      <div id="calendarItems">
        ${calendarList(items)}
      </div>
    </section>
  `;
}

function calendarList(items) {
  if (!items.length) return `<div class="empty-state">Tidak ada transaksi pada bulan ini.</div>`;
  return items.sort((a, b) => a.date.localeCompare(b.date)).map(t => `
    <div class="setting-row">
      <div>
        <strong>${escapeHTML(t.date)}</strong>
        <p>${escapeHTML(t.description)}</p>
      </div>
      <strong class="${t.type === 'income' ? 'income' : 'expense'}">
        ${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}
      </strong>
    </div>
  `).join('');
}

function settingsPage() {
  return `
    <section class="panel">
      <h3>Profil pengguna</h3>
      <div class="setting-row">
        <div><strong>Username</strong><p>${escapeHTML(username)}</p></div>
        <span class="badge">AKTIF</span>
      </div>
      <div class="setting-row">
        <div><strong>Penyimpanan</strong><p>Data lokal perangkat</p></div>
        <span class="badge">LOCAL</span>
      </div>
      <div class="setting-row">
        <div><strong>Versi aplikasi</strong><p>1.0.0</p></div>
      </div>
    </section>

    <section class="panel">
      <h3>Pengingat waktu sholat</h3>
      <p class="muted small">
        Aktifkan izin notifikasi Android agar pengingat bisa muncul di luar aplikasi.
      </p>
      <form id="prayerForm">
        <div class="panel-grid">
          <div class="field">
            <label>KOTA</label>
            <input name="city" value="${escapeHTML(data.settings.city)}" required>
          </div>
          <div class="field">
            <label>NEGARA</label>
            <input name="country" value="${escapeHTML(data.settings.country)}" required>
          </div>
        </div>
        <button class="primary-btn" type="submit">Aktifkan pengingat sholat</button>
        <button class="secondary-btn" type="button" id="disablePrayer">Matikan pengingat</button>
      </form>
      <p class="muted small" style="margin-top:14px">
        Jadwal diambil dari layanan AlAdhan. Periksa izin notifikasi dan pengaturan baterai Android jika pengingat terlambat.
      </p>
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
        <div>
          <strong>ZORA STORE</strong>
          <p>Developer TABUNGAN ANAK JB</p>
        </div>
        <span class="badge">DEV</span>
      </div>
    </section>

    <section class="panel">
      <button class="danger-btn full" id="logoutBtn">Keluar dari akun</button>
    </section>
  `;
}

function backupData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabungan-anak-jb-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup berhasil dibuat.');
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const restored = JSON.parse(reader.result);
      if (!restored || typeof restored !== 'object' ||
          !Array.isArray(restored.transactions)) {
        throw new Error('Format backup tidak valid');
      }
      data = { ...emptyData(), ...restored };
      save();
      render();
      toast('Data berhasil dipulihkan.');
    } catch {
      toast('File backup tidak valid.');
    }
  };
  reader.readAsText(file);
}

function exportCSV() {
  const rows = [
    ['Tanggal', 'Jenis', 'Keterangan', 'Kategori', 'Nominal'],
    ...data.transactions.map(t => [
      t.date, t.type, t.description, t.category, t.amount
    ])
  ];
  const csv = rows.map(row => row.map(value =>
    `"${String(value ?? '').replace(/"/g, '""')}"`
  ).join(',')).join('\n');

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-tabungan-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function calculate(a, b, op) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}

function calculatorInput(key) {
  if (key === 'AC') {
    calculatorValue = '0';
    calculatorPrevious = null;
    calculatorOperator = null;
    calculatorFresh = false;
  } else if (key === '⌫') {
    calculatorValue = calculatorValue.length > 1
      ? calculatorValue.slice(0, -1)
      : '0';
  } else if (key === '±') {
    calculatorValue = String(Number(calculatorValue) * -1);
  } else if (key === '%') {
    calculatorValue = String(Number(calculatorValue) / 100);
  } else if (['+', '−', '×', '÷'].includes(key)) {
    calculatorPrevious = Number(calculatorValue);
    calculatorOperator = key;
    calculatorFresh = true;
  } else if (key === '=') {
    if (calculatorPrevious !== null && calculatorOperator) {
      const result = calculate(
        calculatorPrevious,
        Number(calculatorValue),
        calculatorOperator
      );
      calculatorValue = Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error';
      calculatorPrevious = null;
      calculatorOperator = null;
      calculatorFresh = true;
    }
  } else if (key === '.') {
    if (!calculatorValue.includes('.')) calculatorValue += '.';
  } else if (/^\d$/.test(key)) {
    calculatorValue = calculatorFresh || calculatorValue === '0'
      ? key
      : calculatorValue + key;
    calculatorFresh = false;
  }

  const display = document.querySelector('#calcDisplay');
  if (display) display.textContent = calculatorValue;
}

function render() {
  if (!username) {
    loginScreen();
    return;
  }

  let content = '';
  switch (currentPage) {
    case 'dashboard': content = dashboardPage(); break;
    case 'transactions': content = transactionsPage(); break;
    case 'calculator': content = calculatorPage(); break;
    case 'savings': content = savingsPage(); break;
    case 'notes': content = notesPage(); break;
    case 'debts': content = debtsPage(); break;
    case 'stocks': content = stocksPage(); break;
    case 'reports': content = reportsPage(); break;
    case 'calendar': content = calendarPage(); break;
    case 'settings': content = settingsPage(); break;
    case 'backup':
      content = `<section class="panel"><h3>Backup data</h3><button class="primary-btn" id="backupBtn">Download backup</button></section>`;
      break;
    default: currentPage = 'dashboard'; content = dashboardPage();
  }

  document.querySelector('#app').innerHTML = shell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      currentPage = button.dataset.page;
      render();
    });
  });

  document.querySelectorAll('#logoutBtn').forEach(button => {
    button.addEventListener('click', () => {
      if (!confirm('Keluar dari aplikasi?')) return;
      localStorage.removeItem(SESSION);
      username = '';
      currentPage = 'dashboard';
      render();
    });
  });

  document.querySelector('#transactionForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) return toast('Nominal tidak valid.');

    data.transactions.push({
      id: uid(),
      type: form.get('type'),
      amount,
      description: form.get('description').trim(),
      category: form.get('category'),
      date: form.get('date'),
      createdAt: Date.now()
    });
    save();
    render();
    toast('Transaksi berhasil disimpan.');
  });

  document.querySelector('#transactionSearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = data.transactions.filter(t =>
      `${t.description} ${t.category} ${t.date}`.toLowerCase().includes(q)
    ).sort((a, b) => b.createdAt - a.createdAt);
    document.querySelector('#transactionList').innerHTML = transactionTable(filtered);
  });

  document.querySelectorAll('[data-calc]').forEach(button => {
    button.addEventListener('click', () => calculatorInput(button.dataset.calc));
  });

  document.querySelector('#mcForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const quantity = Number(f.get('quantity'));
    const price = Number(f.get('price'));
    const capital = Number(f.get('capital'));
    const revenue = quantity * price;
    const profit = revenue - capital;

    document.querySelector('#mcResult').innerHTML = `
      <div class="setting-row"><span>Jumlah penjualan</span><strong>${quantity}</strong></div>
      <div class="setting-row"><span>Total omzet</span><strong>${rupiah(revenue)}</strong></div>
      <div class="setting-row"><span>Modal</span><strong>${rupiah(capital)}</strong></div>
      <div class="setting-row"><span>Keuntungan bersih</span><strong class="${profit >= 0 ? 'income' : 'expense'}">${rupiah(profit)}</strong></div>
      <button class="secondary-btn" id="saveMC">Simpan hasil sebagai pemasukan</button>
    `;

    document.querySelector('#saveMC').addEventListener('click', () => {
      data.transactions.push({
        id: uid(),
        type: 'income',
        amount: revenue,
        description: 'Hasil kalkulator MC',
        category: 'Penjualan',
        date: today(),
        createdAt: Date.now()
      });

      if (capital > 0) {
        data.transactions.push({
          id: uid(),
          type: 'expense',
          amount: capital,
          description: 'Modal MC',
          category: 'Modal',
          date: today(),
          createdAt: Date.now()
        });
      }

      save();
      toast('Hasil MC dicatat ke transaksi.');
    });
  });

  document.querySelector('#goalForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    data.goals.push({
      id: uid(),
      name: f.get('name').trim(),
      target: Number(f.get('target')),
      saved: 0
    });
    save();
    render();
    toast('Target tabungan dibuat.');
  });

  document.querySelectorAll('[data-save-goal]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const goal = data.goals.find(g => g.id === Number(form.dataset.saveGoal));
      const amount = Number(new FormData(form).get('amount'));
      if (!goal || amount <= 0) return;
      goal.saved += amount;
      save();
      render();
      toast('Tabungan berhasil ditambahkan.');
    });
  });

  document.querySelectorAll('[data-delete-goal]').forEach(button => {
    button.addEventListener('click', () => {
      data.goals = data.goals.filter(g => g.id !== Number(button.dataset.deleteGoal));
      save();
      render();
    });
  });

  document.querySelector('#noteForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    data.notes.unshift({
      id: uid(),
      title: f.get('title').trim(),
      body: f.get('body').trim(),
      date: today()
    });
    save();
    render();
    toast('Catatan disimpan.');
  });

  document.querySelectorAll('[data-delete-note]').forEach(button => {
    button.addEventListener('click', () => {
      data.notes = data.notes.filter(n => n.id !== Number(button.dataset.deleteNote));
      save();
      render();
    });
  });

  document.querySelector('#debtForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    data.debts.push({
      id: uid(),
      person: f.get('person').trim(),
      type: f.get('type'),
      amount: Number(f.get('amount')),
      due: f.get('due'),
      paid: false
    });
    save();
    render();
    toast('Kasbon berhasil disimpan.');
  });

  document.querySelectorAll('[data-paid-debt]').forEach(button => {
    button.addEventListener('click', () => {
      const debt = data.debts.find(d => d.id === Number(button.dataset.paidDebt));
      if (debt) debt.paid = true;
      data.debts = data.debts.filter(d => !d.paid);
      save();
      render();
      toast('Kasbon ditandai lunas.');
    });
  });

  document.querySelectorAll('[data-delete-debt]').forEach(button => {
    button.addEventListener('click', () => {
      data.debts = data.debts.filter(d => d.id !== Number(button.dataset.deleteDebt));
      save();
      render();
    });
  });

  document.querySelector('#stockForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    data.stocks.push({
      id: uid(),
      name: f.get('name').trim(),
      quantity: Number(f.get('quantity')),
      price: Number(f.get('price'))
    });
    save();
    render();
    toast('Barang berhasil ditambahkan.');
  });

  document.querySelectorAll('[data-delete-stock]').forEach(button => {
    button.addEventListener('click', () => {
      data.stocks = data.stocks.filter(s => s.id !== Number(button.dataset.deleteStock));
      save();
      render();
    });
  });

  document.querySelector('#exportCsv')?.addEventListener('click', exportCSV);
  document.querySelector('#backupBtn')?.addEventListener('click', backupData);

  document.querySelector('#restoreBtn')?.addEventListener('click', () => {
    document.querySelector('#restoreFile')?.click();
  });

  document.querySelector('#restoreFile')?.addEventListener('change', e => {
    if (e.target.files[0]) restoreData(e.target.files[0]);
  });

  document.querySelector('#calendarMonth')?.addEventListener('change', e => {
    const items = data.transactions.filter(t => t.date.startsWith(e.target.value));
    document.querySelector('#calendarItems').innerHTML = calendarList(items);
  });

  document.querySelector('#prayerForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    data.settings.city = f.get('city').trim();
    data.settings.country = f.get('country').trim();
    save();
    await enablePrayerNotifications();
  });

  document.querySelector('#disablePrayer')?.addEventListener('click', async () => {
    data.settings.prayerEnabled = false;
    save();
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [7200, 7201, 7202, 7203, 7204].map(id => ({ id }))
        });
      } catch {}
    }
    toast('Pengingat sholat dimatikan.');
  });
}

async function enablePrayerNotifications() {
  if (!Capacitor.isNativePlatform()) {
    toast('Pengingat notifikasi hanya tersedia di APK Android.');
    return;
  }

  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      toast('Izin notifikasi belum diberikan.');
      return;
    }

    const { city, country } = data.settings;
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil jadwal sholat.');

    const result = await response.json();
    if (result.code !== 200 || !result.data?.timings) {
      throw new Error('Jadwal sholat tidak ditemukan.');
    }

    const timings = result.data.timings;
    const prayers = [
      ['Fajr', 'Subuh'],
      ['Dhuhr', 'Dzuhur'],
      ['Asr', 'Ashar'],
      ['Maghrib', 'Maghrib'],
      ['Isha', 'Isya']
    ];

    const ids = [7200, 7201, 7202, 7203, 7204];

    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id }))
    });

    const now = new Date();

    const notifications = prayers.map(([key, name], index) => {
      const time = timings[key].split(' ')[0];
      const [hour, minute] = time.split(':').map(Number);
      const at = new Date();
      at.setHours(hour, minute, 0, 0);

      if (at <= now) at.setDate(at.getDate() + 1);

      return {
        id: ids[index],
        title: `Halo, ${username}!`,
        body: `Waktunya Sholat ${name}. Jangan tinggalkan ibadahmu demi hal-hal yang tidak penting.`,
        schedule: { at }
      };
    });

    await LocalNotifications.schedule({ notifications });

    data.settings.prayerEnabled = true;
    save();
    toast('Pengingat sholat berhasil dijadwalkan.');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Gagal mengaktifkan pengingat.');
  }
}

render();
