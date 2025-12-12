/**
 * Audio Playback Worklet Processor
 * Handles streaming audio playback with ring buffer
 */

class PlaybackWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Ring buffer for audio data (2 seconds at 16kHz)
        this.bufferSize = 32000;
        this.audioBuffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.samplesAvailable = 0;
        
        // Jitter buffer (60-120ms of audio)
        this.jitterBufferSize = 1920; // 120ms at 16kHz
        this.isPlaying = false;
        
        // Listen for audio data from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'audio') {
                this.addAudioData(event.data.data);
            } else if (event.data.type === 'reset') {
                this.reset();
            }
        };
    }
    
    /**
     * Add audio data to ring buffer
     */
    addAudioData(audioData) {
        const float32Data = new Float32Array(audioData);
        
        for (let i = 0; i < float32Data.length; i++) {
            this.audioBuffer[this.writeIndex] = float32Data[i];
            this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
            this.samplesAvailable++;
            
            // Prevent buffer overflow
            if (this.samplesAvailable >= this.bufferSize) {
                this.samplesAvailable = this.bufferSize - 1;
                this.readIndex = (this.writeIndex + 1) % this.bufferSize;
            }
        }
        
        // Start playing once jitter buffer is filled
        if (!this.isPlaying && this.samplesAvailable >= this.jitterBufferSize) {
            this.isPlaying = true;
            this.port.postMessage({ type: 'started' });
        }
    }
    
    /**
     * Reset buffer
     */
    reset() {
        this.writeIndex = 0;
        this.readIndex = 0;
        this.samplesAvailable = 0;
        this.isPlaying = false;
        this.audioBuffer.fill(0);
    }
    
    /**
     * Process audio output
     */
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        
        if (!output || !output[0]) {
            return true;
        }
        
        const channelData = output[0];
        
        if (!this.isPlaying || this.samplesAvailable === 0) {
            // Output silence
            channelData.fill(0);
            return true;
        }
        
        // Fill output with audio from ring buffer
        for (let i = 0; i < channelData.length; i++) {
            if (this.samplesAvailable > 0) {
                channelData[i] = this.audioBuffer[this.readIndex];
                this.readIndex = (this.readIndex + 1) % this.bufferSize;
                this.samplesAvailable--;
            } else {
                // No more data, output silence
                channelData[i] = 0;
                this.isPlaying = false;
                this.port.postMessage({ type: 'ended' });
                break;
            }
        }
        
        return true;
    }
}

registerProcessor('playback-worklet-processor', PlaybackWorkletProcessor);