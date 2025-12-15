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
     
        this.ui = new UIController();
        this.audioCapture = new AudioCapture();
        this.audioPlayback = new AudioPlayback();
        this.wakeWordDetector = new WakeWordDetector();
        this.sttService = new STTService();
        this.ttsService = new TTSService();
        this.knowledgeBase = new KnowledgeBase();
        
      
        this.isRunning = false;
        this.isWaitingForWakeWord = false;
        this.isProcessing = false;
        this.currentTranscript = '';
        
       
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        
        this.silenceTimer = null;
        this.hasSpeech = false;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; 
        this.silenceThreshold = 0.01;
        this.silenceDuration = 600; 
        this.consecutiveSilenceFrames = 0;
        this.requiredSilenceFrames = Math.floor(this.silenceDuration / 20); 
    }
    

    async initialize() {
        try {
            console.log('Initializing Qplus Voice Assistant (OPTIMIZED)...');
            
            
            this.ui.initialize();
            
            
            await this.knowledgeBase.load();
            
            
            this.setupEventListeners();
            
            console.log('Application initialized successfully');
            console.log(`Target latency: ${config.latency.targetMs}ms`);
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.ui.showError('Failed to initialize: ' + error.message);
        }
    }
    
 
    setupEventListeners() {
        const elements = this.ui.getElements();
        
        elements.startBtn.addEventListener('click', () => {
            this.start();
        });
        
        elements.stopBtn.addEventListener('click', () => {
            this.stop();
        });
    }
    
    async start() {
        try {
            this.ui.log('Starting assistant (OPTIMIZED MODE)...');
            this.ui.setControlsEnabled(true);
            
            await this.audioCapture.initialize();
            
            await this.audioPlayback.initialize(this.audioCapture.getContext());
            
            await this.wakeWordDetector.initialize();
            
            this.audioPlayback.setOnPlaybackStarted(() => {
                this.handleSpeechStarted();
            });
            
            this.audioPlayback.setOnPlaybackEnded(() => {
                this.handleSpeechEnded();
            });
            
            await this.ttsService.connect();
            
        
            this.ttsService.setCallbacks({
                onAudioChunk: (audioData) => this.handleTTSAudioChunk(audioData),
                onSpeechStarted: () => {},
                onSpeechEnded: () => {},
                onError: (error) => this.handleError(error)
            });
            
            
            this.startWakeWordListening();
            
            this.isRunning = true;
            this.ui.log('Assistant started successfully');
            
        } catch (error) {
            console.error('Failed to start assistant:', error);
            this.ui.showError('Failed to start: ' + error.message);
            this.cleanup();
        }
    }
    

    async stop() {
        this.ui.log('Stopping assistant...');
        await this.cleanup();
        this.ui.setControlsEnabled(false);
        this.ui.setStatus('idle');
        this.ui.clearTranscript();
        this.ui.clearResponse();
        this.ui.log('Assistant stopped');
    }
    

    async startWakeWordListening() {
        this.ui.setStatus('listening');
        this.ui.clearTranscript();
        this.ui.clearResponse();
        this.ui.resetLatency();
        
    
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; 
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        
        await this.wakeWordDetector.start(() => {
            this.handleWakeWordDetected();
        });
        
        
        this.audioCapture.start((audioData) => {
            
            if (this.isProcessing && this.sttService.isActive() && !this.audioStreamingStopped) {
                
                const energy = this.calculateRMS(audioData);
                
                
                this.sttService.sendAudio(audioData);
                
               
                if (energy > this.silenceThreshold) {
                    // Speech detected
                    if (!this.hasSpeech) {
                        this.hasSpeech = true;
                        this.ui.log(`Speech detected (energy: ${energy.toFixed(4)})`);
                    }
                    this.consecutiveSilenceFrames = 0;
                } else if (this.hasSpeech && !this.silenceTriggered) {
                    
                    this.consecutiveSilenceFrames++;
                    
                    
                    if (this.consecutiveSilenceFrames >= this.requiredSilenceFrames) {
                        this.silenceTriggered = true;
                        this.audioStreamingStopped = true;
                        
                        
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
    

    calculateRMS(audioData) {
        const int16Data = new Int16Array(audioData);
        let sum = 0;
        
        for (let i = 0; i < int16Data.length; i++) {
            const normalized = int16Data[i] / 32768.0;
            sum += normalized * normalized;
        }
        
        return Math.sqrt(sum / int16Data.length);
    }
    

    stopSpeechDetection() {
        if (this.isProcessing && this.sttService.isActive()) {
            this.ui.log('⚡ Triggering IMMEDIATE transcription...');
            this.sttService.stopTranscription();
        }
    }
    

    async handleWakeWordDetected() {
        this.ui.log('🎤 Wake word detected!');
        
        this.isWaitingForWakeWord = false;
        this.isProcessing = true;
        this.ui.setStatus('processing');
        
        
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false; 
        this.speechEndTime = null;
        this.responseStartTime = null;
        
        
        await this.wakeWordDetector.stop();
        
        
        await this.sttService.connect();
        

        this.sttService.startTranscription(
            (partial) => this.handlePartialTranscript(partial),
            (final) => this.handleFinalTranscript(final),
            (error) => this.handleError(error)
        );
        
        
        setTimeout(() => {
            if (this.isProcessing && this.sttService.isActive() && !this.silenceTriggered) {
                this.ui.log('⏱️ Max speech duration reached (2s)');
                this.audioStreamingStopped = true; 
                this.speechEndTime = Date.now();
                this.stopSpeechDetection();
            }
        }, 2000); 
    }
    

    handlePartialTranscript(text) {
        if (text && text.trim()) {
            this.ui.log(`Partial: ${text}`);
            this.ui.showPartialTranscript(text);
            this.currentTranscript = text;
        }
    }
    
 
    async handleFinalTranscript(text) {
        if (!text || !text.trim()) {
            this.ui.log('Empty transcript received');
            this.returnToWakeWordListening();
            return;
        }
        
        this.ui.log(`📝 Final transcript: ${text}`);
        this.ui.showFinalTranscript(text);
        this.currentTranscript = text;
        
        this.sttService.stopTranscription();
        this.sttService.disconnect();
        
        const response = this.knowledgeBase.getAnswer(text);
        this.ui.showResponse(response);
        this.ui.log(`💬 Response: ${response}`);
        

        await this.speakResponse(response);
    }
    

    async speakResponse(text) {
        try {
           
            this.responseStartTime = null;
            
        
            this.ttsService.speak(text);
            
        } catch (error) {
            console.error('Failed to speak response:', error);
            this.handleError(error);
            this.returnToWakeWordListening();
        }
    }
    

    handleTTSAudioChunk(audioData) {

        this.audioPlayback.addAudioChunk(audioData);
    }
    
    handleSpeechStarted() {
        this.ui.setStatus('speaking');
        
        this.responseStartTime = Date.now();
        
        if (this.speechEndTime && this.responseStartTime) {
            const latency = this.responseStartTime - this.speechEndTime;
            this.ui.updateLatency(latency);
            
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
    

    handleSpeechEnded() {
        this.ui.log('Speech playback completed');
        
        
        setTimeout(() => {
            if (this.isRunning) {
                this.returnToWakeWordListening();
            }
        }, 500);
    }
    

    returnToWakeWordListening() {
        this.isProcessing = false;
        this.currentTranscript = '';
        this.speechEndTime = null;
        this.responseStartTime = null;
        this.hasSpeech = false;
        this.consecutiveSilenceFrames = 0;
        this.silenceTriggered = false;
        this.audioStreamingStopped = false;
        

        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        this.sttService.disconnect();
        
        this.audioPlayback.reset();
        
        if (this.isRunning) {
            this.startWakeWordListening();
        }
    }
    

    handleError(error) {
        console.error('Error:', error);
        this.ui.log(`Error: ${error.message}`, 'error');
        
        if (this.isRunning) {
            setTimeout(() => {
                this.returnToWakeWordListening();
            }, 1000);
        }
    }
    

    async cleanup() {
        this.isRunning = false;
        this.isWaitingForWakeWord = false;
        this.isProcessing = false;
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
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

document.addEventListener('DOMContentLoaded', async () => {
    const app = new VoiceAssistant();
    await app.initialize();
    
    window.voiceAssistant = app;
});