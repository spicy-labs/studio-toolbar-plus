## 0.10.3

### 🐛 Fixed

- Issue with version checking

## 0.10.2

### ✨ Added

- Filters for LayoutViewer to filter by visibility and manual crops
- Session persistence for selected Connector and open layout tree
- Persistence for layout filters

### 🐛 Fixed

- Issue with showing layouts without crops
- Layout names when copied to display the ID
- Refresh LayoutViewer on save
- Indentation for LayoutViewer at different levels
- Copying crops not overriding existing crops (avoid duplication)
- Copying crops not using current unsaved changes

## 0.10.1

### ✨ Added

- Manual crop manager to manage crops for a connector
- Toolbar settings to enable/disable apps
- Connector cleanup to remove unused connectors

## 0.9.2

### ✨ Added

- Magic layouts, which act as virtual layouts where you can copy the position and visibility changes from one layout to another.
- Experimental font download method using a package system. It needs improvement.

### ⚡ Improved

- Image mapping is better compressed which means smaller file sizes

## 0.7.0

### ✨ Added

- Add ability to swap image variables within a Layout Image Mapping configuration.

## 0.6.4

### 🐛 Fixed

- Fix issue loading data due to Studio SDK update

## 0.6.3

### 🐛 Fixed

- Fix missing dist files
- Fix export of layout resizing function

## 0.6.2

### ⚡ Improved

- Improve aspect ratio - layout resizing to change the other value

## 0.6.1

### 🐛 Fixed

- Fix height for aspect lock resizing not being set
- Fix visibility of aspect lock resizing being true

## 0.6.0

### ✨ Added

- Download fonts option to download template
- Frame snapshot position bulk delete
- Frame snapshot position copy to layer
- Frame snapshot position copy row
- Frame snapshot position copy and replace

## 0.5.2

### 🐛 Fixed

- Fix automatically adding connector based on name

## 0.5.1

### ✨ Added

- Add aspect ratio lock

### 🐛 Fixed

- Fix issues with rounding numbers
- Fix toolbar loading before document (resolves actions not firing)

## 0.4.0

### ✨ Added

- Add connector replacement during upload
- Add image snapshot and resizing

## 0.3.1

### 🐛 Fixed

- Issue with actions not running for booleans

## 0.3.0

### ✨ Added

- Redimentary version checking
- Layout Image Mapping validation

### 🐛 Fixed

- Issue with adding dependency groups due to invalid mapping
