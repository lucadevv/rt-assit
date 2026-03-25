// background.js - Service Worker for rtassist Chrome Extension
// Coordinator that creates offscreen documents for audio capture

let isCapturing = false;

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.tab) return;
  
  console.log('[rtassist-bg] Message:', message.type);
  
  if (message.type === 'startCapture') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: 'No tab' });
        return;
      }
      
      const tab = tabs[0];
      console.log('[rtassist-bg] Starting capture for tab:', tab.id, tab.url);
      
      try {
        // Check if tab is already being captured and stop existing capture if needed
        const capturedTabs = await chrome.tabCapture.getCapturedTabs();
        const tabIsAlreadyCaptured = capturedTabs.some(t => t.id === tab.id);
        
        if (tabIsAlreadyCaptured) {
          console.log('[rtassist-bg] Tab already captured, stopping existing capture');
          // Send stop message to offscreen document to stop existing capture
          chrome.runtime.sendMessage({
            type: 'stop-recording'
          });
          // Wait a bit for the stop to take effect
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Create offscreen document if not exists
        const existing = await chrome.offscreen.hasDocument();
        if (!existing) {
          await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Capturar audio de la pestaña para rtassist'
          });
          console.log('[rtassist-bg] Created offscreen document');
          // Wait for offscreen document to load
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Get stream ID for target tab
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
        });
        
        if (!streamId) {
          throw new Error('Could not get media stream ID');
        }
        
        console.log('[rtassist-bg] Got streamId:', streamId);
        
        // Send to offscreen document (with retry)
        let sent = false;
        for (let i = 0; i < 3; i++) {
          try {
            await chrome.runtime.sendMessage({
              type: 'start-recording',
              streamId: streamId,
              targetUrl: tab.url
            });
            sent = true;
            break;
          } catch (e) {
            console.log('[rtassist-bg] Retrying send to offscreen...', i);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (!sent) {
          throw new Error('Could not communicate with offscreen document');
        }
        
        isCapturing = true;
        sendResponse({ success: true });
        
      } catch (err) {
        console.error('[rtassist-bg] Error:', err);
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
    
  } else if (message.type === 'stopCapture') {
    try {
      // Try to send stop message to offscreen document (may fail if not loaded)
      try {
        await chrome.runtime.sendMessage({ type: 'stop-recording' });
      } catch (e) {
        // Ignore - offscreen might not be loaded
        console.log('[rtassist-bg] No offscreen to stop:', e.message);
      }
      
      // Close the offscreen document if exists
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) {
        await chrome.offscreen.closeDocument();
      }
      
      isCapturing = false;
      sendResponse({ success: true });

    } catch (err) {
      console.error('[rtassist-bg] Error stopping capture:', err);
      isCapturing = false;
      sendResponse({ success: true }); // Still return success to reset UI
    }
    return true;
    
  } else if (message.type === 'getStatus') {
    // First check if we're in the middle of capturing
    if (isCapturing) {
      const hasDoc = await chrome.offscreen.hasDocument();
      sendResponse({
        connected: true,
        capturing: hasDoc,
        loaded: true
      });
      return true;
    }
    
    // Not capturing - check if tab is being captured by tabCapture API
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const capturedTabs = await chrome.tabCapture.getCapturedTabs();
        const tabIsCaptured = capturedTabs.some(t => t.id === tabs[0].id);
        const hasDoc = await chrome.offscreen.hasDocument();
        sendResponse({
          connected: true,
          capturing: tabIsCaptured || (isCapturing && hasDoc),
          loaded: true
        });
      } else {
        sendResponse({ connected: true, capturing: false, loaded: false });
      }
    });
    return true;
  }
});

// Listen for errors from offscreen document
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'capture-error') {
    console.error('[rtassist-bg] Capture error from offscreen:', message.error);
    isCapturing = false;
    // Notify popup of error
    chrome.runtime.sendMessage({
      type: 'capture-error',
      error: message.error
    });
  }
});

console.log('[rtassist-bg] Ready');
