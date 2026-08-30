/**
 * AUTOSOCIAL - Autonomous Client Application Engine v2.4.0
 * Light Fresh SaaS (Default) + Dark Ops Mode
 */

// Application State
const state = {
  activeTab: 'overview',
  theme: localStorage.getItem('autosocial-theme') || 'light',
  automationEnabled: true,
  logs: [],
  filteredLogs: [],
  selectedLogIds: new Set(),
  posters: [],
  filteredPosters: [],
  filterVaultStatus: 'ALL',
  filterPlatform: 'ALL',
  filterStatus: 'ALL',
  searchQueryLogs: '',
  searchQueryPosters: '',
  sessionDurationMinutes: 30,
  activeProofLog: null,
};

let targetTimeEpoch = null;
let isSessionActive = false;

// Document Ready Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initLiveClock();
  initCountdownTimer();
  initMasterToggle();
  initTabs();
  initVaultFilters();
  initLogFilters();
  initCheckboxes();
  initDropzone();
  initActionButtons();
  initCustomDispatchModal();
  initSessionDurationControls();
  initPasswordToggles();

  // Initial Data Fetch
  fetchSchedulerStatus();
  fetchDashboardStats();
  fetchPosters();
  fetchAuditLogs();
  fetchConfig();

  // 5-Second Real-time Polling Interval
  setInterval(() => {
    fetchSchedulerStatus(true);
    fetchDashboardStats(true);
    fetchAuditLogs(true);
    if (state.activeTab === 'vault') fetchPosters(true);
  }, 5000);
});

/* ==========================================================================
   1. THEME ENGINE (LIGHT FRESH & DARK OPS MODE)
   ========================================================================== */
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();

  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('autosocial-theme', state.theme);
      updateThemeIcon();
      showToast(`Beralih ke mode ${state.theme === 'dark' ? 'Ops Mode (Gelap)' : 'Light Fresh (Terang)'}`, 'info');
    });
  }
}

function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    if (state.theme === 'dark') {
      icon.className = 'fa-solid fa-sun';
      icon.style.color = 'var(--warning)';
    } else {
      icon.className = 'fa-regular fa-moon';
      icon.style.color = 'var(--ink-600)';
    }
  }
}

/* ==========================================================================
   2. SIDEBAR & NAVIGATION TABS
   ========================================================================== */
function initSidebar() {
  const btnMobile = document.getElementById('btnMobileSidebar');
  const sidebar = document.getElementById('appSidebar');

  if (btnMobile && sidebar) {
    btnMobile.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 860 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !btnMobile.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    });
  }
}

function initTabs() {
  const links = document.querySelectorAll('.nav-link-item');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.dataset.tab;
      if (!targetTab) return;

      links.forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      link.classList.add('active');
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) targetPane.classList.add('active');

      state.activeTab = targetTab;

      if (window.innerWidth <= 860) {
        const sidebar = document.getElementById('appSidebar');
        if (sidebar) sidebar.classList.remove('open');
      }

      if (targetTab === 'vault') fetchPosters();
      if (targetTab === 'reports') fetchAuditLogs();
      if (targetTab === 'settings') fetchConfig();
    });
  });
}

/* ==========================================================================
   3. LIVE CLOCK (ASIA/JAKARTA - WIB) & COUNTDOWN TICKER
   ========================================================================== */
