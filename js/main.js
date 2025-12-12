/**
 * Main Application Entry Point
 * Orchestrates all modules for the voice assistant
 */

import config from './config.js';
import AudioCapture from './audio/audioCapture.js';
import AudioPlayback from './audio/audioPlayback.js';
import WakeWordDetector from './wakeword/wakewordDetector.js';
import STTService from './services/sttService.js';
import TTSService from './services/ttsService.js';
import KnowledgeBase from './services/knowledgeBase.js';
import UIController from './ui/uiController.js';

class VoiceAssistant {
    constructor() {
        // Initialize modules
        this.ui = new UIController();
        this.audioCapture = new AudioCapture();
        this.audioPlayback = new AudioPlayback();
        this.wakeWordDetector = new WakeWordDetector();
        this.sttService = new STTService();
        this.ttsService = new TTSService();
        this.knowledgeBase = new KnowledgeBase();
        
        // State
        this.isRunning = false;
        this.isWaitingForWakeWord = false;
        this.isProcessing = false;
        this.currentTranscript = '';
        
        // Timing
        this.speechEndTime = null;
    }
    
    /**
     * Initialize application
     */
    async initialize() {
        try {
            console.log('Initializing Qplus Voice Assistant...');
            
            // Initialize UI
            this.ui.initialize();
            
            // Load knowledge base
            await this.knowledgeBase.load();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.ui.showError('Failed to initialize: ' + error.message);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const elements = this.ui.getElements();
        
        // Start button
        elements.startBtn.addEventListener('click', () => {
            this.start();
        });
        
        // Stop button
        elements.stopBtn.addEventListener('click', () => {
            this.stop();
        });
    }
    
    /**
     * Start the assistant
     */
    async start() {
        try {
            this.ui.log('Starting assistant...');
            this.ui.setControlsEnabled(true);
            
            // Verify configuration
            if (!config.isConfigured()) {
                throw new Error('Please configure API keys first');
            }
            
            // Initialize audio capture
            await this.audioCapture.initialize();
            
            // Initialize audio playback (share audio context)
            await this.audioPlayback.initialize(this.audioCapture.getContext());
            
            // Initialize wake word detector
            await this.wakeWordDetector.initialize();
            
            // Setup TTS callbacks
            this.ttsService.setCallbacks({
                onAudioChunk: (audioData) => this.handleTTSAudioChunk(audioData),
                onSpeechStarted: () => this.handleSpeechStarted(),
                onSpeechEnded: () => this.handleSpeechEnded(),
                onError: (error) => this.handleError(error)
            });
            
            // Connect TTS service
            await this.ttsService.connect();
            
            // Start listening for wake word
            this.startWakeWordListening();
            
            this.isRunning = true;
            this.ui.log('Assistant started successfully');
            
        } catch (error) {
            console.error('Failed to start assistant:', error);
            this.ui.showError('Failed to start: ' + error.message);
            this.cleanup();
        }
    }
    
    /**
     * Stop the assistant
     */
    async stop() {
        this.ui.log('Stopping assistant...');
        await this.cleanup();
        this.ui.setControlsEnabled(false);
        this.ui.setStatus('idle');
        this.ui.clearTranscript();
        this.ui.clearResponse();
        this.ui.log('Assistant stopped');
    }
    
    /**
     * Start listening for wake word
     */
    startWakeWordListening() {
        this.ui.setStatus('listening');
        this.ui.clearTranscript();
        this.ui.clearResponse();
        
        // Start wake word detection
        this.wakeWordDetector.start(() => {
            this.handleWakeWordDetected();
        });
        
        // Start audio capture and feed to wake word detector
        this.audioCapture.start((audioData) => {
            if (this.wakeWordDetector.isActive()) {
                this.wakeWordDetector.processAudio(audioData);
            } else if (this.isProcessing && this.sttService.isActive()) {
                // Send audio to STT
                this.sttService.sendAudio(audioData);
            }
        });
        
        this.isWaitingForWakeWord = true;
        this.ui.log('Listening for wake word: "Hey Qplus"');
    }
    
    /**
     * Handle wake word detection
     */
    async handleWakeWordDetected() {
        this.ui.log('Wake word detected!');
        this.isWaitingForWakeWord = false;
        this.isProcessing = true;
        this.ui.setStatus('processing');
        
        // Stop wake word detection
        this.wakeWordDetector.stop();
        
        // Connect to STT service
        await this.sttService.connect();
        
        // Start transcription
        this.sttService.startTranscription(
            (partial) => this.handlePartialTranscript(partial),
            (final) => this.handleFinalTranscript(final),
            (error) => this.handleError(error)
        );
        
        // Set timeout for user speech (10 seconds)
        setTimeout(() => {
            if (this.isProcessing) {
                this.sttService.stopTranscription();
            }
        }, 10000);
    }
    
    /**
     * Handle partial transcript
     */
    handlePartialTranscript(text) {
        this.ui.log(`Partial: ${text}`);
        this.ui.showPartialTranscript(text);
        this.currentTranscript = text;
    }
    
    /**
     * Handle final transcript
     */
    async handleFinalTranscript(text) {
        this.ui.log(`Final: ${text}`);
        this.ui.showFinalTranscript(text);
        this.currentTranscript = text;
        
        // Mark speech end time
        this.speechEndTime = Date.now();
        
        // Stop STT
        this.sttService.stopTranscription();
        this.sttService.disconnect();
        
        // Get response from knowledge base
        const response = this.knowledgeBase.getAnswer(text);
        this.ui.showResponse(response);
        this.ui.log(`Response: ${response}`);
        
        // Speak response
        await this.speakResponse(response);
    }
    
    /**
     * Speak response using TTS
     */
    async speakResponse(text) {
        try {
            // Speak the response
            this.ttsService.speak(text);
            
        } catch (error) {
            console.error('Failed to speak response:', error);
            this.handleError(error);
            this.returnToWakeWordListening();
        }
    }
    
    /**
     * Handle TTS audio chunk
     */
    handleTTSAudioChunk(audioData) {
        // Feed audio to playback
        this.audioPlayback.addAudioChunk(audioData);
    }
    
    /**
     * Handle speech started
     */
    handleSpeechStarted() {
        this.ui.setStatus('speaking');
        
        // Update latency if we have speech end time
        if (this.speechEndTime) {
            const latency = Date.now() - this.speechEndTime;
            this.ui.log(`Latency: ${latency}ms`);
            this.ui.updateLatency();
            this.speechEndTime = null;
        }
    }
    
    /**
     * Handle speech ended
     */
    handleSpeechEnded() {
        this.ui.log('Speech ended');
        
        // Wait a bit, then return to wake word listening
        setTimeout(() => {
            if (this.isRunning) {
                this.returnToWakeWordListening();
            }
        }, 500);
    }
    
    /**
     * Return to wake word listening
     */
    returnToWakeWordListening() {
        this.isProcessing = false;
        this.currentTranscript = '';
        
        // Disconnect services
        this.sttService.disconnect();
        
        // Reset audio playback
        this.audioPlayback.reset();
        
        // Start listening for wake word again
        if (this.isRunning) {
            this.startWakeWordListening();
        }
    }
    
    /**
     * Handle error
     */
    handleError(error) {
        console.error('Error:', error);
        this.ui.log(`Error: ${error.message}`, 'error');
        
        // Try to recover by returning to wake word listening
        if (this.isRunning) {
            setTimeout(() => {
                this.returnToWakeWordListening();
            }, 1000);
        }
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.isRunning = false;
        this.isWaitingForWakeWord = false;
        this.isProcessing = false;
        
        // Stop and cleanup all modules
        if (this.wakeWordDetector) {
            await this.wakeWordDetector.cleanup();
        }
        
        if (this.audioCapture) {
            await this.audioCapture.cleanup();
        }
        
        if (this.audioPlayback) {
            await this.audioPlayback.cleanup();
        }
        
        if (this.sttService) {
            this.sttService.disconnect();
        }
        
        if (this.ttsService) {
            this.ttsService.disconnect();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new VoiceAssistant();
    await app.initialize();
    
    // Make app globally accessible for debugging
    window.voiceAssistant = app;
});