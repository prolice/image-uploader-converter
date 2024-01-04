import './lib/jszip/jszip.min.js';  

class DataImporterWebpConverter extends FormApplication {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "data-importer-webp-converter",
            classes: ["starwarsffg", "data-import"],
            title: "Image importer (from zip)",
            template: "modules/webp-converter/template/data-importer.html",
        });
    }

    /**
     * Return a reference to the target attribute
     * @type {String}
     */
    get attribute() {
        return this.options.name;
    }

    asyncForEach = async(array, callback) => {
        for (let index = 0; index < array.length; index += 1) {
            await callback(array[index], index, array);
        }
    };
    /** @override */
    async getData() {
        let data = await FilePicker.browse("data", "", {
            bucket: null,
            extensions: [".zip", ".ZIP"],
            wildcard: false
        });
        const files = data.files.map((file) => {
            return decodeURIComponent(file);
        });

        $(".import-progress").addClass("import-hidden");

        if (!CONFIG?.temporary) {
            CONFIG.temporary = {};
        }

        return {
            data,
            files,
            cssClass: "data-importer-window",
        };
    }

    async migrateImagesAndAttachments() {
        let importDataFinished;
        importDataFinished = await this.importData("import");
    }
    /**
     * Imports data based on the specified action.
     * @param {string} action - The action to perform, e.g., "import".
     */
    async importData(action) {
        // Check if the action is "import"
        if (action !== "import") {
            return;
        }
        let resultProcessImportFiles = false;
        // Log the start of the import process
        //CONFIG.logger.debug("Importing Data Files");
        this._importLogger(`Starting import`);

        // Get the selected files for import
        const importFiles = this.getSelectedImportFiles();

        // Get the selected file for import source
        const selectedFile = $("#import-file").val();
        this._importLogger(`Using ${selectedFile} for import source`);

        let zip;
        //let JSZip = new JSZip();();
        // Load the ZIP file either from URL or from the selected file input
        if (selectedFile) {
            zip = await this.loadZipFromUrl(selectedFile);
        } else {
            const form = $("form.data-importer-window")[0];

            if (form.data.files.length) {
                zip = await readBlobFromFile(form.data.files[0]).then(JSZip.loadAsync);
            }
        }

        // Process the selected files for import
        resultProcessImportFiles = await this.processImportFiles(importFiles, zip);

        // Reset temporary configuration
        CONFIG.temporary = {};
        return resultProcessImportFiles;
    }

    /** @override */
    async activateListeners(html) {
        super.activateListeners(html);

        $(`<span class="debug"><label><input type="checkbox" /> Generate Log</label></span>`).insertBefore("#data-importer header a");

        html.find(".dialog-button").on("click", this._dialogButton.bind(this));

    }

    _importLog = [];
    _importLogger(message) {
        if ($(".debug input:checked").length > 0) {
            this._importLog.push(`[${new Date().getTime()}] ${message}`);
        }
    }

    async _dialogButton(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;
        const action = a.dataset.button;

        if (action === "import") {
            this.migrateImagesAndAttachments();
        }
    }

    /**
     * Retrieves the selected files for import.
     * @returns {Array} An array of selected files with metadata.
     */
    getSelectedImportFiles() {
        return $("input:checkbox[name=imports]:checked")
        .map(function () {
            return {
                file: $(this).val(),
                label: $(this).data("name"),
                type: $(this).data("type"),
                itemtype: $(this).data("itemtype")
            };
        })
        .get();
    }

    /**
     * Loads a ZIP file from a specified URL.
     * @param {string} url - The URL of the ZIP file.
     * @returns {Promise<JSZip>} A promise that resolves to the loaded JSZip object.
     */
    async loadZipFromUrl(url) {
        const response = await fetch(`/${url}`);
        if (response.status === 200 || response.status === 0) {
            return Promise.resolve(response.blob()).then(JSZip.loadAsync);
        } else {
            return Promise.reject(new Error(response.statusText));
        }
    }

    /**
     * Processes the selected files for import.
     * @param {Array} importFiles - An array of selected files with metadata.
     * @param {JSZip} zip - The JSZip object representing the ZIP file.
     */
    async processImportFiles(importFiles, zip) {
        for (const file of importFiles) {
            // Process Vehicle Images
            if (file.file.includes('/')) {
                this.processImages(file, zip);
            }
        }
    }

    /**
     * Processes Vehicle Images from the specified file and ZIP.
     * @param {Object} file - The file metadata.
     * @param {JSZip} zip - The JSZip object representing the ZIP file.
     */
    async processImages(file, zip) {
        const files = this.getFilteredFiles(zip, "/", file.type);
        const serverPath = game.settings.get('webp-converter', 'ImageFolder');
        return await this.processFiles(files, zip, serverPath, file.type, file.label);
    }

    /**
     * Filters files in the ZIP object based on the specified path and extension.
     * @param {JSZip} zip - The JSZip object representing the ZIP file.
     * @param {string} path - The path to filter files.
     * @param {string} extension - The file extension to filter.
     * @returns {Array} An array of filtered files.
     */
    getFilteredFiles(zip, path, extension) {
        return Object.values(zip.files).filter(
            file => !file.dir && file.name.split(".").pop() === extension);
    }

    /**
     * Processes files with the specified server path, success message, and count setting.
     * @param {Array} files - An array of files to process.
     * @param {string} serverPath - The server path for importing files.
     * @param {string} successMessage - The success message for notifications.
     * @param {string} countSetting - The game settings key for storing the count.
     */
    async processFiles(files, zip, serverPath, successMessage, progressSubClassName) {
        const totalCount = files.length;
        let currentCount = 0;

        if (files.length) {
            // Log the start of the import process
            //CONFIG.logger.debug(`Starting Oggdude ${successMessage} Import`);
            //let progressSubClassName = successMessage.charAt(0).toLowerCase() + successMessage.slice(1).replace(/\s/g, '');
            if ($(`.import-progress.${progressSubClassName}`).hasClass("import-hidden")) {
                // Show the import progress bar
                $(`.import-progress.${progressSubClassName}`).toggleClass("import-hidden");
            }
            var textarea = $('textarea[name="log"]');
            var dynamicContent = "### Image importation ###\r\n";
            textarea.val(dynamicContent);
            // Process each file
            await this.asyncForEach(files, async(file) => {
                try {
                    let myNewFile = await importImage(file.name, zip, serverPath);
                    currentCount += 1;
                    dynamicContent = "[ZIP]/" + file.name + " -> " + myNewFile;

                    textarea.val(textarea.val() + dynamicContent + '\r\n');

                    // Update the import progress bar
                    $(`.${progressSubClassName} .import-progress-bar`)
                    .width(`${Math.trunc((currentCount / totalCount) * 100)}%`)
                    .html(`<div style="display: flex;height: 100%;"><span style="flex-grow: 1;padding-top: 5px;padding-left: 10px;">${Math.trunc((currentCount / totalCount) * 100)}%</span></div>`);

                    if (Math.trunc((currentCount / totalCount) * 100) == 100) {
                        return true;
                    }
                } catch (err) {
                    // Log error if import fails
                    CONFIG.logger.error(`Error importing record: `, err);
                }
            });

            // Show notification for successful import
            ui.notifications.info(`${successMessage} imported successfully: ${currentCount} images`);

            // Update game settings with the count
            //game.settings.set('webp-converter', countSetting, currentCount);
        }
    }

    _enableImportSelection(files, name, isDirectory, returnFilename) {
        this._importLogger(`Checking zip file for ${name}`);
        let fileName;
        Object.values(files).findIndex((file) => {
            if (file.name.includes(`/${name}.xml`) || (isDirectory && file.name.includes(`/${name}`))) {
                this._importLogger(`Found file ${file.name}`);
                let filename = file.name;
                if (file.name.includes(`.xml`) && isDirectory) {
                    filename = `${file.name.substring(0, file.name.lastIndexOf("/"))}/`;
                }
                $(`#import${name.replace(" ", "")}`)
                .removeAttr("disabled")
                .val(filename);
                if (returnFilename) {
                    fileName = file.name;
                }
                return true;
            }
            return false;
        }) > -1;

        return fileName;
    }
}

    function log(msg, ...args) {
        if (game && game.settings.get("webp-converter", "verboseLogs")) {
            const color = "background: #6699ff; color: #000; font-size: larger;";
            console.debug(`%c WebpConverterModule: ${msg}`, color, ...args);
        }
    }

    Hooks.on("init", () => {

        game.settings.register('webp-converter', 'ImageFolder', {
            name: 'Image Folder',
            type: String,
            //filePicker: 'folder',
        default:
            'modules/webp-converter/',
            config: true,
            restricted: true
        });

        game.settings.registerMenu('webp-converter', 'UploadImage', {
            name: "Upload Image Folder",
            label: "Import Images", // The text label used in the button
            hint: "Import images from a zip file into your world (auto conversion in webp)",
            icon: "fas fa-upload", // A Font Awesome icon used in the submenu button
            type: DataImporterWebpConverter, // A FormApplication subclass
            restricted: true // Restrict this submenu to gamemaster only?
        });

        //let JSZip = new JSZip();//await import("modules/webp-converter/lib/jszip/jszip.min.js");        
        //import("modules/webp-converter/lib/jszip/jszip.min.js");
        /*import("modules/webp-converter/lib/jszip/jszip.min.js").then((JSZip) => {
        console.log(mod === mod2); // true
        });*/
    });


