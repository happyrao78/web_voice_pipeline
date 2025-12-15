import { WebSocketServer } from 'ws';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import textToSpeech from '@google-cloud/text-to-speech';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;

// Read API keys from .env file
let GROQ_API_KEY = '';
let GOOGLE_CREDENTIALS_PATH = '';
let PICOVOICE_ACCESS_KEY = '';

try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        const groqMatch = envContent.match(/GROQ_API_KEY=(.+)/);
        if (groqMatch) {
            GROQ_API_KEY = groqMatch[1].trim();
        }
        
        const googleMatch = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS=(.+)/);
        if (googleMatch) {
            GOOGLE_CREDENTIALS_PATH = googleMatch[1].trim();
        }
        
        const picovoiceMatch = envContent.match(/PICOVOICE_ACCESS_KEY=(.+)/);
        if (picovoiceMatch) {
            PICOVOICE_ACCESS_KEY = picovoiceMatch[1].trim();
        }
    }
} catch (error) {
    console.error('Error reading .env file:', error);
}

if (!GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY not found in .env file');
    process.exit(1);
}

if (!GOOGLE_CREDENTIALS_PATH) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not found in .env file');
    process.exit(1);
}

if (!PICOVOICE_ACCESS_KEY) {
    console.error('ERROR: PICOVOICE_ACCESS_KEY not found in .env file');
    process.exit(1);
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

const ttsClient = new textToSpeech.TextToSpeechClient();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/porcupine-key') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ key: PICOVOICE_ACCESS_KEY }));
        return;
    }
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Proxy Server Running (Groq + Google TTS + Porcupine)\n');
});


const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs, req) => {
    console.log('Client connected');
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const service = url.searchParams.get('service');
    
    if (service === 'stt') {
        handleSTTConnection(clientWs);
    } else if (service === 'tts') {
        handleTTSConnection(clientWs);
    } else {
        console.error('Unknown service:', service);
        clientWs.close();
    }
});


function handleSTTConnection(clientWs) {
    console.log('STT service connected (Groq Whisper - Optimized)');
    
    let audioBuffer = [];
    let isTranscribing = false;
    
    clientWs.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'start':
                    
                    clientWs.send(JSON.stringify({
                        type: 'ready',
                        message: 'Groq STT ready'
                    }));
                    break;
                    
                case 'audio':
                    
                    const audioData = Buffer.from(message.audio, 'base64');
                    audioBuffer.push(audioData);
                    break;
                    
                case 'transcribe':
                    
                    if (!isTranscribing && audioBuffer.length > 0) {
                        isTranscribing = true;
                        
                        const startTime = Date.now();
                        const audioBlob = Buffer.concat(audioBuffer);
                        audioBuffer = []; 
                        
                        
                        transcribeWithGroq(audioBlob)
                            .then(transcript => {
                                const transcriptionTime = Date.now() - startTime;
                                console.log(`✅ Groq transcription completed in ${transcriptionTime}ms`);
                                
                                clientWs.send(JSON.stringify({
                                    type: 'transcript',
                                    text: transcript
                                }));
                            })
                            .catch(error => {
                                console.error('Transcription error:', error);
                                clientWs.send(JSON.stringify({
                                    type: 'error',
                                    message: error.message
                                }));
                            })
                            .finally(() => {
                                isTranscribing = false;
                            });
                    }
                    break;
            }
        } catch (error) {
            console.error('STT message error:', error);
        }
    });
    
    clientWs.on('close', () => {
        console.log('STT client disconnected');
    });
}


function handleTTSConnection(clientWs) {
    console.log('TTS service connected (Google Wavenet - Optimized)');
    
    clientWs.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'start':
                
                    clientWs.send(JSON.stringify({
                        type: 'ready',
                        message: 'Google TTS ready'
                    }));
                    break;
                    
                case 'speak':
                    const text = message.text;
                    const startTime = Date.now();
                    
                    try {
                        await synthesizeWithGoogleOptimized(text, clientWs);
                        
                        const synthesisTime = Date.now() - startTime;
                        console.log(`✅ Google TTS completed in ${synthesisTime}ms`);
                        
                    
                        clientWs.send(JSON.stringify({
                            type: 'done'
                        }));
                    } catch (error) {
                        console.error('TTS error:', error);
                        clientWs.send(JSON.stringify({
                            type: 'error',
                            message: error.message
                        }));
                    }
                    break;
            }
        } catch (error) {
            console.error('TTS message error:', error);
        }
    });
    
    clientWs.on('close', () => {
        console.log('TTS client disconnected');
    });
}


async function transcribeWithGroq(audioBuffer) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        
        const wavBuffer = createWavFile(audioBuffer);
        
        form.append('file', wavBuffer, {
            filename: 'audio.wav',
            contentType: 'audio/wav'
        });
        form.append('model', 'whisper-large-v3-turbo'); 
        form.append('language', 'en');
        form.append('response_format', 'json');
        form.append('temperature', '0'); 
        
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/audio/transcriptions',
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${GROQ_API_KEY}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.text || '');
                } catch (error) {
                    reject(new Error('Failed to parse Groq response'));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Groq API timeout'));
        });
        
        form.pipe(req);
    });
}


async function synthesizeWithGoogleOptimized(text, clientWs) {
    const request = {
        input: { text: text },
        voice: {
            languageCode: 'en-US',
            name: 'en-US-Standard-F', 
            ssmlGender: 'FEMALE'
        },
        audioConfig: {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 16000,
            speakingRate: 1.15, 
            pitch: 0.0
        }
    };
    
    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent;
    
    const chunkSize = 800; 
    
    for (let i = 0; i < audioContent.length; i += chunkSize) {
        const chunk = audioContent.slice(i, i + chunkSize);
        
        clientWs.send(JSON.stringify({
            type: 'audio',
            data: chunk.toString('base64')
        }));
        
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function createWavFile(pcmData) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    
    const header = Buffer.alloc(44);
    
    
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, pcmData]);
}

server.listen(PORT, () => {
    console.log(`✓ WebSocket Proxy Server running on ws://localhost:${PORT}`);
    console.log(`✓ Groq API Key loaded: ${GROQ_API_KEY.substring(0, 10)}...`);
    console.log(`✓ Google Credentials: ${GOOGLE_CREDENTIALS_PATH}`);
    console.log(`✓ Picovoice Access Key loaded: ${PICOVOICE_ACCESS_KEY.substring(0, 10)}...`);
    console.log(`✓ OPTIMIZED for ultra-low latency (<800ms target)`);
    console.log(`Ready to proxy STT (Groq Turbo), TTS (Google Standard), and Porcupine`);
});