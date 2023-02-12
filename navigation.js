'use strict';

const navigationFetchWorker = new Worker('fetchWorker.js');
const sceneElement = document.querySelector('a-scene');
const sphereHeightAboveGround = 4.6;
const highlightedPathHeight = 0.014;
const pathHighlightColour = "#FF00FF";
const modal = document.getElementById("myModal");
const span = document.getElementsByClassName("close")[0];
const destinationLatInputBox = document.getElementById("destinationLat");
const destinationLongInputBox = document.getElementById("destinationLong");
const buildingNameDataList = document.getElementById("buildingNames");
const buildingNameInput = document.getElementById("buildingInput");
var navigationInProgress = false;
var currentRectanglesInPaths = [];
var sourceLatLong = {lat: -1, long: -1};
var destinationLatLong;
var uniBuildings = new Map();
var startSphere = null;
var endSphere = null;

/**
 * The function starts navigation by finding the closest path node to the user's current location and
 * the destination, then it finds the shortest path between the two nodes using Dijkstra's algorithm,
 * and finally it highlights the path to the destination by changing the color of the rectangles that
 * make up the path.
 */
function navigate(pathPromise) {
    pathPromise = pathPromise.then(function () {
        navigationInProgress = true;
        destinationLatLong = { lat: destinationLatInputBox.value, long: destinationLongInputBox.value };
        console.log(destinationLatLong);
        if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
        sourceLatLong = usersCurrentLatLong;
        hideNavigationMenu();
        removeSpheres();
        uncolourRectangles();
        startSphere = addFloatingSphere(usersCurrentLatLong, "#00FF00");
        endSphere = addFloatingSphere(destinationLatLong, "#FF0000");
        let pathToDest = dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);
        console.log(pathToDest);

        for (let pathToDestIndex = 1; pathToDestIndex < pathToDest.length; pathToDestIndex++) {
            const node1 = pathToDest[pathToDestIndex - 1];
            const node2 = pathToDest[pathToDestIndex];
            let index = find2DIndex([node1, node2])
            try {
                let rectangle = rectangles[index[0]][Math.round(index[1] / 2)];
                currentRectanglesInPaths.push({rectangle, color: rectangle.getAttribute('material').color});
                rectangle.setAttribute("material", { color: pathHighlightColour })
                rectangle.object3D.position.set(rectangle.object3D.position.x, rectangle.object3D.position.y + highlightedPathHeight, rectangle.object3D.position.z);
            } catch (e) {
                console.log("Could not find rectangle to colour (Most likely on purpose)");
            }
        }
        return new Promise(function (resolve, reject) {});
    });
}

/**
 * If the navigation is in progress, start the navigation
 */
function carryOnNavigating(pathPromise) {
    if (!navigationInProgress) return;
    if (checkDestinationReached()) {
        stopNavigation();
        return;
    }
    navigate(pathPromise);
}

/**
 * It stops the navigation process by setting the navigationInProgress variable to false, setting the
 * destinationLatLong variable to null, removing the spheres, uncolouring the rectangles, and showing a
 * message to the user.
 */
function stopNavigation() {
    console.log("Destination reached!");
    navigationInProgress = false;
    destinationLatLong = null;
    removeSpheres();
    uncolourRectangles();
    showDestinationFoundMessage();
}

/**
 * It takes the user's current location and the destination location and calculates the distance
 * between them. If the distance is less than 8 meters, it returns true. Otherwise, it returns false
 * @returns A boolean value.
 */
function checkDestinationReached() {
    console.log("Distance: " + getDistance([usersCurrentLatLong.lat, usersCurrentLatLong.long], [destinationLatLong.lat, destinationLatLong.long]) + "m");
    return getDistance([usersCurrentLatLong.lat, usersCurrentLatLong.long], [destinationLatLong.lat, destinationLatLong.long]) < 25;
}

/**
 * It takes a path to a destination and returns the index of the path in the paths array
 * @param pathToDest - The path to the destination.
 * @returns The index of the path that contains the destination.
 */
function find2DIndex(pathToDest) {
    for (let i = 0; i < paths.length; i++) {
        for (let j = 0; j < paths[i].length - 1; j++) {
            if ((paths[i][j] === pathToDest[0] && paths[i][j + 1] === pathToDest[1]) ||
                (paths[i][j] === pathToDest[1] && paths[i][j + 1] === pathToDest[0])) {
                return [i,j];
            }
        }
    }
    return -1;
}

/**
 * It returns true if the coords object has a valid latitude and longitude, and false otherwise
 * @param coords - The coordinates to check.
 * @returns A boolean value.
 */
function areCoordsValid(coords) {
    return coords.lat !== "" && coords.long !== "" && coords.lat >= -90 && coords.lat <= 90 && coords.long >= -180 && coords.long <= 180;
}