Hooks.on("renderSettingsConfig", (app, html, data) => {

    let fileInput = $('input[name="webp-converter.ImageFolder"]', html).css({
        'flex-basis': 'unset',
        'flex-grow': 1
    });

    // Create a button for browsing files
    let browseBtn = $('<button>')
        .addClass('file')
        .attr('type', 'button') // Change type to 'button' to prevent form submission
        .attr('data-type', "folder")
        .attr('data-target', "img")
        .attr('title', "Select Folder")
        .attr('tabindex', "-1")
        .html('<i class="fas fa-file-import fa-fw"></i>')
        .click(function (event) {
            const fp = new FilePicker({
                type: "folder",
                current: fileInput.val(),
                callback: path => {
                    fileInput.val(path);
                }
            });
            return fp.browse();
        });

    // Create a button for creating a directory
    let createDirBtn = $('<button>')
        .addClass('create-directory')
        .attr('type', 'button') // Change type to 'button' to prevent form submission
        .attr('title', 'Create a sub directory')
        .attr('tabindex', '-1')
        .html('<i class="fas fa-folder-plus fa-fw"></i>')
        .click(function (event) {
            const fp = new FilePicker({
                type: 'folder',
                current: fileInput.val(),
                callback: path => {
                    fileInput.val(path);
                }
            });
            return fp._createDirectoryDialog(fp.sources.data)
        });

    // Insert the buttons after the file input
    browseBtn.clone(true).insertAfter(fileInput);
    createDirBtn.clone(true).insertAfter(fileInput);
});

