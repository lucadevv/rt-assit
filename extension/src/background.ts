// Background Service Worker - Coordinator for rtassist Chrome Extension
// Implements Clean Architecture with dependency injection

import { captureService } from '../services/capture-service';

const STATE = {
  isCapturing: false,
  currentTabId: null as number | null
};

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return tab;
}

async function ensureOffscreenDocument(): Promise<void> {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Audio capture for interview assistant'
    });
    await new Promise(r => setTimeout(r, 500));
  }
}

async function getStreamId(tabId: number): Promise<string> {
  return chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
}

async function startCapture(): Promise<void> {
  if (STATE.isCapturing) {
    console.log('[Background] Already capturing, stopping first');
    await stopCapture();
  }

  const tab = await getActiveTab();
  if (!tab.id) throw new Error('No tab ID');

  STATE.currentTabId = tab.id;

  try {
    await ensureOffscreenDocument();

    const streamId = await getStreamId(tab.id);
    if (!streamId) throw new Error('Could not get stream ID');

    await captureService.start({
      targetTabId: tab.id,
      targetUrl: tab.url || '',
      streamId
    });

    STATE.isCapturing = true;
    console.log('[Background] Capture started for tab:', tab.id);

  } catch (error) {
    console.error('[Background] Capture failed:', error);
    STATE.isCapturing = false;
    throw error;
  }
}

async function stopCapture(): Promise<void> {
  await captureService.stop();
  STATE.isCapturing = false;
  STATE.currentTabId = null;
  console.log('[Background] Capture stopped');
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) return; // Ignore messages from tabs

  (async () => {
    try {
      switch (message.type) {
        case 'startCapture':
          await startCapture();
          sendResponse({ success: true });
          break;

        case 'stopCapture':
          await stopCapture();
          sendResponse({ success: true });
          break;

        case 'getStatus':
          sendResponse({
            isCapturing: STATE.isCapturing,
            tabId: STATE.currentTabId
          });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })();

  return true; // Async response
});

// Listen for tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (STATE.isCapturing && STATE.currentTabId !== activeInfo.tabId) {
    console.log('[Background] Tab changed, stopping capture');
    await stopCapture();
  }
});

console.log('[Background] rtassist service worker loaded');
