// Background script for handling downloads
// This script manages downloads using chrome.downloads.download API

// Track active downloads
const activeDownloads = new Map();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startDownload") {
    handleDownload(message.data, sender.tab.id)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Handle download request
async function handleDownload(downloadData, tabId) {
  const { url, authorization, folder, filename, downloadId } = downloadData;

  try {
    if (!url) {
      throw new Error("URL is required for download");
    }

    const downloadUrl = url;

    // Prepare download options
    const downloadOptions = {
      url: downloadUrl,
      filename: `spicy-toolbar/${folder}/${filename}`,
      saveAs: false, // Don't show save dialog
    };

    // Add authorization header if provided (only for external URLs)
    if (authorization && url) {
      // For Chrome extensions, we need to handle authorization differently
      // We'll use the onBeforeRequest listener to add headers
      setupAuthorizationHeader(url, authorization);
    }

    // Start the download
    const chromeDownloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download(downloadOptions, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    });

    // Track the download
    activeDownloads.set(chromeDownloadId, {
      downloadId: downloadId,
      tabId: tabId,
      url: url,
      downloadUrl: downloadUrl,
      filename: filename,
      folder: folder,
      status: "in_progress",
    });

    // Listen for download completion
    const downloadListener = (downloadDelta) => {
      if (downloadDelta.id === chromeDownloadId) {
        if (downloadDelta.state && downloadDelta.state.current === "complete") {
          handleDownloadComplete(chromeDownloadId, true);
          chrome.downloads.onChanged.removeListener(downloadListener);
        } else if (
          downloadDelta.state &&
          downloadDelta.state.current === "interrupted"
        ) {
          handleDownloadComplete(
            chromeDownloadId,
            false,
            downloadDelta.error?.current
          );
          chrome.downloads.onChanged.removeListener(downloadListener);
        }
      }
    };

    chrome.downloads.onChanged.addListener(downloadListener);

    return { chromeDownloadId, downloadId };
  } catch (error) {
    // Notify frontend of error
    notifyDownloadComplete(tabId, downloadId, false, error.message);
    throw error;
  }
}

// Handle download completion
function handleDownloadComplete(
  chromeDownloadId,
  success,
  errorMessage = null
) {
  const downloadInfo = activeDownloads.get(chromeDownloadId);

  if (downloadInfo) {
    downloadInfo.status = success ? "complete" : "error";
    downloadInfo.error = errorMessage;

    // No cleanup needed for blob URLs created in the React component

    // Notify the frontend
    notifyDownloadComplete(
      downloadInfo.tabId,
      downloadInfo.downloadId,
      success,
      errorMessage
    );

    // Clean up
    activeDownloads.delete(chromeDownloadId);
  }
}

// Notify frontend of download completion
function notifyDownloadComplete(
  tabId,
  downloadId,
  success,
  errorMessage = null
) {
  chrome.tabs
    .sendMessage(tabId, {
      action: "downloadComplete",
      data: {
        downloadId: downloadId,
        success: success,
        error: errorMessage,
      },
    })
    .catch((error) => {
      console.error("Failed to notify frontend:", error);
    });
}

// Setup authorization header for downloads
function setupAuthorizationHeader(url, authorization) {
  // For Manifest V3, we'll use a simpler approach
  // Store the authorization for this specific URL temporarily
  const authMap = new Map();
  authMap.set(url, authorization);

  // Add request listener for this specific download
  const requestListener = (details) => {
    if (details.url === url && authMap.has(url)) {
      const auth = authMap.get(url);

      // Add authorization header
      const newHeaders = [...(details.requestHeaders || [])];
      newHeaders.push({
        name: "Authorization",
        value: auth,
      });

      // Clean up after first use
      authMap.delete(url);
      chrome.webRequest.onBeforeSendHeaders.removeListener(requestListener);

      return { requestHeaders: newHeaders };
    }
  };

  // Add the listener
  chrome.webRequest.onBeforeSendHeaders.addListener(
    requestListener,
    { urls: [url] },
    ["requestHeaders"]
  );

  // Clean up after 30 seconds if not used
  setTimeout(() => {
    if (authMap.has(url)) {
      authMap.delete(url);
      chrome.webRequest.onBeforeSendHeaders.removeListener(requestListener);
    }
  }, 30000);
}

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Downloader background script started");
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Downloader background script installed");
});
