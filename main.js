var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]
var usersPixelCoords = { x: -1, y: -1 };           // Impossible coordinates
var startShowingMap = false;
var watchID = -1;

const overpassURL = "https://overpass-api.de/api/interpreter?data=";
const uniCoordinate = { lat: 54.01028, long: -2.78536 }   // Centre of uni
const buildingScale = 4.3;                                // Scaling the buildings (bigger number = bigger buildings in the x and z).
const buildingHeightScale = 2.2;                          // Scale for the buildings height (bigger number = bigger buildings in y axis).
const coordsScale = 1 / (twfData[0] + buildingScale - 1); // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building.
const buildingHeightOffset = 200;                         // How far to extend the buildings under the ground
const bboxSize = 600;                                     // Length of one side of bounding box in metres
const distanceNeededToMove = (bboxSize/2)*0.7;            // Used to check if the user has moved far enough.
const locationOptions = {
    enableHighAccuracy: true,
    maximumAge: 600,    // Will only update every 600ms
    timeout: 5000       // 5 second timeout until it errors if it can't get their location
};

const debug = true;


/**
 * Hides the welcome screen and shows the map
 */
function showMap() {
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    //navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
    startShowingMap = true;
    if (watchID == -1) watchID = navigator.geolocation.watchPosition(locationSuccess, locationError, locationOptions);
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
    startShowingMap = false;

    navigator.storage.estimate().then((estimate) => {
        document.getElementById("percent").value =
            (estimate.usage / estimate.quota * 100).toFixed(2);
    });
}

navigator.storage.estimate().then((estimate) => {
    document.getElementById("percent").value =
        (estimate.usage / estimate.quota * 100).toFixed(2);
});

async function locationSuccess(position) {
    console.log("\n\n===== NEW LOCATION ======");
    let newLatLong = {lat: position.coords.latitude, long: position.coords.longitude};

    if (startShowingMap == false) return;
    let newPixelCoords = convertLatLongToPixelCoords(newLatLong);
    if (newPixelCoords.x < 0 || newPixelCoords.x > 5000 || newPixelCoords.y < 0 || newPixelCoords.y > 5000) throw "Invalid Coordinates"
    if (!movedFarEnough(newPixelCoords)) {console.log("Not moved far enough..."); return;}

    await loadMap(newLatLong, newPixelCoords, bboxSize);
    placeCameraAtPixelCoords(newPixelCoords);
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



function movedFarEnough({x: newX, y: newY}) {
    // Guard check. If -1, this is first time user has moved.
    if (usersPixelCoords.x == -1 && usersPixelCoords.y == -1) {
        console.log("First time moving");
        usersPixelCoords = {x: newX, y: newY};
        return true;
    }

    // Storing how many metres the user has moved in the x and y directions.
    let xDistance = usersPixelCoords.x - newX;
    xDistance = Math.abs(xDistance)*2;
    let yDistance = usersPixelCoords.y - newY;
    yDistance = Math.abs(yDistance)*2;
    console.log(xDistance);
    console.log(yDistance);

    // The user has to have moved 'distanceNeededToMove' metres.
    if (xDistance > distanceNeededToMove || yDistance > distanceNeededToMove) {
        usersPixelCoords = {x: newX, y: newY};
        return true;
    }
    return false;
}

function validateCoords({ lat: lat, long: long }) {
    return lat == 91 && long == 181 ? true : lat >= -90 && lat <= 90 && long >= -180 && long <= 180 ? true : false;
}


function placeCameraAtGPSLocation({ lat: lat, long: long }) {
    console.log("=== Placing Camera ===");
    //console.log(lat);
    //console.log(long);
    if (isPlayerCameraActive()) {
        camera = document.getElementById("rig");
        var utm = convertLatLongToUTM(lat, long);
        var pixelCoords = convertUTMToPixelCoords(utm.x, utm.y);
        console.log({ lat: lat, long: long });
        console.log(utm);
        console.log(pixelCoords);
        camera.setAttribute("position", pixelCoords.x + " " + (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)] + 1.6) + " " + pixelCoords.y);
    }
}

function placeCameraAtPixelCoords(pixelCoords) {
    console.log("=== Placing Camera ===");
    //console.log(lat);
    //console.log(long);
    if (isPlayerCameraActive()) {
        camera = document.getElementById("rig");
        camera.setAttribute("position", pixelCoords.x + " " + (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)] + 1.6) + " " + pixelCoords.y);
    }
}


async function loadMap(coordinate, pixelCoords, bboxSize) {
    console.log("=== Loading Map ===");
    await getHeightMap(pixelCoords, bboxSize);
    setCurrentMapForRemoval();
    removeCurrentMap();
    loadTerrain();
    loadBuildings(coordinate.lat, coordinate.long, bboxSize);
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

function changeElementID(elementID, newElementID) {
    let element = document.getElementById(elementID);
    if (element) element.setAttribute("id", newElementID);
}

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