// content.js - Runs on Meet/Teams/Zoom pages
// Handles audio capture via tabCapture

console.log('[rtassist-content] Script starting...');

let ws = null;
let audioTrack = null;
let currentStream = null;
let isCapturing = false;

console.log('[rtassist-content] Variables initialized');

// Connect to rtassist WebSocket server
function connectToRtassist() {
  const rtassistURL = 'ws://localhost:8766/audio';
  console.log('[rtassist-content] Connecting to:', rtassistURL);
  
  try {
    ws = new WebSocket(rtassistURL);
    console.log('[rtassist-content] WebSocket created');
    
    ws.onopen = () => {
      console.log('[rtassist-content] WebSocket connected!');
      chrome.runtime.sendMessage({ type: 'contentConnected' });
    };
    
    ws.onclose = () => {
      console.log('[rtassist-content] WebSocket disconnected');
      if (isCapturing) {
        setTimeout(connectToRtassist, 3000);
      }
    };
    
    ws.onerror = (err) => {
      console.error('[rtassist-content] WebSocket error:', err);
    };
    
    ws.onmessage = (event) => {
      console.log('[rtassist-content] Message from rtassist:', event.data);
    };
  } catch (err) {
    console.error('[rtassist-content] Failed to create WebSocket:', err);
    if (isCapturing) {
      setTimeout(connectToRtassist, 3000);
    }
  }
}

async function startCapture() {
  if (isCapturing) {
    console.log('[rtassist-content] Already capturing');
    return;
  }
  
  console.log('[rtassist-content] Starting capture...');
  
  try {
    console.log('[rtassist-content] Calling chrome.tabCapture.capture...');
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });
    console.log('[rtassist-content] tabCapture returned:', stream);
    
    if (!stream) {
      console.error('[rtassist-content] tabCapture returned null');
      chrome.runtime.sendMessage({ type: 'captureError', error: 'tabCapture returned null' });
      return;
    }
    
    const audioTracks = stream.getAudioTracks();
    console.log('[rtassist-content] Audio tracks:', audioTracks.length);
    
    if (audioTracks.length === 0) {
      console.error('[rtassist-content] No audio track');
      stream.getTracks().forEach(t => t.stop());
      chrome.runtime.sendMessage({ type: 'captureError', error: 'No audio track' });
      return;
    }
    
    currentStream = stream;
    audioTrack = audioTracks[0];
    isCapturing = true;
    
    console.log('[rtassist-content] Capture started:', audioTrack.label);
    chrome.runtime.sendMessage({ type: 'captureStarted', label: audioTrack.label });
    
    // Create AudioContext
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      sendAudioChunk(inputData);
    };
    
    audioTrack.onended = () => {
      console.log('[rtassist-content] Track ended');
      stopCapture();
    };
    
  } catch (err) {
    console.error('[rtassist-content] Capture error:', err);
    isCapturing = false;
    chrome.runtime.sendMessage({ type: 'captureError', error: err.message });
  }
}

function stopCapture() {
  console.log('[rtassist-content] Stopping capture');
  isCapturing = false;
  
  if (audioTrack) {
    try { audioTrack.stop(); } catch (e) {}
    audioTrack = null;
  }
  
  if (currentStream) {
    try { currentStream.getTracks().forEach(track => track.stop()); } catch (e) {}
    currentStream = null;
  }
  
  chrome.runtime.sendMessage({ type: 'captureStopped' });
}

function sendAudioChunk(float32Array) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  try {
    ws.send(int16Array.buffer);
  } catch (err) {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[rtassist-content] Message from background:', message.type);
  
  switch (message.type) {
    case 'startCapture':
      startCapture();
      sendResponse({ success: true });
      break;
      
    case 'stopCapture':
      stopCapture();
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({ 
        isCapturing: isCapturing,
        connected: ws && ws.readyState === WebSocket.OPEN
      });
      return true;
  }
});

console.log('[rtassist-content] Setting up connection...');
connectToRtassist();

console.log('[rtassist-content] Script loaded on', window.location.href);
