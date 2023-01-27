var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data
var tiffURL = "uniTiff/SD45ne_DTM_2m.tif";    // Uni .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 464999.0000000000]      // City .twf Data
//var tiffURL = "cityTiff/SD46se_DTM_2m.tif";    // City .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 350001.0000000000, 424999.0000000000]       // Leyland .twf Data
//var tiffURL = "leylandTiff/SD52sw_DTM_2m.tif";    // Leyland .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 350001.0000000000, 419999.0000000000]       // Lydiate .twf Data
//var tiffURL = "lydiateTiff/SD51nw_DTM_2m.tif";    // Lydiate .tiff data

var currentCentreOfBBox = { x: -1, y: -1, roundedX: -1, roundedY: -1 };         // Impossible coordinates in pixel coords
var usersCurrentPixelCoords = { x: -1, y: -1, roundedX: -1, roundedY: -1 };     // Impossible coordinates in pixel coords
var usersCurrentLatLong = { lat: 91, long: 181 };                               // Impossible coordinates in lat and long
var watchID = -1;
var numberOfPositionChanges = 0;
var coordsTotal = { lat: 0, long: 0 };
var mapBeingShown = false;
var lowQuality = false;
var heightMaps;

const overpassURL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=";
const buildingCoordsScale = 1 / (twfData[0] + buildingScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const pathCoordsScale = 1 / (twfData[0] + pathScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const bboxSize = 270;                                     // Length of one side of bounding box in metres
const distanceNeededToMove = (bboxSize / 2) * 0.75;            // Used to check if the user has moved far enough
const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,    // Will only update every 600ms
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};
const debug = true;
// const tiff = GeoTIFF.fromUrl(tiffURL);
// const image = tiff.then((tiff) => { return tiff.getImage() });
var tiffImage;

// var uniTiffImage = fetch("uniTiff/SD45ne_DTM_2m.tif").then((response) => {
//     return response.arrayBuffer();
// }).then((response) => {
//     return GeoTIFF.fromArrayBuffer(response);
// }).then((response) => {
//     return response.getImage()
// });

// var cityTiffImage = fetch("cityTiff/SD46se_DTM_2m.tif").then((response) => {
//     return response.arrayBuffer();
// }).then((response) => {
//     return GeoTIFF.fromArrayBuffer(response);
// }).then((response) => {
//     return response.getImage()
// });

var raster;
const worker = new Worker('rasterWorker.js');
var tempRasters;
var rasters = new Promise((resolve, reject) => {
    worker.postMessage({ uniURL: "uniTiff/SD45ne_DTM_2m.tif", cityURL: "cityTiff/SD46se_DTM_2m.tif" });
    worker.onmessage = async function (e) {
        if (e.data.status == "bad") {
            console.log("Worker failed. Reverting to UI thread.");
            // TODO #3 Need to look over adding catches to this code as if it fails, no height map will be created.
            var pools = [new GeoTIFF.Pool(), new GeoTIFF.Pool()];
            const rasters = await Promise.all([
                raster("uniTiff/SD45ne_DTM_2m.tif", pools[0]),
                raster("cityTiff/SD46se_DTM_2m.tif", pools[1])
            ]);
            pools.forEach(pool => {
                pool.destroy();
            });
            resolve({ uniRaster: rasters[0], cityRaster: rasters[1] })
        }
        resolve({ uniRaster: e.data.uniRaster, cityRaster: e.data.cityRaster });
    }
});


function raster(url, pool) {
    return GeoTIFF.fromUrl(url).then(tiff => {
        return tiff.getImage();
    }).then(image => {
        return image.readRasters({ pool });
    });

    // .catch((err) => {
    //     console.log(err)
    //     reject(err);
    // })
}


const osmCacheName = "osmCache";            // Name of the cache for the OSM data that is fetched
var osmCache = caches.open(osmCacheName);   // Opens a new cache with the given name
var cacheDeletionInterval;
/**
 * Deletes the cache and then opens a new cache.
 */
async function deleteAndReOpenCache() {
    await caches.delete(osmCacheName);
    console.log("Cache Storage Deleted");
    console.log("Opening New Cache Storage");
    osmCache = caches.open(osmCacheName);
}
/* Delete the cache when the page is unloaded. */
window.addEventListener("unload", async function () {
    await caches.delete(osmCacheName);
});
/* Clearing the interval when the window is not in focus. */
window.onblur = function () {
    if (typeof cacheDeletionInterval !== 'undefined' && mapBeingShown == true) {
        cacheDeletionInterval = clearInterval(cacheDeletionInterval);
        console.log("Interval Cleared");
    }
};
/* Restarting the cache deletion interval when the window is in focus. */
window.onfocus = function () {
    if (typeof cacheDeletionInterval === 'undefined' && mapBeingShown == true) {
        cacheDeletionInterval = setInterval(deleteAndReOpenCache, 1000 * 60);   // Once a minute clear the caches.
        console.log("Interval Restarted");
    }
};

function cityMap() {
    twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 464999.0000000000]      // City .twf Data
    tiffURL = "cityTiff/SD46se_DTM_2m.tif";    // City .tiff data
    raster = rasters.then((rasters) => {
        return rasters.cityRaster;
    });
}
function uniMap() {
    twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data
    tiffURL = "uniTiff/SD45ne_DTM_2m.tif";    // Uni .tiff data
    raster = rasters.then((rasters) => {
        return rasters.uniRaster;
    });
}