function initLiveClock() {
  const clockEl = document.getElementById('liveClock');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();
    const options = {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const parts = new Intl.DateTimeFormat('id-ID', options).formatToParts(now);
    const h = parts.find(p => p.type === 'hour')?.value || '00';
    const m = parts.find(p => p.type === 'minute')?.value || '00';
    const s = parts.find(p => p.type === 'second')?.value || '00';
    clockEl.innerText = `${h}.${m}.${s} WIB`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}

function initCountdownTimer() {
  setInterval(() => {
    updateCountdownUI();
    updateTimelineVisual();
    updateScheduleTableRealtime();
  }, 1000);
}

function updateCountdownUI() {
  const countdownEl = document.getElementById('nextSessionCountdown');
  if (!countdownEl) return;

  if (!targetTimeEpoch) {
    countdownEl.innerText = '--:--:--';
    return;
  }

  const now = Date.now();
  const diff = targetTimeEpoch - now;

  if (diff <= 0) {
    if (isSessionActive) {
      countdownEl.innerText = '00:00:00';
      countdownEl.classList.remove('warning');
    } else {
      countdownEl.innerText = 'MEMULAI SESI...';
      countdownEl.classList.add('warning');
    }
    return;
  }

  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  countdownEl.innerText = `${hh}:${mm}:${ss}`;
  if (hours === 0 && minutes < 10) {
    countdownEl.classList.add('warning');
  } else {
    countdownEl.classList.remove('warning');
  }
}

function updateTimelineVisual() {
  const marker = document.getElementById('timelineCurrentMarker');
  const track = document.getElementById('timelineTrack');
  if (!marker || !track) return;

  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: 'numeric', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const totalM = h * 60 + m;

  const pct = (totalM / 1440) * 100;
  marker.style.left = `${pct.toFixed(2)}%`;

  const duration = state.sessionDurationMinutes || 30;
  const widthPct = (duration / 1440) * 100;

  const blockPagi = document.getElementById('timelineBlockPagi');
  const blockSiang = document.getElementById('timelineBlockSiang');
  const blockMalam = document.getElementById('timelineBlockMalam');

  if (blockPagi) {
    blockPagi.style.left = `${((7 * 60) / 1440) * 100}%`;
    blockPagi.style.width = `${Math.max(widthPct, 2.08)}%`;
    blockPagi.className = (totalM >= 7 * 60 && totalM < 7 * 60 + duration) ? 'timeline-window-block active' : (totalM > 7 * 60 + duration ? 'timeline-window-block' : 'timeline-window-block future');
  }

  if (blockSiang) {
    blockSiang.style.left = `${((13 * 60) / 1440) * 100}%`;
    blockSiang.style.width = `${Math.max(widthPct, 2.08)}%`;
    blockSiang.className = (totalM >= 13 * 60 && totalM < 13 * 60 + duration) ? 'timeline-window-block active' : (totalM > 13 * 60 + duration ? 'timeline-window-block' : 'timeline-window-block future');
  }

  if (blockMalam) {
    blockMalam.style.left = `${((18 * 60) / 1440) * 100}%`;
    blockMalam.style.width = `${Math.max(widthPct, 2.08)}%`;
    blockMalam.className = (totalM >= 18 * 60 && totalM < 18 * 60 + duration) ? 'timeline-window-block active' : (totalM > 18 * 60 + duration ? 'timeline-window-block' : 'timeline-window-block future');
  }
}

function updateScheduleTableRealtime() {
  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: 'numeric', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const totalM = h * 60 + m;
  const duration = state.sessionDurationMinutes || 30;

  // Format window end times
  const fmtEndTime = (startH, durMin) => {
    const totalEndMin = startH * 60 + durMin;
    const endH = String(Math.floor(totalEndMin / 60)).padStart(2, '0');
    const endM = String(totalEndMin % 60).padStart(2, '0');
    return `${endH}.${endM}`;
  };

  const winPagiEl = document.getElementById('windowPagiText');
  const winSiangEl = document.getElementById('windowSiangText');
  const winMalamEl = document.getElementById('windowMalamText');
  if (winPagiEl) winPagiEl.innerText = `07.00–${fmtEndTime(7, duration)}`;
  if (winSiangEl) winSiangEl.innerText = `13.00–${fmtEndTime(13, duration)}`;
  if (winMalamEl) winMalamEl.innerText = `18.00–${fmtEndTime(18, duration)}`;

  // Calculate dynamic jitter slots based on duration
  const calcSlot = (startH, ratio) => {
    const slotMin = Math.round(duration * ratio);
    const totalSlot = startH * 60 + slotMin;
    const sH = String(Math.floor(totalSlot / 60)).padStart(2, '0');
    const sM = String(totalSlot % 60).padStart(2, '0');
    return `${sH}.${sM} WIB`;
  };

  const setSlot = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };

  setSlot('slotPagiIg', calcSlot(7, 0.15));
  setSlot('slotPagiX', calcSlot(7, 0.45));
  setSlot('slotPagiFb', calcSlot(7, 0.75));

  setSlot('slotSiangIg', calcSlot(13, 0.15));
  setSlot('slotSiangX', calcSlot(13, 0.45));
  setSlot('slotSiangFb', calcSlot(13, 0.75));

  setSlot('slotMalamIg', calcSlot(18, 0.15));
  setSlot('slotMalamX', calcSlot(18, 0.45));
  setSlot('slotMalamFb', calcSlot(18, 0.75));

  // Determine row status for each session
  const updateRow = (name, startH, sessStats) => {
    const startMin = startH * 60;
    const endMin = startMin + duration;
    const badgeEl = document.getElementById(`statusBadge${name}`);
    const rowEl = document.getElementById(`rowSession${name}`);
    if (!badgeEl || !rowEl) return;

    const isCompleted = sessStats && (sessStats.completed || (sessStats.count >= 3));

    if (totalM >= endMin || isCompleted) {
      badgeEl.className = 'status-pill published';
      badgeEl.innerHTML = `<i class="fa-solid fa-check"></i> Selesai`;
      rowEl.classList.remove('active-session-row');
    } else if (totalM >= startMin && totalM < endMin) {
      badgeEl.className = 'status-pill active';
      badgeEl.innerHTML = `<span class="switch-dot"></span> Jendela Aktif`;
      rowEl.classList.add('active-session-row');
    } else {
      badgeEl.className = 'status-pill waiting';
      badgeEl.innerHTML = `Menunggu`;
      rowEl.classList.remove('active-session-row');
    }
  };

  const stats = state.lastSessionsStats;
  updateRow('Pagi', 7, stats?.PAGI);
  updateRow('Siang', 13, stats?.SIANG);
  updateRow('Malam', 18, stats?.MALAM);
}

/* ==========================================================================
   4. MASTER AUTOMATION TOGGLE
   ========================================================================= */
function initMasterToggle() {
  const toggle = document.getElementById('masterAutomationToggle');
  if (!toggle) return;

  toggle.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    state.automationEnabled = isChecked;
    updateMasterSwitchUI(isChecked);

    try {
      showToast(`Mengubah status otomasi ke ${isChecked ? 'AKTIF' : 'DIJEDA'}...`, 'info');
      const res = await fetch('/api/scheduler/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: isChecked })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchSchedulerStatus();
      } else {
        showToast('Gagal mengubah status otomasi.', 'error');
        toggle.checked = !isChecked;
        updateMasterSwitchUI(!isChecked);
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan.', 'error');
      toggle.checked = !isChecked;
      updateMasterSwitchUI(!isChecked);
    }
  });
}

function updateMasterSwitchUI(isEnabled) {
  const dot = document.getElementById('masterSwitchDot');
  const label = document.getElementById('masterSwitchStatusText');
  const engineDot = document.getElementById('engineDot');

  if (label) {
    label.innerText = isEnabled ? 'OTOMASI AKTIF' : 'OTOMASI DIJEDA';
    label.style.color = isEnabled ? 'var(--primary)' : 'var(--ink-400)';
  }

  if (dot) {
    dot.className = isEnabled ? 'switch-dot' : 'switch-dot off';
  }

  if (engineDot) {
    engineDot.className = isEnabled ? 'engine-status-dot pulse' : 'engine-status-dot off';
  }
}

