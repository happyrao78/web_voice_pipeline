import config from '../config.js';

class AudioPlayback {
    constructor() {
        this.audioContext = null;
        this.workletNode = null;
        this.isPlaying = false;
        this.onPlaybackStarted = null;
        this.onPlaybackEnded = null;
    }
    
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext || new AudioContext({
                sampleRate: config.audio.sampleRate,
                latencyHint: 'interactive'
            });
            
            await this.audioContext.audioWorklet.addModule('js/audio/worklets/playback-worklet.js');
            
            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                'playback-worklet-processor'
            );
            
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
     * @param {ArrayBuffer} audioData 
     */
    addAudioChunk(audioData) {
        if (!this.workletNode) {
            throw new Error('Audio playback not initialized');
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const int16Data = new Int16Array(audioData);
        const float32Data = new Float32Array(int16Data.length);
        
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF);
        }
        
        this.workletNode.port.postMessage({
            type: 'audio',
            data: float32Data.buffer
        }, [float32Data.buffer]);
    }
    
    reset() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'reset' });
        }
        this.isPlaying = false;
    }
    
    setOnPlaybackStarted(callback) {
        this.onPlaybackStarted = callback;
    }
    

    setOnPlaybackEnded(callback) {
        this.onPlaybackEnded = callback;
    }
    

    isActive() {
        return this.isPlaying;
    }
    

    async cleanup() {
        this.reset();
        
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        
        console.log('Audio playback cleaned up');
    }
}

export default AudioPlayback;