/**
 * Hides the welcome screen and shows the map
 */
function showMap() {
    document.getElementById("welcomeScreen").style.display = "none";
    document.getElementById("navigationScreen").style.display = "none";
    document.getElementById("mapScreen").style.display = "block";


    // TODO #4 Get the camera to face the correct heading.
    // navigator.geolocation.getCurrentPosition(function(position) {
    //     console.log("Position:", position);
    //     var heading = position.coords.heading;
    //     console.log("Heading: ", heading);
    //     let camera = document.getElementById("rig");
    //     camera.setAttribute("rotation", {x: 0, y: heading, z: 0});
    // });
    if (watchID == -1) watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
    cacheDeletionInterval = setInterval(deleteAndReOpenCache, 1000 * 60);   // Once a minute clear the caches.
    mapBeingShown = true;
}

/**
 * Hides the map and shows the welcome screen
 */
function showMainMenu() {
    document.getElementById("mapScreen").style.display = "none";
    document.getElementById("welcomeScreen").style.display = "block";

    navigator.geolocation.clearWatch(watchID);
    watchID = -1;
    clearInterval(cacheDeletionInterval);
    console.log("Interval Cleared");
    mapBeingShown = false;
}

function showNavigationMenu() {
    document.getElementById("navigationScreen").style.display = "block";
    document.getElementById("loadNavigationMenuBtn").style.visibility = "hidden";
}

function hideNavigationMenu() {
    document.getElementById("navigationScreen").style.display = "none";
    document.getElementById("loadNavigationMenuBtn").style.visibility = "";
}


/**
 * If the user has moved far enough, load a new map area, and place the camera at the user's new
 * location.
 * @param position - the position object returned by the geolocation API
 */
async function locationSuccess(position) {
    console.log("\n\n===== NEW LOCATION ======");
    let newLatLong = { lat: position.coords.latitude, long: position.coords.longitude };
    let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    console.log(newPixelCoords);
    if (newPixelCoords.roundedX < 0 || newPixelCoords.roundedX > 2500 || newPixelCoords.roundedY < 0 || newPixelCoords.roundedY > 2500) throw "Invalid Coordinates"
    if (movedFarEnough(newPixelCoords)) await loadNewMapArea(newLatLong, currentCentreOfBBox, bboxSize);
    placeCameraAtPixelCoords(newPixelCoords, newLatLong);
}

/**
 * Will log the error that occured from the geolocation API to the console.
 * @param error - The error object returned by the geolocation API.
 */
function locationError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.log("User denied the request for Geolocation.")
            break;
        case error.POSITION_UNAVAILABLE:
            console.log("Location information is unavailable.")
            break;
        case error.TIMEOUT:
            console.log("The request to get user location timed out.")
            break;
        case error.UNKNOWN_ERROR:
            console.log("An unknown error occurred.")
            break;
    }
}


/**
 * If the user has moved more than 'distanceNeededToMove' metres, return true
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns a boolean value.
 */
function movedFarEnough(newPixelCoords) {
    // Guard check. If -1, this is first time user has moved.
    if (currentCentreOfBBox.x == -1 && currentCentreOfBBox.y == -1) {
        console.log("First time moving");
        currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
        return true;
    }

    // Storing how many metres the user has moved in the x and y directions.
    let xDistance = currentCentreOfBBox.x - newPixelCoords.x;
    xDistance = Math.abs(xDistance) * 2;
    let yDistance = currentCentreOfBBox.y - newPixelCoords.y;
    yDistance = Math.abs(yDistance) * 2;
    console.log(xDistance);
    console.log(yDistance);

    // The user has to have moved 'distanceNeededToMove' metres.
    if (xDistance > distanceNeededToMove || yDistance > distanceNeededToMove) {
        currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
        return true;
    }
    return false;
}



/**
 * Places the camera at the pixel coords and sets the users current location variables.
 * @param pixelCoords - The new pixel coordinates of the user.
 * @param newLatLong - The new latitude and longitude of the user.
 * @returns returns null
 */
