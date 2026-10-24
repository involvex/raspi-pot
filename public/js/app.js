// Core Application Logic
const token = localStorage.getItem('token');

// Auth Check
if (!token && !window.location.pathname.includes('login.html')) {
  window.location.href = '/login.html';
}

// Socket Initialization
const socket = io({
  auth: { token },
});

const elements = {
  cpuVal: document.getElementById('cpuVal'),
  cpuBar: document.getElementById('cpuBar'),
  memVal: document.getElementById('memVal'),
  memBar: document.getElementById('memBar'),
  memTotal: document.getElementById('memTotal'),
  memUsed: document.getElementById('memUsed'),
  tempVal: document.getElementById('tempVal'),
  tempStatus: document.getElementById('tempStatus'),
  diskVal: document.getElementById('diskVal'),
  diskBar: document.getElementById('diskBar'),
  ipList: document.getElementById('ipList'),
  uptimeVal: document.getElementById('uptimeVal'),
  netDown: document.getElementById('netDown'),
  netUp: document.getElementById('netUp'),
  status: document.getElementById('connectionStatus'),
};

socket.on('connect', () => {
  if (elements.status) {
    elements.status.innerHTML =
      '<span class="material-icons text-success" style="font-size: 1rem;">check_circle</span> Live';
  }
});

socket.on('disconnect', () => {
  if (elements.status) {
    elements.status.innerHTML =
      '<span class="material-icons text-danger" style="font-size: 1rem;">error</span> Offline';
  }
});

socket.on('telemetry:stats', data => {
  updateTelemetry(data);
});

function updateTelemetry(data) {
  if (elements.cpuVal) {
    elements.cpuVal.textContent = data.cpu;
    elements.cpuBar.style.width = data.cpu + '%';
  }

  if (elements.memVal) {
    elements.memVal.textContent = data.mem;
    elements.memBar.style.width = data.mem + '%';
    elements.memBar.style.backgroundColor = data.mem > 85 ? 'var(--danger)' : 'var(--success)';
    if (elements.memTotal) elements.memTotal.textContent = data.mem_total;
    if (elements.memUsed) elements.memUsed.textContent = data.mem_used;
  }

  if (elements.tempVal) {
    elements.tempVal.textContent = Math.round(data.temp);
    if (elements.tempStatus) {
      elements.tempStatus.textContent =
        data.temp > 70 ? 'High' : data.temp > 60 ? 'Warning' : 'Optimal';
      elements.tempStatus.className =
        data.temp > 70 ? 'text-danger' : data.temp > 60 ? 'text-warning' : 'text-success';
    }
  }

  if (elements.diskVal) {
    const used = parseFloat(data.disk_used);
    const total = parseFloat(data.disk_total);
    const percent = Math.round((used / total) * 100) || 0;
    elements.diskVal.textContent = percent;
    elements.diskBar.style.width = percent + '%';
  }

  if (elements.uptimeVal && data.uptime) {
    elements.uptimeVal.textContent = formatUptime(data.uptime);
  }

  if (elements.netDown && data.net_down) elements.netDown.textContent = data.net_down;
  if (elements.netUp && data.net_up) elements.netUp.textContent = data.net_up;

  if (elements.ipList && data.ips) {
    elements.ipList.innerHTML =
      data.ips
        .map(ip => `<span class="ip-tag"><span class="iface">${ip.iface}:</span>${ip.ip}</span>`)
        .join('') || '<span class="ip-tag disconnected">Disconnected</span>';
  }
}

function formatUptime(s) {
  if (!s) return '0d 00:00:00';
  const d = Math.floor(s / (3600 * 24));
  const h = Math.floor((s % (3600 * 24)) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  });
}

// Mobile Navigation Logic
function initMobileNav() {
  const aside = document.querySelector('aside');
  const toggle = document.createElement('button');
  toggle.className = 'menu-toggle';
  toggle.innerHTML = '<span class="material-icons">menu</span>';
  toggle.setAttribute('aria-label', 'Toggle Navigation');
  document.body.appendChild(toggle);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);

  function toggleMenu() {
    aside.classList.toggle('open');
    overlay.classList.toggle('active');
    toggle.innerHTML = aside.classList.contains('open')
      ? '<span class="material-icons">close</span>'
      : '<span class="material-icons">menu</span>';
  }

  toggle.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);

  // Close menu when clicking nav items on mobile
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1024) toggleMenu();
    });
  });
}

document.addEventListener('DOMContentLoaded', initMobileNav);
