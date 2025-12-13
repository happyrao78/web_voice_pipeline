/**
 * UI Controller
 * Manages user interface state and updates
 */

import config from '../config.js';

class UIController {
    constructor() {
        this.elements = {};
        this.debugEnabled = false;
        this.currentStatus = 'idle';
    }
    
    /**
     * Initialize UI elements
     */
    initialize() {
        // Get all UI elements
        this.elements = {
            // Control buttons
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            
            // Status display
            statusBadge: document.getElementById('statusBadge'),
            statusText: document.querySelector('.status-text'),
            latencyIndicator: document.getElementById('latencyIndicator'),
            latencyValue: document.querySelector('.latency-value'),
            
            // Transcript and response
            transcriptBox: document.getElementById('transcriptBox'),
            responseBox: document.getElementById('responseBox'),
            
            // Debug
            debugSection: document.getElementById('debugSection'),
            debugBox: document.getElementById('debugBox')
        };
        
        // Enable start button (no API keys needed in browser)
        this.elements.startBtn.disabled = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('UI initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Toggle debug with Ctrl+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
    }
    
    /**
     * Update status
     */
    setStatus(status) {
        this.currentStatus = status;
        
        // Update badge
        this.elements.statusBadge.className = 'status-badge ' + status;
        
        // Update text
        const statusTexts = {
            'idle': 'Idle',
            'listening': 'Listening for Wake Word',
            'processing': 'Processing',
            'speaking': 'Speaking'
        };
        
        this.elements.statusText.textContent = statusTexts[status] || status;
    }
    
    /**
     * Update latency display
     */
    updateLatency(latencyMs) {
        this.elements.latencyValue.textContent = `${latencyMs} ms`;
        
        // Color code based on target
        this.elements.latencyValue.className = 'latency-value';
        if (latencyMs > config.latency.criticalMs) {
            this.elements.latencyValue.classList.add('very-slow');
        } else if (latencyMs > config.latency.warningMs) {
            this.elements.latencyValue.classList.add('slow');
        }
    }
    
    /**
     * Reset latency display
     */
    resetLatency() {
        this.elements.latencyValue.textContent = '-- ms';
        this.elements.latencyValue.className = 'latency-value';
    }
    
    /**
     * Show partial transcript
     */
    showPartialTranscript(text) {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-partial">${this.escapeHtml(text)}</div>
        `;
    }
    
    /**
     * Show final transcript
     */
    showFinalTranscript(text) {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-final">${this.escapeHtml(text)}</div>
        `;
    }
    
    /**
     * Show response
     */
    showResponse(text) {
        this.elements.responseBox.innerHTML = `
            <div class="response-text">${this.escapeHtml(text)}</div>
        `;
    }
    
    /**
     * Clear transcript
     */
    clearTranscript() {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-placeholder">Waiting for wake word...</div>
        `;
    }
    
    /**
     * Clear response
     */
    clearResponse() {
        this.elements.responseBox.innerHTML = `
            <div class="response-placeholder">No response yet</div>
        `;
    }
    
    /**
     * Enable/disable controls
     */
    setControlsEnabled(started) {
        this.elements.startBtn.disabled = started;
        this.elements.stopBtn.disabled = !started;
    }
    
    /**
     * Show info message
     */
    showInfo(message) {
        this.log(message, 'info');
    }
    
    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        this.log(message, 'error');
        alert(message);
    }
    
    /**
     * Toggle debug console
     */
    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        this.elements.debugSection.style.display = 
            this.debugEnabled ? 'block' : 'none';
        
        if (this.debugEnabled) {
            this.log('Debug console enabled', 'info');
        }
    }
    
    /**
     * Log to debug console
     */
    log(message, type = 'info') {
        // Always log to console
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
        
        // Only show in debug if enabled
        if (!this.debugEnabled) return;
        
        const entry = document.createElement('div');
        entry.className = `debug-entry debug-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        this.elements.debugBox.appendChild(entry);
        
        // Auto-scroll to bottom
        this.elements.debugBox.scrollTop = this.elements.debugBox.scrollHeight;
        
        // Limit debug entries to 100
        while (this.elements.debugBox.children.length > 100) {
            this.elements.debugBox.removeChild(this.elements.debugBox.firstChild);
        }
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Get elements for event binding
     */
    getElements() {
        return this.elements;
    }
}

export default UIController;