asyncForEach = async(array, callback) => {
    for (let index = 0; index < array.length; index += 1) {
        await callback(array[index], index, array);
    }
};

/**
 * Imports binary file, by extracting from zip file and uploading to path.
 *
 * @param  {string} path - Path to image within zip file
 * @param  {object} zip - Zip file
 * @returns {string} - Path to file within VTT
 */
async function importImage(path, zip, serverPath) {
    if (!path)
        return;

    const filename = getFileNameFromPath(path);
    if (!CONFIG.temporary.images) {
        CONFIG.temporary.images = [];
    }

    try {
        const imagePath = `${serverPath}/${filename}`;
        if (!CONFIG.temporary.images.includes(imagePath)) {
            CONFIG.temporary.images.push(imagePath);

            const img = await getImageFromZip(zip, path);
            const type = await getImageType(img);

            const file = createFileFromImage(img, filename, type);

            var imageWebp;
            if (type !== "image/webp") {
                imageWebp = await convertToWebp(file);
            } else {
                imageWebp = file;
            }

            await uploadImageToServer(imageWebp, serverPath);

            return `${serverPath}/${imageWebp.name}`;
        }
    } catch (err) {
        CONFIG.logger.error(`Error Uploading File: ${path} to ${serverPath}`);
    }
}

function getHeaderFromImage(byteArray) {
    let header = "";
    for (let i = 0; i < byteArray.length; i++) {
        header += byteArray[i].toString(16).padStart(2, '0');
    }
    return header;
}

function getFileNameFromPath(path) {
    return path.replace(/^.*[\\\/]/, "");
}

async function getImageFromZip(zip, path) {
    return await zip.file(path).async("uint8array");
}

function getImageType(img) {
    const header = getHeaderFromImage(img.subarray(0, 4));
    return getMimeType(header);
}

function createFileFromImage(img, filename, type) {
    return new File([img], filename, {
        type
    });
}

