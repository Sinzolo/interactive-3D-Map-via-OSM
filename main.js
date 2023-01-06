var overpassURL = "https://overpass-api.de/api/interpreter?data=";
var uniCoords = {lat: 54.01028, long: -2.78536}     // Centre of uni
//var uniCoords = {lat: 54.013115, long: -2.785182} // Slightly off centre of uni
var twfData = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]
var buildingScale = 4.3;  // Scaling the buildings (bigger number = bigger buildings in the x and z).
var buildingHeightScale = 2.2;  // Scale for the buildings height (bigger number = bigger buildings in y axis).
var coordsScale = 1/(twfData[0]+buildingScale-1);  // The coordinates of the buildings need to be offset depending on the scale of the geotiff image and the scale of the building.
var heightOffset = 200; // How far to extend the buildings under the ground
var bboxSize = 600;     // Length of one side of bounding box in metres

async function showMap() {
    /*
        Hides the welcome screen and shows the map
    */
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";
    //loadMap(uniCoords.lat, uniCoords.long);

    setUpLocationWatcher();
}

function setUpLocationWatcher() {
    return navigator.geolocation.watchPosition(async (position) => {
        console.log("New location = ", {lat: position.coords.latitude, long: position.coords.longitude});
        await loadMap(position.coords.latitude, position.coords.longitude);
        placeCameraAtGPSLocation(position.coords.latitude, position.coords.longitude);
    }, function(error) {
        switch(error.code){
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
    }, {
        enableHighAccuracy: true,
        maximumAge: 1000,    // Will only update every 600ms
        timeout: 10000      // 10 second timeout until it errors if it can't get their location
    });
}

function placeCameraAtGPSLocation(latitude, longitude) {
    if (isPlayerCameraActive()) {
        camera = document.querySelector('#rig');
        var utm = convertLatLongToUTM(latitude, longitude);
        var pixelCoords = convertUTMToPixelCoords(utm.x, utm.y);
        camera.setAttribute("position", pixelCoords.x +" "+ (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]+1.6) +" "+ pixelCoords.y);
    }
}

async function loadMap(latitude, longitude) {
    await getHeightMap(latitude, longitude, bboxSize);
    deleteCurrentTerrain();
    loadTerrain();
    deleteCurrentBuildings();
    loadBuildings(latitude, longitude, bboxSize);
}


function showMenu() {
    /*
        Hides the map and shows the welcome screen
    */
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "none";
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "block";
}


/**
 * Return true if the player's camera is active, otherwise return false.
 * 
 * @returns The active state of the players camera.
 */
function isPlayerCameraActive() {
    var playerCamera = document.querySelector('#playerCamera');
    return playerCamera.getAttribute('camera').active;
}


/**
 * It deletes the terrain from the scene
 */
function deleteCurrentTerrain() {
    var terrainParent = document.querySelector('#terrainParent');
    var terrainChildren = terrainParent.querySelectorAll('*');
    terrainChildren.forEach(terrainChild => {
        terrainParent.removeChild(terrainChild);
    });
}


/**
 * It deletes all the buildings from the scene
 */
function deleteCurrentBuildings() {
    var buildingParent = document.querySelector('#buildingParent');
    var buildingChildren = buildingParent.querySelectorAll('*');
    buildingChildren.forEach(buildingChild => {
        buildingParent.removeChild(buildingChild);
    });
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
            if (keys.KeySpaceBar)  { console.log("Space"); this.dVelocity.y += 1; }
            if (keys.KeyShift) { console.log("Shift"); this.dVelocity.y -= 1; }
        }

    return this.dVelocity.clone();
    },
});





/* Listening for the keydown event and if the key pressed is the c key,
then it will switch the active camera. */
document.addEventListener("keydown", function(event) {
    if (event.code === "KeyC") {
        var playerCamera = document.querySelector('#playerCamera');
        if (playerCamera.getAttribute('camera').active == true) {
            var debugCamera = document.querySelector('#debugCamera');
            debugCamera.setAttribute('camera', 'active', true);
            console.log("Debug camera now active");
        }
        else {
            playerCamera.setAttribute('camera', 'active', true)
            console.log("Player camera now active");
        }
    }
});