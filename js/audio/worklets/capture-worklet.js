class CaptureWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 320; 
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }
    
    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            
            const clamped = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = clamped < 0 
                ? clamped * 0x8000 
                : clamped * 0x7FFF;
        }
        return int16Array;
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
    
        if (!input || !input[0]) {
            return true;
        }
        
        const channelData = input[0]; 
        
        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];
            
            if (this.bufferIndex >= this.bufferSize) {
                const pcmData = this.float32ToInt16(this.buffer);
                
                this.port.postMessage({
                    type: 'audio',
                    data: pcmData.buffer
                }, [pcmData.buffer]);
                
                this.bufferIndex = 0;
            }
        }
        
        return true; 
    }
}

registerProcessor('capture-worklet-processor', CaptureWorkletProcessor);