'use strict';

const uniURL = "uniTiff/SD45ne_DTM_2m_Compressed.tif"
const cityURL = "cityTiff/SD46se_DTM_2m_Compressed.tif"
var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data
var tiffURL = uniURL;    // Uni .tiff data
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
var pathPromise;

const overpassURL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=";
const buildingCoordsScale = 1 / (twfData[0] + buildingScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const pathCoordsScale = 1 / (twfData[0] + pathScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const bboxSize = 300;                                     // Length of one side of bounding box in metres
const distanceNeededToLoadNewChunk = (bboxSize / 2) * 0.70;            // Used to check if the user has moved far enough
const distanceNeededToUpdateNavigation = 10;
const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 500,    // Will only update every 600ms
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};
const debug = true;
const humanHeight = 1.2;    // Height of the user in metres
const cacheTTL = 1000 * 60 * 3;     // How often the cache should be deleted and reopened
const rasterWorker = new Worker('rasterWorker.js');
const rasters = new Promise((resolve, reject) => {
    rasterWorker.postMessage({ uniURL: uniURL, cityURL: cityURL });
    rasterWorker.onmessage = async function (e) {
        if (e.data.status == "bad") {
            console.log("Worker failed. Reverting to UI thread.");
            // TODO #3 Need to look over adding catches to this code as if it fails, no height map will be created.
            let cpuCores = navigator.hardwareConcurrency;
            var pools = [new GeoTIFF.Pool(cpuCores / 2 - 1), new GeoTIFF.Pool(cpuCores / 2 - 1)];
            const rasters = await Promise.all([
                rasterFromURL(uniURL, pools[0]),
                rasterFromURL(cityURL, pools[1])
            ]);
            pools.forEach((pool, index) => {
                pools[index] = undefined;
                pool.destroy();
            });
            resolve({ uniRaster: rasters[0], cityRaster: rasters[1] })
        }
        resolve({ uniRaster: e.data.uniRaster, cityRaster: e.data.cityRaster });
    }
});
var currentRaster = rasters.then((rasters) => {
    return rasters.uniRaster;
});


function rasterFromURL(url, pool) {
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
// var cacheDeletionInterval;
/**
 * Deletes the cache and then opens a new cache.
 */
// async function deleteAndReOpenCache() {
//     await caches.delete(osmCacheName);
//     console.log("Cache Storage Deleted");
//     console.log("Opening New Cache Storage");
//     osmCache = caches.open(osmCacheName);
// }
/* Delete the cache when the page is unloaded. */
window.addEventListener("unload", async function () {
    await caches.delete(osmCacheName);
});
// /* Clearing the interval when the window is not in focus. */
// window.onblur = function () {
//     if (typeof cacheDeletionInterval !== 'undefined' && mapBeingShown == true) {
//         cacheDeletionInterval = clearInterval(cacheDeletionInterval);
//         console.log("Interval Cleared");
//     }
// };
// /* Restarting the cache deletion interval when the window is in focus. */
// window.onfocus = function () {
//     if (typeof cacheDeletionInterval === 'undefined' && mapBeingShown == true) {
//         cacheDeletionInterval = setInterval(deleteAndReOpenCache, cacheTTL);   // Once a minute clear the caches.
//         console.log("Interval Restarted");
//     }
// };

function cityMap() {
    twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 464999.0000000000]      // City .twf Data
    tiffURL = cityURL;    // City .tiff data
    currentRaster = rasters.then((rasters) => {
        return rasters.cityRaster;
    });
}
function uniMap() {
    twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data
    tiffURL = uniURL;    // Uni .tiff data
    currentRaster = rasters.then((rasters) => {
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
    // cacheDeletionInterval = setInterval(deleteAndReOpenCache, cacheTTL);   // Once a minute clear the caches.
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
    if (movedFarEnoughForMap(newPixelCoords)) loadNewMapArea(newLatLong, currentCentreOfBBox, bboxSize);
    else if (movedFarEnoughForNavigation(newPixelCoords)) carryOnNavigating(pathPromise);
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
 * If the user has moved more than 'distanceNeededToLoadNewChunk' metres, return true
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns a boolean value.
 */
function movedFarEnoughForMap(newPixelCoords) {
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
    if (xDistance > distanceNeededToLoadNewChunk || yDistance > distanceNeededToLoadNewChunk) {
        currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
        return true;
    }
    return false;
}

/**
 * If the user has moved more than 'distanceNeededToUpdateNavigation' metres, return true
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns a boolean value.
 */
function movedFarEnoughForNavigation(newPixelCoords) {
    if (!navigationInProgress) return false;

    // Storing how many metres the user has moved in the x and y directions.
    let xDistance = usersCurrentPixelCoords.x - newPixelCoords.x;
    xDistance = Math.abs(xDistance) * 2;
    let yDistance = usersCurrentPixelCoords.y - newPixelCoords.y;
    yDistance = Math.abs(yDistance) * 2;
    console.log(xDistance);
    console.log(yDistance);

    if (xDistance > distanceNeededToUpdateNavigation || yDistance > distanceNeededToUpdateNavigation) {
        return true;
    }
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
    pathPromise = loadPaths(coordinate, bboxSize);
    carryOnNavigating(pathPromise);
    return pathPromise;
}

/**
 * Places the camera at the pixel coords and sets the users current location variables.
 * @param pixelCoords - The new pixel coordinates of the user.
 * @param newLatLong - The new latitude and longitude of the user.
 * @returns returns null
 */
function placeCameraAtPixelCoords(pixelCoords, newLatLong) {
    let camera = document.querySelector("#rig");
    camera.object3D.position.set(pixelCoords.x, humanHeight, pixelCoords.y);
    usersCurrentPixelCoords = pixelCoords;
    usersCurrentLatLong = newLatLong;

    if (lowQuality) return;
    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
            camera.object3D.position.set(pixelCoords.x, (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + humanHeight), pixelCoords.y);
        });
    }).catch((err) => {
        console.log(err);
    });
}