async function convertToWebp(file) {
    return new Promise((resolve) => {
        const imageWebp = new Image();
        imageWebp.name = extractFileName(file.name) + '.webp';
        imageWebp.onload = () => {
            const canvas = createCanvasFromImage(imageWebp);
            canvas.toBlob((blob) => {
                const webpFile = new File([blob], imageWebp.name, {
                    type: blob.type
                });
                resolve(webpFile);
            }, 'image/webp');
        };
        imageWebp.src = URL.createObjectURL(file);
    });
}

function createCanvasFromImage(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
}

async function uploadImageToServer(image, serverPath) {
    await UploadFile("data", serverPath, image, {
        bucket: null
    });
}

async function ForgeUploadFile(source, path, file, options) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", `${path}/${file.name}`);

    const response = await ForgeAPI.call("assets/upload", fd);
    if (!response || response.error) {
        ui.notifications.error(response ? response.error : "An unknown error occured accessing The Forge API");
        return false;
    } else {
        return {
            path: response.url
        };
    }
}

/**
 * Uploads a file to Foundry without the UI Notification
 * @param  {string} source
 * @param  {string} path
 * @param  {blog} file
 * @param  {object} options
 */
async function UploadFile(source, path, file, options) {
    if (typeof ForgeVTT !== "undefined" && ForgeVTT?.usingTheForge) {
        return ForgeUploadFile("forgevtt", path, file, options);
    }
    let fd = new FormData();
    fd.set("source", source);
    fd.set("target", path);
    fd.set("upload", file);
    Object.entries(options).forEach((o) => fd.set(...o));

    const request = await fetch(FilePicker.uploadURL, {
        method: "POST",
        body: fd
    });

    if (request.status === 413) {
        return ui.notifications.error(game.i18n.localize("FILES.ErrorTooLarge"));
    }

    const response = await request.json().catch((err) => {
        return {};
    });
    if (response.error) {
        ui.notifications.error(response.error);
        return false;
    } else if (!response.path) {
        return ui.notifications.error(game.i18n.localize("FILES.ErrorSomethingWrong"));
    }
}

Hooks.once("init", async function () {
    // TURN ON OR OFF HOOK DEBUGGING
    CONFIG.debug.hooks = false;

});

Hooks.on("ready", async() => {
    //WebpConverterModule.singleton = new WebpConverterModule();
    //WebpConverterModule.singleton.init();
    //let JSZip = new JSZip();//await  
});

// Custom function to extract file name without path and extension
function extractFileName(filePath) {
    let startIndex = filePath.lastIndexOf("/") + 1;
    let endIndex = filePath.lastIndexOf(".");
    return filePath.substring(startIndex, endIndex);
}

function readBlobFromFile(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = (ev) => {
            resolve(reader.result);
        };
        reader.onerror = (ev) => {
            reader.abort();
            reject();
        };
        reader.readAsBinaryString(file);
    });
}

function writeFileFromBlob(fileBlob) {
    const fileWriter = new FileWriter(filePath);
    fileWriter.write(fileBlob);
    fileWriter.onwriteend = () => {
        resolve(filePath);
    };
    fileWriter.onerror = (err) => {
        reject(err);
    };
}
/**
 * Returns the name of a file within the zip file based on a built string.
 *
 * @param  {object} zip - Zip file
 * @param  {string} type - Object Type
 * @param  {string} itemtype - Item Type
 * @param  {string} key - Item Key
 * @returns {string} - Path to file within Zip File
 */
async function getImageFilename(zip, type, itemtype, key) {
    const imgFileName = `${type}Images/${itemtype}${key}`;

    return Object.values(zip.files).find((file) => {
        if (file.name.includes(imgFileName)) {
            return file.name;
        }
        return undefined;
    });
}

/**
 * Returns the MIME type for a media file
 * @param  {string} header - Hex header for file.
 */
async function getMimeType(header) {
    let type = "";
    switch (header) {
    case "89504e47":
        type = "image/png";
        break;
    case "47494638":
        type = "image/gif";
        break;
    case "ffd8ffe0":
    case "ffd8ffe1":
    case "ffd8ffe2":
    case "ffd8ffe3":
    case "ffd8ffe8":
        type = "image/jpeg";
        break;
    case "52494646":
        type = "image/webp";
        break;
    default:
        type = "unknown"; // Or you can use the blob.type as fallback
    }

    return type;
}


