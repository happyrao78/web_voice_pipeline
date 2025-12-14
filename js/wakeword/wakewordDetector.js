/**
 * Wake Word Detector
 * Detects "Hey Quantum" using Picovoice Porcupine with WebVoiceProcessor
 */

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
    
    /**
     * Initialize wake word detector with Porcupine
     */
    async initialize() {
        try {
            // Wait for libraries to load from CDN
            await this.waitForLibraries();
            
            // Fetch Porcupine access key from proxy server
            const response = await fetch('http://localhost:8080/porcupine-key');
            const data = await response.json();
            this.accessKey = data.key;
            
            if (!this.accessKey) {
                throw new Error('Porcupine access key not found');
            }
            
            console.log('Porcupine access key loaded');
            
            // Get PorcupineWorker from global window object
            const { PorcupineWorker } = window.PorcupineWeb;
            
            // Create keyword model object
            const keywordModel = {
                publicPath: "Hey-Quantum_en_wasm_v4_0_0.ppn",
                label: "hey quantum"
            };
            
            // Detection callback
            const detectionCallback = (detection) => {
                console.log('Porcupine detected:', detection.label);
                this.handleWakeWordDetected();
            };
            
            // Create model parameter
            const modelParams = {
                publicPath: "porcupine_params.pv"
            };
            
            // Initialize Porcupine
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
    
    /**
     * Wait for Porcupine and WebVoiceProcessor libraries to load from CDN
     */
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
    
    /**
     * Start listening for wake word
     */
    async start(onDetectedCallback) {
        if (!this.isInitialized) {
            console.error('Porcupine not initialized');
            return;
        }
        
        this.isListening = true;
        this.onWakeWordDetected = onDetectedCallback;
        
        // Subscribe to WebVoiceProcessor
        const { WebVoiceProcessor } = window.WebVoiceProcessor;
        await WebVoiceProcessor.subscribe(this.porcupineWorker);
        
        console.log('✅ Wake word detector started and subscribed to WebVoiceProcessor');
    }
    
    /**
     * Stop listening for wake word
     */
    async stop() {
        if (!this.isInitialized) {
            return;
        }
        
        this.isListening = false;
        this.onWakeWordDetected = null;
        
        // Unsubscribe from WebVoiceProcessor
        try {
            const { WebVoiceProcessor } = window.WebVoiceProcessor;
            await WebVoiceProcessor.unsubscribe(this.porcupineWorker);
            console.log('✅ Unsubscribed from WebVoiceProcessor');
        } catch (error) {
            console.error('Error unsubscribing from WebVoiceProcessor:', error);
        }
    }
    
    /**
     * Process audio data - NOT USED (WebVoiceProcessor handles this)
     */
    processAudio(audioData) {
        // WebVoiceProcessor automatically feeds audio to Porcupine
        // This method is kept for compatibility but not used
    }
    
    /**
     * Handle wake word detection
     */
    handleWakeWordDetected() {
        if (!this.isListening) {
            return;
        }
        
        // Check cooldown
        if (Date.now() < this.cooldownUntil) {
            return;
        }
        
        console.log('✅ Wake word "Hey Quantum" detected!');
        
        // Set cooldown to prevent multiple rapid detections
        this.cooldownUntil = Date.now() + config.wakeWord.cooldownMs;
        
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