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
        let pathToDest = dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);
        console.log(pathToDest);
        // paths.forEach(path => {
        //     for(let i = 1; i < path.length+1; i+=2) {
        //         console.log(path[i-1]);
        //         console.log(path[i]);

        //     }
        // });
        let rectanglesToColour = [];
        for (let i = 1; i < pathToDest.length + 1; i++) {
            paths.forEach((path, pathsIndex) => {
                for (let j = 1; j < path.length + 1; j += 2) {
                    if (path[j - 1] == pathToDest[i - 1] && path[j] == pathToDest[i]) rectanglesToColour.push([pathsIndex, j-1]);
                };
            });
        }
        console.log(rectanglesToColour);
        rectanglesToColour.forEach((rectangleIndex, index) => {
            rectangles[rectangleIndex[0]][rectangleIndex[1]/2].setAttribute("material", { roughness: "0.6", color: "#FF00FF" });
            console.log(index);
        });
    });
}

function carryOnNavigating() {
    if (navigationInProgress) startNavigation();
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
    const distances = dijkstrasAlgorithm.getNodes().map((node) => getDistance(node, target));     // TODO Will be an issue if this runs before paths are made
    const closestIndex = distances.indexOf(Math.min(...distances));

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


