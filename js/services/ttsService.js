/**
 * Text-to-Speech Service
 * Handles streaming TTS via OpenAI Realtime API through proxy
 */

class TTSService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isSpeaking = false;
        
        // Callbacks
        this.onAudioChunk = null;
        this.onSpeechStarted = null;
        this.onSpeechEnded = null;
        this.onError = null;
        
        // Session state
        this.sessionId = null;
        this.currentResponseId = null;
    }
    
    /**
     * Connect to OpenAI Realtime API via local proxy
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Connect to LOCAL proxy server (not directly to OpenAI)
                const wsUrl = `ws://localhost:8080?model=gpt-4o-mini-realtime-preview-2024-12-17`;
                
                console.log('Connecting TTS to proxy server:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('TTS WebSocket connected to proxy');
                    this.isConnected = true;
                    
                    // Send session configuration
                    this.sendSessionUpdate();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('TTS WebSocket error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('TTS WebSocket closed');
                    this.isConnected = false;
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Send session configuration
     */
    sendSessionUpdate() {
        const sessionConfig = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: 'You are a helpful voice assistant.',
                voice: 'shimmer',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                turn_detection: null // Disable turn detection for TTS-only mode
            }
        };
        
        this.send(sessionConfig);
    }
    
    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'session.created':
                    this.sessionId = message.session.id;
                    console.log('TTS session created:', this.sessionId);
                    break;
                    
                case 'response.audio.delta':
                    // Streaming audio chunk
                    if (message.delta && this.onAudioChunk) {
                        const audioData = this.base64ToArrayBuffer(message.delta);
                        this.onAudioChunk(audioData);
                    }
                    break;
                    
                case 'response.audio.done':
                    console.log('TTS audio stream completed');
                    this.isSpeaking = false;
                    if (this.onSpeechEnded) {
                        this.onSpeechEnded();
                    }
                    break;
                    
                case 'response.created':
                    this.currentResponseId = message.response.id;
                    console.log('Response created:', this.currentResponseId);
                    break;
                    
                case 'response.output_item.added':
                    console.log('Output item added');
                    break;
                    
                case 'response.content_part.added':
                    console.log('Content part added');
                    if (this.onSpeechStarted) {
                        this.onSpeechStarted();
                    }
                    this.isSpeaking = true;
                    break;
                    
                case 'error':
                    console.error('TTS error:', message.error);
                    if (this.onError) {
                        this.onError(new Error(message.error.message || 'Unknown error'));
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to parse TTS message:', error);
        }
    }
    
    /**
     * Synthesize text to speech
     */
    speak(text) {
        if (!this.isConnected || !this.ws) {
            console.warn('Cannot speak: not connected');
            return;
        }
        
        console.log('Speaking:', text);
        
        // Create conversation item with text
        const createMessage = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: text
                    }
                ]
            }
        };
        
        this.send(createMessage);
        
        // Create response request
        const responseMessage = {
            type: 'response.create',
            response: {
                modalities: ['audio'],
                instructions: 'Respond to the user message.'
            }
        };
        
        this.send(responseMessage);
    }
    
    /**
     * Cancel current speech
     */
    cancel() {
        if (this.currentResponseId) {
            const cancelMessage = {
                type: 'response.cancel'
            };
            this.send(cancelMessage);
        }
        this.isSpeaking = false;
    }
    
    /**
     * Send message via WebSocket
     */
    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send TTS message:', error);
        }
    }
    
    /**
     * Set callbacks
     */
    setCallbacks({ onAudioChunk, onSpeechStarted, onSpeechEnded, onError }) {
        this.onAudioChunk = onAudioChunk;
        this.onSpeechStarted = onSpeechStarted;
        this.onSpeechEnded = onSpeechEnded;
        this.onError = onError;
    }
    
    /**
     * Disconnect from service
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isSpeaking = false;
    }
    
    /**
     * Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Check if connected
     */
    isActive() {
        return this.isConnected;
    }
    
    /**
     * Check if currently speaking
     */
    isSpeakingNow() {
        return this.isSpeaking;
    }
}

export default TTSService;