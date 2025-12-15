class PlaybackWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.bufferSize = 32000;
        this.audioBuffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.samplesAvailable = 0;
        
        
        this.jitterBufferSize = 1920; 
        this.isPlaying = false;
        
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'audio') {
                this.addAudioData(event.data.data);
            } else if (event.data.type === 'reset') {
                this.reset();
            }
        };
    }
    
    addAudioData(audioData) {
        const float32Data = new Float32Array(audioData);
        
        for (let i = 0; i < float32Data.length; i++) {
            this.audioBuffer[this.writeIndex] = float32Data[i];
            this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
            this.samplesAvailable++;
            
            if (this.samplesAvailable >= this.bufferSize) {
                this.samplesAvailable = this.bufferSize - 1;
                this.readIndex = (this.writeIndex + 1) % this.bufferSize;
            }
        }
        
        if (!this.isPlaying && this.samplesAvailable >= this.jitterBufferSize) {
            this.isPlaying = true;
            this.port.postMessage({ type: 'started' });
        }
    }
    

    reset() {
        this.writeIndex = 0;
        this.readIndex = 0;
        this.samplesAvailable = 0;
        this.isPlaying = false;
        this.audioBuffer.fill(0);
    }
    

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
        
        for (let i = 0; i < channelData.length; i++) {
            if (this.samplesAvailable > 0) {
                channelData[i] = this.audioBuffer[this.readIndex];
                this.readIndex = (this.readIndex + 1) % this.bufferSize;
                this.samplesAvailable--;
            } else {
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