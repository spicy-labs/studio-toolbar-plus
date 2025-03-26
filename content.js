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

const script = document.createElement("script");
script.src = chrome.runtime.getURL("./dist/index.js");
(document.head || document.documentElement).appendChild(script);
