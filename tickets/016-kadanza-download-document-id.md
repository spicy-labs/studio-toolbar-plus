# Ticket 016: Kadanza download uses fallback document ID

**File:** `src/components/DownloadModal/utils.ts`, lines 251–264

## Description

`getDocumentKind()` and `getDocumentId()` parse the document type and ID from `window.location.href` using a regex that expects `/studio/(templates|components)/`. On kadanza.io, CHILI Studio is iframed inside a completely different host URL structure, so these regexes never match. `getDocumentKind()` returns `null` and `getDocumentId()` falls back to the literal string `"document"`, producing incorrect package manifests.

The URL-based approach cannot work for kadanza because the iframe's parent URL has no predictable relationship to the Studio document. The document kind and ID need to come from the SDK or extension configuration instead.

## Suggested fix

Retrieve the document ID and type from the Studio SDK configuration (e.g. via `studio.document` or `studio.configuration.getValue(...)`) rather than parsing the host URL. The URL-based approach should remain as a fallback for non-iframe environments.
