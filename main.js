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

var bboxPixelCoords = { x: -1, y: -1, roundedX: -1, roundedY: -1 };         // Impossible coordinates in pixel coords
var bboxLatLongCoords = { lat: 91, long: 181 };                             // Impossible coordinates in lat and long coords
var usersCurrentPixelCoords = { x: -1, y: -1, roundedX: -1, roundedY: -1 }; // Impossible coordinates in pixel coords
var usersCurrentLatLong = { lat: 91, long: 181 };                           // Impossible coordinates in lat and long
var watchID = -1;
var mapBeingShown = false;
var lowQuality = false;
var heightMaps;
var pathPromise;
var centreCamera = false;
var touchstartX;
var rigPos = { x: 0, y: 0, z: 0 };
var hasToggledCamView = false;
var hasToggledStatView = false;
var lastDebugPos = { x: 0, y: 0, z: 0 };
var xNumberDistancesMoved = 0;
var yNumberDistancesMoved = 0;

const osmCacheName = "osmCache";            // Name of the cache for the OSM data that is fetched
var osmCache = caches.open(osmCacheName);   // Opens a new cache with the given name
var cacheDeletionInterval;

const isIOS = navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
const overpassURL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=";
const buildingCoordsScale = 1 / (twfData[0] + buildingScale - 1);   // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const pathCoordsScale = 1 / (twfData[0] + pathScale - 1);                       // ^^
const grassAreaCoordsScale = 1 / (twfData[0] + areaScale - 1);                  // ^^
const pedestrianAreaCoordsScale = 1 / (twfData[0] + pedestrianAreaScale - 1);   // ^^
const bboxSize = 400;                       // Length of one side of bounding box in metres
const pathLookAhead = 1500 - bboxSize;      // How much bigger the bbox is for the paths to see ahead for navigation (1500m = uni campus size)
const distanceNeededToLoadNewChunk = (bboxSize / 2) * 0.70;     // Used to check if the user has moved far enough
const bboxOffset = distanceNeededToLoadNewChunk * -1.9;
const distanceNeededToUpdateNavigation = 16;
const humanHeight = 1.2;    // Height of the user in metres
const birdHeight = 140;     // Height of the user in metres
const cacheTTL = 1000 * 60 * 2;     // How often the cache should be deleted and reopened

const scene = document.querySelector("a-scene");
const cameraRig = document.getElementById("rig");
const secondaryCameraRig = document.getElementById("secondaryRig");
const secondaryCamera = document.getElementById("secondarycamera");
const playerCamera = document.getElementById("playerCamera");
const debugCamera = document.getElementById("debugCamera");
const playerSphere = document.getElementById("playerSphere");
const interfaceUI = document.getElementById("interface");
const miniMap = document.getElementById("miniMap");
const loadingModal = document.getElementById("loadingModal");

const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,      // How often the location should be updated
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};

const rasterWorker = new Worker('rasterWorker.js');
const rasters = new Promise((resolve, reject) => {
    rasterWorker.postMessage({ uniURL: uniURL, cityURL: cityURL });
    rasterWorker.onmessage = async function (e) {
        // if (e.data.status == "bad") {
        //     debugLog("Worker failed. Reverting to UI thread.");
        //     // TODO #3 Need to look over adding catches to this code as if it fails, no height map will be created.
        //     let cpuCores = navigator.hardwareConcurrency;
        //     var pools = [new GeoTIFF.Pool(cpuCores / 2 - 1), new GeoTIFF.Pool(cpuCores / 2 - 1)];
        //     const rasters = await Promise.all([
        //         rasterFromURL(uniURL, pools[0]),
        //         rasterFromURL(cityURL, pools[1])
        //     ]);
        //     pools.forEach((pool, index) => {
        //         pools[index] = undefined;
        //         pool.destroy();
        //     });
        //     resolve({ uniRaster: rasters[0], cityRaster: rasters[1] })
        // }
        // resolve({ uniRaster: e.data.uniRaster, cityRaster: e.data.cityRaster });
        resolve({ uniRaster: 0, cityRaster: 0 });
    }
});

