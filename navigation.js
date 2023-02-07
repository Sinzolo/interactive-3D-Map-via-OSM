'use strict';

const sceneElement = document.querySelector('a-scene');
const sphereHeightAboveGround = 4.6;
const modal = document.getElementById("myModal");
const span = document.getElementsByClassName("close")[0];
var navigationInProgress = false;
var currentRectanglesInPaths = [];
var sourceLatLong = {lat: -1, long: -1};
var destinationLatLong;

/**
 * The function starts navigation by finding the closest path node to the user's current location and
 * the destination, then it finds the shortest path between the two nodes using Dijkstra's algorithm,
 * and finally it highlights the path to the destination by changing the color of the rectangles that
 * make up the path.
 */
function navigate(pathPromise) {
    console.log("Before", pathPromise);
    pathPromise = pathPromise.then(function () {
        navigationInProgress = true;
        destinationLatLong = { lat: document.getElementById("destinationLat").value, long: document.getElementById("destinationLong").value };
        console.log(destinationLatLong);
        if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
        sourceLatLong = usersCurrentLatLong;
        hideNavigationMenu();
        removeSpheres();
        uncolourRectangles();
        addFloatingSphere(usersCurrentLatLong, "#00FF00");
        addFloatingSphere(destinationLatLong, "#FF0000");
        let pathToDest = dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);
        console.log(pathToDest);

        for (let pathToDestIndex = 1; pathToDestIndex < pathToDest.length; pathToDestIndex++) {
            const node1 = pathToDest[pathToDestIndex - 1];
            const node2 = pathToDest[pathToDestIndex];
            let index = find2DIndex([node1, node2])
            try {
                let rectangle = rectangles[index[0]][Math.round(index[1] / 2)];
                currentRectanglesInPaths.push({rectangle, color: rectangle.getAttribute('material').color});
                currentRectanglesInPaths[currentRectanglesInPaths.length - 1].rectangle.setAttribute("material", { color: "#FF00FF" })
                // TODO - Slightly raise the chosen rectangles to ensure they show up and do not z-fight with the other paths on the map
                // console.log(currentRectanglesInPaths[currentRectanglesInPaths.length - 1].rectangle);
                // let pos = currentRectanglesInPaths[currentRectanglesInPaths.length - 1].rectangle.getAttribute("position");
                // console.log(pos);
            } catch (e) {
                // console.log(e);
                console.log("Could not find rectangle to colour (Most likely on purpose)");
            }
        }
        return new Promise(function (resolve, reject) {});
    });
    console.log("After", pathPromise);
}

/**
 * If the navigation is in progress, start the navigation
 */
function carryOnNavigating(pathPromise) {
    if (!navigationInProgress) return;
    console.log("Peen");
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
}


/**
 * It removes all the spheres from the scene
 */
function removeSpheres() {
    document.querySelectorAll('a-sphere').forEach(element => {
        element.remove();
    });
}

/**
 * It takes all the rectangles that are currently in the path, and sets their color back to what it was
 * before.
 */
function uncolourRectangles() {
    currentRectanglesInPaths.forEach(({rectangle, color}) => {
        rectangle.setAttribute("material", { color });
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
        setTimeout(() => {modal.style.display = "none"}, 600);
    }, 3500);
}

/* Hiding the modal when the user clicks on the X button. */
span.onclick = function () {
    modal.style.display = "none";
}