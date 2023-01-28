const sphereHeightAboveGround = 4.6;
var navigationInProgress = false;

function startNavigation() {
    pathPromise.then(function () {
        navigationInProgress = true;
        destinationLatLong = { lat: document.getElementById("destinationLat").value, long: document.getElementById("destinationLong").value };
        if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
        hideNavigationMenu();
        removeSpheres();
        findClosestPathNode(usersCurrentLatLong, "#00FF00");
        findClosestPathNode(destinationLatLong, "#FF0000");
        console.log(usersCurrentLatLong);
        console.log(destinationLatLong);
        dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);
    });
}


/**
 * It returns true if the coords object has a valid latitude and longitude, and false otherwise
 * @param coords - The coordinates to check.
 * @returns A boolean value.
 */
function areCoordsValid(coords) {
    return coords.lat !== "" && coords.long !== "" && coords.lat >= -90 && coords.lat <= 90 && coords.long >= -180 && coords.long <= 180;
}


function findClosestPathNode(coords, colour) {
    target = [coords.long, coords.lat];         // Swap to make it long, lat as thats the way the nodes come from OSM
    const distances = dijkstrasAlgorithm.getNodes().map((node) => getDistance(node.coords, target));     // TODO Will be an issue if this runs before paths are made
    const closestIndex = distances.indexOf(Math.min(...distances));

    const pixelCoords = convertLatLongToPixelCoords({ lat: dijkstrasAlgorithm.getNodes()[closestIndex].coords[1], long: dijkstrasAlgorithm.getNodes()[closestIndex].coords[0] });
    const sceneElement = document.querySelector('a-scene');
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


