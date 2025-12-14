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
        
        // Latency targets (reduced)
        this.latency = {
            targetMs: 800,   // 800ms target
            warningMs: 1200, // Warning at 1.2s
            criticalMs: 1500 // Critical at 1.5s
        };
        
        // Wake word configuration
        this.wakeWord = {
            phrase: 'hey quantum',
            sensitivity: 0.5,
            cooldownMs: 1000 // Prevent multiple rapid activations
        };
        
        // WebSocket configuration
        this.websocket = {
            url: 'ws://localhost:8080',
            reconnectAttempts: 3,
            reconnectDelayMs: 1000,
            heartbeatIntervalMs: 30000
        };
        
        // Service providers (handled by proxy server)
        this.providers = {
            stt: {
                provider: 'Groq',
                model: 'whisper-large-v3',
                language: 'en',
                temperature: 0 // More deterministic
            },
            tts: {
                provider: 'Google Wavenet',
                voice: 'en-US-Wavenet-F',
                languageCode: 'en-US',
                speakingRate: 1.1, // Slightly faster
                pitch: 0.0
            }
        };
    }
    
    /**
     * Check if configured
     * (Always true since no keys needed in browser)
     */
    isConfigured() {
        return true;
    }
    
    /**
     * Get WebSocket URL for a service
     */
    getWebSocketURL(service) {
        return `${this.websocket.url}?service=${service}`;
    }
}

// Export singleton instance
export default new Config();