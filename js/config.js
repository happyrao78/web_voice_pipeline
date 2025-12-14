/**
 * Configuration Manager (OPTIMIZED)
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
        
        // Latency targets (OPTIMIZED)
        this.latency = {
            targetMs: 800,   // 800ms target (AGGRESSIVE)
            warningMs: 1200, // Warning at 1.2s
            criticalMs: 1500 // Critical at 1.5s
        };
        
        // Wake word configuration
        this.wakeWord = {
            phrase: 'hey quantum',
            sensitivity: 0.5,
            cooldownMs: 1000
        };
        
        // WebSocket configuration
        this.websocket = {
            url: 'ws://localhost:8080',
            reconnectAttempts: 3,
            reconnectDelayMs: 1000,
            heartbeatIntervalMs: 30000
        };
        
        // Service providers (OPTIMIZED for speed)
        this.providers = {
            stt: {
                provider: 'Groq',
                model: 'whisper-large-v3-turbo', // TURBO for speed
                language: 'en',
                temperature: 0 // More deterministic = faster
            },
            tts: {
                provider: 'Google Standard', // Standard instead of Wavenet for speed
                voice: 'en-US-Standard-F',
                languageCode: 'en-US',
                speakingRate: 1.15, // Slightly faster
                pitch: 0.0
            }
        };
        
        // Silence detection (OPTIMIZED - more aggressive)
        this.silenceDetection = {
            threshold: 0.01, // RMS threshold
            durationMs: 600, // Reduced from 800ms to 600ms
            maxSpeechDurationMs: 2000 // Reduced from 2500ms to 2000ms
        };
    }
    
    /**
     * Check if configured
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