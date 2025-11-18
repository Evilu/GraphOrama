import { Injectable, OnModuleInit } from '@nestjs/common';
import { GraphData, ServiceNode, Edge } from './interfaces/graph.interfaces';
import { FilterOptions, GraphResponse, Route } from './interfaces/filter.interfaces';

@Injectable()
export class GraphService implements OnModuleInit {
    // Core data structures for O(1) lookups
    private nodes: Map<string, ServiceNode> = new Map();
    private adjacencyList: Map<string, Set<string>> = new Map();
    private reverseAdjacencyList: Map<string, Set<string>> = new Map();

    // Indexed collections for O(1) filtering
    private publicNodes: Set<string> = new Set();
    private sinkNodes: Set<string> = new Set();
    private vulnerableNodes: Set<string> = new Set();
    private nodesByKind: Map<string, Set<string>> = new Map();

    // Pre-computed paths for O(1) access
    private publicPaths: Map<string, Route[]> = new Map();
    private sinkPaths: Map<string, Route[]> = new Map();
    private vulnerablePaths: Map<string, Route[]> = new Map();

    // Graph data storage
    private graphData: GraphData | null = null;

    onModuleInit() {
        this.initializeEmptyGraph();
    }

    /**
     * Initialize empty graph structures
     */
    private initializeEmptyGraph(): void {
        this.nodes.clear();
        this.adjacencyList.clear();
        this.reverseAdjacencyList.clear();
        this.publicNodes.clear();
        this.sinkNodes.clear();
        this.vulnerableNodes.clear();
        this.nodesByKind.clear();
        this.publicPaths.clear();
        this.sinkPaths.clear();
        this.vulnerablePaths.clear();
    }

    /**
     * Load and process graph data asynchronously
     * Uses async iterators to prevent blocking
     */
    public async loadGraph(data: GraphData): Promise<void> {
        this.initializeEmptyGraph();
        this.graphData = data;

        // Process in chunks to avoid blocking
        await this.preprocessGraphAsync(data);
        await this.precomputePathsAsync();
    }

    /**
     * Preprocess graph data using async iteration
     */
    private async preprocessGraphAsync(data: GraphData): Promise<void> {
        // Process nodes in batches
        const nodeChunks = this.chunkArray(data.nodes, 100);

        for (const chunk of nodeChunks) {
            await this.processNodeChunk(chunk);
            // Yield to event loop
            await this.yieldToEventLoop();
        }

        // Process edges in batches
        const edgeChunks = this.chunkArray(data.edges, 100);

        for (const chunk of edgeChunks) {
            await this.processEdgeChunk(chunk);
            // Yield to event loop
            await this.yieldToEventLoop();
        }
    }

    /**
     * Process a chunk of nodes
     */
    private async processNodeChunk(nodes: ServiceNode[]): Promise<void> {
        nodes.forEach(node => {
            this.nodes.set(node.name, node);
            this.adjacencyList.set(node.name, new Set());
            this.reverseAdjacencyList.set(node.name, new Set());

            // Index by kind
            if (!this.nodesByKind.has(node.kind)) {
                this.nodesByKind.set(node.kind, new Set());
            }
            this.nodesByKind.get(node.kind)!.add(node.name);

            // Index special nodes
            if (node.publicExposed) {
                this.publicNodes.add(node.name);
            }

            if (this.isSinkNode(node)) {
                this.sinkNodes.add(node.name);
            }

            if (node.vulnerabilities?.length > 0) {
                this.vulnerableNodes.add(node.name);
            }
        });
    }

    /**
     * Process a chunk of edges
     */
    private async processEdgeChunk(edges: Edge[]): Promise<void> {
        edges.forEach(edge => {
            const destinations = Array.isArray(edge.to) ? edge.to : [edge.to];

            destinations.forEach(destination => {
                this.adjacencyList.get(edge.from)?.add(destination);

                if (!this.reverseAdjacencyList.has(destination)) {
                    this.reverseAdjacencyList.set(destination, new Set());
                }
                this.reverseAdjacencyList.get(destination)!.add(edge.from);
            });
        });
    }