var currentRaster = rasters.then((rasters) => {
    return rasters.uniRaster;
});

fillSuggestions();

function rasterFromURL(url, pool) {
    return GeoTIFF.fromUrl(url).then(tiff => {
        return tiff.getImage();
    }).then(image => {
        return image.readRasters({ pool });
    });
}

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

    showLoadingMessage();
    if (watchID == -1) watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
    cacheDeletionInterval = setInterval(deleteAndReOpenCache, cacheTTL);   // Once a minute clear the caches.
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
    debugLog("Interval Cleared");
    mapBeingShown = false;
}

/**
 * The function hides the button to open the navigation menu and displays the navigation menu.
 */
function showNavigationMenu() {
    document.getElementById("navigationScreen").style.display = "block";
    document.getElementById("loadNavigationMenuBtn").style.visibility = "hidden";
}

/**
 * Hide the navigation menu and show the button to open the navigation menu.
 */
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
    // debugLog("\n\n===== NEW LOCATION ======");
    // let newLatLong = { lat: position.coords.latitude, long: position.coords.longitude };
    // let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    // debugLog(newLatLong, newPixelCoords);
    // // if (newPixelCoords.roundedX < 0 || newPixelCoords.roundedX > 2500 || newPixelCoords.roundedY < 0 || newPixelCoords.roundedY > 2500) throw "Invalid Coordinates"
    // if (movedFarEnoughForMap(newPixelCoords)) {
    //     if (currentCentreOfBBox.x == -1 && currentCentreOfBBox.y == -1) {
    //         currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
    //     }
    //     else {
    //         currentCentreOfBBox = { x: currentCentreOfBBox.x + (bboxSize / 3) * xNumberDistancesMoved, y: currentCentreOfBBox.y + (bboxSize / 3) * yNumberDistancesMoved, roundedX: currentCentreOfBBox.roundedX + (bboxSize / 3) * xNumberDistancesMoved, roundedY: currentCentreOfBBox.roundedY + (bboxSize / 3) * yNumberDistancesMoved };
    //         // console.log("Before: " + newPixelCoords.x + ", " + newPixelCoords.y);
    //         // // newPixelCoords = { x: newPixelCoords.x + bboxSize * xNumberDistancesMoved, y: newPixelCoords.y + bboxSize * yNumberDistancesMoved, roundedX: newPixelCoords.roundedX + bboxSize * xNumberDistancesMoved, roundedY: newPixelCoords.roundedY + bboxSize * yNumberDistancesMoved };
    //         // console.log("After: " + newPixelCoords.x + ", " + newPixelCoords.y);
    //         // console.log("Before: " + newLatLong.lat + ", " + newLatLong.long);
    //         // newLatLong = addDistance(newLatLong, xNumberDistancesMoved * (bboxSize/2), true)
    //         // console.log("During: " + newLatLong.lat + ", " + newLatLong.long + "");
    //         // newLatLong = addDistance(newLatLong, yNumberDistancesMoved * (bboxSize/2), false)
    //         // console.log("After: " + newLatLong.lat + ", " + newLatLong.long + "");
    //     }
    //     let bboxLatLong = convertPixelCoordsToLatLong(currentCentreOfBBox);
    //     bboxLatLong = {lat: bboxLatLong.x, long: bboxLatLong.y}
    //     console.log("BBox Pixel: " + currentCentreOfBBox.x + ", " + currentCentreOfBBox.y + "");
    //     console.log("BBox LatLong: " + bboxLatLong.lat + ", " + bboxLatLong.long + "");
    //     loadNewMapArea(bboxLatLong, currentCentreOfBBox, bboxSize).then(() => { renderMiniMap(); });
    // }
    // else if (movedFarEnoughForNavigation(newLatLong)) carryOnNavigating(pathPromise);
    // placeCameraAtPixelCoords(newPixelCoords, { lat: position.coords.latitude, long: position.coords.longitude });

    debugLog("\n\n===== NEW LOCATION ======");
    let newLatLong = { lat: position.coords.latitude, long: position.coords.longitude };
    let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    debugLog(newLatLong);
    if (movedEnoughForNewChunk(bboxPixelCoords, newPixelCoords)) {
        bboxPixelCoords = saveNewChunkCoords(bboxPixelCoords, newPixelCoords);
        showLoadingMessage();
        loadNewMapArea(bboxPixelCoords, bboxSize).then(() => {
            renderMiniMap();
            if ('caches' in window) {
                deleteAndReOpenCache();
                loadFourEdgeChunks(structuredClone(bboxPixelCoords), bboxSize);
            }
            hideLoadingMessage();
        });
    }
    else if (movedFarEnoughForNavigation(newLatLong)) carryOnNavigating(pathPromise);
    placeCameraAtPixelCoords(newPixelCoords, newLatLong);
}

