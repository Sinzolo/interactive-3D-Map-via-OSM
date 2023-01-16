var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]      // Uni .twf Data
const tiffURL = "uniTiff/SD45ne_DTM_2m.tif";    // Uni .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 464999.0000000000]      // City .twf Data
//const tiffURL = "cityTiff/SD46se_DTM_2m.tif";    // City .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 350001.0000000000, 424999.0000000000]       // Leyland .twf Data
//const tiffURL = "leylandTiff/SD52sw_DTM_2m.tif";    // Leyland .tiff data
//var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 350001.0000000000, 419999.0000000000]       // Lydiate .twf Data
//const tiffURL = "lydiateTiff/SD51nw_DTM_2m.tif";    // Lydiate .tiff data


var usersPixelCoords = { x: -1, y: -1 };           // Impossible coordinates
var watchID = -1;
var numberOfPositionChanges = 0;
var coordsTotal = {lat: 0, long: 0};
var mapBeingShown = false;

const overpassURL = "https://overpass-api.de/api/interpreter?data=";
const uniCoordinate = { lat: 54.01028, long: -2.78536 }   // Centre of uni
const buildingScale = 4.3;                                // Scaling the buildings (bigger number = bigger buildings in the x and z)
const buildingHeightScale = 2.2;                          // Scale for the buildings height (bigger number = bigger buildings in y axis)
const coordsScale = 1 / (twfData[0] + buildingScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building
const buildingHeightOffset = 200;                         // How far to extend the buildings under the ground
const bboxSize = 500;                                     // Length of one side of bounding box in metres
const distanceNeededToMove = (bboxSize/2)*0.7;            // Used to check if the user has moved far enough
const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 1000,    // Will only update every 600ms
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};
const debug = true;

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
    osmCache = caches.open(osmCacheName)
}
/* Delete the cache when the page is unloaded. */
window.addEventListener("unload", async function() {
    await caches.delete(osmCacheName);
});
/* Clearing the interval when the window is not in focus. */
window.onblur = function() {
    if (typeof cacheDeletionInterval !== 'undefined' && mapBeingShown == true) {
        cacheDeletionInterval = clearInterval(cacheDeletionInterval);
        console.log("Interval Cleared");
    }
};
/* Restarting the cache deletion interval when the window is in focus. */
window.onfocus = function() {
    if (typeof cacheDeletionInterval === 'undefined' && mapBeingShown == true) {
        cacheDeletionInterval = setInterval(deleteAndReOpenCache, 1000*60);   // Once a minute clear the caches.
        console.log("Interval Restarted");
    }
};



/**
 * Hides the welcome screen and shows the map
 */
function showMap() {
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    if (watchID == -1) watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
    cacheDeletionInterval = setInterval(deleteAndReOpenCache, 1000*60);   // Once a minute clear the caches.
    mapBeingShown = true;
}

/**
 * Hides the map and shows the welcome screen
 */
function showMenu() {
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "none";
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "block";

    navigator.geolocation.clearWatch(watchID);
    watchID = -1;
    clearInterval(cacheDeletionInterval);
    console.log("Interval Cleared");
    mapBeingShown = false;
}


async function locationSuccess(position) {
    console.log("\n\n===== NEW LOCATION ======");
    let newLatLong = {lat: position.coords.latitude, long: position.coords.longitude};

    let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    console.log(newPixelCoords);
    if (newPixelCoords.x < 0 || newPixelCoords.x > 2500 || newPixelCoords.y < 0 || newPixelCoords.y > 2500) throw "Invalid Coordinates"
    if (movedFarEnough(newPixelCoords)) await loadNewMapArea(newLatLong, newPixelCoords, bboxSize);
    if (twoDHeightMapArray) placeCameraAtPixelCoords(newPixelCoords);
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
    if (usersPixelCoords.x == -1 && usersPixelCoords.y == -1) {
        console.log("First time moving");
        usersPixelCoords = {x: newPixelCoords.x, y: newPixelCoords.y};
        return true;
    }

    // Storing how many metres the user has moved in the x and y directions.
    let xDistance = usersPixelCoords.x - newPixelCoords.x;
    xDistance = Math.abs(xDistance)*2;
    let yDistance = usersPixelCoords.y - newPixelCoords.y;
    yDistance = Math.abs(yDistance)*2;
    console.log(xDistance);
    console.log(yDistance);

    // The user has to have moved 'distanceNeededToMove' metres.
    if (xDistance > distanceNeededToMove || yDistance > distanceNeededToMove) {
        usersPixelCoords = {x: newPixelCoords.x, y: newPixelCoords.y};
        return true;
    }
    return false;
}


/**
 * It takes a pixel coordinate and places the camera at that pixel coordinate
 * @param pixelCoords - The pixel coordinates of where the camera is to be placed.
 */
function placeCameraAtPixelCoords(pixelCoords) {
    camera = document.getElementById("rig");
    camera.setAttribute("position", pixelCoords.x + " " + (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)] + 1.6) + " " + pixelCoords.y);
    // TODO Smooth camera movement or smooth out GPS coordinates
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
    await getHeightMap(pixelCoords, bboxSize);
    setCurrentMapForRemoval();
    removeCurrentMap();
    loadTerrain();
    loadBuildings(coordinate, bboxSize);
    loadPaths(coordinate, bboxSize);
}


/**
 * Return true if the player's camera is active, otherwise return false.
 * 
 * @returns The active state of the players camera.
 */
function isPlayerCameraActive() {
    var playerCamera = document.getElementById("playerCamera");
    return playerCamera.getAttribute('camera').active;
}


/**
 * Remove the element with the given id from the document.
 * Does nothing if element does not exist.
 * @param id - The id of the element to remove.
 */
function removeElement(id) {
    let parentElement = document.getElementById(id);
    if (parentElement) parentElement.remove();
}

/**
 * Removes the terrain from the scene
 */
function removeCurrentTerrain() {
    console.log("=== Deleting Terrain ===");
    removeElement("terrainToRemove")
}

/**
 * Removes all the buildings from the scene
 */
function removeCurrentBuildings() {
    console.log("=== Deleting Buildings ===");
    removeElement("buildingToRemove")
}

/**
 * Removes the current terrain and buildings
 */
function removeCurrentMap() {
    removeCurrentTerrain();
    removeCurrentBuildings();
}

/**
 * If the element with the given ID exists, change its ID to the new ID.
 * @param elementID - The ID of the element you want to change.
 * @param newElementID - The new ID you want to give the element.
 */
function changeElementID(elementID, newElementID) {
    let element = document.getElementById(elementID);
    if (element) element.setAttribute("id", newElementID);
}

/**
 * It changes the ID of the terrain and building parents to "terrainToRemove" and "buildingToRemove"
 * respectively.
 */
function setCurrentMapForRemoval() {
    changeElementID("terrainParent", "terrainToRemove")
    changeElementID("buildingParent", "buildingToRemove")
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



function debugLog(log) {
    if (debug == true) console.log(log);
}