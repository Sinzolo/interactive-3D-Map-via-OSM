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
        var nodeIndex = this.getNodesIndex(node);
        if (nodeIndex === -1) {
            nodeIndex = this.nodes.length;
            this.nodes.push(node);
            this.connectedNodes[nodeIndex] = [];
        }
        paths[numberOfPaths].push(nodeIndex)
        return nodeIndex;
    }

    addPair(node1, node2) {
        let node1Index = this.addToNodes(node1);
        let node2Index = this.addToNodes(node2);
        let distance = getDistance([node1[1], node1[0]], [node2[1], node2[0]]);
        this.connectedNodes[node1Index].push({ index: node2Index, distance });
        this.connectedNodes[node2Index].push({ index: node1Index, distance });
        // TODO - Only need to store one connection as its a waste of time and storage to do both
    }

    /**
     * It returns the index of the node in the nodes array
     * @param nodeToFind - The node to look for
     * @returns The index of the node in the nodes array
    */
    getNodesIndex(nodeToFind) {
        return this.nodes.findIndex(node => node[0] === nodeToFind[0] && node[1] === nodeToFind[1]);
    }

    /**
     * It finds the closest node to the given coordinates
     * @param coords - The coordinates of the point you want to find the closest path node to
     * @returns The index of the closest node to the given coordinates
     */
    findClosestPathNodeIndex(coords) {
        const distances = this.nodes.map((node) => getDistance([node[1],node[0]], coords));
        return distances.indexOf(Math.min(...distances));
    }

    findShortestPathBetween(sourceCoords, destinationCoords) {
        sourceCoords = [sourceCoords.lat, sourceCoords.long];
        destinationCoords = [destinationCoords.lat, destinationCoords.long];
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
}