function movedEnoughForNewChunk(currentCentreOfBBox, newPixelCoords) {
    if (currentCentreOfBBox.x == -1 && currentCentreOfBBox.y == -1) return true;
    let xDistance = Math.abs(currentCentreOfBBox.x - newPixelCoords.x) * 2;
    let yDistance = Math.abs(currentCentreOfBBox.y - newPixelCoords.y) * 2;
    if (xDistance > distanceNeededToLoadNewChunk || yDistance > distanceNeededToLoadNewChunk) return true;
    return false;
}

function saveNewChunkCoords(currentCentreOfBBox, newPixelCoords) {
    if (currentCentreOfBBox.x == -1 && currentCentreOfBBox.y == -1) {
        return { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
    }
    let xDistance = (currentCentreOfBBox.x - newPixelCoords.x) * 2;
    let yDistance = (currentCentreOfBBox.y - newPixelCoords.y) * 2;
    let xNumberDistancesMoved = Math.trunc(xDistance / distanceNeededToLoadNewChunk)/2;
    let yNumberDistancesMoved = Math.trunc(yDistance / distanceNeededToLoadNewChunk)/2;
    return { x: currentCentreOfBBox.x + xNumberDistancesMoved * bboxOffset, y: currentCentreOfBBox.y + yNumberDistancesMoved * bboxOffset, roundedX: currentCentreOfBBox.roundedX + xNumberDistancesMoved * bboxOffset, roundedY: currentCentreOfBBox.roundedY + yNumberDistancesMoved * bboxOffset };
}

/**
 * Will log the error that occured from the geolocation API to the console.
 * @param error - The error object returned by the geolocation API.
 */
function locationError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            debugLog("User denied the request for Geolocation.")
            break;
        case error.POSITION_UNAVAILABLE:
            debugLog("Location information is unavailable.")
            break;
        case error.TIMEOUT:
            debugLog("The request to get user location timed out.")
            break;
        case error.UNKNOWN_ERROR:
            debugLog("An unknown error occurred.")
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
    if (bboxPixelCoords.x == -1 && bboxPixelCoords.y == -1) {
        // currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
        return true;
    }

    // Storing how many metres the user has moved in the x and y directions.
    let xDistance = bboxPixelCoords.x - newPixelCoords.x;
    xDistance = Math.abs(xDistance) * 2;
    let yDistance = bboxPixelCoords.y - newPixelCoords.y;
    yDistance = Math.abs(yDistance) * 2;
    debugLog(xDistance);
    debugLog(yDistance);

    // The user has to have moved 'distanceNeededToMove' metres.
    xNumberDistancesMoved = Math.floor(xDistance / distanceNeededToLoadNewChunk);
    yNumberDistancesMoved = Math.floor(yDistance / distanceNeededToLoadNewChunk);
    console.log("xNumberDistancesMoved: " + xNumberDistancesMoved);
    console.log("yNumberDistancesMoved: " + yNumberDistancesMoved);
    if (xNumberDistancesMoved > 0 || yNumberDistancesMoved > 0) {
        // currentCentreOfBBox = { x: currentCentreOfBBox.x + bboxSize * xNumberDistancesMoved, y: currentCentreOfBBox.y + bboxSize * yNumberDistancesMoved, roundedX: currentCentreOfBBox.roundedX + bboxSize * xNumberDistancesMoved, roundedY: currentCentreOfBBox.roundedY + bboxSize * yNumberDistancesMoved };
        return true;
    }
    // if (xDistance > distanceNeededToLoadNewChunk && yDistance > distanceNeededToLoadNewChunk) {
    // }
    // else if (xDistance > distanceNeededToLoadNewChunk) {
    //     currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
    //     return true;
    // }
    // else if (yDistance > distanceNeededToLoadNewChunk) {
    //     currentCentreOfBBox = { x: newPixelCoords.x, y: newPixelCoords.y, roundedX: newPixelCoords.roundedX, roundedY: newPixelCoords.roundedY };
    //     return true;
    // }
    return false;
}

