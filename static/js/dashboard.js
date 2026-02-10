/**
 * 🐷 OinkWatch Dashboard JavaScript
 * Real-time updates and interactions with WebSocket support
 */

// API Endpoints
const API = {
    status: '/api/status',
    memory: '/api/memory',
    memoryContent: (name) => `/api/memory/${encodeURIComponent(name)}`,
    cron: '/api/cron',
    git: '/api/git',
    nightproject: '/api/nightproject'
};

// WebSocket connection
let socket;
let isConnected = false;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupEventListeners();
    initWebSocket();
});

async function initDashboard() {
    await Promise.all([
        loadStatus(),
        loadMemory(),
        loadCronJobs(),
        loadGitActivity()
    ]);
    initActivityChart();
    updateTimestamp();
}

function initWebSocket() {
    socket = io();
    
    socket.on('connect', () => {
        isConnected = true;
        document.getElementById('ws-status').textContent = '⚡ Live';
        document.getElementById('ws-status').style.color = 'var(--success)';
        console.log('🐷 WebSocket connected');
    });
    
    socket.on('disconnect', () => {
        isConnected = false;
        document.getElementById('ws-status').textContent = '⚠️ Offline';
        document.getElementById('ws-status').style.color = 'var(--warning)';
        console.log('🐷 WebSocket disconnected');
    });
    
    socket.on('stats_update', (stats) => {
        updateStatsDisplay(stats);
        updateTimestamp();
    });
    
    socket.on('status', (data) => {
        console.log('Server status:', data.message);
    });
}

function setupEventListeners() {
    document.getElementById('refresh-memories').addEventListener('click', loadMemory);
    document.getElementById('memory-search').addEventListener('input', debounce(searchMemories, 300));
    document.getElementById('view-nightproject').addEventListener('click', viewNightProject);
    
    // Modal close handlers
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('memory-modal').addEventListener('click', (e) => {
        if (e.target.id === 'memory-modal') closeModal();
    });
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

async function loadStatus() {
    try {
        const response = await fetch(API.status);
        const data = await response.json();
        
        document.getElementById('status-text').textContent = 'Online';
        
        if (data.stats) {
            updateStatsDisplay(data.stats);
        }
        
        console.log('🐷 Status loaded:', data);
    } catch (error) {
        console.error('Failed to load status:', error);
        document.getElementById('status-text').textContent = 'Offline';
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('stat-files').textContent = stats.total_files || 0;
    document.getElementById('stat-dirs').textContent = stats.total_dirs || 0;
    document.getElementById('stat-memory').textContent = stats.memory_count || 0;
    document.getElementById('stat-size').textContent = stats.project_size_mb || 0;
}

async function loadMemory() {
    try {
        const response = await fetch(API.memory);
        const memories = await response.json();
        
        renderMemoryList(memories);
        console.log('🧠 Memories loaded:', memories.length);
    } catch (error) {
        console.error('Failed to load memories:', error);
        document.getElementById('memory-list').innerHTML = 
            '<div class="loading">Failed to load memories</div>';
    }
}

function renderMemoryList(memories) {
    const container = document.getElementById('memory-list');
    
    if (memories.length === 0) {
        container.innerHTML = '<div class="loading">No memories found</div>';
        return;
    }
    
    container.innerHTML = memories.map(m => `
        <div class="memory-item" data-name="${m.name.toLowerCase()}" onclick="viewMemory('${m.name}')">
            <div>
                <div class="memory-name">📄 ${m.name}</div>
                <div class="memory-meta">${formatBytes(m.size)} • ${formatDate(m.modified)}</div>
            </div>
        </div>
    `).join('');
}

async function viewMemory(filename) {
    try {
        const response = await fetch(API.memoryContent(filename));
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading memory:', data.error);
            return;
        }
        
        showModal(filename, data.content);
    } catch (error) {
        console.error('Failed to load memory content:', error);
    }
}

async function viewNightProject() {
    try {
        const response = await fetch(API.nightproject);
        const data = await response.json();
        
        if (!data.exists) {
            showModal('Night Project', 'No night project file found.');
            return;
        }
        
        showModal('🐷 Night Project', data.content);
    } catch (error) {
        console.error('Failed to load night project:', error);
    }
}

function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').textContent = content;
    document.getElementById('memory-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('memory-modal').classList.remove('active');
    document.body.style.overflow = '';
}

async function loadCronJobs() {
    try {
        const response = await fetch(API.cron);
        const data = await response.json();
        
        renderCronList(data.jobs);
        console.log('⏰ Cron jobs loaded:', data.jobs.length);
    } catch (error) {
        console.error('Failed to load cron jobs:', error);
    }
}

function renderCronList(jobs) {
    const container = document.getElementById('cron-list');
    
    if (!jobs || jobs.length === 0) {
        container.innerHTML = '<div class="loading">No cron jobs found</div>';
        return;
    }
    
    container.innerHTML = jobs.map(job => {
        const lastRun = job.last_run ? formatTimestamp(job.last_run) : 'Never';
        const errorBadge = job.consecutive_errors > 0 
            ? `<span style="color: var(--error); margin-left: 0.5rem;">⚠️ ${job.consecutive_errors} errors</span>` 
            : '';
        
        return `
        <div class="cron-item">
            <div>
                <div class="cron-name">⚙️ ${job.name}</div>
                <div class="cron-schedule">${job.schedule} • Last: ${lastRun}${errorBadge}</div>
            </div>
            <span class="cron-status ${job.status}">${job.status}</span>
        </div>
    `}).join('');
}

async function loadGitActivity() {
    try {
        const response = await fetch(API.git);
        const data = await response.json();
        
        renderGitList(data.commits);
        console.log('🔀 Git activity loaded:', data.commits?.length || 0);
    } catch (error) {
        console.error('Failed to load git activity:', error);
    }
}

function renderGitList(commits) {
    const container = document.getElementById('git-list');
    
    if (!commits || commits.length === 0) {
        container.innerHTML = '<div class="loading">No commits found</div>';
        return;
    }
    
    container.innerHTML = commits.map(c => `
        <div class="git-item">
            <div style="display: flex; align-items: center; flex: 1;">
                <span class="git-hash">${c.hash}</span>
                <span class="git-message" title="${c.message}">${truncate(c.message, 40)}</span>
            </div>
            <span class="git-time">${c.time}</span>
        </div>
    `).join('');
}

function searchMemories(e) {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.memory-item');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

function initActivityChart() {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    // Sample data - will be replaced with real data
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Agent Activity',
                data: [12, 19, 8, 25, 32, 15],
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#e6edf3' }
                }
            },
            scales: {
                x: {
                    grid: { color: '#30363d' },
                    ticks: { color: '#8b949e' }
                },
                y: {
                    grid: { color: '#30363d' },
                    ticks: { color: '#8b949e' }
                }
            }
        }
    });
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('update-time').textContent = 
        `Last updated: ${now.toLocaleTimeString()}`;
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatTimestamp(ms) {
    if (!ms || ms < 1000000000) return 'Never';
    const date = new Date(ms);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

function truncate(str, length) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