    /**
     * Precompute all paths using generators for memory efficiency
     */
    private async precomputePathsAsync(): Promise<void> {
        // Compute paths from public nodes
        for (const publicNode of this.publicNodes) {
            const paths = await this.computePathsFromNodeAsync(publicNode, 'forward');
            this.publicPaths.set(publicNode, paths);
            await this.yieldToEventLoop();
        }

        // Compute paths to sink nodes
        for (const sinkNode of this.sinkNodes) {
            const paths = await this.computePathsFromNodeAsync(sinkNode, 'backward');
            this.sinkPaths.set(sinkNode, paths);
            await this.yieldToEventLoop();
        }

        // Compute paths through vulnerable nodes
        for (const vulnerableNode of this.vulnerableNodes) {
            const paths = await this.computeVulnerablePathsAsync(vulnerableNode);
            this.vulnerablePaths.set(vulnerableNode, paths);
            await this.yieldToEventLoop();
        }
    }

    /**
     * Compute paths using recursive async function instead of while loop
     */
    private async computePathsFromNodeAsync(
        startNode: string,
        direction: 'forward' | 'backward',
        maxDepth: number = 10
    ): Promise<Route[]> {
        const routes: Route[] = [];
        const visited = new Set<string>();

        await this.explorePathsRecursive(
            startNode,
            [startNode],
            visited,
            routes,
            direction,
            0,
            maxDepth
        );

        return routes;
    }