/**
 * If the user has moved more than 'distanceNeededToUpdateNavigation' metres, return true
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns a boolean value.
 */
function movedFarEnoughForNavigation(newLatLong) {
    if (!navigationInProgress) return false;
    let distance = getDistance([sourceLatLong.lat, sourceLatLong.long], [newLatLong.lat, newLatLong.long]);
    debugLog("Distance: " + distance + " metres");
    if (distance > distanceNeededToUpdateNavigation) {
        debugLog("Moved far enough!");
        return true;
    }
    return false;
}

/**
 * It loads the map by getting the height map, removing the current map, loading the terrain, and
 * loading the buildings.
 * @param coordinate - The coordinate of the center of the map.
 * @param pixelCoords - The pixel coordinates of the center of the map.
 * @param bboxSize - The size of the bounding box in metres.
 */
async function loadNewMapArea(pixelCoords, bboxSize) {
    lowQuality = true;
    heightMaps = getHeightMap(pixelCoords, bboxSize);
    removeCurrentMap();
    loadTerrain();
    loadBuildings(pixelCoords, bboxSize);
    pathPromise = loadPaths(pixelCoords, bboxSize);
    loadNaturalFeatures(pixelCoords, bboxSize);
    carryOnNavigating(pathPromise);
    return pathPromise;
}

/**
 * Places the camera at the pixel coords and sets the users current location variables.
 * @param pixelCoords - The new pixel coordinates of the user.
 * @param newLatLong - The new latitude and longitude of the user.
 */
function placeCameraAtPixelCoords(pixelCoords, newLatLong) {
    if (watchID != -1) {
        cameraRig.object3D.position.set(pixelCoords.x, humanHeight, pixelCoords.y);
    }
    secondaryCameraRig.object3D.position.set(pixelCoords.x, birdHeight, pixelCoords.y);
    playerSphere.object3D.position.set(pixelCoords.x, humanHeight, pixelCoords.y);
    renderMiniMap();
    usersCurrentPixelCoords = pixelCoords;
    usersCurrentLatLong = newLatLong;

    if (lowQuality) return;
    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
            cameraRig.object3D.position.set(pixelCoords.x, (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + humanHeight), pixelCoords.y);
            secondaryCameraRig.object3D.position.set(pixelCoords.x, (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + birdHeight), pixelCoords.y);
            playerSphere.object3D.position.set(pixelCoords.x, (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + humanHeight), pixelCoords.y);
            renderMiniMap();
        });
    }).catch((err) => {
        debugLog(err);
    });
}

function loadFourEdgeChunks(tempBboxPixelCoords, bboxSize) {
    tempBboxPixelCoords.x += bboxOffset / 2;
    preloadBuildingChunk(tempBboxPixelCoords, bboxSize);
    preloadPathChunk(tempBboxPixelCoords, bboxSize);

    tempBboxPixelCoords.x -= bboxOffset / 2;
    tempBboxPixelCoords.y += bboxOffset / 2;
    preloadBuildingChunk(tempBboxPixelCoords, bboxSize);
    preloadPathChunk(tempBboxPixelCoords, bboxSize);

    tempBboxPixelCoords.x -= bboxOffset / 2;
    tempBboxPixelCoords.y -= bboxOffset / 2;
    preloadBuildingChunk(tempBboxPixelCoords, bboxSize);
    preloadPathChunk(tempBboxPixelCoords, bboxSize);

    tempBboxPixelCoords.x += bboxOffset / 2;
    tempBboxPixelCoords.y -= bboxOffset / 2;
    preloadBuildingChunk(tempBboxPixelCoords, bboxSize);
    preloadPathChunk(tempBboxPixelCoords, bboxSize);
}

