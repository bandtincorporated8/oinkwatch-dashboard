#!/usr/bin/env python3
"""
🐷 OinkWatch Dashboard
Real-time visibility into your OpenClaw agent
"""

from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import os
import json
import subprocess
from datetime import datetime
from pathlib import Path

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oinkwatch-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Paths
WORKSPACE = Path.home() / ".openclaw" / "workspace"
MEMORY_DIR = WORKSPACE / "memory"
NIGHTPROJECT = WORKSPACE / "nightproject.md"

def run_openclaw_cron_list():
    """Fetch real cron jobs from OpenClaw"""
    try:
        result = subprocess.run(
            ['openclaw', 'cron', 'list'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception as e:
        print(f"Cron fetch error: {e}")
    return None

def get_git_commits():
    """Get recent git commits for the dashboard repo"""
    try:
        dashboard_dir = WORKSPACE / "oinkwatch-dashboard"
        result = subprocess.run(
            ['git', 'log', '--oneline', '-10', '--pretty=format:%h|%s|%ar'],
            capture_output=True,
            text=True,
            cwd=dashboard_dir,
            timeout=5
        )
        if result.returncode == 0:
            commits = []
            for line in result.stdout.strip().split('\n'):
                if '|' in line:
                    parts = line.split('|', 2)
                    commits.append({
                        'hash': parts[0],
                        'message': parts[1],
                        'time': parts[2]
                    })
            return commits
    except Exception as e:
        print(f"Git fetch error: {e}")
    return []

def get_workspace_stats():
    """Get overall workspace statistics"""
    stats = {
        'total_files': 0,
        'total_dirs': 0,
        'memory_count': 0,
        'project_size_mb': 0
    }
    try:
        if WORKSPACE.exists():
            for item in WORKSPACE.rglob('*'):
                if item.is_file():
                    stats['total_files'] += 1
                    stats['project_size_mb'] += item.stat().st_size
                elif item.is_dir():
                    stats['total_dirs'] += 1
            stats['memory_count'] = len(list(MEMORY_DIR.glob('*.md'))) if MEMORY_DIR.exists() else 0
            stats['project_size_mb'] = round(stats['project_size_mb'] / (1024 * 1024), 2)
    except Exception as e:
        print(f"Stats error: {e}")
    return stats

@app.route("/")
def index():
    """Main dashboard view"""
    return render_template("dashboard.html")

@app.route("/api/status")
def api_status():
    """Get current agent status"""
    stats = get_workspace_stats()
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "workspace": str(WORKSPACE),
        "stats": stats
    })

@app.route("/api/memory")
def api_memory():
    """List all memory files with metadata"""
    memories = []
    if MEMORY_DIR.exists():
        for f in sorted(MEMORY_DIR.glob("*.md"), reverse=True):
            stat = f.stat()
            memories.append({
                "name": f.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "path": str(f)
            })
    return jsonify(memories)

@app.route("/api/memory/<path:filename>")
def api_memory_content(filename):
    """Get content of a specific memory file"""
    try:
        file_path = MEMORY_DIR / filename
        if file_path.exists() and file_path.is_file():
            with open(file_path, 'r') as f:
                content = f.read()
            return jsonify({
                "name": filename,
                "content": content,
                "size": len(content)
            })
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/cron")
def api_cron():
    """Get real cron jobs from OpenClaw"""
    cron_data = run_openclaw_cron_list()
    if cron_data and 'jobs' in cron_data:
        jobs = []
        for job in cron_data['jobs']:
            schedule_str = "Unknown"
            if job.get('schedule', {}).get('kind') == 'every':
                every_ms = job['schedule'].get('everyMs', 0)
                minutes = every_ms // 60000
                schedule_str = f"Every {minutes} minutes"
            
            state = job.get('state', {})
            jobs.append({
                "id": job.get('id', 'unknown'),
                "name": job.get('name', 'Unnamed'),
                "schedule": schedule_str,
                "status": "active" if job.get('enabled', False) else "paused",
                "last_run": state.get('lastRunAtMs', 0),
                "next_run": state.get('nextRunAtMs', 0),
                "consecutive_errors": state.get('consecutiveErrors', 0)
            })
        return jsonify({"jobs": jobs})
    
    # Fallback mock data
    return jsonify({
        "jobs": [
            {
                "name": "OinkWatch-Background-Sync",
                "schedule": "Every 30 minutes",
                "status": "active",
                "last_run": "Just now"
            }
        ]
    })

@app.route("/api/git")
def api_git():
    """Get git activity"""
    return jsonify({
        "commits": get_git_commits(),
        "repo": "oinkwatch-dashboard",
        "branch": "master"
    })

@app.route("/api/nightproject")
def api_nightproject():
    """Get nightproject.md content"""
    try:
        if NIGHTPROJECT.exists():
            with open(NIGHTPROJECT, 'r') as f:
                content = f.read()
            return jsonify({
                "exists": True,
                "content": content,
                "last_modified": datetime.fromtimestamp(NIGHTPROJECT.stat().st_mtime).isoformat()
            })
    except Exception as e:
        return jsonify({"exists": False, "error": str(e)})
    return jsonify({"exists": False})

# WebSocket events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    emit('status', {'message': 'Connected to OinkWatch'})
    # Broadcast current status
    stats = get_workspace_stats()
    emit('stats_update', stats)

@socketio.on('request_update')
def handle_update_request():
    """Handle manual update request"""
    stats = get_workspace_stats()
    emit('stats_update', stats)

def broadcast_updates():
    """Broadcast updates to all connected clients"""
    while True:
        socketio.sleep(10)  # Update every 10 seconds
        stats = get_workspace_stats()
        socketio.emit('stats_update', stats)

if __name__ == "__main__":
    socketio.run(app, debug=True, port=5001, use_reloader=False)
