'use strict';

const sphereHeightAboveGround = 4.6;
var navigationInProgress = false;

/**
 * The function starts navigation by finding the closest path node to the user's current location and
 * the destination, then it finds the shortest path between the two nodes using Dijkstra's algorithm,
 * and finally it highlights the path to the destination by changing the color of the rectangles that
 * make up the path.
 */
function startNavigation() {
    pathPromise.then(function () {
        navigationInProgress = true;
        let destinationLatLong = { lat: document.getElementById("destinationLat").value, long: document.getElementById("destinationLong").value };
        console.log(destinationLatLong);
        if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
        hideNavigationMenu();
        removeSpheres();
        findClosestPathNode(usersCurrentLatLong, "#00FF00");
        findClosestPathNode(destinationLatLong, "#FF0000");
        let pathToDest = dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);
        console.log(pathToDest);

        for (let pathToDestIndex = 1; pathToDestIndex < pathToDest.length; pathToDestIndex++) {
            const node1 = pathToDest[pathToDestIndex - 1];
            const node2 = pathToDest[pathToDestIndex];
            let index = find2DIndex([node1, node2])
            try {
                rectangles[index[0]][Math.round(index[1] / 2)].setAttribute("material", { roughness: "0.6", color: "#FF00FF" });
            } catch (e) {
                console.log("Could not find rectangle to colour (Most likely on purpose)");
            }
        }
    });
}

/**
 * If the navigation is in progress, start the navigation
 */
function carryOnNavigating() {
    if (navigationInProgress) startNavigation();
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
 * It takes a latitude and longitude and finds the closest node in the path network to that point
 * @param coords - The coordinates of the point you want to find the closest path node to.
 * @param colour - The colour of the sphere
 * @returns The closest node to the given coords.
 */
function findClosestPathNode(coords, colour) {
    let target = [coords.long, coords.lat];         // Swap to make it long, lat as thats the way the nodes come from OSM
    const closestIndex = dijkstrasAlgorithm.findClosestPathNodeIndex([coords.lat, coords.long]);
    console.log(closestIndex);
    console.log(dijkstrasAlgorithm.getNodes()[closestIndex]);

    const pixelCoords = convertLatLongToPixelCoords({ lat: dijkstrasAlgorithm.getNodes()[closestIndex][1], long: dijkstrasAlgorithm.getNodes()[closestIndex][0] });
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