/* ==========================================================================
   5. DASHBOARD STATS & SCHEDULER MONITORING
   ========================================================================== */
async function fetchSchedulerStatus(silent = false) {
  try {
    const res = await fetch('/api/scheduler/status');
    const data = await res.json();
    if (!data.success || !data.data) return;

    const info = data.data;
    state.automationEnabled = info.automationEnabled;

    const toggle = document.getElementById('masterAutomationToggle');
    if (toggle) toggle.checked = info.automationEnabled;
    updateMasterSwitchUI(info.automationEnabled);

    const heroName = document.getElementById('nextSessionName');
    const heroStatusTag = document.getElementById('heroStatusTag');
    const heroJitter = document.getElementById('heroJitterSubtext');

    if (info.nextSession) {
      if (heroName) heroName.innerText = `Sesi ${info.nextSession.name} (${info.nextSession.window})`;
      if (heroStatusTag) {
        if (info.nextSession.isWindowActive) {
          heroStatusTag.innerHTML = `<span class="switch-dot"></span> JENDELA AKTIF`;
          heroStatusTag.className = 'hero-status-tag active';
        } else {
          heroStatusTag.innerHTML = `<span class="switch-dot"></span> Sesi Berikutnya`;
          heroStatusTag.className = 'hero-status-tag';
        }
      }
      if (heroJitter) {
        heroJitter.innerText = info.nextSession.isWindowActive
          ? `Eksekusi jitter acak sedang berjalan`
          : `Jendela eksekusi acak mandiri 24/7`;
      }

      if (info.nextSession.targetTimestamp) {
        targetTimeEpoch = new Date(info.nextSession.targetTimestamp).getTime();
        isSessionActive = Boolean(info.nextSession.isWindowActive);
        updateCountdownUI();
      }
    }

    if (info.sessionWindowDurationMinutes) {
      state.sessionDurationMinutes = info.sessionWindowDurationMinutes;
      updateTimelineVisual();
    }

    if (info.activeJitterPlan && info.activeJitterPlan.tasks) {
      info.activeJitterPlan.tasks.forEach(task => {
        const timeStr = new Date(task.scheduledTime).toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit'
        }) + ' WIB';

        const sess = info.activeJitterPlan.sessionType;
        const plat = task.platform.toUpperCase();

        let slotId = null;
        if (sess === 'PAGI') {
          if (plat === 'INSTAGRAM') slotId = 'slotPagiIg';
          else if (plat === 'X') slotId = 'slotPagiX';
          else if (plat === 'FACEBOOK') slotId = 'slotPagiFb';
        } else if (sess === 'SIANG') {
          if (plat === 'INSTAGRAM') slotId = 'slotSiangIg';
          else if (plat === 'X') slotId = 'slotSiangX';
          else if (plat === 'FACEBOOK') slotId = 'slotSiangFb';
        } else if (sess === 'MALAM') {
          if (plat === 'INSTAGRAM') slotId = 'slotMalamIg';
          else if (plat === 'X') slotId = 'slotMalamX';
          else if (plat === 'FACEBOOK') slotId = 'slotMalamFb';
        }

        if (slotId) {
          const el = document.getElementById(slotId);
          if (el) el.innerText = timeStr;
        }
      });
    }
  } catch (err) {
    if (!silent) console.error('Error fetching scheduler status:', err);
  }
}

async function fetchDashboardStats(silent = false) {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (!data.success || !data.data) return;

    const stats = data.data;

    const numSuccess = stats.todaySuccessCount || 0;
    const metricSuccess = document.getElementById('metricSuccessToday');
    if (metricSuccess) metricSuccess.innerText = numSuccess;

    const percent = Math.min(100, Math.round((numSuccess / 9) * 100));
    const progressBar = document.getElementById('metricProgressBar');
    if (progressBar) progressBar.style.width = `${percent}%`;

    const percentText = document.getElementById('metricPercentText');
    if (percentText) percentText.innerText = `${percent}% tercapai hari ini (${numSuccess}/9)`;

    if (stats.platformBreakdownToday) {
      const ig = stats.platformBreakdownToday.instagram || 0;
      const x = stats.platformBreakdownToday.x || 0;
      const fb = stats.platformBreakdownToday.facebook || 0;

      const elIg = document.getElementById('countIg');
      if (elIg) elIg.innerText = `${ig} / 3`;

      const elX = document.getElementById('countX');
      if (elX) elX.innerText = `${x} / 3`;

      const elFb = document.getElementById('countFb');
      if (elFb) elFb.innerText = `${fb} / 3`;
    }

    if (stats.sessionsToday) {
      state.lastSessionsStats = stats.sessionsToday;
      updateScheduleTableRealtime();
    }
  } catch (err) {
    if (!silent) console.error('Error fetching stats:', err);
  }
}

/* ==========================================================================
   6. POSTER VAULT API & GRID
   ========================================================================== */
async function fetchPosters(silent = false) {
  try {
    const res = await fetch('/api/posters');
    const data = await res.json();
    state.posters = data.data || [];

    const badge = document.getElementById('posterCountBadge');
    if (badge) badge.innerText = state.posters.length;

    const totalText = document.getElementById('vaultTotalText');
    if (totalText) totalText.innerText = `Total: ${state.posters.length} Poster`;

    applyVaultFilters();
  } catch (err) {
    if (!silent) console.error('Error fetching posters:', err);
  }
}

