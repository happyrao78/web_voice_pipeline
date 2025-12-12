/**
 * Audio Playback Module
 * Manages streaming TTS audio playback using AudioWorklet
 */

import config from '../config.js';

class AudioPlayback {
    constructor() {
        this.audioContext = null;
        this.workletNode = null;
        this.isPlaying = false;
        this.onPlaybackStarted = null;
        this.onPlaybackEnded = null;
    }
    
    /**
     * Initialize audio playback
     */
    async initialize(audioContext) {
        try {
            // Use existing AudioContext or create new one
            this.audioContext = audioContext || new AudioContext({
                sampleRate: config.audio.sampleRate,
                latencyHint: 'interactive'
            });
            
            // Load AudioWorklet
            await this.audioContext.audioWorklet.addModule('js/audio/worklets/playback-worklet.js');
            
            // Create worklet node
            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                'playback-worklet-processor'
            );
            
            // Listen for events from worklet
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'started') {
                    this.isPlaying = true;
                    if (this.onPlaybackStarted) {
                        this.onPlaybackStarted();
                    }
                } else if (event.data.type === 'ended') {
                    this.isPlaying = false;
                    if (this.onPlaybackEnded) {
                        this.onPlaybackEnded();
                    }
                }
            };
            
            // Connect to destination
            this.workletNode.connect(this.audioContext.destination);
            
            console.log('Audio playback initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio playback:', error);
            throw error;
        }
    }
    
    /**
     * Add audio data for playback
     * @param {ArrayBuffer} audioData - Int16 PCM audio data
     */
    addAudioChunk(audioData) {
        if (!this.workletNode) {
            throw new Error('Audio playback not initialized');
        }
        
        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Convert Int16 to Float32
        const int16Data = new Int16Array(audioData);
        const float32Data = new Float32Array(int16Data.length);
        
        for (let i = 0; i < int16Data.length; i++) {
            // Convert from 16-bit int to float (-1.0 to 1.0)
            float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF);
        }
        
        // Send to worklet
        this.workletNode.port.postMessage({
            type: 'audio',
            data: float32Data.buffer
        }, [float32Data.buffer]);
    }
    
    /**
     * Reset playback buffer
     */
    reset() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'reset' });
        }
        this.isPlaying = false;
    }
    
    /**
     * Set playback started callback
     */
    setOnPlaybackStarted(callback) {
        this.onPlaybackStarted = callback;
    }
    
    /**
     * Set playback ended callback
     */
    setOnPlaybackEnded(callback) {
        this.onPlaybackEnded = callback;
    }
    
    /**
     * Check if currently playing
     */
    isActive() {
        return this.isPlaying;
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.reset();
        
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        
        // Note: Don't close AudioContext if it's shared
        console.log('Audio playback cleaned up');
    }
}

export default AudioPlayback;