/**
 * Deletes the cache and then opens a new cache.
 */
async function deleteAndReOpenCache() {
    await caches.delete(osmCacheName);
    console.log("Cache Storage Deleted");
    console.log("Opening New Cache Storage");
    debugLog("Cache Storage Deleted");
    debugLog("Opening New Cache Storage");
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
        debugLog("Interval Cleared");
    }
};

/* Restarting the cache deletion interval when the window is in focus. */
window.onfocus = function () {
    if (typeof cacheDeletionInterval === 'undefined' && mapBeingShown == true) {
        cacheDeletionInterval = setInterval(deleteAndReOpenCache, cacheTTL);   // Once a minute clear the caches.
        debugLog("Interval Restarted");
    }
};

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
 * Removes the everything from the scene.
 */
function removeCurrentMap() {
    removeCurrentTerrain();
    removeCurrentBuildings();
    removeCurrentPaths();
    removeCurrentPedestrianAreas();
    removeCurrentNaturalAreas();
    removeCurrentTrees();
}

/* Listens for any key presses. */
document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
    if (event.code === "KeyC") toggleCameraView();
    else if (event.code === "KeyV") toggleStats();
});

/* Listens for when the user starts touching the screen. */
document.addEventListener("touchstart", function (event) {
    if (event.touches.length === 2) {
        touchstartX = event.changedTouches[0].screenX;
    }
});

/* Listens for when the user stops touching the screen. */
document.addEventListener("touchend", function (event) {
    if (event.touches.length === 2) {
        handleGesture(touchstartX, event.changedTouches[0].screenX);
    }
});

/**
 * If the user swipes left or right, toggle the stats.
 * @param touchstartX - The x coordinate of the point where the user started the touch 
 * @param touchendX - The x coordinate of the point where the user ended the touch
 */
function handleGesture(touchstartX, touchendX) {
    if (touchendX >= touchstartX || touchendX <= touchstartX) toggleStats();
}

/**
 * If the player camera is active, make the debug camera active. Otherwise, make the player camera
 * active.
 */
function toggleCameraView() {
    if (!hasToggledCamView) {
        hasToggledCamView = true;
    }
    const playerActive = playerCamera.getAttribute('camera').active;
    if (!playerActive) {
        watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
        playerCamera.setAttribute('camera', 'active', !playerActive);
    }
    else {
        navigator.geolocation.clearWatch(watchID);
        watchID = -1;
        debugCamera.setAttribute('camera', 'active', playerActive);
        rigPos = cameraRig.object3D.position;
    }
}

/**
 * Toggles the stats attribute on the scene element.
 */
function toggleStats() {
    if (!hasToggledStatView) {
        hasToggledStatView = true;
        alert("Swiping with three fingers right or pressing 'v' toggles the stats :)")
    }
    scene.setAttribute('stats', !scene.getAttribute('stats'));
}

/* When mini map is clicked, zoom in/out to make it bigger. */
miniMap.addEventListener("click", function () {
    if (miniMap.width === 100) {
        miniMap.width = 200;
        miniMap.height = 200;
        secondaryCamera.setAttribute("camera", "zoom", 1.8);
        miniMap.style.border = "4px solid black";
    } else {
        miniMap.width = 100;
        miniMap.height = 100;
        secondaryCamera.setAttribute("camera", "zoom", 3);
        miniMap.style.border = "2px solid black";
    }
    renderMiniMap();
});

/**
 * It renders the scene from the perspective of the secondary camera, and then draws the result to the
 * mini map canvas.
 */
