'use strict';

const nodeStatus = {
    unseen: 'unseen',
    infringe: 'infringe',
    intree: 'intree',
};

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
            this.nodes.push(node);
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

    getNodesIndex(nodeToFind) {
        return this.nodes.findIndex(node => JSON.stringify(node) === JSON.stringify(nodeToFind));
    }

    findClosestPathNodeIndex(coords) {
        const distances = this.getNodes().map((node) => getDistance(node, coords));
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

        let shortestDistances = new Array(this.connectedNodes.length);
        shortestDistances.fill(Infinity);
        shortestDistances[sourceNodeIndex] = 0;

        let previous = new Array(this.connectedNodes.length);
        previous.fill(null);

        let status = new Array(this.connectedNodes.length);
        status.fill(nodeStatus.unseen);
        status[sourceNodeIndex] = nodeStatus.intree;

        this.connectedNodes[sourceNodeIndex].forEach(adjacentNode => {
            if (previous[adjacentNode.index] == sourceNodeIndex) return;
            status[adjacentNode.index] = nodeStatus.infringe;
            if (adjacentNode.distance < shortestDistances[adjacentNode.index]) {
                shortestDistances[adjacentNode.index] = adjacentNode.distance;
                previous[adjacentNode.index] = sourceNodeIndex;
            }
        });

        while (status.some((status) => status == nodeStatus.infringe)) {
            let currentNode;
            let currentShortestDist = Infinity;
            status.forEach((node, index) => {
                if (node != nodeStatus.infringe) return;
                if (shortestDistances[index] < currentShortestDist) {
                    currentShortestDist = shortestDistances[index];
                    currentNode = index;
                }
            });
            status[currentNode] = nodeStatus.intree;
            // if (currentNode == destinationNodeIndex) break;

            this.connectedNodes[currentNode].forEach(adjacentNode => {
                if (status[adjacentNode.index] == nodeStatus.intree) return;
                status[adjacentNode.index] = nodeStatus.infringe;
                if (adjacentNode.distance < shortestDistances[adjacentNode.index]) {
                    shortestDistances[adjacentNode.index] = adjacentNode.distance + shortestDistances[currentNode];
                    previous[adjacentNode.index] = currentNode;
                }
            });
        }
        let currentNode = destinationNodeIndex;
        let path = [];
        while (previous[currentNode] != null) {
            path.push(currentNode)
            currentNode = previous[currentNode]
        }
        path.push(sourceNodeIndex);

        return path.reverse();
    }

    /**
     * If the node exists, return true, otherwise return false.
     * @param nodeToCheck - The node to check
     * @returns A boolean value
     */
    nodeExists(nodeToCheck) {
        return this.nodes.some(node => node.length === nodeToCheck.length && node.every((v, j) => v === nodeToCheck[j]));
    }
}