/**
 * While the element has a first child, remove that child.
 * @param element - The element whose children you want to remove.
 */
function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
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
 * It removes the sun from the scene if low quality is enabled, and adds it back in if low quality is
 * disabled. Also, it sets the lowQuality variable to the given value.
 * @param tempLowQuality - a boolean, true if low quality is to be set,
 * false if high quality is to be set.
 */
async function setLowQuality(tempLowQuality) {
    if (lowQuality == tempLowQuality) return
    lowQuality = tempLowQuality;
    if (tempLowQuality) {
        // removeElement("sun");
        document.getElementById("sun").remove();
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
    let pathPromise;
    await Promise.all([
        pathPromise = loadNewMapArea(usersCurrentLatLong, currentCentreOfBBox, bboxSize),
        placeCameraAtPixelCoords(usersCurrentPixelCoords, usersCurrentLatLong)
    ]);
    carryOnNavigating(pathPromise);
}



/* Listening for the keydown event and if the key pressed is the c key,
then it will switch the active camera. */
document.addEventListener("keydown", function (event) {
    if (event.code === "KeyC") {
        toggleCameraView();
    }
    else if (event.code === "KeyV") {
        toggleStats();
    }
});

var touchstartX = 0;
var touchendX = 0;

document.addEventListener("touchstart", function (event) {
    if (event.touches.length === 2) {
        touchstartX = event.changedTouches[0].screenX;
    }
}, false);

document.addEventListener("touchend", function (event) {
    if (event.touches.length === 2) {
        touchendX = event.changedTouches[0].screenX;
        handleGesture();
    }
}, false);

function handleGesture() {
    if (touchendX <= touchstartX) {
        toggleCameraView();
    }
    if (touchendX >= touchstartX) {
        toggleStats();
    }
}

function toggleCameraView() {
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

function toggleStats() {
    console.log("Toggling stats");
    let sceneElement = document.querySelector('a-scene');
    sceneElement.setAttribute('stats', !sceneElement.getAttribute('stats'));
}