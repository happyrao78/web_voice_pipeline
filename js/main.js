/**
 * Main Application Entry Point (OPTIMIZED)
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
        
        // Timing for end-to-end latency (Speech End -> Response Start)
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        // Speech detection (OPTIMIZED - more aggressive)
        this.silenceTimer = null;
        this.hasSpeech = false;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; // NEW: Flag to stop audio streaming
        this.silenceThreshold = 0.01;
        this.silenceDuration = 600; // REDUCED from 800ms to 600ms
        this.consecutiveSilenceFrames = 0;
        this.requiredSilenceFrames = Math.floor(this.silenceDuration / 20); // 30 frames
    }
    
    /**
     * Initialize application
     */
    async initialize() {
        try {
            console.log('Initializing Qplus Voice Assistant (OPTIMIZED)...');
            
            // Initialize UI
            this.ui.initialize();
            
            // Load knowledge base
            await this.knowledgeBase.load();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Application initialized successfully');
            console.log(`Target latency: ${config.latency.targetMs}ms`);
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
        
        elements.startBtn.addEventListener('click', () => {
            this.start();
        });
        
        elements.stopBtn.addEventListener('click', () => {
            this.stop();
        });
    }
    
    /**
     * Start the assistant
     */
    async start() {
        try {
            this.ui.log('Starting assistant (OPTIMIZED MODE)...');
            this.ui.setControlsEnabled(true);
            
            // Initialize audio capture
            await this.audioCapture.initialize();
            
            // Initialize audio playback
            await this.audioPlayback.initialize(this.audioCapture.getContext());
            
            // Initialize wake word detector
            await this.wakeWordDetector.initialize();
            
            // Setup TTS callbacks
            this.audioPlayback.setOnPlaybackStarted(() => {
                this.handleSpeechStarted();
            });
            
            this.audioPlayback.setOnPlaybackEnded(() => {
                this.handleSpeechEnded();
            });
            
            // Connect TTS service
            await this.ttsService.connect();
            
            // Setup TTS callbacks
            this.ttsService.setCallbacks({
                onAudioChunk: (audioData) => this.handleTTSAudioChunk(audioData),
                onSpeechStarted: () => {},
                onSpeechEnded: () => {},
                onError: (error) => this.handleError(error)
            });
            
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
    async startWakeWordListening() {
        this.ui.setStatus('listening');
        this.ui.clearTranscript();
        this.ui.clearResponse();
        this.ui.resetLatency();
        
        // Reset state
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; // NEW: Reset flag
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        // Start wake word detection
        await this.wakeWordDetector.start(() => {
            this.handleWakeWordDetected();
        });
        
        // Start audio capture for STT
        this.audioCapture.start((audioData) => {
            // CRITICAL FIX: Only process if streaming not stopped
            if (this.isProcessing && this.sttService.isActive() && !this.audioStreamingStopped) {
                // Calculate RMS energy for silence detection
                const energy = this.calculateRMS(audioData);
                
                // Send audio to STT immediately
                this.sttService.sendAudio(audioData);
                
                // Detect speech and silence
                if (energy > this.silenceThreshold) {
                    // Speech detected
                    if (!this.hasSpeech) {
                        this.hasSpeech = true;
                        this.ui.log(`Speech detected (energy: ${energy.toFixed(4)})`);
                    }
                    this.consecutiveSilenceFrames = 0;
                } else if (this.hasSpeech && !this.silenceTriggered) {
                    // Silence detected after speech
                    this.consecutiveSilenceFrames++;
                    
                    // Check if silence duration reached (FASTER - 600ms)
                    if (this.consecutiveSilenceFrames >= this.requiredSilenceFrames) {
                        this.silenceTriggered = true;
                        this.audioStreamingStopped = true; // STOP STREAMING IMMEDIATELY
                        
                        // Mark speech end time for latency calculation
                        this.speechEndTime = Date.now();
                        this.ui.log(`✅ Speech ended (${this.silenceDuration}ms silence) - Audio streaming STOPPED`);
                        
                        this.stopSpeechDetection();
                    }
                }
            }
        });
        
        this.isWaitingForWakeWord = true;
        this.ui.log('Listening for wake word: "Hey Quantum"');
    }
    
    /**
     * Calculate RMS energy of audio
     */
    calculateRMS(audioData) {
        const int16Data = new Int16Array(audioData);
        let sum = 0;
        
        for (let i = 0; i < int16Data.length; i++) {
            const normalized = int16Data[i] / 32768.0;
            sum += normalized * normalized;
        }
        
        return Math.sqrt(sum / int16Data.length);
    }
    
    /**
     * Stop speech detection and process
     */
    stopSpeechDetection() {
        if (this.isProcessing && this.sttService.isActive()) {
            this.ui.log('⚡ Triggering IMMEDIATE transcription...');
            this.sttService.stopTranscription();
        }
    }
    
    /**
     * Handle wake word detection
     */
    async handleWakeWordDetected() {
        this.ui.log('🎤 Wake word detected!');
        
        this.isWaitingForWakeWord = false;
        this.isProcessing = true;
        this.ui.setStatus('processing');
        
        // Reset state
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; // NEW: Reset flag
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        // Stop wake word detection
        await this.wakeWordDetector.stop();
        
        // Connect to STT service
        await this.sttService.connect();
        
        // Start transcription
        this.sttService.startTranscription(
            (partial) => this.handlePartialTranscript(partial),
            (final) => this.handleFinalTranscript(final),
            (error) => this.handleError(error)
        );
        
        // Maximum speech timeout (REDUCED to 2 seconds)
        setTimeout(() => {
            if (this.isProcessing && this.sttService.isActive() && !this.silenceTriggered) {
                this.ui.log('⏱️ Max speech duration reached (2s)');
                this.audioStreamingStopped = true; // STOP STREAMING
                this.speechEndTime = Date.now();
                this.stopSpeechDetection();
            }
        }, 2000); // REDUCED from 2500ms
    }
    
    /**
     * Handle partial transcript
     */
    handlePartialTranscript(text) {
        if (text && text.trim()) {
            this.ui.log(`Partial: ${text}`);
            this.ui.showPartialTranscript(text);
            this.currentTranscript = text;
        }
    }
    
    /**
     * Handle final transcript
     */
    async handleFinalTranscript(text) {
        if (!text || !text.trim()) {
            this.ui.log('Empty transcript received');
            this.returnToWakeWordListening();
            return;
        }
        
        this.ui.log(`📝 Final transcript: ${text}`);
        this.ui.showFinalTranscript(text);
        this.currentTranscript = text;
        
        // Stop STT
        this.sttService.stopTranscription();
        this.sttService.disconnect();
        
        // Get response from knowledge base (INSTANT)
        const response = this.knowledgeBase.getAnswer(text);
        this.ui.showResponse(response);
        this.ui.log(`💬 Response: ${response}`);
        
        // Speak response IMMEDIATELY
        await this.speakResponse(response);
    }
    
    /**
     * Speak response using TTS
     */
    async speakResponse(text) {
        try {
            // Reset response start time
            this.responseStartTime = null;
            
            // Speak the response immediately
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
     * Handle speech started (TTS playback begins)
     */
    handleSpeechStarted() {
        this.ui.setStatus('speaking');
        
        // Mark response start time (when first audio chunk plays)
        this.responseStartTime = Date.now();
        
        // Calculate and update end-to-end latency (Speech End → Response Start)
        if (this.speechEndTime && this.responseStartTime) {
            const latency = this.responseStartTime - this.speechEndTime;
            this.ui.updateLatency(latency);
            
            // Performance feedback with emojis
            if (latency <= config.latency.targetMs) {
                this.ui.log(`🎯 EXCELLENT! Latency: ${latency}ms (Target: ${config.latency.targetMs}ms)`, 'info');
            } else if (latency <= config.latency.warningMs) {
                this.ui.log(`✅ Good latency: ${latency}ms (Warning threshold: ${config.latency.warningMs}ms)`, 'info');
            } else if (latency <= config.latency.criticalMs) {
                this.ui.log(`⚠️ High latency: ${latency}ms (Critical: ${config.latency.criticalMs}ms)`, 'warning');
            } else {
                this.ui.log(`❌ CRITICAL latency: ${latency}ms (Target: ${config.latency.targetMs}ms)`, 'error');
            }
        }
    }
    
    /**
     * Handle speech ended
     */
    handleSpeechEnded() {
        this.ui.log('Speech playback completed');
        
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
        this.speechEndTime = null;
        this.responseStartTime = null;
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; // NEW: Reset flag
        
        // Clear silence timer
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
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
        
        // Clear timers
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
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