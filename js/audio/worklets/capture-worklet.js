/**
 * Audio Capture Worklet Processor
 * Captures audio from microphone and converts Float32 to 16-bit PCM
 */

class CaptureWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 320; // 20ms at 16kHz
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }
    
    /**
     * Convert Float32 audio to Int16 PCM
     */
    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // Clamp values between -1 and 1
            const clamped = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to 16-bit integer
            int16Array[i] = clamped < 0 
                ? clamped * 0x8000 
                : clamped * 0x7FFF;
        }
        return int16Array;
    }
    
    /**
     * Process audio in 128-sample chunks
     */
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        // No input available
        if (!input || !input[0]) {
            return true;
        }
        
        const channelData = input[0]; // Mono channel
        
        // Fill buffer with incoming audio
        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];
            
            // Buffer is full, send it
            if (this.bufferIndex >= this.bufferSize) {
                // Convert to Int16 PCM
                const pcmData = this.float32ToInt16(this.buffer);
                
                // Send to main thread
                this.port.postMessage({
                    type: 'audio',
                    data: pcmData.buffer
                }, [pcmData.buffer]);
                
                // Reset buffer
                this.bufferIndex = 0;
            }
        }
        
        return true; // Keep processor alive
    }
}

registerProcessor('capture-worklet-processor', CaptureWorkletProcessor);