function renderMiniMap() {
    scene.renderer.render(scene.object3D, secondaryCamera.components.camera.camera);
    miniMap.getContext("2d", {
        failIfMajorPerformanceCaveat: true,
        antialias: true
    }).drawImage(scene.renderer.domElement, 0, 0, miniMap.width, miniMap.height);
}

/**
 * If the interface is hidden, show it, otherwise hide it.
 */
function toggleInterface() {
    interfaceUI.style.display = interfaceUI.style.display === "none" ? "block" : "none";
}

/**
 * Adds an event listener to the window object to listen for the deviceorientation event.
 */
function startCompass() {
    if (isIOS) window.addEventListener("deviceorientation", handleCompassHeading, true);
    else window.addEventListener("deviceorientationabsolute", handleCompassHeading, true);
}

/**
 * It takes the compass heading and uses it to rotate the main and secondary cameras.
 * @param event - The event object that contains the compass heading.
 */
function handleCompassHeading(event) {
    let compassHeading = event.webkitCompassHeading || Math.abs(event.alpha - 360);
    if (centreCamera) angleMainCamera(compassHeading);
    angleSecondaryCamera(compassHeading);
}

/**
 * Takes the compass heading and rotates the mini map to match the heading of the device.
 * @param compassHeading - The compass heading of the device.
 */
function angleSecondaryCamera(compassHeading) {
    miniMap.style.transform = "rotate(" + (360 - compassHeading) + "deg)";
}

/**
 * Takes the compass heading and rotates the camera to match the heading of the device.
 * @param compassHeading - The compass heading in degrees.
 */
function angleMainCamera(compassHeading) {
    debugLog("BEFORE Compass Heading: " + compassHeading + " degrees");
    compassHeading = 360 - compassHeading;
    debugLog("AFTER Compass Heading: " + compassHeading + " degrees");
    centreCamera = false;
    // playerCamera.setAttribute("rotation", "0 " + compassHeading + " 0")
    // debugLog("yaw", playerCamera.components['look-controls'].yawObject.rotation.y);
    // debugLog("magic", playerCamera.components['look-controls'].magicWindowDeltaEuler.y);
    // debugLog("magic ABS", playerCamera.components['look-controls'].magicWindowAbsoluteEuler.y);
    debugLog(playerCamera.components['look-controls']);
    playerCamera.components['look-controls'].magicWindowControls.deviceOrientation.alpha = compassHeading;
    // playerCamera.components['look-controls'].yawObject.rotation.y = compassHeading - playerCamera.components['look-controls'].magicWindowDeltaEuler.y;
}

/**
 * If the camera has moved more than 1.5 meters in either the x or z direction, return true.
 * @param newDebugPos - The new position of the debug camera
 * @returns A boolean value
 */
function debugCamMovedFarEnough(newDebugPos) {
    const xDistance = Math.abs(lastDebugPos.x - newDebugPos.x);
    if (xDistance > 1.5) return true;
    const yDistance = Math.abs(lastDebugPos.z - newDebugPos.z);
    if (yDistance > 1.5) return true;
    return false;
}

/**
 * Shows the modal that tells the user that the website is loading.
 */
function showLoadingMessage() {
    loadingModal.style.display = "block";
    loadingModal.style.animationName = "modalSlideUp";
}

function hideLoadingMessage() {
    // loadingModal.style.animationName = "modalSlideDown";
    loadingModal.style.display = "none"
    // setTimeout(() => { loadingModal.style.display = "none" }, 580);
}

AFRAME.registerComponent("updatedebugmap", {
    init: function () {
        this.tick = AFRAME.utils.throttleTick(this.tick, 80, this);    // Throttle the tick function to 500ms
    },
    tick: function () {
        if (!mapBeingShown || watchID != -1) return;
        let debugPos = debugCamera.object3D.position.clone();
        if (debugCamMovedFarEnough(debugPos)) {
            lastDebugPos = debugPos;
            let latLong = convertPixelCoordsToLatLong({ x: debugPos.x + rigPos.x, y: debugPos.z + rigPos.z });
            locationSuccess({ coords: { latitude: latLong.lat, longitude: latLong.long } });
        }
    },
});