// First, get the current extension version
const currentVersion = chrome.runtime.getManifest().version;

// Break currentVersion down into major, minor, patch
// const [currentMajor, currentMinor, currentPatch] = currentVersion.split(".").map(Number);

// // Create a function to fetch the GitHub version
// async function checkForUpdates() {
//   try {
//     // Check if we've already notified about this version
//     const lastNotifiedVersion = localStorage.getItem(
//       "toolbarplus_last_notified_version"
//     );

//     // Fetch the package.json from GitHub's main branch
//     const manifestResp = await fetch(
//       "https://raw.githubusercontent.com/spicy-labs/studio-toolbar-plus/refs/heads/main/manifest.json"
//     );
//     const packageJson = await manifestResp.json();
//     const githubVersion = packageJson.version;
//     const [githubMajor, githubMinor, githubPatch] = githubVersion.split(".");

//     // Compare versions and check if we've already notified
//     if (
//       githubMajor > currentMajor ||
//       (githubMajor === currentMajor && githubMinor > currntMinor) ||
//       (githubMajor === currentMajor &&
//         githubMinor === currntMinor &&
//         githubPatch > currentPatch &&
//         githubVersion !== lastNotifiedVersion)
//     ) {
//       const changelogResp = await fetch(
//         "https://raw.githubusercontent.com/spicy-labs/studio-toolbar-plus/refs/heads/main/CHANGELOG.md"
//       );

//       const changelog = await changelogResp.text();

//       // Parse and convert changelog for the current GitHub version
//       const changelogHtml = parseChangelogToHtml(changelog, githubVersion);

//       // Create a hidden div with version information
//       const versionDiv = document.createElement("div");
//       versionDiv.id = "toolbar-version";
//       versionDiv.style.display = "none";
//       versionDiv.dataset.currentVersion = currentVersion;
//       versionDiv.dataset.latestVersion = githubVersion;
//       versionDiv.innerHTML = changelogHtml;
//       document.body.appendChild(versionDiv);

//       // Dispatch custom event to notify React app about the update
//       // const updateEvent = new CustomEvent('toolbarPlusUpdate', {
//       //   detail: {
//       //     currentVersion,
//       //     latestVersion: githubVersion
//       //   }
//       // });
//       // document.dispatchEvent(updateEvent);
//     }
//   } catch (error) {
//     console.error("Failed to check for updates:", error);
//   }
// }

// Function to parse changelog markdown and convert to HTML for specific version
function parseChangelogToHtml(changelogText, targetVersion) {
  // Split the changelog into lines
  const lines = changelogText.split("\n");

  let currentVersion = null;
  let inTargetVersion = false;
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for version line (## X.X.X)
    if (line.startsWith("## ")) {
      // If we were in a list, close it
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }

      // Get the version from the line
      currentVersion = line.substring(3).trim();

      // Check if this is the target version
      if (currentVersion === targetVersion) {
        inTargetVersion = true;
        html += `<h2>${currentVersion}</h2>\n`;
      } else if (inTargetVersion) {
        // We've moved past our target version, stop processing
        break;
      }
    }
    // Only process lines if we're in the target version section
    else if (inTargetVersion) {
      if (line.startsWith("### ")) {
        // If we were in a list, close it
        if (inList) {
          html += "</ul>\n";
          inList = false;
        }

        // Convert subheadings (### Fixed)
        const heading = line.substring(4).trim();
        html += `<h3>${heading}</h3>\n`;
      } else if (line.startsWith("- ")) {
        // Convert list items
        if (!inList) {
          html += "<ul>\n";
          inList = true;
        }

        const listItem = line.substring(2).trim();
        html += `<li>${listItem}</li>\n`;
      }
      // Handle empty lines between sections
      else if (inList && line === "" && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine.startsWith("- ")) {
          html += "</ul>\n";
          inList = false;
        }
      }
    }
  }

  // Close any open list
  if (inList) {
    html += "</ul>\n";
  }

  return html;
}

async function loadScripts() {
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

}

window.addEventListener("message", (event) => {
  if (event.data.type === "TOOLBAR_READY_TO_LOAD") {
    window.postMessage({
      type: "LOAD_TOOLBAR",
      payload: {
        config: {
          currentVersion,
          setEnableActions: true,
          apps: {
            errorAlert: true,
          },
        },
      },
    });
  }
});

// Check for updates when the document is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadScripts);
} else {
  loadScripts();
}

// Add message listener for acknowledging version notification
// chrome.runtime.onMessage.addListener((message) => {
//   if (message.action === "acknowledge_version") {
//     localStorage.setItem("toolbarplus_last_notified_version", message.version);
//   }
// });
