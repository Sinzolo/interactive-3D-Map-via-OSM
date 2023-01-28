class DijkstrasAlgo {
    constructor(nodes = [], connectedNodes = []) {
        this.nodes = nodes;
        this.connectedNodes = connectedNodes;
    }

    printNodes() {
        console.log("Nodes: ", this.nodes);
    }

    printConnectedNodes() {
        console.log("Connected Nodes: ", this.connectedNodes);
    }

    printEverything() {
        this.printNodes();
        this.printConnectedNodes();
    }

    getNodes() {
        return this.nodes;
    }

    getConnectedNodes() {
        return this.connectedNodes;
    }

    setNodes(nodes) {
        this.nodes = nodes;
    }

    setConnectedNodes(connectedNodes) {
        this.connectedNodes = connectedNodes;
    }

    addToNodes(node) {
        if (this.nodeExists(node)) {
            paths[numberOfPaths].push(this.getNodesIndex(node));
        }
        else {
            this.nodes.push({ coords: node, unseen: true });
            paths[numberOfPaths].push(this.nodes.length - 1);
            this.connectedNodes[this.nodes.length - 1] = []
        }
    }

    addPair(node1, node2) {
        this.addToNodes(node1);
        this.addToNodes(node2);
        let distance = getDistance([node1[1], node1[0]], [node2[1], node2[0]]);
        let node1Index = this.getNodesIndex(node1);
        let node2Index = this.getNodesIndex(node2);
        this.connectedNodes[node1Index].push({ index: node2Index, distance });
        this.connectedNodes[node2Index].push({ index: node1Index, distance });
    }

    getNodesIndex(node) {
        return this.nodes.findIndex(elem => JSON.stringify(elem.coords) === JSON.stringify(node));
    }

    findClosestPathNodeIndex(coords) {
        const distances = this.getNodes().map((node) => getDistance(node.coords, coords));     // TODO Will be an issue if this runs before paths are made
        return distances.indexOf(Math.min(...distances));
    }

    findShortestPathBetween(sourceCoords, destinationCoords) {
        sourceCoords = [sourceCoords.long, sourceCoords.lat];
        destinationCoords = [destinationCoords.long, destinationCoords.lat];
        let sourceNodeIndex = this.findClosestPathNodeIndex(sourceCoords);
        let destinationNodeIndex = this.findClosestPathNodeIndex(destinationCoords);
        console.log("Source:");
        console.log(sourceNodeIndex);
        console.log(this.connectedNodes[sourceNodeIndex]);
        console.log("Destination:");
        console.log(destinationNodeIndex);
        console.log(this.connectedNodes[destinationNodeIndex]);

        let shortestDistances = new Array(this.nodes.length);
        shortestDistances.fill(Infinity);
        shortestDistances[sourceNodeIndex] = 0;

        let currentNode = sourceNodeIndex;
        this.setNodeToSeen(sourceNodeIndex);
        while (currentNode != destinationNodeIndex) {
            let closest = this.connectedNodes[currentNode][0];
            this.connectedNodes[currentNode].forEach(element => {
                this.setNodeToSeen(element.index);
                if (element.distance < shortestDistances[element.index]) {
                    shortestDistances[element.index] = element.distance;
                }
                if (element.distance < closest.distance) {
                    closest = element;
                }
            });
            console.log(closest);
            currentNode = closest;
            break;
        }
        console.log(shortestDistances);
    }

    setNodeToSeen(nodeIndex) {
        this.nodes[nodeIndex].unseen = false;
    }

    /**
     * If the node exists, return true, otherwise return false.
     * @param nodeToCheck - The node to check
     * @returns A boolean value
     */
    nodeExists(nodeToCheck) {
        return this.nodes.some(node => node.coords.length === nodeToCheck.length && node.coords.every((v, j) => v === nodeToCheck[j]));
    }
}