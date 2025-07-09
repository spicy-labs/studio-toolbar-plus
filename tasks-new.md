# Tasks
We are building a chrome extension that adds a toolbar to a online document editor called GraFx Studio. The extension is built using React and TypeScript. The code is in src/ and is built using bun (https://bun.sh/). The entry point is src/index.tsx. The toolbar is defined in src/components/Toolbar.tsx. The toolbar uses mantine (https://mantine.dev/) for the UI.


Your tasks are as follows:

# Task
We are going to rewrite the DownloadModal so the modal has 4 buttons:

1. (blue) Download Document JSON
2. (blue) Download Template Package
3. (green) Upload Document JSON or Template Package
4. (blue) Download Document Fonts

For #1 "Download Document JSON" the modal just downloads the document JSON with the proper name. Similar to current behavior with the checkbox unchecked.

For #2 "Download Template Package" the modal downloads the document JSON with the proper name but also includes the token and baseUrl in the properties section of the JSON. The file extension is also changed to .packageJson. Similar to current behavior with the checkbox unchecked.

For #3 "Upload Document JSON or Template Package" the is as it currently is for uploading.

For #4 "Download Document Fonts" you will downloads fonts similar to the old code which you cand find here:
https://github.com/spicy-labs/studio-toolbar-plus/blob/main/src/components/DownloadModal.tsx

The only difference to the old way is that instead ofnaming the fonts with the `"_" + fontStyleDetails.name + fontStyleDetails.fileName.slice(lastDotIndex)`, you create ledger in a "md" file where you match the `fontStyleDetails.name + fontStyleDetails.fileName.slice(lastDotIndex)` to the font name `fontStyleDetails.fileName.slice(0, lastDotIndex)`.

This also means that you will not download a font with the same name more than once, as sometimes using json-2-csv



Underneath that there should be a three grey buttons "Attach Variable Sheet (JSON, CVS)" and "Download Variable JSON" and "Download Variable CSV".