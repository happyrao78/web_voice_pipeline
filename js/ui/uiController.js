import config from '../config.js';

class UIController {
    constructor() {
        this.elements = {};
        this.debugEnabled = false;
        this.currentStatus = 'idle';
    }
    

    initialize() {
        
        this.elements = {
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            
            statusBadge: document.getElementById('statusBadge'),
            statusText: document.querySelector('.status-text'),
            latencyIndicator: document.getElementById('latencyIndicator'),
            latencyValue: document.querySelector('.latency-value'),
            
            transcriptBox: document.getElementById('transcriptBox'),
            responseBox: document.getElementById('responseBox'),
            
            debugSection: document.getElementById('debugSection'),
            debugBox: document.getElementById('debugBox')
        };
        
        this.elements.startBtn.disabled = false;
        
    
        this.setupEventListeners();
        
        console.log('UI initialized');
    }
    

    setupEventListeners() {
    
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
    }
    

    setStatus(status) {
        this.currentStatus = status;
        
        this.elements.statusBadge.className = 'status-badge ' + status;
        
        
        const statusTexts = {
            'idle': 'Idle',
            'listening': 'Listening for Wake Word',
            'processing': 'Processing',
            'speaking': 'Speaking'
        };
        
        this.elements.statusText.textContent = statusTexts[status] || status;
    }

    updateLatency(latencyMs) {
        this.elements.latencyValue.textContent = `${latencyMs} ms`;
        
        
        this.elements.latencyValue.className = 'latency-value';
        if (latencyMs > config.latency.criticalMs) {
            this.elements.latencyValue.classList.add('very-slow');
        } else if (latencyMs > config.latency.warningMs) {
            this.elements.latencyValue.classList.add('slow');
        }
    }
    

    resetLatency() {
        this.elements.latencyValue.textContent = '-- ms';
        this.elements.latencyValue.className = 'latency-value';
    }
    

    showPartialTranscript(text) {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-partial">${this.escapeHtml(text)}</div>
        `;
    }
    

    showFinalTranscript(text) {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-final">${this.escapeHtml(text)}</div>
        `;
    }
    
 
    showResponse(text) {
        this.elements.responseBox.innerHTML = `
            <div class="response-text">${this.escapeHtml(text)}</div>
        `;
    }

    clearTranscript() {
        this.elements.transcriptBox.innerHTML = `
            <div class="transcript-placeholder">Waiting for wake word...</div>
        `;
    }

    clearResponse() {
        this.elements.responseBox.innerHTML = `
            <div class="response-placeholder">No response yet</div>
        `;
    }
    
    setControlsEnabled(started) {
        this.elements.startBtn.disabled = started;
        this.elements.stopBtn.disabled = !started;
    }
    

    showInfo(message) {
        this.log(message, 'info');
    }
    

    showError(message) {
        console.error(message);
        this.log(message, 'error');
        alert(message);
    }
    

    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        this.elements.debugSection.style.display = 
            this.debugEnabled ? 'block' : 'none';
        
        if (this.debugEnabled) {
            this.log('Debug console enabled', 'info');
        }
    }
    

    log(message, type = 'info') {
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
        
        if (!this.debugEnabled) return;
        
        const entry = document.createElement('div');
        entry.className = `debug-entry debug-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        this.elements.debugBox.appendChild(entry);
        
        this.elements.debugBox.scrollTop = this.elements.debugBox.scrollHeight;
        

        while (this.elements.debugBox.children.length > 100) {
            this.elements.debugBox.removeChild(this.elements.debugBox.firstChild);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    

    getElements() {
        return this.elements;
    }
}

export default UIController;