/**
 * Audio Capture Module
 * Manages microphone capture using AudioWorklet
 */

import config from '../config.js';

class AudioCapture {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.source = null;
        this.workletNode = null;
        this.isCapturing = false;
        this.onAudioData = null;
    }
    
    /**
     * Initialize audio capture
     */
    async initialize() {
        try {
            // Create AudioContext with target sample rate
            this.audioContext = new AudioContext({
                sampleRate: config.audio.sampleRate,
                latencyHint: 'interactive'
            });
            
            // Request microphone permission
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: config.audio.sampleRate,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Load AudioWorklet
            await this.audioContext.audioWorklet.addModule('js/audio/worklets/capture-worklet.js');
            
            // Create audio source
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            
            // Create worklet node
            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                'capture-worklet-processor'
            );
            
            // Listen for audio data from worklet
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio' && this.isCapturing && this.onAudioData) {
                    this.onAudioData(event.data.data);
                }
            };
            
            // Connect nodes
            this.source.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination);
            
            console.log('Audio capture initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio capture:', error);
            throw error;
        }
    }
    
    /**
     * Start capturing audio
     */
    start(onAudioCallback) {
        if (!this.audioContext || !this.workletNode) {
            throw new Error('Audio capture not initialized');
        }
        
        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.onAudioData = onAudioCallback;
        this.isCapturing = true;
        console.log('Audio capture started');
    }
    
    /**
     * Stop capturing audio
     */
    stop() {
        this.isCapturing = false;
        this.onAudioData = null;
        console.log('Audio capture stopped');
    }
    
    /**
     * Get audio context
     */
    getContext() {
        return this.audioContext;
    }
    
    /**
     * Check if currently capturing
     */
    isActive() {
        return this.isCapturing;
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stop();
        
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('Audio capture cleaned up');
    }
}

export default AudioCapture;