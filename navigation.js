function startNavigation() {
    destinationLatLong = [document.getElementById("destinationLat").value, document.getElementById("destinationLong").value];
    if (!areCoordsValid({ lat: destinationLatLong[0], long: destinationLatLong[1] })) return;
    findClosestPathNode(destinationLatLong);
    console.log(destinationLatLong);
}


/**
 * It returns true if the coords object has a valid latitude and longitude, and false otherwise
 * @param coords - The coordinates to check.
 * @returns A boolean value.
 */
function areCoordsValid(coords) {
    return coords.lat !== "" && coords.long !== "" && coords.lat >= -90 && coords.lat <= 90 && coords.long >= -180 && coords.long <= 180;
}


function findClosestPathNode(coords) {
    target = [coords[1], coords[0]];    // Swap to make it long, lat
    const distances = pathNodes.map((coord) => getDistance(coord, target));     // TODO Will be an issue if this runs before paths are made
    const closestIndex = distances.indexOf(Math.min(...distances));
    console.log(distances[closestIndex]);
    console.log(closestIndex);
    console.log({ lat: pathNodes[closestIndex][1], long: pathNodes[closestIndex][0] });
    let pixelCoords = convertLatLongToPixelCoords({ lat: pathNodes[closestIndex][1], long: pathNodes[closestIndex][0] });
    console.log(pixelCoords);

    let sceneElement = document.querySelector('a-scene');
    let newSphere = document.createElement('a-sphere');
    newSphere.setAttribute("color", "#FF0000");
    newSphere.setAttribute("position", pixelCoords.x + " 0 " + pixelCoords.y);
    sceneElement.appendChild(newSphere);

    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
            newSphere.setAttribute("position", pixelCoords.x + " " + (heightMap[pixelCoords.roundedX][pixelCoords.roundedY])+" "+pixelCoords.y);
        });
    });
}


/**
 * If the node exists, return true, otherwise return false.
 * @param node - The node to check
 * @returns A boolean value
 */
function nodeExists(node) {
    return pathNodes.some(item => item.length === node.length && item.every((v, j) => v === node[j]));
}