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
    

    async initialize() {
        try {
            
            this.audioContext = new AudioContext({
                sampleRate: config.audio.sampleRate,
                latencyHint: 'interactive'
            });
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: config.audio.sampleRate,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            await this.audioContext.audioWorklet.addModule('js/audio/worklets/capture-worklet.js');
            
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            
            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                'capture-worklet-processor'
            );
            
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio' && this.isCapturing && this.onAudioData) {
                    this.onAudioData(event.data.data);
                }
            };
            
            this.source.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination);
            
            console.log('Audio capture initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio capture:', error);
            throw error;
        }
    }
    
    start(onAudioCallback) {
        if (!this.audioContext || !this.workletNode) {
            throw new Error('Audio capture not initialized');
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.onAudioData = onAudioCallback;
        this.isCapturing = true;
        console.log('Audio capture started');
    }
    
    stop() {
        this.isCapturing = false;
        this.onAudioData = null;
        console.log('Audio capture stopped');
    }
    
    getContext() {
        return this.audioContext;
    }
    

    isActive() {
        return this.isCapturing;
    }
    

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