/**
 * Configuration Manager
 * Handles system configuration
 * NO API KEYS NEEDED IN BROWSER (handled by proxy)
 */

class Config {
    constructor() {
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
        
        // Service providers
        this.providers = {
            stt: 'groq', // Groq Whisper
            tts: 'google' // Google Wavenet
        };
    }
    
    /**
     * Check if configured
     * (Always true since no keys needed in browser)
     */
    isConfigured() {
        return true;
    }
}

// Export singleton instance
export default new Config();