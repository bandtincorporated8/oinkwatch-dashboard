/**
 * 🐷 OinkWatch Dashboard JavaScript
 * Real-time updates and interactions
 */

// API Endpoints
const API = {
    status: '/api/status',
    memory: '/api/memory',
    cron: '/api/cron'
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupEventListeners();
    startPolling();
});

async function initDashboard() {
    await loadStatus();
    await loadMemory();
    await loadCronJobs();
    initActivityChart();
}

function setupEventListeners() {
    document.getElementById('refresh-memories').addEventListener('click', loadMemory);
    document.getElementById('memory-search').addEventListener('input', debounce(searchMemories, 300));
}

async function loadStatus() {
    try {
        const response = await fetch(API.status);
        const data = await response.json();
        
        document.getElementById('status-text').textContent = 'Online';
        document.getElementById('memory-count').textContent = data.memory_files;
        document.getElementById('uptime').textContent = 'Active';
        
        console.log('🐷 Status loaded:', data);
    } catch (error) {
        console.error('Failed to load status:', error);
        document.getElementById('status-text').textContent = 'Offline';
    }
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
        <div class="memory-item" data-name="${m.name.toLowerCase()}">
            <div>
                <div class="memory-name">📄 ${m.name}</div>
                <div class="memory-meta">${formatBytes(m.size)} • ${formatDate(m.modified)}</div>
            </div>
        </div>
    `).join('');
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
    
    container.innerHTML = jobs.map(job => `
        <div class="cron-item">
            <div>
                <div class="cron-name">⚙️ ${job.name}</div>
                <div class="cron-schedule">${job.schedule}</div>
            </div>
            <span class="cron-status ${job.status}">${job.status}</span>
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

function startPolling() {
    // Refresh data every 30 seconds
    setInterval(() => {
        loadStatus();
        loadMemory();
        loadCronJobs();
    }, 30000);
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