/**
 * Places a floating sphere above the node closest to the given coordinates.
 * @param coords - The coordinates
 * @param colour - The colour of the sphere
 */
function addFloatingSphere(coords, colour) {
    const closestIndex = dijkstrasAlgorithm.findClosestPathNodeIndex([coords.lat, coords.long]);
    const pixelCoords = convertLatLongToPixelCoords({ lat: dijkstrasAlgorithm.getNodes()[closestIndex][1], long: dijkstrasAlgorithm.getNodes()[closestIndex][0] });
    let newSphere = document.createElement('a-sphere');
    newSphere.setAttribute("color", colour);
    newSphere.setAttribute("position", pixelCoords.x + " " + sphereHeightAboveGround + " " + pixelCoords.y);
    sceneElement.appendChild(newSphere);

    if (lowQuality) return;
    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
            newSphere.setAttribute("position", pixelCoords.x + " " + (heightMap[pixelCoords.roundedX][pixelCoords.roundedY] + sphereHeightAboveGround) + " " + pixelCoords.y);
        });
    });

    return newSphere;
}

/**
 * It removes the start and end spheres from the scene
 */
function removeSpheres() {
    if (startSphere) startSphere.remove();
    startSphere = null;
    if (endSphere) endSphere.remove();
    endSphere = null;
}

/**
 * It takes all the rectangles that are currently in the path, and sets their color back to what it was
 * before.
 */
function uncolourRectangles() {
    currentRectanglesInPaths.forEach(({rectangle, color}) => {
        rectangle.setAttribute("material", { color });
        rectangle.object3D.position.set(rectangle.object3D.position.x, rectangle.object3D.position.y - highlightedPathHeight, rectangle.object3D.position.z);
    });
    currentRectanglesInPaths = [];
}

/**
 * Shows the modal that tells the user that they have reached their destination.
 * Shows the modal for 3.5 seconds, then hides it.
 */
function showDestinationFoundMessage() {
    console.log("Showing destination found message");
    modal.style.display = "block";
    modal.style.animationName = "modalSlideUp";
    setTimeout(() => {
        console.log("Hiding destination found message");
        modal.style.animationName = "modalSlideDown";
        setTimeout(() => {modal.style.display = "none"}, 580);
    }, 3500);
}

/* Hiding the modal when the user clicks on the X button. */
span.onclick = function () {
    modal.style.display = "none";
}

/* An event listener that is called when the user changes the value of the input box. */
buildingNameInput.onchange = function () {
    const coords = uniBuildings.get(buildingNameInput.value);
    if (coords) {
        console.log("You selected a valid option: " + buildingNameInput.value);
        let latSum = 0;
        let longSum = 0;
        coords[0].forEach(coord => {
            latSum += coord[1];
            longSum += coord[0];
        });
        const count = coords[0].length;
        destinationLatInputBox.value = (latSum / count).toFixed(6);
        destinationLongInputBox.value = (longSum / count).toFixed(6);
    } else {
        console.log("You entered an invalid option: " + buildingNameInput.value);
        destinationLatInputBox.value = "";
        destinationLongInputBox.value = "";
    }
};

/**
 * Queries the overpass API for all the buildings in the
 * bounding box that contains the university, and adds the names of the
 * buildings to the data list for auto-complete.
 * @returns A promise.
 */
function fillSuggestions() {
    const stringBBox = "54.00216, -2.79478, 54.01638, -2.78173";
    const overpassQuery = overpassURL + encodeURIComponent(
        "(way[building](" + stringBBox + ");" +
        "rel[building](" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );
    const message = { overpassQuery };
    if ('caches' in window) message.osmCacheName = osmCacheName;
    navigationFetchWorker.postMessage(message);

    return new Promise(resolve => {
        navigationFetchWorker.onmessage = async function (e) {
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach(feature => {
                if (feature.geometry.type == "Polygon") addBuildingNameToDataList(feature);
            });
        }
    });
}

/**
 * Takes a feature, checks if it has a name, and if it does, add it to the
 * `uniBuildings` map and adds the name of the feature to the `datalist` element.
 * @param feature - the feature
 */
function addBuildingNameToDataList(feature) {
    if (!feature.properties.name) return;
    uniBuildings.set(feature.properties.name, feature.geometry.coordinates);
    const option = document.createElement("option");
    option.value = feature.properties.name;
    option.text = feature.properties.name;
    buildingNameDataList.appendChild(option);
}

/* Setting the onclick function of the start navigation button to the navigate function. */
document.getElementById("startNavigationBtn").onclick = function () {
    navigate(pathPromise)
    buildingNameInput.value = "";
}

/* Hiding the navigation menu when the user clicks on the "Hide Navigation Menu" button. */
document.getElementById("hideNavigationMenuBtn").onclick = function () {
    hideNavigationMenu();
    buildingNameInput.value = "";
}