function placeCameraAtPixelCoords(pixelCoords, newLatLong) {
    camera = document.querySelector("#rig");
    camera.object3D.position.set(pixelCoords.x, 1.6, pixelCoords.y);
    usersCurrentPixelCoords = pixelCoords;
    usersCurrentLatLong = newLatLong;

    if (lowQuality) return;
    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
            camera.object3D.position.set(pixelCoords.x, (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + 1.6), pixelCoords.y);
        });
    }).catch((err) => {
        console.log(err);
    });
}


/**
 * It loads the map by getting the height map, removing the current map, loading the terrain, and
 * loading the buildings.
 * @param coordinate - The coordinate of the center of the map.
 * @param pixelCoords - The pixel coordinates of the center of the map.
 * @param bboxSize - The size of the bounding box in metres.
 */
async function loadNewMapArea(coordinate, pixelCoords, bboxSize) {
    console.log("=== Loading Map ===");
    heightMaps = getHeightMap(pixelCoords, bboxSize);
    // heightMaps = new Promise((resolve, reject) => {
    //     reject(new Error("Test error"));
    // });
    removeCurrentMap();
    loadTerrain();
    loadBuildings(coordinate, bboxSize);
    loadPaths(coordinate, bboxSize);
}


/**
 * Remove the element with the given id from the document.
 * Does nothing if element does not exist.
 * @param id - The id of the element to remove.
 */
function removeElement(id) {
    let parentElement = document.getElementById(id);
    if (parentElement) parentElement.remove();
    return document.getElementById(id);
}


/**
 * Removes the current terrain and buildings
 */
function removeCurrentMap() {
    removeCurrentTerrain();
    removeCurrentBuildings();
    removeCurrentPaths();
}

/**
 * If the element with the given ID exists, change its ID to the new ID.
 * @param elementID - The ID of the element you want to change.
 * @param newElementID - The new ID you want to give the element.
 */
function changeElementID(elementID, newElementID) {
    let element = document.getElementById(elementID);
    if (element) element.setAttribute("id", newElementID);
    return document.getElementById(elementID);
}

/**
 * It changes the ID of the terrain and building parents to "terrainToRemove" and "buildingsToRemove"
 * respectively.
 */
function setCurrentMapForRemoval() {
    while (changeElementID("terrainParent", "terrainToRemove")) { }
    while (changeElementID("buildingParent", "buildingsToRemove")) { }
    while (changeElementID("pathParent", "pathsToRemove")) { }
}


async function setLowQuality(tempLoqQuality) {
    if (lowQuality == tempLoqQuality) return
    lowQuality = tempLoqQuality;
    if (tempLoqQuality) {
        removeElement("sun");
    }
    else {
        let newSun = document.createElement('a-simple-sun-sky');
        newSun.setAttribute("id", "sun");
        newSun.setAttribute("sun-position", "0.7 1 -1");
        newSun.setAttribute("light-color", "#87cefa");
        newSun.setAttribute("dark-color", "#00bfff");
        newSun.setAttribute("fog-color", "#74d2fa");
        document.querySelector('a-scene').appendChild(newSun);
    }
    await Promise.all([
        placeCameraAtPixelCoords(usersCurrentPixelCoords, usersCurrentLatLong),
        loadNewMapArea(usersCurrentLatLong, currentCentreOfBBox, bboxSize)
    ]);
}




// window.addEventListener("keydown", (event) => {
//     if (event.defaultPrevented) {
//       return; // Do nothing if the event was already processed
//     }

//     switch (event.key) {
//       case "Shift":
//         console.log("shift");
//         this.dVelocity.y -= 1;
//         break;
//       case "Space":
//         console.log("Space");
//         this.dVelocity.y += 1;
//         break;
//     }
// });
AFRAME.registerComponent('flight-controls', {
    getVelocityDelta: function () {
        var data = this.data,
            keys = this.getKeys();

        this.dVelocity.set(0, 0, 0);
        if (data.enabled) {
            // NEW STUFF HERE
            if (keys.KeySpaceBar) { console.log("Space"); this.dVelocity.y += 1; }
            if (keys.KeyShift) { console.log("Shift"); this.dVelocity.y -= 1; }
        }

        return this.dVelocity.clone();
    },
});





/* Listening for the keydown event and if the key pressed is the c key,
then it will switch the active camera. */
document.addEventListener("keydown", function (event) {
    if (event.code === "KeyC") {
        var playerCamera = document.getElementById("playerCamera");
        if (playerCamera.getAttribute('camera').active == true) {
            var debugCamera = document.getElementById("debugCamera");
            debugCamera.setAttribute('camera', 'active', true);
            console.log("Debug camera now active");
        }
        else {
            playerCamera.setAttribute('camera', 'active', true)
            console.log("Player camera now active");
        }
    }
});