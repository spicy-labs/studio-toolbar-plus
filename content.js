// First, get the current extension version
const currentVersion = chrome.runtime.getManifest().version;

// Break currentVersion down into major, minor, patch
const [currentMajor, currntMinor, currentPatch] = currentVersion
  .split(".")
  .map(Number);

// Create a function to fetch the GitHub version
async function checkForUpdates() {
  try {
    // Check if we've already notified about this version
    const lastNotifiedVersion = localStorage.getItem(
      "toolbarplus_last_notified_version"
    );

    // Fetch the package.json from GitHub's main branch
    const response = await fetch(
      "https://raw.githubusercontent.com/spicy-labs/studio-toolbar-plus/refs/heads/main/manifest.json"
    );
    const packageJson = await response.json();
    const githubVersion = packageJson.version;
    const [githubMajor, githubMinor, githubPatch] = githubVersion
      .split(".")
      .map(Number);

    // Compare versions and check if we've already notified
    if (
      githubMajor > currentMajor ||
      (githubMajor === currentMajor && githubMinor > currntMinor) ||
      (githubMajor === currentMajor &&
        githubMinor === currntMinor &&
        githubPatch > currentPatch &&
        githubVersion !== lastNotifiedVersion)
    ) {
      // Create a hidden div with version information
      const versionDiv = document.createElement("div");
      versionDiv.id = "toolbar-version";
      versionDiv.style.display = "none";
      versionDiv.dataset.currentVersion = currentVersion;
      versionDiv.dataset.latestVersion = githubVersion;
      document.body.appendChild(versionDiv);

      // Dispatch custom event to notify React app about the update
      // const updateEvent = new CustomEvent('toolbarPlusUpdate', {
      //   detail: {
      //     currentVersion,
      //     latestVersion: githubVersion
      //   }
      // });
      // document.dispatchEvent(updateEvent);
    }
  } catch (error) {
    console.error("Failed to check for updates:", error);
  }
}

// Inject CSS
const link = document.createElement("link");
link.rel = "stylesheet";
link.type = "text/css";
link.href = chrome.runtime.getURL("./dist/index.css");

// Insert at the top of head if it exists
if (document.head) {
  document.head.insertBefore(link, document.head.firstChild);
} else if (document.documentElement) {
  // Fallback if head doesn't exist yet
  document.documentElement.appendChild(link);
}

// Inject JavaScript
const script = document.createElement("script");
script.src = chrome.runtime.getURL("./dist/index.js");
(document.head || document.documentElement).appendChild(script);

// Check for updates when the document is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkForUpdates);
} else {
  checkForUpdates();
}

// Add message listener for acknowledging version notification
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "acknowledge_version") {
    localStorage.setItem("toolbarplus_last_notified_version", message.version);
  } else if (message.action === "downloadComplete") {
    // Forward download completion messages to the page
    window.postMessage(
      {
        type: "DOWNLOAD_COMPLETE",
        data: message.data,
      },
      "*"
    );
  }
});

// Listen for messages from the page (React component)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "START_DOWNLOAD") {
    // Forward download requests to background script
    chrome.runtime.sendMessage(
      {
        action: "startDownload",
        data: event.data.data,
      },
      (response) => {
        // Send response back to page
        window.postMessage(
          {
            type: "DOWNLOAD_RESPONSE",
            requestId: event.data.requestId,
            response: response,
          },
          "*"
        );
      }
    );
  }
});
