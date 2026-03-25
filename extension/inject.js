// inject.js - Injected into Meet/Teams/Zoom pages via chrome.scripting.executeScript
// Handles audio capture via tabCapture

(function() {
  'use strict';
  
  console.log('[rtassist] Inject script running');
  
  if (window.__rtassistCapturing) {
    console.log('[rtassist] Already capturing');
    return;
  }
  
  window.__rtassistCapturing = true;
  
  let ws = null;
  let audioTrack = null;
  let currentStream = null;
  
  function log(msg) {
    console.log('[rtassist]', msg);
  }
  
  function connectWS() {
    log('Connecting to ws://localhost:8766/audio');
    ws = new WebSocket('ws://localhost:8766/audio');
    
    ws.onopen = () => {
      log('WebSocket connected!');
    };
    
    ws.onclose = () => {
      log('WebSocket closed');
      ws = null;
    };
    
    ws.onerror = (err) => {
      log('WebSocket error: ' + err);
    };
  }
  
  async function startCapture() {
    log('Starting capture...');
    
    try {
      log('Calling chrome.tabCapture.capture...');
      
      const stream = await chrome.tabCapture.capture({
        audio: true,
        video: false
      });
      
      log('tabCapture returned: ' + (stream ? 'stream with ' + stream.getAudioTracks().length + ' tracks' : 'null'));
      
      if (!stream) {
        log('ERROR: tabCapture returned null');
        window.__rtassistCapturing = false;
        return;
      }
      
      const tracks = stream.getAudioTracks();
      
      if (tracks.length === 0) {
        log('ERROR: No audio tracks');
        stream.getTracks().forEach(t => t.stop());
        window.__rtassistCapturing = false;
        return;
      }
      
      currentStream = stream;
      audioTrack = tracks[0];
      log('Capture started: ' + audioTrack.label);
      
      // Connect to rtassist
      connectWS();
      
      // Create AudioContext for processing
      const ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(ctx.destination);
      
      // Send audio data
      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        try {
          ws.send(pcmData.buffer);
        } catch (err) {
          log('WS send error: ' + err);
        }
      };
      
      // Handle track ending
      audioTrack.onended = () => {
        log('Audio track ended');
        stopCapture();
      };
      
    } catch (err) {
      log('Capture error: ' + err);
      window.__rtassistCapturing = false;
    }
  }
  
  function stopCapture() {
    log('Stopping capture');
    window.__rtassistCapturing = false;
    
    if (audioTrack) {
      try { audioTrack.stop(); } catch (e) {}
      audioTrack = null;
    }
    
    if (currentStream) {
      try { currentStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      currentStream = null;
    }
    
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
  }
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    log('Message from background: ' + msg.type);
    
    if (msg.type === 'startCapture') {
      startCapture();
      sendResponse({ success: true });
    } else if (msg.type === 'stopCapture') {
      stopCapture();
      sendResponse({ success: true });
    } else if (msg.type === 'getStatus') {
      sendResponse({ isCapturing: window.__rtassistCapturing });
    }
    
    return true;
  });
  
  log('Inject script ready');
})();
