# DataImporterWebpConverter

The `DataImporterWebpConverter` is a custom Foundry VTT module designed to import images from a ZIP file and convert them to WebP format. This module integrates with the Foundry VTT system, providing a seamless experience for users who want to manage and import large quantities of images efficiently.

## Features

- Import images from a ZIP file directly into Foundry VTT.
- Automatically convert imported images to WebP format to save space and improve performance.
- Customizable settings, including the target image folder and debug logging.
- Progress tracking and visual feedback during the import process.

## Installation

1. Download the module or clone the repository into your Foundry VTT `modules` directory.
2. Ensure that the `jszip.min.js` library is included in your `lib` folder as it's a dependency.
3. Activate the module from the Foundry VTT module management interface.

## Usage

1. Go to the settings menu in Foundry VTT.
2. Select the "Upload Image Folder" option from the `webp-converter` submenu.
3. Choose a ZIP file containing the images you wish to import.
4. The module will automatically process and convert the images to WebP format, then upload them to the specified folder.

## Configuration

- **Image Folder:** Set the target directory for imported images. This can be configured from the settings.
- **Generate Log:** Enable or disable detailed logging during the import process.

## Code Overview

### Main Class: `DataImporterWebpConverter`

The `DataImporterWebpConverter` class extends `FormApplication` and handles the main logic for importing and converting images. 

- **Methods:**
  - `getData()`: Gathers and processes data for the import process.
  - `importData(action)`: Handles the import logic based on the specified action (e.g., "import").
  - `processImages(file, zip)`: Filters and processes images from the ZIP file.
  - `activateListeners(html)`: Initializes event listeners for the import dialog.

### Utility Functions

- **importImage(path, zip, serverPath):** Extracts an image from the ZIP file, converts it to WebP format if necessary, and uploads it to the server.
- **convertToWebp(file):** Converts a given image file to WebP format.
- **getMimeType(header):** Determines the MIME type of a file based on its header.

### Event Hooks

- **init**: Registers module settings and configuration options.
- **renderSettingsConfig**: Customizes the settings configuration interface for the module.

## Dependencies

- [JSZip](https://stuk.github.io/jszip/) - A JavaScript library for creating, reading, and editing .zip files.

## Contributing

If you'd like to contribute to this project, please fork the repository and submit a pull request. All contributions are welcome!

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

