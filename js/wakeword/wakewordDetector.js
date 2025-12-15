import config from '../config.js';

class WakeWordDetector {
    constructor() {
        this.isListening = false;
        this.onWakeWordDetected = null;
        this.porcupineWorker = null;
        this.isInitialized = false;
        this.cooldownUntil = 0;
        this.accessKey = null;
    }
    

    async initialize() {
        try {
            
            await this.waitForLibraries();
            
            
            const response = await fetch('http://localhost:8080/porcupine-key');
            const data = await response.json();
            this.accessKey = data.key;
            
            if (!this.accessKey) {
                throw new Error('Porcupine access key not found');
            }
            
            console.log('Porcupine access key loaded');
            
            
            const { PorcupineWorker } = window.PorcupineWeb;
            
            
            const keywordModel = {
                publicPath: "Hey-Quantum_en_wasm_v4_0_0.ppn",
                label: "hey quantum"
            };
            
           
            const detectionCallback = (detection) => {
                console.log('Porcupine detected:', detection.label);
                this.handleWakeWordDetected();
            };
            
            
            const modelParams = {
                publicPath: "porcupine_params.pv"
            };
            
            this.porcupineWorker = await PorcupineWorker.create(
                this.accessKey,
                [keywordModel],
                detectionCallback,
                modelParams
            );
            
            console.log('✅ Porcupine worker created');
            
            this.isInitialized = true;
            console.log('✅ Porcupine wake word detector initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Porcupine:', error);
            throw error;
        }
    }
    

    async waitForLibraries() {
        let attempts = 0;
        const maxAttempts = 100;
        
        while ((!window.PorcupineWeb || !window.WebVoiceProcessor) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.PorcupineWeb) {
            throw new Error('Porcupine library failed to load from CDN');
        }
        
        if (!window.WebVoiceProcessor) {
            throw new Error('WebVoiceProcessor library failed to load from CDN');
        }
        
        console.log('✅ Porcupine and WebVoiceProcessor libraries loaded from CDN');
    }
    

    async start(onDetectedCallback) {
        if (!this.isInitialized) {
            console.error('Porcupine not initialized');
            return;
        }
        
        this.isListening = true;
        this.onWakeWordDetected = onDetectedCallback;
        
        const { WebVoiceProcessor } = window.WebVoiceProcessor;
        await WebVoiceProcessor.subscribe(this.porcupineWorker);
        
        console.log('✅ Wake word detector started and subscribed to WebVoiceProcessor');
    }
    

    async stop() {
        if (!this.isInitialized) {
            return;
        }
        
        this.isListening = false;
        this.onWakeWordDetected = null;
        
        try {
            const { WebVoiceProcessor } = window.WebVoiceProcessor;
            await WebVoiceProcessor.unsubscribe(this.porcupineWorker);
            console.log('✅ Unsubscribed from WebVoiceProcessor');
        } catch (error) {
            console.error('Error unsubscribing from WebVoiceProcessor:', error);
        }
    }
    
    
    handleWakeWordDetected() {
        if (!this.isListening) {
            return;
        }
        
        if (Date.now() < this.cooldownUntil) {
            return;
        }
        
        console.log('✅ Wake word "Hey Quantum" detected!');
        
        this.cooldownUntil = Date.now() + config.wakeWord.cooldownMs;
        
        if (this.onWakeWordDetected) {
            this.onWakeWordDetected();
        }
    }
    
    isActive() {
        return this.isListening;
    }
    

    async cleanup() {
        await this.stop();
        
        if (this.porcupineWorker) {
            try {
                await this.porcupineWorker.release();
                await this.porcupineWorker.terminate();
            } catch (error) {
                console.error('Error cleaning up Porcupine:', error);
            }
            this.porcupineWorker = null;
        }
        
        this.isInitialized = false;
        console.log('✅ Wake word detector cleaned up');
    }
}

export default WakeWordDetector;