function startNavigation() {
    destinationLatLong = { lat: document.getElementById("destinationLat").value, long: document.getElementById("destinationLong").value };
    if (!areCoordsValid(destinationLatLong) || !areCoordsValid(usersCurrentLatLong)) return;
    findClosestPathNode(usersCurrentLatLong, "#00FF00");
    findClosestPathNode(destinationLatLong, "#FF0000");
    console.log(usersCurrentLatLong);
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


function findClosestPathNode(coords, colour) {
    target = [coords.long, coords.lat];         // Swap to make it long, lat as thats the way the nodes come from OSM
    const distances = nodes.map((coord) => getDistance(coord, target));     // TODO Will be an issue if this runs before paths are made
    const closestIndex = distances.indexOf(Math.min(...distances));
    const pixelCoords = convertLatLongToPixelCoords({ lat: nodes[closestIndex][1], long: nodes[closestIndex][0] });
    const sceneElement = document.querySelector('a-scene');
    let newSphere = document.createElement('a-sphere');
    newSphere.setAttribute("color", colour);
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
    return nodes.some(item => item.length === node.length && item.every((v, j) => v === node[j]));
}