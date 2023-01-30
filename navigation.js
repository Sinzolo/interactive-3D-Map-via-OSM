'use strict';

const sphereHeightAboveGround = 4.6;
var navigationInProgress = false;

function startNavigation() {
    pathPromise.then(function () {
        navigationInProgress = true;
        let destinationLatLong = { lat: document.getElementById("destinationLat").value, long: document.getElementById("destinationLong").value };
        if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
        hideNavigationMenu();
        removeSpheres();
        findClosestPathNode(usersCurrentLatLong, "#00FF00");
        findClosestPathNode(destinationLatLong, "#FF0000");
        let pathToDest = dijkstrasAlgorithm.findShortestPathBetween(usersCurrentLatLong, destinationLatLong);

        let rectanglesToColour = [];
        for (let pathToDestIndex = 0; pathToDestIndex < pathToDest.length - 1; pathToDestIndex++) {
            console.log("Next two path to dest indices");
            console.log(pathToDest[pathToDestIndex]);
            console.log(pathToDest[pathToDestIndex+1]);
            for (let pathsOuterIndex = 0; pathsOuterIndex < paths.length; pathsOuterIndex++) {
                for (let pathsInnerIndex = 0; pathsInnerIndex < paths[pathsOuterIndex].length-1; pathsInnerIndex+=2) {
                    if (pathToDest[pathToDestIndex] == paths[pathsOuterIndex][pathsInnerIndex] && pathToDest[pathToDestIndex + 1] == paths[pathsOuterIndex][pathsInnerIndex + 1]) {
                        console.log("Found!");
                        console.log([pathsOuterIndex, pathsInnerIndex]);
                        console.log([pathsOuterIndex, pathsInnerIndex + 1]);
                        rectanglesToColour.push([pathsOuterIndex, pathsInnerIndex]);
                        break;
                    }
                    else if (pathToDest[pathToDestIndex + 1] == paths[pathsOuterIndex][pathsInnerIndex] && pathToDest[pathToDestIndex] == paths[pathsOuterIndex][pathsInnerIndex + 1]) {
                        console.log("Found!");
                        console.log([pathsOuterIndex, pathsInnerIndex]);
                        console.log([pathsOuterIndex, pathsInnerIndex + 1]);
                        rectanglesToColour.push([pathsOuterIndex, pathsInnerIndex]);
                        break;
                    }
                }
            }
        }
        // paths.forEach((path, pathsIndex) => {
        //     for (let j = 0; j < path.length-1; j += 2) {
        //         if (path[j] == pathToDest[i] && path[j-1] == pathToDest[i-1]) {
        //             console.log("Found rectangle");
        //             console.log([pathsIndex, j - 1]);

        //             rectanglesToColour.push([pathsIndex, j-1]);
        //         }
        //     };
        // });
        console.log(rectanglesToColour);
        rectanglesToColour.forEach((rectangleIndex, index) => {
            try {
            rectangles[rectangleIndex[0]][rectangleIndex[1]/2].setAttribute("material", { roughness: "0.6", color: "#FF00FF" });
            } catch (e) {
                console.log("Error");
                console.log(rectangleIndex);
                console.log(index);
            }
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
    let target = [coords.long, coords.lat];         // Swap to make it long, lat as thats the way the nodes come from OSM
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