function initVaultFilters() {
  const searchInput = document.getElementById('inputSearchPosters');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQueryPosters = e.target.value.toLowerCase().trim();
      applyVaultFilters();
    });
  }

  const chips = document.querySelectorAll('[data-filter-vault]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterVaultStatus = chip.dataset.filterVault;
      applyVaultFilters();
    });
  });

  const btnUploadTrigger = document.getElementById('btnUploadPosterTrigger');
  const fileInput = document.getElementById('filePosterInput');
  if (btnUploadTrigger && fileInput) {
    btnUploadTrigger.addEventListener('click', () => fileInput.click());
  }

  const btnSelectFile = document.getElementById('btnSelectFileTrigger');
  if (btnSelectFile && fileInput) {
    btnSelectFile.addEventListener('click', () => fileInput.click());
  }
}

function applyVaultFilters() {
  let list = [...state.posters];

  if (state.filterVaultStatus !== 'ALL') {
    list = list.filter(p => (p.status || 'AVAILABLE').toUpperCase() === state.filterVaultStatus);
  }

  if (state.searchQueryPosters) {
    list = list.filter(p => (p.fileName || '').toLowerCase().includes(state.searchQueryPosters));
  }

  state.filteredPosters = list;
  renderPostersGrid();
}

function renderPostersGrid() {
  const grid = document.getElementById('posterGridContainer');
  if (!grid) return;

  if (state.filteredPosters.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--ink-400);">
        <i class="fa-solid fa-images fa-3x" style="margin-bottom: 12px; opacity: 0.5;"></i>
        <div style="font-weight: 700; font-size: 1.1rem; color: var(--ink-600);">Tidak Ada Poster di Vault</div>
        <p style="font-size: 0.85rem; margin-top: 4px;">Unggah file poster gambar (.jpg/.png) untuk memulai antrean publikasi otomatis.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.filteredPosters.map(poster => {
    const isAvailable = (poster.status || 'AVAILABLE') === 'AVAILABLE';
    const isPosted = poster.status === 'POSTED';
    const statusClass = isAvailable ? 'available' : (isPosted ? 'posted' : 'scheduled');
    const statusLabel = isAvailable ? 'Tersedia' : (isPosted ? 'Terpublikasi' : 'Terjadwal');

    const dateStr = poster.createdAt ? new Date(poster.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : '-';

    return `
      <div class="poster-card" data-poster-id="${poster.id}">
        <div class="poster-card-top">
          <img src="${poster.publicUrl}" alt="${poster.fileName}" class="poster-card-image" loading="lazy" onclick="openProofModalDirect('${poster.publicUrl}', '${poster.fileName}')">
          <span class="poster-status-chip ${statusClass}">${statusLabel}</span>
          <button class="poster-delete-btn" onclick="deletePoster('${poster.id}')" title="Hapus Poster">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="poster-card-body">
          <div class="poster-title-text" title="${poster.fileName}">${poster.fileName}</div>
          <span class="poster-date-subline">${dateStr}</span>
        </div>
      </div>
    `;
  }).join('');
}

function initDropzone() {
  const dropzone = document.getElementById('posterDropzone');
  const fileInput = document.getElementById('filePosterInput');
  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFileUpload(fileInput.files[0]);
  });
}

