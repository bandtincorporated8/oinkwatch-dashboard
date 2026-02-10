#!/usr/bin/env python3
"""
🐷 OinkWatch Dashboard
Real-time visibility into your OpenClaw agent
"""

from flask import Flask, render_template, jsonify
import os
import json
from datetime import datetime
from pathlib import Path

app = Flask(__name__)

# Paths
WORKSPACE = Path.home() / ".openclaw" / "workspace"
MEMORY_DIR = WORKSPACE / "memory"

@app.route("/")
def index():
    """Main dashboard view"""
    return render_template("dashboard.html")

@app.route("/api/status")
def api_status():
    """Get current agent status"""
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "workspace": str(WORKSPACE),
        "memory_files": len(list(MEMORY_DIR.glob("*.md"))) if MEMORY_DIR.exists() else 0
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

@app.route("/api/cron")
def api_cron():
    """Get cron job status from OpenClaw"""
    # Will integrate with actual cron data
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

if __name__ == "__main__":
    app.run(debug=True, port=5001)
