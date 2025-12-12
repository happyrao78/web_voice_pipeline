/**
 * Configuration Manager
 * Handles API keys and system configuration
 */

class Config {
    constructor() {
        this.keys = {
            openai: null,
            picovoice: null
        };
        
        // Audio configuration
        this.audio = {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            chunkDurationMs: 20, // 20ms chunks for lowest latency
            bufferSize: 320 // 16000 * 0.02 = 320 samples per chunk
        };
        
        // Latency targets
        this.latency = {
            targetMs: 1200, // 1.2 seconds target
            warningMs: 1500,
            criticalMs: 2000
        };
        
        // Wake word configuration
        this.wakeWord = {
            phrase: 'hey qplus',
            sensitivity: 0.5,
            cooldownMs: 1000 // Prevent multiple rapid activations
        };
        
        // WebSocket configuration
        this.websocket = {
            reconnectAttempts: 3,
            reconnectDelayMs: 1000,
            heartbeatIntervalMs: 30000
        };
        
        this.loadFromStorage();
    }
    
    /**
     * Set OpenAI API key
     */
    setOpenAIKey(key) {
        this.keys.openai = key;
        this.saveToStorage();
    }
    
    /**
     * Set Picovoice access key
     */
    setPicovoiceKey(key) {
        this.keys.picovoice = key;
        this.saveToStorage();
    }
    
    /**
     * Get OpenAI API key
     */
    getOpenAIKey() {
        return this.keys.openai;
    }
    
    /**
     * Get Picovoice access key
     */
    getPicovoiceKey() {
        return this.keys.picovoice;
    }
    
    /**
     * Check if required keys are set
     */
    isConfigured() {
        return !!this.keys.openai;
    }
    
    /**
     * Save configuration to localStorage
     */
    saveToStorage() {
        try {
            const config = {
                openai: this.keys.openai,
                picovoice: this.keys.picovoice
            };
            localStorage.setItem('qplus_config', JSON.stringify(config));
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }
    
    /**
     * Load configuration from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('qplus_config');
            if (stored) {
                const config = JSON.parse(stored);
                this.keys.openai = config.openai || null;
                this.keys.picovoice = config.picovoice || null;
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }
    
    /**
     * Clear all stored configuration
     */
    clearStorage() {
        try {
            localStorage.removeItem('qplus_config');
            this.keys.openai = null;
            this.keys.picovoice = null;
        } catch (error) {
            console.error('Failed to clear configuration:', error);
        }
    }
}

// Export singleton instance
export default new Config();