async function handleFileUpload(file) {
  if (!file.type.match('image/(jpeg|jpg|png)')) {
    showToast('Hanya format JPG/JPEG dan PNG yang diperbolehkan!', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('poster', file);

  try {
    showToast('Mengunggah poster ke vault...', 'info');
    const res = await fetch('/api/posters/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (result.success) {
      showToast('Poster berhasil diunggah ke vault!', 'success');
      fetchPosters();
    } else {
      showToast(result.error || result.message || 'Gagal mengunggah poster.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan saat mengunggah.', 'error');
  }
}

async function deletePoster(posterId) {
  if (!confirm('Hapus poster ini dari Poster Vault?')) return;
  try {
    const res = await fetch(`/api/posters/${posterId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('Poster berhasil dihapus.', 'success');
      fetchPosters();
    } else {
      showToast('Gagal menghapus poster.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

/* ==========================================================================
   7. LAPORAN PUBLIKASI (5-COLUMN STANDARDIZED TABLE & AUDIT LOGS)
   ========================================================================== */
async function fetchAuditLogs(silent = false) {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    state.logs = data.data || [];

    const badge = document.getElementById('reportCountBadge');
    if (badge) badge.innerText = state.logs.length;

    const total = state.logs.length;
    const successCount = state.logs.filter(l => (l.status || '').toUpperCase() === 'SUCCESS').length;
    const failCount = total - successCount;
    const rate = total > 0 ? Math.round((successCount / total) * 100) : 100;

    const stripTotal = document.getElementById('stripTotalPublished');
    if (stripTotal) stripTotal.innerText = total;

    const stripRate = document.getElementById('stripSuccessRate');
    if (stripRate) stripRate.innerText = `${rate}%`;

    const stripFail = document.getElementById('stripTotalFailed');
    if (stripFail) stripFail.innerText = failCount;

    const stripTg = document.getElementById('stripTelegramSent');
    if (stripTg) stripTg.innerText = successCount;

    applyLogFilters();
  } catch (err) {
    if (!silent) console.error('Error fetching logs:', err);
  }
}

function initLogFilters() {
  const searchInput = document.getElementById('inputSearchLogs');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQueryLogs = e.target.value.toLowerCase().trim();
      applyLogFilters();
    });
  }

  const platformChips = document.querySelectorAll('[data-filter-platform]');
  platformChips.forEach(chip => {
    chip.addEventListener('click', () => {
      platformChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterPlatform = chip.dataset.filterPlatform;
      applyLogFilters();
    });
  });

  const statusChips = document.querySelectorAll('[data-filter-status]');
  statusChips.forEach(chip => {
    chip.addEventListener('click', () => {
      statusChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterStatus = chip.dataset.filterStatus;
      applyLogFilters();
    });
  });
}

function applyLogFilters() {
  let list = [...state.logs];

  if (state.filterPlatform !== 'ALL') {
    list = list.filter(l => l.platform.toUpperCase() === state.filterPlatform);
  }

  if (state.filterStatus === 'SUCCESS') {
    list = list.filter(l => (l.status || '').toUpperCase() === 'SUCCESS');
  } else if (state.filterStatus === 'FAILED') {
    list = list.filter(l => (l.status || '').toUpperCase() === 'FAILED');
  }

  if (state.searchQueryLogs) {
    list = list.filter(l => {
      const platMatch = (l.platform || '').toLowerCase().includes(state.searchQueryLogs);
      const sessMatch = (l.sessionType || '').toLowerCase().includes(state.searchQueryLogs);
      const urlMatch = (l.platformPostUrl || '').toLowerCase().includes(state.searchQueryLogs);
      return platMatch || sessMatch || urlMatch;
    });
  }

  state.filteredLogs = list;
  renderFullLogsTable();
}

function renderFullLogsTable() {
  const tbody = document.getElementById('tbodyFullLogs');
  if (!tbody) return;

  if (state.filteredLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-lg" style="text-align: center; padding: 40px 16px; color: var(--ink-400);">
          <i class="fa-solid fa-inbox fa-2x" style="margin-bottom: 8px;"></i><br>
          Tidak ada laporan publikasi yang cocok.
        </td>
      </tr>
    `;
    updateBulkBar();
    return;
  }

  tbody.innerHTML = state.filteredLogs.map(log => {
    const isSelected = state.selectedLogIds.has(log.id);
    const dateObj = new Date(log.executedAt || log.createdAt);
    
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('id-ID', options).formatToParts(dateObj);
    const h = parts.find(p => p.type === 'hour')?.value || '00';
    const m = parts.find(p => p.type === 'minute')?.value || '00';
    const s = parts.find(p => p.type === 'second')?.value || '00';
    const timeFormatted = `${h}.${m}.${s} WIB`;
    const dateFormatted = dateObj.toLocaleDateString('en-CA');

    let platIcon = 'fa-globe';
    let platClass = 'x';
    let platName = log.platform;
    if (log.platform.toUpperCase() === 'INSTAGRAM') { platIcon = 'fa-brands fa-instagram'; platClass = 'ig'; platName = 'Instagram'; }
    else if (log.platform.toUpperCase() === 'FACEBOOK') { platIcon = 'fa-brands fa-facebook'; platClass = 'fb'; platName = 'Facebook'; }
    else if (log.platform.toUpperCase() === 'X') { platIcon = 'fa-brands fa-x-twitter'; platClass = 'x'; platName = 'X (Twitter)'; }

    const postUrl = log.platformPostUrl || '';
    const isFailed = (log.status || '').toUpperCase() === 'FAILED';
    const mediaThumbUrl = log.screenshotUrl || (log.asset ? log.asset.publicUrl : null) || 'https://placehold.co/100x100/1e293b/6366f1?text=Foto';

    return `
      <tr class="${isSelected ? 'row-selected' : ''} ${isFailed ? 'row-failed' : ''}" data-log-id="${log.id}">
        <td style="text-align: center;">
          <input type="checkbox" class="check-log-item" data-id="${log.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td>
          <span class="plat-tag ${platClass}"><i class="${platIcon}"></i> ${platName}</span>
        </td>
        <td>
          <span class="session-tag">Sesi ${log.sessionType}</span>
        </td>
        <td>
          <div class="table-datetime-wrap">
            <span class="table-datetime-date">${dateFormatted}</span>
            <span class="table-datetime-time">${timeFormatted}</span>
          </div>
          ${isFailed ? `<div style="font-size: 0.72rem; color: var(--danger); margin-top: 2px;">[${log.errorCode || 'GAGAL'}] ${log.errorMessage ? log.errorMessage.slice(0, 45) + '...' : ''}</div>` : ''}
        </td>
        <td>
          ${postUrl ? `<a href="${postUrl}" target="_blank" class="post-permalink" title="${postUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${postUrl}</a>` : (isFailed ? `<span class="status-pill failed"><i class="fa-solid fa-triangle-exclamation"></i> Gagal</span>` : '<span class="status-pill published"><i class="fa-solid fa-check"></i> Terbit</span>')}
        </td>
        <td>
          <img src="${mediaThumbUrl}" alt="Foto Konten" class="table-media-thumb btn-view-proof" data-id="${log.id}">
        </td>
        <td style="text-align: right; white-space: nowrap;">
          ${isFailed ? `
            <button class="btn-secondary btn-retry-single-log" data-id="${log.id}" title="Publikasikan Ulang Sekarang" style="display: inline-flex; padding: 4px 8px; font-size: 0.75rem; margin-right: 4px; border-color: var(--primary); color: var(--primary);">
              <i class="fa-solid fa-rotate-right"></i> Coba Lagi
            </button>
          ` : `
            <button class="btn-icon-plain btn-view-proof" data-id="${log.id}" title="Lihat Pratinjau Foto" style="display: inline-flex; margin-right: 4px;">
              <i class="fa-regular fa-image"></i>
            </button>
          `}
          <button class="btn-icon-plain btn-delete-single-log" data-id="${log.id}" title="Hapus Laporan" style="display: inline-flex; color: var(--danger);">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachTableEventListeners();
  updateBulkBar();
}

function initCheckboxes() {
  const checkAll = document.getElementById('checkSelectAll');
  if (checkAll) {
    checkAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        state.filteredLogs.forEach(l => state.selectedLogIds.add(l.id));
      } else {
        state.selectedLogIds.clear();
      }
      renderFullLogsTable();
    });
  }

  const btnBulkDelete = document.getElementById('btnBulkDelete');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', handleBulkDelete);
  }

  const btnCancelSelection = document.getElementById('btnCancelSelection');
  if (btnCancelSelection) {
    btnCancelSelection.addEventListener('click', () => {
      state.selectedLogIds.clear();
      renderFullLogsTable();
    });
  }
}

function attachTableEventListeners() {
  document.querySelectorAll('.check-log-item').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        state.selectedLogIds.add(id);
      } else {
        state.selectedLogIds.delete(id);
      }
      renderFullLogsTable();
    });
  });

  document.querySelectorAll('.btn-view-proof').forEach(btn => {
    btn.addEventListener('click', () => openProofModal(btn.dataset.id));
  });

  document.querySelectorAll('.btn-delete-single-log').forEach(btn => {
    btn.addEventListener('click', () => deleteSingleLog(btn.dataset.id));
  });

  document.querySelectorAll('.btn-retry-single-log').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      showToast('Memulai publikasi ulang...', 'info');
      try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Proses...';
        const res = await fetch(`/api/logs/${id}/retry`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          showToast(result.message, 'success');
          fetchAuditLogs();
          fetchDashboardStats();
        } else {
          showToast(result.error || 'Gagal publikasi ulang.', 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Coba Lagi';
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Coba Lagi';
      }
    });
  });
}

