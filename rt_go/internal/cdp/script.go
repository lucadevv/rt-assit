// Package cdp provides Chrome DevTools Protocol integration for audio capture.
package cdp

// JSInjection is the JavaScript code injected into Chrome tabs to capture WebRTC audio.
// It intercepts REMOTE audio tracks (from the other party in a call).
// Supports late injection: hooks existing RTCPeerConnection instances even if Meet was loaded first.
const JSInjection = `
(function() {
  'use strict';

  // ============================================================
  // PHASE 1: IDEMPOTENCY GUARD
  // ============================================================
  if (window.__rtassistInjected) {
    console.log('rtassist: Already injected, skipping');
    return;
  }
  window.__rtassistInjected = true;

  // ============================================================
  // PHASE 1: CONSTANTS
  // ============================================================
  const BINDING_NAME = 'rtassistAudio';
  const SAMPLE_RATE = 16000;
  const CHUNK_SIZE = 4096;
  const POLL_INTERVAL_MS = 2000;
  const POLL_TIMEOUT_MS = 120000; // 2 minutes
  const MAX_SCAN_DEPTH = 5;

  // ============================================================
  // PHASE 1: GLOBAL STATE
  // ============================================================
  let audioContext = null;
  let processor = null;
  let activeStreams = new Set();
  let processedConnections = new WeakSet();
  let isResumed = false;
  let chunkCount = 0;
  let pollIntervalId = null;
  let audioConfirmed = false;

  // ============================================================
  // AUDIOCONTEXT MANAGEMENT (PERSISTENT LISTENERS)
  // ============================================================
  
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processor.connect(audioContext.destination);
      
      tryResume();
      
      // PERSISTENT listeners (no once: true)
      document.addEventListener('click', tryResume);
      document.addEventListener('keydown', tryResume);
      document.addEventListener('touchstart', tryResume);
    }
    return audioContext;
  }
  
  function tryResume() {
    if (audioContext && audioContext.state === 'suspended' && !isResumed) {
      audioContext.resume().then(() => {
        isResumed = true;
        console.log('rtassist: AudioContext resumed successfully');
      }).catch(e => {
        console.warn('rtassist: Could not resume AudioContext:', e.message);
      });
    }
  }

  // ============================================================
  // AUDIO SENDING
  // ============================================================
  
  function sendAudio(audioData) {
    if (typeof window[BINDING_NAME] !== 'function') {
      return;
    }
    
    // Convert Float32 to 16-bit PCM
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const bytes = new Uint8Array(pcmData.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    const payload = JSON.stringify({
      data: base64,
      format: 'linear16',
      timestamp: Date.now()
    });
    
    try {
      window[BINDING_NAME](payload);
      chunkCount++;
      audioConfirmed = true; // Mark that we received audio
      
      if (chunkCount === 1) {
        console.log('rtassist: First audio chunk sent!');
      } else if (chunkCount % 50 === 0) {
        console.log('rtassist: Sent', chunkCount, 'audio chunks to Go');
      }
    } catch (e) {
      console.error('rtassist: Error calling binding:', e);
    }
  }

  // ============================================================
  // PHASE 2: LATE HOOK - Find existing RTCPeerConnection
  // ============================================================
  
  function captureStream(stream) {
    if (activeStreams.has(stream)) return;
    activeStreams.add(stream);
    
    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(processor);
      console.log('rtassist: Capturing remote audio stream');
    } catch (e) {
      console.error('rtassist: Failed to capture stream:', e);
    }
  }
  
  function setupProcessor() {
    if (!processor) return;
    if (processor.onaudioprocess) return; // Already set
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      sendAudio(inputData);
    };
    
    console.log('rtassist: Audio processor setup complete');
  }
  
  function hookConnection(pc) {
    if (processedConnections.has(pc)) return;
    processedConnections.add(pc);
    
    console.log('rtassist: Hooking RTCPeerConnection');
    
    // Hook existing receivers
    pc.getReceivers().forEach(receiver => {
      if (receiver.track && receiver.track.kind === 'audio') {
        const stream = new MediaStream([receiver.track]);
        setupProcessor();
        captureStream(stream);
      }
    });
    
    // Hook future track events
    pc.addEventListener('track', (event) => {
      if (event.track.kind === 'audio' && event.streams.length > 0) {
        setupProcessor();
        captureStream(event.streams[0]);
      }
    });
  }
  
  // Recursive object scanner with depth limit
  function findPCInObject(obj, visited, depth) {
    if (!obj || typeof obj !== 'object') return [];
    if (depth > MAX_SCAN_DEPTH) return [];
    if (visited.has(obj)) return [];
    visited.add(obj);
    
    const results = [];
    const OriginalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    
    if (obj instanceof OriginalRTCPeerConnection) {
      results.push(obj);
    }
    
    try {
      for (const key of Object.keys(obj)) {
        if (key === 'window' || key === 'document' || key === 'location') continue;
        
        const val = obj[key];
        if (val instanceof OriginalRTCPeerConnection) {
          results.push(val);
        } else if (typeof val === 'object' && val !== null) {
          results.push(...findPCInObject(val, visited, depth + 1));
        }
      }
    } catch (e) {
      // Access denied for some properties, ignore
    }
    
    return results;
  }
  
  function searchWindow(win, visited, depth) {
    if (!win || depth > MAX_SCAN_DEPTH) return;
    
    const OriginalRTCPeerConnection = win.RTCPeerConnection || win.webkitRTCPeerConnection;
    
    // Check direct properties on window
    try {
      const suspects = [win.app, win.MeetApp, win.hangouts, win.__redux_store__];
      for (const suspect of suspects) {
        if (suspect) {
          findPCInObject(suspect, visited, depth).forEach(hookConnection);
        }
      }
    } catch (e) {}
    
    // Search iframes
    try {
      for (let i = 0; i < win.frames.length; i++) {
        searchWindow(win.frames[i], visited, depth + 1);
      }
    } catch (e) {}
  }
  
  function findAndHookExistingConnections() {
    const visited = new WeakSet();
    searchWindow(window, visited, 0);
  }

  // ============================================================
  // PHASE 3: POLLING MECHANISM
  // ============================================================
  
  function startPolling() {
    // Initial scan
    findAndHookExistingConnections();
    
    // Periodic polling for new connections
    pollIntervalId = setInterval(() => {
      findAndHookExistingConnections();
    }, POLL_INTERVAL_MS);
    
    // Auto-stop after timeout
    setTimeout(() => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
        console.log('rtassist: Stopped polling for connections');
      }
    }, POLL_TIMEOUT_MS);
    
    console.log('rtassist: Started polling for RTCPeerConnection');
  }

  // ============================================================
  // PHASE 1-2-3: OVERRIDE + POLLING INTEGRATION
  // ============================================================
  
  const OriginalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  
  if (!OriginalRTCPeerConnection) {
    console.warn('rtassist: RTCPeerConnection not available');
    return;
  }
  
  // Override for NEW connections using Object.defineProperty
  // This bypasses the read-only restriction on window.RTCPeerConnection
  Object.defineProperty(window, 'RTCPeerConnection', {
    configurable: true,
    writable: true,
    enumerable: true,
    value: function(...args) {
      const pc = new OriginalRTCPeerConnection(...args);
      hookConnection(pc);
      return pc;
    }
  });
  
  // ============================================================
  // START
  // ============================================================
  
  // Start polling for existing connections
  startPolling();
  
  console.log('rtassist: Late injection script loaded');
  console.log('rtassist: Will poll for existing RTCPeerConnection for', POLL_TIMEOUT_MS / 1000, 'seconds');
})();
`