    /**
     * Recursive path exploration without loops
     */
    private async explorePathsRecursive(
        currentNode: string,
        currentPath: string[],
        visited: Set<string>,
        routes: Route[],
        direction: 'forward' | 'backward',
        depth: number,
        maxDepth: number
    ): Promise<void> {
        if (depth >= maxDepth) return;

        visited.add(currentNode);

        const neighbors = direction === 'forward'
            ? this.adjacencyList.get(currentNode) || new Set()
            : this.reverseAdjacencyList.get(currentNode) || new Set();

        const neighborArray = Array.from(neighbors);

        // Process neighbors in chunks to avoid blocking
        const chunks = this.chunkArray(neighborArray, 10);

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (neighbor) => {
                if (!visited.has(neighbor)) {
                    const newPath = direction === 'forward'
                        ? [...currentPath, neighbor]
                        : [neighbor, ...currentPath];

                    routes.push(this.createRoute(newPath));

                    // Recursive call
                    await this.explorePathsRecursive(
                        neighbor,
                        newPath,
                        new Set(visited), // Create new set for each branch
                        routes,
                        direction,
                        depth + 1,
                        maxDepth
                    );
                }
            }));

            // Yield to event loop between chunks
            await this.yieldToEventLoop();
        }
    }

    /**
     * Compute paths through vulnerable nodes
     */
    private async computeVulnerablePathsAsync(vulnerableNode: string): Promise<Route[]> {
        const routes: Route[] = [];

        // Get all incoming paths to vulnerable node
        const incomingPaths = await this.computePathsFromNodeAsync(vulnerableNode, 'backward', 5);

        // Get all outgoing paths from vulnerable node
        const outgoingPaths = await this.computePathsFromNodeAsync(vulnerableNode, 'forward', 5);

        // Combine paths that go through the vulnerable node
        incomingPaths.forEach(inPath => {
            outgoingPaths.forEach(outPath => {
                if (outPath.path.length > 1) {
                    const combinedPath = [...inPath.path.slice(0, -1), ...outPath.path];
                    routes.push(this.createRoute(combinedPath));
                }
            });
        });

        return routes;
    }

    /**
     * Get filtered graph - O(1) lookup from precomputed paths
     */
    public async getFilteredGraph(filters: FilterOptions): Promise<GraphResponse> {
        const filteredRoutes = new Set<Route>();

        // O(1) lookups from precomputed maps
        if (filters.startsWithPublic) {
            this.publicPaths.forEach(routes => {
                routes.forEach(route => filteredRoutes.add(route));
            });
        }

        if (filters.endsInSink) {
            this.sinkPaths.forEach(routes => {
                routes.forEach(route => {
                    if (!filters.startsWithPublic || route.isPublicSource) {
                        filteredRoutes.add(route);
                    }
                });
            });
        }

        if (filters.hasVulnerability) {
            this.vulnerablePaths.forEach(routes => {
                routes.forEach(route => {
                    const matchesOtherFilters =
                        (!filters.startsWithPublic || route.isPublicSource) &&
                        (!filters.endsInSink || route.isSinkTarget);

                    if (matchesOtherFilters) {
                        filteredRoutes.add(route);
                    }
                });
            });
        }

        // Apply custom filters
        let finalRoutes = Array.from(filteredRoutes);
        if (filters.customFilters?.length > 0) {
            finalRoutes = await this.applyCustomFiltersAsync(finalRoutes, filters.customFilters);
        }

        // If no filters, return all precomputed routes
        if (!this.hasActiveFilters(filters)) {
            finalRoutes = this.getAllPrecomputedRoutes();
        }

        return this.buildGraphResponse(finalRoutes);
    }

    /**
     * Apply custom filters asynchronously
     */
    private async applyCustomFiltersAsync(
        routes: Route[],
        customFilters: Array<(route: Route) => boolean>
    ): Promise<Route[]> {
        const chunks = this.chunkArray(routes, 100);
        const filteredChunks: Route[][] = [];

        for (const chunk of chunks) {
            const filteredChunk = chunk.filter(route =>
                customFilters.every(filter => filter(route))
            );
            filteredChunks.push(filteredChunk);
            await this.yieldToEventLoop();
        }

        return filteredChunks.flat();
    }

    /**
     * Build graph response for 3D visualization
     */
    private buildGraphResponse(routes: Route[]): GraphResponse {
        const nodes = new Set<string>();
        const edges = new Map<string, Set<string>>();

        routes.forEach(route => {
            route.path.forEach((node, index) => {
                nodes.add(node);
                if (index < route.path.length - 1) {
                    const from = route.path[index];
                    const to = route.path[index + 1];
                    if (!edges.has(from)) {
                        edges.set(from, new Set());
                    }
                    edges.get(from)!.add(to);
                }
            });
        });

        // Format for 3D Force Graph
        const graphNodes = Array.from(nodes).map(nodeId => {
            const nodeData = this.nodes.get(nodeId)!;
            return {
                id: nodeId,
                name: nodeId,
                group: nodeData.kind,
                isPublic: this.publicNodes.has(nodeId),
                isSink: this.sinkNodes.has(nodeId),
                hasVulnerability: this.vulnerableNodes.has(nodeId),
                vulnerabilities: nodeData.vulnerabilities || [],
                metadata: nodeData.metadata || {}
            };
        });

        const graphLinks = Array.from(edges.entries()).flatMap(([source, targets]) =>
            Array.from(targets).map(target => ({
                source,
                target,
                value: 1
            }))
        );

        return {
            nodes: graphNodes,
            links: graphLinks,
            metadata: {
                totalNodes: graphNodes.length,
                totalEdges: graphLinks.length,
                publicNodes: graphNodes.filter(n => n.isPublic).length,
                sinkNodes: graphNodes.filter(n => n.isSink).length,
                vulnerableNodes: graphNodes.filter(n => n.hasVulnerability).length
            }
        };
    }

    // Helper methods

    private createRoute(path: string[]): Route {
        return {
            path,
            source: path[0],
            target: path[path.length - 1],
            hasVulnerability: path.some(node => this.vulnerableNodes.has(node)),
            isPublicSource: this.publicNodes.has(path[0]),
            isSinkTarget: this.sinkNodes.has(path[path.length - 1])
        };
    }

    private isSinkNode(node: ServiceNode): boolean {
        return node.kind === 'rds' || node.kind === 'sqs' ||
            node.kind === 'sql' || node.kind === 'database';
    }

    private hasActiveFilters(filters: FilterOptions): boolean {
        return filters.startsWithPublic || filters.endsInSink ||
            filters.hasVulnerability || (filters.customFilters?.length > 0);
    }

    private getAllPrecomputedRoutes(): Route[] {
        const allRoutes: Route[] = [];
        this.publicPaths.forEach(routes => allRoutes.push(...routes));
        this.sinkPaths.forEach(routes => allRoutes.push(...routes));
        this.vulnerablePaths.forEach(routes => allRoutes.push(...routes));
        return allRoutes;
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    private yieldToEventLoop(): Promise<void> {
        return new Promise(resolve => setImmediate(resolve));
    }

    /**
     * Get graph statistics - O(1) operations
     */
    public getStatistics() {
        return {
            totalNodes: this.nodes.size,
            totalEdges: Array.from(this.adjacencyList.values())
                .reduce((sum, set) => sum + set.size, 0),
            nodesByKind: Object.fromEntries(
                Array.from(this.nodesByKind.entries())
                    .map(([kind, nodes]) => [kind, nodes.size])
            ),
            publicNodes: this.publicNodes.size,
            sinkNodes: this.sinkNodes.size,
            vulnerableNodes: this.vulnerableNodes.size
        };
    }
}