function updateBulkBar() {
  const bar = document.getElementById('floatingBulkBar');
  const countEl = document.getElementById('selectedCountBadge');
  const count = state.selectedLogIds.size;

  if (countEl) countEl.innerText = count;

  if (bar) {
    if (count > 0) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  }
}

async function handleBulkDelete() {
  const ids = Array.from(state.selectedLogIds);
  if (ids.length === 0) return;

  if (!confirm(`Hapus ${ids.length} laporan publikasi yang dipilih?`)) return;

  try {
    showToast(`Menghapus ${ids.length} laporan...`, 'info');
    const res = await fetch('/api/logs/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      state.selectedLogIds.clear();
      fetchAuditLogs();
      fetchDashboardStats();
    } else {
      showToast('Gagal menghapus laporan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function deleteSingleLog(logId) {
  if (!confirm('Hapus laporan publikasi ini?')) return;
  try {
    const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('Laporan berhasil dihapus.', 'success');
      state.selectedLogIds.delete(logId);
      fetchAuditLogs();
      fetchDashboardStats();
    } else {
      showToast('Gagal menghapus laporan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

/* ==========================================================================
   8. ACTION BUTTONS & MODAL CONTROLS
   ========================================================================== */
function initActionButtons() {
  const btnClean = document.getElementById('btnCleanOffSchedule');
  if (btnClean) {
    btnClean.addEventListener('click', async () => {
      if (!confirm('Bersihkan seluruh hasil postingan uji coba di luar jam resmi?')) return;
      try {
        showToast('Membersihkan data uji coba...', 'info');
        const res = await fetch('/api/logs/delete-off-schedule', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          showToast(result.message, 'success');
          fetchAuditLogs();
          fetchDashboardStats();
        } else {
          showToast('Gagal membersihkan data.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      }
    });
  }

  const btnDeleteAll = document.getElementById('btnDeleteAllLogs');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', async () => {
      if (!confirm('PERINGATAN: Hapus SELURUH riwayat laporan publikasi?')) return;
      try {
        showToast('Mereset seluruh database laporan...', 'info');
        const res = await fetch('/api/logs', { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
          showToast('Seluruh riwayat berhasil dibersihkan!', 'success');
          state.selectedLogIds.clear();
          fetchAuditLogs();
          fetchDashboardStats();
          fetchPosters();
        } else {
          showToast(result.message || 'Gagal mereset log.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      }
    });
  }

  const btnResetDay = document.getElementById('btnResetDay');
  if (btnResetDay) {
    btnResetDay.addEventListener('click', async () => {
      if (!confirm('Reset status rotasi publikasi hari ini?')) return;
      try {
        showToast('Mereset status hari ini...', 'info');
        const res = await fetch('/api/logs/delete-off-schedule', { method: 'POST' });
        showToast('Status rotasi hari ini berhasil direset.', 'success');
        fetchDashboardStats();
      } catch (err) {
        showToast('Gagal mereset status.', 'error');
      }
    });
  }

  const btnCloseModal = document.getElementById('btnCloseProofModal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeProofModal);

  const modalOverlay = document.getElementById('modalProofPreview');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProofModal();
    });
  }

  const btnTestTg = document.getElementById('btnTestTgProof');
  if (btnTestTg) btnTestTg.addEventListener('click', testTelegramProof);

  const btnTestTgFromSettings = document.getElementById('btnTestTgProofFromSettings');
  if (btnTestTgFromSettings) btnTestTgFromSettings.addEventListener('click', testTelegramProof);

  const btnTestPing = document.getElementById('btnTestTgPingFromSettings');
  if (btnTestPing) btnTestPing.addEventListener('click', testTelegramPing);

  const btnSaveConfig = document.getElementById('btnSaveConfig');
  if (btnSaveConfig) btnSaveConfig.addEventListener('click', saveConfiguration);

  const btnSaveCredentials = document.getElementById('btnSaveConfigCredentials');
  if (btnSaveCredentials) btnSaveCredentials.addEventListener('click', saveConfiguration);

  const btnRefreshSchedule = document.getElementById('btnRefreshSchedule');
  if (btnRefreshSchedule) {
    btnRefreshSchedule.addEventListener('click', () => {
      fetchSchedulerStatus();
      fetchDashboardStats();
      showToast('Jadwal diperbarui.', 'info');
    });
  }
}

/* Custom Dispatch Modal Handling */
function initCustomDispatchModal() {
  const btnOpen = document.getElementById('btnOpenCustomDispatch');
  const modal = document.getElementById('modalCustomDispatch');
  const btnClose = document.getElementById('btnCloseCustomDispatchModal');
  const btnCancel = document.getElementById('btnCancelCustomDispatch');
  const btnSubmit = document.getElementById('btnSubmitCustomDispatch');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.add('active'));
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (btnSubmit && modal) {
    btnSubmit.addEventListener('click', async () => {
      const sessionType = document.getElementById('selectCustomSessionType').value;
      const platforms = [];
      if (document.getElementById('checkPlatIg').checked) platforms.push('INSTAGRAM');
      if (document.getElementById('checkPlatX').checked) platforms.push('X');
      if (document.getElementById('checkPlatFb').checked) platforms.push('FACEBOOK');

      if (platforms.length === 0) {
        showToast('Pilih minimal satu platform media sosial!', 'error');
        return;
      }

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses Eksekusi...';
        showToast(`Memulai publikasi Sesi ${sessionType} ke ${platforms.join(', ')}...`, 'info');

        const res = await fetch('/api/scheduler/dispatch-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionType, platforms })
        });
        const result = await res.json();

        if (result.success) {
          showToast(result.message || 'Publikasi sesi kustom berhasil diproses!', 'success');
          modal.classList.remove('active');
          fetchAuditLogs();
          fetchDashboardStats();
        } else {
          showToast(result.error || result.message || 'Gagal memproses sesi kustom.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Mulai Publikasi Sekarang</span>';
      }
    });
  }
}

/* Dynamic Session Duration Controls & Active Slider Sync */
function initSessionDurationControls() {
  const inputDuration = document.getElementById('inputSessionDuration');
  const sliderJitter = document.getElementById('sliderJitterMock');
  const displayDuration = document.getElementById('sessionDurationDisplay');
  const jitterRangeDisplay = document.getElementById('jitterRangeDisplay');

  function updateDuration(val) {
    if (isNaN(val) || val < 5) return;
    state.sessionDurationMinutes = val;
    if (inputDuration && parseInt(inputDuration.value, 10) !== val) inputDuration.value = val;
    if (sliderJitter && parseInt(sliderJitter.value, 10) !== val) sliderJitter.value = val;

    if (displayDuration) displayDuration.innerText = `${val} Menit`;
    if (jitterRangeDisplay) {
      const maxJitter = Math.floor(val * 0.95);
      jitterRangeDisplay.innerText = `Proporsional (0 – ${maxJitter} Menit)`;
    }

    updateScheduleTableRealtime();
    updateTimelineVisual();
  }

  if (inputDuration) {
    inputDuration.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      updateDuration(val);
    });
  }

  if (sliderJitter) {
    sliderJitter.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      updateDuration(val);
    });
  }
}

function openProofModal(logId) {
  const log = state.logs.find(l => l.id === logId);
  if (!log) return;

  state.activeProofLog = log;
  const modal = document.getElementById('modalProofPreview');
  const imgEl = document.getElementById('modalProofImg');
  const titleEl = document.getElementById('modalProofTitle');
  const captionEl = document.getElementById('modalProofCaption');

  const dateObj = new Date(log.executedAt || log.createdAt);
  const fullDateTime = dateObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
  const mediaUrl = log.screenshotUrl || (log.asset ? log.asset.publicUrl : null) || 'https://placehold.co/600x400/1e293b/6366f1?text=Foto+Konten';

  if (imgEl) imgEl.src = mediaUrl;
  if (titleEl) titleEl.innerText = `Bukti Publikasi: ${log.platform} (Sesi ${log.sessionType})`;
  if (captionEl) {
    captionEl.innerHTML = `
      <div><strong>Waktu Tayang:</strong> ${fullDateTime}</div>
      <div><strong>Tautan:</strong> ${log.platformPostUrl ? `<a href="${log.platformPostUrl}" target="_blank">${log.platformPostUrl}</a>` : 'Tidak ada tautan'}</div>
    `;
  }

  if (modal) modal.classList.add('active');
}

function openProofModalDirect(imgUrl, title) {
  const modal = document.getElementById('modalProofPreview');
  const imgEl = document.getElementById('modalProofImg');
  const titleEl = document.getElementById('modalProofTitle');
  const captionEl = document.getElementById('modalProofCaption');

  if (imgEl) imgEl.src = imgUrl;
  if (titleEl) titleEl.innerText = title;
  if (captionEl) captionEl.innerHTML = `<div><strong>Aset Vault:</strong> ${title}</div>`;

  if (modal) modal.classList.add('active');
}

function closeProofModal() {
  const modal = document.getElementById('modalProofPreview');
  if (modal) modal.classList.remove('active');
  state.activeProofLog = null;
}

/* ==========================================================================
   9. CONFIGURATION & CREDENTIALS
   ========================================================================== */
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (!data.data) return;

    const config = data.data;

    // Instagram
    if (config.accounts && config.accounts.instagram) {
      const igUser = config.accounts.instagram.username || '';
      document.getElementById('inputIgUsername').value = igUser;
      const linkIg = document.getElementById('linkIgProfile');
      if (linkIg) linkIg.href = igUser ? `https://instagram.com/${igUser}` : 'https://instagram.com/';
      const subIg = document.getElementById('igSubtitleText');
      if (subIg) subIg.innerText = igUser ? `@${igUser}` : 'Belum Terhubung';

      const badge = document.getElementById('badgeIgSession');
      if (badge) {
        badge.innerHTML = config.accounts.instagram.hasSavedSession ? '<i class="fa-solid fa-circle-check"></i> TERHUBUNG' : '<i class="fa-solid fa-circle-xmark"></i> BELUM LOGIN';
        badge.className = config.accounts.instagram.hasSavedSession ? 'session-status-badge active' : 'session-status-badge inactive';
      }
    }

    // X (Twitter)
    if (config.accounts && config.accounts.x) {
      const xUser = config.accounts.x.username || '';
      document.getElementById('inputXUsername').value = xUser;
      const linkX = document.getElementById('linkXProfile');
      if (linkX) linkX.href = xUser ? `https://x.com/${xUser}` : 'https://x.com/';
      const subX = document.getElementById('xSubtitleText');
      if (subX) subX.innerText = xUser ? `@${xUser}` : 'Belum Terhubung';

      const badge = document.getElementById('badgeXSession');
      if (badge) {
        badge.innerHTML = config.accounts.x.hasSavedSession ? '<i class="fa-solid fa-circle-check"></i> TERHUBUNG' : '<i class="fa-solid fa-circle-xmark"></i> BELUM LOGIN';
        badge.className = config.accounts.x.hasSavedSession ? 'session-status-badge active' : 'session-status-badge inactive';
      }
    }

    // Facebook
    if (config.accounts && config.accounts.facebook) {
      const fbEmail = config.accounts.facebook.email || '';
      document.getElementById('inputFbEmail').value = fbEmail;
      const linkFb = document.getElementById('linkFbProfile');
      if (linkFb) linkFb.href = 'https://facebook.com/me';
      const subFb = document.getElementById('fbSubtitleText');
      if (subFb) subFb.innerText = fbEmail ? fbEmail : 'Belum Terhubung';

      const badge = document.getElementById('badgeFbSession');
      if (badge) {
        badge.innerHTML = config.accounts.facebook.hasSavedSession ? '<i class="fa-solid fa-circle-check"></i> TERHUBUNG' : '<i class="fa-solid fa-circle-xmark"></i> BELUM LOGIN';
        badge.className = config.accounts.facebook.hasSavedSession ? 'session-status-badge active' : 'session-status-badge inactive';
      }
    }

    // Telegram
    if (config.telegram) {
      document.getElementById('inputTgChat').value = config.telegram.chatId || '';
      const tgLabel = document.getElementById('tgBotLabel');
      if (tgLabel) {
        tgLabel.innerText = config.telegram.hasBotToken ? 'Bot Telegram Terhubung' : 'Bot Telegram Belum Disetel';
      }
    }

    // Session Duration
    if (config.sessionWindowDurationMinutes) {
      state.sessionDurationMinutes = config.sessionWindowDurationMinutes;
      const inputDuration = document.getElementById('inputSessionDuration');
      const sliderJitter = document.getElementById('sliderJitterMock');
      if (inputDuration) inputDuration.value = config.sessionWindowDurationMinutes;
      if (sliderJitter) sliderJitter.value = config.sessionWindowDurationMinutes;
      if (inputDuration) inputDuration.dispatchEvent(new Event('input'));
    }
  } catch (err) {
    console.error('Error fetching config:', err);
  }
}

async function saveConfiguration() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const payload = {
    igUsername: getVal('inputIgUsername'),
    igPassword: getVal('inputIgPassword'),
    fbEmail: getVal('inputFbEmail'),
    fbPassword: getVal('inputFbPassword'),
    xUsername: getVal('inputXUsername'),
    xPassword: getVal('inputXPassword'),
    tgToken: getVal('inputTgToken'),
    tgChatId: getVal('inputTgChat'),
    sessionWindowDurationMinutes: parseInt(getVal('inputSessionDuration'), 10) || 30,
  };

  try {
    showToast('Menyimpan konfigurasi...', 'info');
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Konfigurasi akun, kredensial & durasi sesi berhasil disimpan!', 'success');
      fetchConfig();
    } else {
      showToast(result.message || 'Gagal menyimpan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan saat menyimpan konfigurasi.', 'error');
  }
}

