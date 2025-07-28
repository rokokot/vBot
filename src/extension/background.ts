// src/extension/background.ts
// Background Service Worker for Chrome Extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize with default settings
    chrome.storage.local.set({
      books: [],
      settings: {
        autoFillTitle: true,
        autoFillDescription: true,
        includeISBN: true,
        useEmojis: true
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we're on a Vinted page
  if (tab.url && tab.url.includes('vinted.com')) {
    // If on listing page, inject content script if not already present
    if (tab.url.includes('/items/new')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js']
        });
      } catch (error) {
        console.log('Content script already injected or failed to inject');
      }
    }
  }
});

// Listen for tab updates to update badge
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Update badge based on current page
    if (tab.url.includes('vinted.com/items/new')) {
      chrome.action.setBadgeText({
        text: '●',
        tabId: tabId
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#10b981',
        tabId: tabId
      });
      chrome.action.setTitle({
        title: 'Vinted Book Lister - Ready to autofill!',
        tabId: tabId
      });
    } else if (tab.url.includes('vinted.com')) {
      chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });
      chrome.action.setTitle({
        title: 'Vinted Book Lister - Navigate to listing page',
        tabId: tabId
      });
    } else {
      chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });
      chrome.action.setTitle({
        title: 'Vinted Book Lister',
        tabId: tabId
      });
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          isVintedPage: tabs[0].url?.includes('vinted.com') || false,
          isListingPage: tabs[0].url?.includes('vinted.com/items/new') || false
        });
      }
    });
    return true;
  }
  
  if (request.action === 'openVintedListing') {
    chrome.tabs.create({
      url: 'https://www.vinted.com/items/new'
    });
  }
});

// Context menu for quick actions
chrome.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId === 'openVintedListing') {
    chrome.tabs.create({
      url: 'https://www.vinted.com/items/new'
    });
  }
});

// Create context menu on startup
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'openVintedListing',
      title: 'Open Vinted Listing Page',
      contexts: ['action']
    });
  });
}