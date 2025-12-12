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
        this.latencyStartTime = null;
    }
    
    /**
     * Initialize UI elements
     */
    initialize() {
        // Get all UI elements
        this.elements = {
            // Config inputs
            openaiKeyInput: document.getElementById('openaiKey'),
            porcupineKeyInput: document.getElementById('porcupineKey'),
            saveConfigBtn: document.getElementById('saveConfig'),
            apiConfig: document.getElementById('apiConfig'),
            
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
        
        // Load saved keys
        this.loadSavedKeys();
        
        // Enable start button if configured
        if (config.isConfigured()) {
            this.elements.startBtn.disabled = false;
            this.elements.apiConfig.style.display = 'none';
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('UI initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Save configuration
        this.elements.saveConfigBtn.addEventListener('click', () => {
            this.saveConfiguration();
        });
        
        // Toggle debug with Ctrl+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
    }
    
    /**
     * Load saved API keys
     */
    loadSavedKeys() {
        if (config.getOpenAIKey()) {
            this.elements.openaiKeyInput.value = config.getOpenAIKey();
        }
        if (config.getPicovoiceKey()) {
            this.elements.porcupineKeyInput.value = config.getPicovoiceKey();
        }
    }
    
    /**
     * Save configuration
     */
    saveConfiguration() {
        const openaiKey = this.elements.openaiKeyInput.value.trim();
        const porcupineKey = this.elements.porcupineKeyInput.value.trim();
        
        if (!openaiKey) {
            alert('Please enter an OpenAI API key');
            return;
        }
        
        config.setOpenAIKey(openaiKey);
        if (porcupineKey) {
            config.setPicovoiceKey(porcupineKey);
        }
        
        this.elements.startBtn.disabled = false;
        this.elements.apiConfig.style.display = 'none';
        
        this.showInfo('Configuration saved successfully!');
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
        
        // Start latency timer on processing
        if (status === 'processing') {
            this.latencyStartTime = Date.now();
        }
    }
    
    /**
     * Update latency display
     */
    updateLatency() {
        if (!this.latencyStartTime) return;
        
        const latency = Date.now() - this.latencyStartTime;
        this.elements.latencyValue.textContent = `${latency} ms`;
        
        // Color code based on target
        this.elements.latencyValue.className = 'latency-value';
        if (latency > config.latency.criticalMs) {
            this.elements.latencyValue.classList.add('very-slow');
        } else if (latency > config.latency.warningMs) {
            this.elements.latencyValue.classList.add('slow');
        }
        
        this.latencyStartTime = null;
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
    }
    
    /**
     * Log to debug console
     */
    log(message, type = 'info') {
        if (!this.debugEnabled) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-entry debug-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        this.elements.debugBox.appendChild(entry);
        this.elements.debugBox.scrollTop = this.elements.debugBox.scrollHeight;
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