class Config {
    constructor() {
        this.audio = {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            chunkDurationMs: 20, 
            bufferSize: 320 
        };
        
        this.latency = {
            targetMs: 800,   
            warningMs: 1200, 
            criticalMs: 1500
        };
        
        
        this.wakeWord = {
            phrase: 'hey quantum',
            sensitivity: 0.5,
            cooldownMs: 1000
        };
        
        this.websocket = {
            url: 'ws://localhost:8080',
            reconnectAttempts: 3,
            reconnectDelayMs: 1000,
            heartbeatIntervalMs: 30000
        };
        
        this.providers = {
            stt: {
                provider: 'Groq',
                model: 'whisper-large-v3-turbo', 
                language: 'en',
                temperature: 0 
            },
            tts: {
                provider: 'Google Standard', 
                voice: 'en-US-Standard-F',
                languageCode: 'en-US',
                speakingRate: 1.15,
                pitch: 0.0
            }
        };
        
        this.silenceDetection = {
            threshold: 0.01, 
            durationMs: 600, 
            maxSpeechDurationMs: 2000 
        };
    }
    
    isConfigured() {
        return true;
    }
    

    getWebSocketURL(service) {
        return `${this.websocket.url}?service=${service}`;
    }
}

export default new Config();