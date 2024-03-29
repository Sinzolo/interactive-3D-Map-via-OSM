'use strict';

const twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data

var bboxPixelCoords = { x: -1, y: -1, roundedX: -1, roundedY: -1 };         // Impossible coordinates in pixel coords
var bboxLatLongCoords = { lat: 91, long: 181 };                             // Impossible coordinates in lat and long coords
var usersCurrentPixelCoords = { x: -1, y: -1, roundedX: -1, roundedY: -1 }; // Impossible coordinates in pixel coords
var usersCurrentLatLong = { lat: 91, long: 181 };                           // Impossible coordinates in lat and long
var watchID = -1;           // Navigation watch ID
var mapBeingShown = false;  // Whether the map is being shown
var lowQuality = true;
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
var wakeLock = null;

const osmCacheName = "osmCache";            // Name of the cache for the OSM data that is fetched
var osmCache;
var cacheDeletionInterval;

const isIOS = navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const overpassURL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=";
const buildingCoordsScale = 1 / (twfData[0] + buildingScale - 1);   // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const pathCoordsScale = 1 / (twfData[0] + pathScale - 1);                       // ^^
const areaCoordsScale = 1 / (twfData[0] + areaScale - 1);                  // ^^
const pedestrianAreaCoordsScale = 1 / (twfData[0] + pedestrianAreaScale - 1);   // ^^
const bboxSize = 380;                       // Length of one side of bounding box in metres
const pathLookAhead = 1500 - bboxSize;      // How much bigger the bbox is for the paths to see ahead for navigation (1500m = uni campus size)
const distanceNeededToLoadNewChunk = (bboxSize / 2) * 0.65;     // Used to check if the user has moved far enough
const bboxOffset = distanceNeededToLoadNewChunk * -1.9;
const distanceNeededToUpdateNavigation = 14;
const humanHeight = 1.2;    // Height of the user in metres
const birdHeight = 140;     // Height of the user in metres
const cacheTTL = 1000 * 60 * 2;     // How often the cache should be deleted and reopened

const cameraRig = document.getElementById("rig");
const secondaryCameraRig = document.getElementById("secondaryRig");
const secondaryCamera = document.getElementById("secondarycamera");
const playerCamera = document.getElementById("playerCamera");
const debugCamera = document.getElementById("debugCamera");
const playerSphere = document.getElementById("playerSphere");
const hamburgerMenuDiv = document.getElementById("hamburgerMenuDiv");
const miniMap = document.getElementById("miniMap");
const loadingModal = document.getElementById("loadingModal");
const pLoadingModalTxt = loadingModal.querySelector("p");
const invalidEntryModal = document.getElementById("invalidEntryModal");
const pInvalidEntryModalTxt = invalidEntryModal.querySelector("p");
const fullscreenBtn = document.getElementById('fullscreenBtn');
const ctx = miniMap.getContext("2d", {
    failIfMajorPerformanceCaveat: false,
    antialias: false,
});
const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,      // How often the location should be updated
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};
const rasters = new Promise((resolve, reject) => {
    resolve({ uniRaster: 0});
});
var currentRaster = rasters.then((rasters) => {
    return rasters.uniRaster;
});



fillSuggestions();

function uniMap() {
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

    changeLoadingModal("Getting Your Location!", "#b51d1d", "#F5F5F5");
    showLoadingMessage();
    if (watchID == -1) watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
    cacheDeletionInterval = setInterval(deleteAndReOpenCache, cacheTTL);   // Once a minute clear the caches.
    mapBeingShown = true;
    enableWakeLock();
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
}

/**
 * Hide the navigation menu and show the button to open the navigation menu.
 */
function hideNavigationMenu() {
    document.getElementById("navigationScreen").style.display = "none";
}

/**
 * If the navigation screen is not displayed, display it. Otherwise, hide it
 */
function toggleNavigationMenu() {
    document.getElementById("navigationScreen").style.display = document.getElementById("navigationScreen").style.display === "none" ? "block" : "none";
}

/**
 * If the user has moved far enough, load a new map area, and place the camera at the user's new
 * location.
 * @param position - the position object returned by the geolocation API
 */
async function locationSuccess(position) {
    debugLog("\n\n===== NEW LOCATION ======");
    let newLatLong = { lat: position.coords.latitude, long: position.coords.longitude };
    let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    if (movedEnoughForNewChunk(bboxPixelCoords, newPixelCoords)) {
        changeLoadingModal("Fetching Map Data...", "#ffa500", "#2e2e2e");
        bboxPixelCoords = saveNewChunkCoords(bboxPixelCoords, newPixelCoords);
        showLoadingMessage();
        loadNewMapArea(bboxPixelCoords, bboxSize).then(async () => {
            renderMiniMap();
            if ('caches' in window) {
                await deleteAndReOpenCache();
                loadFourEdgeChunks(structuredClone(bboxPixelCoords), bboxSize);
            }
            changeLoadingModal("Map Loaded!", "#006110", "#F5F5F5");
            hideLoadingMessage();
        });
    }
    else if (movedFarEnoughForNavigation(newLatLong)) carryOnNavigating(pathPromise);
    placeCameraAtPixelCoords(newPixelCoords, newLatLong);
}

/**
 * If the new pixel coordinates are far enough away from the current centre of the bounding box, return
 * true.
 * @param currentCentreOfBBox - The centre of the current bounding box.
 * @param newPixelCoords - The new pixel coordinates of the centre of the bounding box.
 * @returns A boolean value.
 */
