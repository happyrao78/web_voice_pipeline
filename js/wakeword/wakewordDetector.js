/**
 * Wake Word Detector
 * Detects "Hey Qplus" using client-side processing
 * Falls back to simple energy-based detection if Porcupine not available
 */

import config from '../config.js';

class WakeWordDetector {
    constructor() {
        this.isListening = false;
        this.onWakeWordDetected = null;
        this.porcupineEngine = null;
        this.usePorcupine = false;
        
        // Simple energy-based detection
        this.energyThreshold = 0.02;
        this.silenceThreshold = 0.005;
        this.speechFrames = 0;
        this.minSpeechFrames = 10; // ~200ms of speech
        this.cooldownUntil = 0;
    }
    
    /**
     * Initialize wake word detector
     */
    async initialize() {
        try {
            const picovoiceKey = config.getPicovoiceKey();
            
            if (picovoiceKey) {
                // Try to initialize Porcupine
                await this.initializePorcupine(picovoiceKey);
            } else {
                console.log('Picovoice key not provided, using simple energy detection');
                this.usePorcupine = false;
            }
            
            return true;
        } catch (error) {
            console.warn('Failed to initialize Porcupine, falling back to simple detection:', error);
            this.usePorcupine = false;
            return true;
        }
    }
    
    /**
     * Initialize Porcupine (if available)
     */
    async initializePorcupine(accessKey) {
        try {
            // Note: This is a placeholder for Porcupine integration
            // You would need to load the Porcupine WASM library here
            // For now, we'll use simple detection
            
            // Example Porcupine initialization (pseudo-code):
            // const { Porcupine } = await import('@picovoice/porcupine-web');
            // this.porcupineEngine = await Porcupine.create(
            //     accessKey,
            //     { keywords: ['hey-qplus'] }
            // );
            
            console.log('Porcupine not implemented in this version');
            this.usePorcupine = false;
        } catch (error) {
            throw error;
        }
    }
    
    /**
     * Start listening for wake word
     */
    start(onDetectedCallback) {
        this.isListening = true;
        this.onWakeWordDetected = onDetectedCallback;
        this.speechFrames = 0;
        console.log('Wake word detector started');
    }
    
    /**
     * Stop listening for wake word
     */
    stop() {
        this.isListening = false;
        this.onWakeWordDetected = null;
        this.speechFrames = 0;
        console.log('Wake word detector stopped');
    }
    
    /**
     * Process audio data for wake word detection
     */
    processAudio(audioData) {
        if (!this.isListening || !this.onWakeWordDetected) {
            return;
        }
        
        // Check cooldown
        if (Date.now() < this.cooldownUntil) {
            return;
        }
        
        if (this.usePorcupine && this.porcupineEngine) {
            this.processPorcupine(audioData);
        } else {
            this.processSimpleDetection(audioData);
        }
    }
    
    /**
     * Process with Porcupine
     */
    processPorcupine(audioData) {
        // Placeholder for Porcupine processing
        // const int16Data = new Int16Array(audioData);
        // const detected = this.porcupineEngine.process(int16Data);
        // if (detected >= 0) {
        //     this.handleWakeWordDetected();
        // }
    }
    
    /**
     * Simple energy-based detection
     */
    processSimpleDetection(audioData) {
        const int16Data = new Int16Array(audioData);
        
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < int16Data.length; i++) {
            const normalized = int16Data[i] / 32768.0;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / int16Data.length);
        
        // Detect speech based on energy
        if (rms > this.energyThreshold) {
            this.speechFrames++;
            
            // If we have sustained speech, trigger wake word
            if (this.speechFrames >= this.minSpeechFrames) {
                this.handleWakeWordDetected();
            }
        } else if (rms < this.silenceThreshold) {
            // Reset on silence
            this.speechFrames = Math.max(0, this.speechFrames - 1);
        }
    }
    
    /**
     * Handle wake word detection
     */
    handleWakeWordDetected() {
        console.log('Wake word detected!');
        
        // Set cooldown to prevent multiple rapid detections
        this.cooldownUntil = Date.now() + config.wakeWord.cooldownMs;
        
        // Reset state
        this.speechFrames = 0;
        
        // Notify callback
        if (this.onWakeWordDetected) {
            this.onWakeWordDetected();
        }
    }
    
    /**
     * Check if currently listening
     */
    isActive() {
        return this.isListening;
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stop();
        
        if (this.porcupineEngine) {
            // await this.porcupineEngine.release();
            this.porcupineEngine = null;
        }
        
        console.log('Wake word detector cleaned up');
    }
}

export default WakeWordDetector;