async function testTelegramPing() {
  try {
    showToast('Menguji koneksi ke Bot Telegram...', 'info');
    const res = await fetch('/api/test-telegram', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(`Berhasil terhubung ke bot ${result.botName || 'Telegram'}!`, 'success');
    } else {
      showToast(result.error || 'Gagal menghubungkan bot Telegram.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat ping Telegram.', 'error');
  }
}

async function testTelegramProof() {
  try {
    showToast('Mengirim bukti laporan postingan foto ke Telegram...', 'info');
    const res = await fetch('/api/telegram/test-proof', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(result.message || 'Bukti foto laporan berhasil terkirim ke Telegram!', 'success');
    } else {
      showToast(result.error || 'Gagal mengirim bukti ke Telegram.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

function initPasswordToggles() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-toggle-pwd');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    btn.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    btn.setAttribute('title', isPwd ? 'Sembunyikan Password' : 'Tampilkan Password');
  });
}

/* ==========================================================================
   10. TOAST NOTIFICATION ENGINE
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  let cleanMessage = String(message || '');
  if (cleanMessage.includes('ECONNRESET') || cleanMessage.includes('read ECONNRESET') || cleanMessage.includes('socket hang up')) {
    cleanMessage = 'Koneksi Jaringan Terputus (ECONNRESET) — Silakan periksa koneksi internet atau coba beberapa saat lagi.';
  } else if (cleanMessage.includes('ETIMEDOUT')) {
    cleanMessage = 'Koneksi Waktu Habis (ETIMEDOUT) — Server tidak merespons tepat waktu.';
  } else if (cleanMessage.includes('ENOTFOUND')) {
    cleanMessage = 'Domain Tidak Ditemukan (ENOTFOUND) — Periksa koneksi internet Anda.';
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-solid fa-circle-info';
  if (type === 'success') icon = 'fa-solid fa-circle-check text-success';
  if (type === 'error') icon = 'fa-solid fa-triangle-exclamation text-danger';

  toast.innerHTML = `
    <i class="${icon}"></i>
    <span>${cleanMessage}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
