// offscreen.js - Handles audio capture in offscreen document
// Uses AudioWorklet to capture raw PCM at 48kHz for Deepgram free tier

let stream = null;
let ws = null;
let audioContext = null;
let pcmProcessor = null;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8766/audio');
    
    ws.onopen = () => {
        console.log('[offscreen] WebSocket connected');
    };
    
    ws.onclose = () => {
        console.log('[offscreen] WebSocket closed');
        ws = null;
        // Try to reconnect after a delay
        setTimeout(() => {
            if (stream && stream.active) {
                connectWebSocket();
            }
        }, 1000);
    };
    
    ws.onerror = (err) => {
        console.error('[offscreen] WebSocket error:', err);
    };
}

async function startAudioCapture(streamId) {
    try {
        console.log('[offscreen] Requesting getUserMedia with chromeMediaSource');
        
        // 1. Obtener stream del tab (audio de Meet)
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });
        
        console.log('[offscreen] Got stream:', stream);
        
        // 2. LAS 4 LÍNEAS MÁGICAS: restaurar audio para el usuario
        // Sin esto, Chrome silencia el audio del tab
        audioContext = new AudioContext();
        const outputSource = audioContext.createMediaStreamSource(stream);
        outputSource.connect(audioContext.destination);
        console.log('[offscreen] Audio playback preserved via AudioContext');
        
        // 3. Crear AudioWorklet para capturar PCM crudo
        await audioContext.audioWorklet.addModule(chrome.runtime.getURL('pcm-processor.js'));
        
        const pcmProcessorNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        pcmProcessorNode.port.onmessage = (event) => {
            if (event.data.pcm && ws && ws.readyState === WebSocket.OPEN) {
                // event.data.pcm es un ArrayBuffer de Int16 (linear16, 48kHz, mono)
                ws.send(event.data.pcm);
            }
        };
        
        // 4. Conectar el stream de audio al processor
        const inputSource = audioContext.createMediaStreamSource(stream);
        inputSource.connect(pcmProcessorNode);
        
        console.log('[offscreen] AudioWorklet started, capturing PCM');
        
        // 5. Conectar WebSocket
        connectWebSocket();
        
        return true;
        
    } catch (err) {
        console.error('[offscreen] Error starting capture:', err);
        chrome.runtime.sendMessage({
            type: 'capture-error',
            error: err.message
        });
        return false;
    }
}

function stopAudioCapture() {
    console.log('[offscreen] Stopping audio capture');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    if (ws) {
        ws.close();
        ws = null;
    }
}

chrome.runtime.onMessage.addListener(async (message) => {
    console.log('[offscreen] Received message:', message.type);
    
    if (message.type === 'start-recording') {
        await startAudioCapture(message.streamId);
    }
    
    if (message.type === 'stop-recording') {
        stopAudioCapture();
    }
    
    return true;
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    console.log('[offscreen] Visibility:', document.hidden ? 'hidden' : 'visible');
});

// Handle errors
window.addEventListener('error', (e) => {
    console.error('[offscreen] Uncaught error:', e.error);
});

console.log('[offscreen] Offscreen document loaded');
