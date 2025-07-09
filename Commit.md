# Commit Request: Add Out Template Feature

## Summary
Added comprehensive Out Template feature that allows users to generate output files (JPG, PNG, PDF, GIF, MP4) from templates using GraFx Studio's output API.

## Changes Made

### New Files
- `src/components/OutTemplateModal.tsx` - Main modal component for output generation

### Modified Files
- `src/components/Toolbar.tsx` - Added OutTemplate ActionIcon and modal integration
- `src/components/ToolbarSettingsModal.tsx` - Added showOutTemplate configuration option
- `CHANGELOG.md` - Added v0.12.0 release notes

## Features Implemented

### 1. Output Template Modal
- Fetches available output settings from `${baseUrl}output/settings` endpoint
- Displays settings in a dropdown with automatic default selection
- Supports all output types: JPG, PNG, PDF, GIF, MP4

### 2. Document Processing
- Retrieves current document state using `getCurrentDocumentState`
- Gets selected layout using `getSelected`
- Extracts engine version from document JSON

### 3. Output Generation
- Calls appropriate output endpoint based on selected setting type
- Sends document content, layout ID, output settings ID, and engine version
- Handles authentication using GRAFX_AUTH_TOKEN

### 4. Task Management
- Polls task status every second until completion (200 status)
- Shows loading spinner during processing
- Provides download button when task succeeds

### 5. Error Handling
- Handles 500 errors by fetching detailed error reports
- Displays errors grouped by RecordId in scrollable container
- Uses raiseError for consistent error reporting throughout the app

### 6. UI/UX Features
- Modal takes 50% of screen size for better usability
- Loading states for all async operations
- Success state with download functionality
- Comprehensive error display with scrollable container

### 7. Configuration
- Added `showOutTemplate` option to AppConfig
- Enabled by default in defaultConfig
- Configurable through toolbar settings modal

## Technical Implementation

### API Integration
- Uses existing studio adapter patterns for authentication
- Follows established error handling patterns with raiseError
- Implements proper TypeScript interfaces for all API responses

### State Management
- Manages modal state, loading states, and error states
- Resets state when modal opens for clean user experience
- Handles polling state for task monitoring

### Code Quality
- Follows existing project patterns and conventions
- Uses React/TypeScript/Mantine UI stack consistently
- Implements proper error boundaries and fallbacks

## Testing Recommendations
1. Test with different output settings (JPG, PNG, PDF, GIF, MP4)
2. Verify error handling with invalid documents or settings
3. Test task polling with both successful and failed outputs
4. Verify configuration toggle works correctly
5. Test with different document types and layouts

## Commit Message
```
feat: add Out Template feature for output generation

- Add OutTemplateModal component with output settings selection
- Implement document processing and output generation
- Add task polling with download functionality
- Include comprehensive error handling with detailed reports
- Add configurable toolbar option for Out Template feature
- Support all output types: JPG, PNG, PDF, GIF, MP4

Closes: Output template generation requirements
```
