// popup.js - Handles popup UI interactions

let isTransitioning = false;
let ourTabId = null;

function log(msg) {
  console.log('[popup]', msg);
  const el = document.getElementById('debugInfo');
  if (el) el.textContent = msg;
}

document.addEventListener('DOMContentLoaded', () => {
  log('Loading...');
  
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  async function update() {
    // Skip if we're in a transition (waiting for stop to take effect)
    if (isTransitioning) {
      return;
    }
    
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        dot.className = 'dot disconnected';
        text.textContent = 'No tab';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        ourTabId = null;
        return;
      }
      
      const currentTabId = tabs[0].id;
      
      // Check tabCapture status - only count OUR tab
      const capturedTabs = await chrome.tabCapture.getCapturedTabs();
      const ourTabIsCaptured = capturedTabs.some(t => t.id === currentTabId);
      
      // Check if offscreen document exists
      const hasDoc = await chrome.offscreen.hasDocument();
      
      // We're capturing if either: our tab is in capturedTabs OR offscreen exists
      const isCapturing = ourTabIsCaptured || hasDoc;
      
      log('tab=' + currentTabId + ', ourCap=' + ourTabIsCaptured + ', doc=' + hasDoc);
      
      dot.className = 'dot ' + (isCapturing ? 'capturing' : 'connected');
      text.textContent = isCapturing ? 'Capturing!' : 'Ready';
      
      startBtn.style.display = isCapturing ? 'none' : 'block';
      stopBtn.style.display = isCapturing ? 'block' : 'none';
      
      // Remember which tab we're tracking
      if (isCapturing) {
        ourTabId = currentTabId;
      } else {
        ourTabId = null;
      }
    } catch (err) {
      log('Error: ' + err.message);
      dot.className = 'dot disconnected';
      text.textContent = 'Error';
    }
  }
  
  startBtn.onclick = async () => {
    log('Starting...');
    text.textContent = 'Starting...';
    startBtn.disabled = true;
    isTransitioning = true;
    
    try {
      // Get current tab first
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        log('No tab');
        startBtn.disabled = false;
        isTransitioning = false;
        return;
      }
      
      const tabId = tabs[0].id;
      ourTabId = tabId; // Remember our tab
      
      // Send start capture message
      const response = await chrome.runtime.sendMessage({ 
        type: 'startCapture',
        tabId: tabId 
      });
      
      log('Result: ' + JSON.stringify(response));
      
      if (response && response.success) {
        text.textContent = 'Capturing!';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        text.textContent = 'Error: ' + (response?.error || 'Unknown');
        log('Failed: ' + (response?.error || 'Unknown error'));
        ourTabId = null;
      }
      startBtn.disabled = false;
    } catch (err) {
      log('Exception: ' + err.message);
      startBtn.disabled = false;
      ourTabId = null;
    }
    
    // Refresh status after a moment
    setTimeout(() => {
      isTransitioning = false;
      update();
    }, 1000);
  };
  
  stopBtn.onclick = async () => {
    log('Stopping...');
    stopBtn.disabled = true;
    isTransitioning = true;
    
    // Update UI immediately (optimistic)
    text.textContent = 'Stopping...';
    dot.className = 'dot disconnected';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    
    try {
      await chrome.runtime.sendMessage({ type: 'stopCapture' });
    } catch (err) {
      log('Stop: ' + err.message);
    }
    
    // Give time for stop to take effect, then re-enable updates
    setTimeout(() => {
      ourTabId = null; // Clear our tab on stop
      isTransitioning = false;
      update();
    }, 2000);
  };
  
  update();
  setInterval(update, 2000);
});