function movedEnoughForNewChunk(currentCentreOfBBox, newPixelCoords) {
    if (currentCentreOfBBox.x == -1 && currentCentreOfBBox.y == -1) return true;
    let xDistance = Math.abs(currentCentreOfBBox.x - newPixelCoords.x) * 2;
    let yDistance = Math.abs(currentCentreOfBBox.y - newPixelCoords.y) * 2;
    if (xDistance > distanceNeededToLoadNewChunk || yDistance > distanceNeededToLoadNewChunk) return true;
    return false;
}

/**
 * From the current centre of the bounding box and the new coords of the user,
 * calculate the new centre of the bounding box.
 * @param currentCentreOfBBox - The current centre of the bounding box.
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns The new coordinates of the centre of the bounding box.
 */
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
 * If the user has moved more than 'distanceNeededToUpdateNavigation' metres, return true
 * @param newPixelCoords - The new pixel coordinates of the user.
 * @returns a boolean value.
 */
function movedFarEnoughForNavigation(newLatLong) {
    if (!navigationInProgress) return false;
    let distance = getDistance([sourceLatLong.lat, sourceLatLong.long], [newLatLong.lat, newLatLong.long]);
    if (distance > distanceNeededToUpdateNavigation) {
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
}

/**
 * It takes a bounding box and loads the four chunks of buildings and paths that are adjacent to the
 * bounding box
 * @param tempBboxPixelCoords - The top centre of the bounding box in pixel coordinates.
 * @param bboxSize - The size of the bounding box in pixels.
 */
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
    debugLog("Cache Storage Deleted");
    debugLog("Opening New Cache Storage");
    osmCache = await caches.open(osmCacheName);
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

if (!isMobile) {
    /* Listens for any key presses. */
    document.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
        if (event.code === "KeyC") toggleCameraView();
        else if (event.code === "KeyV") toggleStats();
    });
}

/**
 * If the player camera is active, make the debug camera active. Otherwise, make the player camera
 * active.
 */
function toggleCameraView() {
    if (!hasToggledCamView) {
        hasToggledCamView = true;
        alert("Pressing 'c' toggles the camera so you can now move around with WASD :)")
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
        alert("Pressing 'v' toggles the stats :)")
    }
    scene.setAttribute('stats', !scene.getAttribute('stats'));
}

/* When mini map is clicked, zoom in/out to make it bigger. */
miniMap.addEventListener("click", function () {
    if (miniMap.width === 100) {
        miniMap.width = 200;
        miniMap.height = 200;
        secondaryCamera.setAttribute("camera", "zoom", 1.8);
        miniMap.style.border = "3.8px solid black";
    } else {
        miniMap.width = 100;
        miniMap.height = 100;
        secondaryCamera.setAttribute("camera", "zoom", 3);
        miniMap.style.border = "2.4px solid black";
    }
    renderMiniMap();
});

/**
 * It renders the scene from the perspective of the secondary camera, and then draws the result to the
 * mini map canvas.
 */
function renderMiniMap() {
    scene.renderer.render(scene.object3D, secondaryCamera.components.camera.camera);    // Render the scene from the perspective of the secondary camera
    ctx.drawImage(scene.renderer.domElement, 0, 0, miniMap.width, miniMap.height);      // Draw the result to the mini map canvas
}

/**
 * If the interface is hidden, show it, otherwise hide it.
 */
function toggleHamburgerMenu() {
    hamburgerMenuDiv.style.display = hamburgerMenuDiv.style.display === "none" ? "block" : "none";
}

/**
 * Show the hamburger menu.
 */
function showHamburgerMenu() {
    hamburgerMenuDiv.style.display = "block";
}

/**
 * Hide the hamburger menu.
 */
function hideHamburgerMenu() {
    hamburgerMenuDiv.style.display = "none";
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
    // if (centreCamera) angleMainCamera(compassHeading);
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
 * ! Doesn't work
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

/**
 * When the page is loaded, hide the loading modal.
 */
function hideLoadingMessage() {
    setTimeout(() => {
        loadingModal.style.animationName = "modalSlideDown";
        setTimeout(() => { loadingModal.style.display = "none" }, 580);
    }, 1300);
}

/**
 * It changes the text, background colour, and text colour of the loading modal.
 * @param text - The text to display in the loading modal.
 * @param backgroundColour - The background colour of the loading modal.
 * @param textColour - The colour of the text in the loading modal.
 */
function changeLoadingModal(text, backgroundColour, textColour) {
    pLoadingModalTxt.innerHTML = text;
    loadingModal.style.backgroundColor = backgroundColour;
    pLoadingModalTxt.style.color = textColour;
}

if (isIOS) fullscreenBtn.style.display = "none";
else {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.mozFullScreenElement && 
        !document.webkitFullscreenElement && !document.msFullscreenElement ) {
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
            else if (document.documentElement.msRequestFullscreen) document.documentElement.msRequestFullscreen();
            else if (document.documentElement.mozRequestFullScreen) document.documentElement.mozRequestFullScreen();
            else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    });
}

/**
 * Stops the device from going to sleep if supported by the device.
 */
function enableWakeLock() {
    try {
        wakeLock = navigator.wakeLock.request("screen");
    } catch (err) {
        debugLog("Wake Lock Error: " + err);
    }
}

AFRAME.registerComponent("updatedebugmap", {
    init: function () {
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);    // Throttle the tick function to 100ms
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