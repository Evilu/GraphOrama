import { Injectable, OnModuleInit } from '@nestjs/common';
import { GraphData, ServiceNode, Edge } from './interfaces/graph.interfaces';
import { FilterOptions, GraphResponse, Route } from './interfaces/filter.interfaces';
import { RedisService } from '../redis/redis.service';
import Redis from 'ioredis';

@Injectable()
export class GraphService implements OnModuleInit {
    private redis: Redis | null = null;
    private useRedis: boolean = true;


    private nodes: Map<string, ServiceNode> = new Map();
    private adjacencyList: Map<string, Set<string>> = new Map();
    private reverseAdjacencyList: Map<string, Set<string>> = new Map();
    private publicNodes: Set<string> = new Set();
    private sinkNodes: Set<string> = new Set();
    private vulnerableNodes: Set<string> = new Set();
    private nodesByKind: Map<string, Set<string>> = new Map();
    private publicPaths: Map<string, Route[]> = new Map();
    private sinkPaths: Map<string, Route[]> = new Map();
    private vulnerablePaths: Map<string, Route[]> = new Map();

    constructor(private readonly redisService: RedisService) { }

    async onModuleInit() {
        this.useRedis = await this.redisService.isAvailable();
        if (this.useRedis) {
            this.redis = this.redisService.getClient();
            console.log('GraphService: Using Redis for graph storage');
        } else {
            console.log('GraphService: Using in-memory storage (Redis unavailable)');
            this.initializeEmptyGraph();
        }
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
     * Load and process graph data
     * Uses Redis for storage and pre-computation if available
     */
    public async loadGraph(data: GraphData): Promise<void> {
        if (this.useRedis && this.redis) {
            await this.loadGraphRedis(data);
        } else {
            await this.loadGraphMemory(data);
        }
    }

    /**
     * Load graph using Redis - simplified implementation
     */
    private async loadGraphRedis(data: GraphData): Promise<void> {
        const pipeline = this.redis!.pipeline();


        const keys = await this.redis!.keys('graph:*');
        if (keys.length > 0) {
            pipeline.del(...keys);
        }


        data.nodes.forEach(node => {

            pipeline.hset(`graph:node:${node.name}`, {
                name: node.name,
                kind: node.kind,
                language: node.language || '',
                path: node.path || '',
                publicExposed: node.publicExposed ? '1' : '0',
                vulnerabilities: JSON.stringify(node.vulnerabilities || []),
                metadata: JSON.stringify(node.metadata || {}),
            });


            pipeline.sadd(`graph:nodes:${node.kind}`, node.name);
            pipeline.sadd('graph:nodes:all', node.name);


            if (node.publicExposed) {
                pipeline.sadd('graph:nodes:public', node.name);
            }
            if (this.isSinkNode(node)) {
                pipeline.sadd('graph:nodes:sinks', node.name);
            }
            if (node.vulnerabilities && node.vulnerabilities.length > 0) {
                pipeline.sadd('graph:nodes:vulnerable', node.name);
            }



            const indexMetadata = (meta: Record<string, any>) => {
                if (!meta) return;
                Object.entries(meta).forEach(([key, value]) => {
                    pipeline.sadd(`graph:nodes:meta:${key}:${value}`, node.name);
                    pipeline.sadd('graph:meta:keys', `${key}:${value}`);
                });
            };


            if (node.metadata) {
                indexMetadata(node.metadata);
            }


            if (node.vulnerabilities) {
                node.vulnerabilities.forEach(vuln => {
                    if (vuln.metadata) {
                        indexMetadata(vuln.metadata);
                    }
                });
            }
            if (node.vulnerabilities?.length > 0) {
                pipeline.sadd('graph:nodes:vulnerable', node.name);
            }
        });


        data.edges.forEach(edge => {
            const targets = Array.isArray(edge.to) ? edge.to : [edge.to];
            targets.forEach(target => {

                pipeline.sadd(`graph:edges:${edge.from}`, target);
                // Reverse edges
                pipeline.sadd(`graph:reverse:${target}`, edge.from);
                // All edges list
                pipeline.sadd('graph:edges:all', `${edge.from}->${target}`);
            });
        });

        await pipeline.exec();

        // Pre-compute reachable sets (simplified - no complex recursion!)
        await this.computeReachableSetsRedis();
    }

    /**
     * Compute reachable sets in Redis - much simpler than recursive approach
     */
    private async computeReachableSetsRedis(): Promise<void> {
        // Get all public nodes
        const publicNodes = await this.redis!.smembers('graph:nodes:public');

        // For each public node, compute reachable nodes using BFS
        for (const publicNode of publicNodes) {
            const reachable = await this.bfsRedis(publicNode, 'forward');
            if (reachable.size > 0) {
                await this.redis!.sadd(`graph:reachable:public:${publicNode}`, ...Array.from(reachable));
            }
        }

        // Get all sink nodes
        const sinkNodes = await this.redis!.smembers('graph:nodes:sinks');

        // For each sink, compute nodes that can reach it
        for (const sinkNode of sinkNodes) {
            const reachable = await this.bfsRedis(sinkNode, 'backward');
            if (reachable.size > 0) {
                await this.redis!.sadd(`graph:reachable:sink:${sinkNode}`, ...Array.from(reachable));
            }
        }

        // Get all vulnerable nodes
        const vulnerableNodes = await this.redis!.smembers('graph:nodes:vulnerable');

        // For each vulnerable node, compute paths through it
        for (const vulnNode of vulnerableNodes) {
            const incoming = await this.bfsRedis(vulnNode, 'backward', 5);
            const outgoing = await this.bfsRedis(vulnNode, 'forward', 5);
            const combined = new Set([...incoming, ...outgoing, vulnNode]);
            if (combined.size > 0) {
                await this.redis!.sadd(`graph:reachable:vulnerable:${vulnNode}`, ...Array.from(combined));
            }
        }

        // Get all metadata keys
        const metaKeys = await this.redis!.smembers('graph:meta:keys');

        // For each metadata key, compute paths through matching nodes
        for (const metaKey of metaKeys) {
            const metaNodes = await this.redis!.smembers(`graph:nodes:meta:${metaKey}`);

            for (const node of metaNodes) {
                // Treat metadata nodes like vulnerable nodes - we want context (paths through them)
                const incoming = await this.bfsRedis(node, 'backward', 5);
                const outgoing = await this.bfsRedis(node, 'forward', 5);
                const combined = new Set([...incoming, ...outgoing, node]);

                if (combined.size > 0) {
                    await this.redis!.sadd(`graph:reachable:meta:${metaKey}:${node}`, ...Array.from(combined));
                }
            }
        }
    }

    /**
     * Simple BFS using Redis - no complex recursion!
     */
    private async bfsRedis(startNode: string, direction: 'forward' | 'backward', maxDepth: number = 10): Promise<Set<string>> {
        const visited = new Set<string>([startNode]);
        const queue = [{ node: startNode, depth: 0 }];

        while (queue.length > 0) {
            const { node, depth } = queue.shift()!;

            if (depth >= maxDepth) continue;

            const neighbors = direction === 'forward'
                ? await this.redis!.smembers(`graph:edges:${node}`)
                : await this.redis!.smembers(`graph:reverse:${node}`);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ node: neighbor, depth: depth + 1 });
                }
            }
        }

        return visited;
    }

    /**
     * Fallback: Load graph in memory when Redis unavailable
     */
    private async loadGraphMemory(data: GraphData): Promise<void> {
        this.initializeEmptyGraph();
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
     * Get filtered graph - O(1) with Redis SUNION!
     */
    public async getFilteredGraph(filters: FilterOptions): Promise<GraphResponse> {
        if (this.useRedis && this.redis) {
            return await this.getFilteredGraphRedis(filters);
        } else {
            return await this.getFilteredGraphMemory(filters);
        }
    }

    /**
     * Redis-based filtering - MUCH simpler!
     */
    private async getFilteredGraphRedis(filters: FilterOptions): Promise<GraphResponse> {
        const nodeKeys: string[] = [];

        // Build keys for SUNION based on filters
        if (filters.startsWithPublic) {
            const publicNodes = await this.redis!.smembers('graph:nodes:public');
            publicNodes.forEach(node => nodeKeys.push(`graph:reachable:public:${node}`));
        }

        if (filters.endsInSink) {
            const sinkNodes = await this.redis!.smembers('graph:nodes:sinks');
            sinkNodes.forEach(node => nodeKeys.push(`graph:reachable:sink:${node}`));
        }

        if (filters.hasVulnerability) {
            const vulnNodes = await this.redis!.smembers('graph:nodes:vulnerable');
            vulnNodes.forEach(node => nodeKeys.push(`graph:reachable:vulnerable:${node}`));
        }

        // Apply metadata filters
        if (filters.metadataFilters) {
            for (const [key, value] of Object.entries(filters.metadataFilters)) {
                const metaNodes = await this.redis!.smembers(`graph:nodes:meta:${key}:${value}`);
                metaNodes.forEach(node => nodeKeys.push(`graph:reachable:meta:${key}:${value}:${node}`));
            }
        }

        // Get union of all reachable nodes (automatic deduplication!)
        let nodeIds: string[];

        if (this.hasActiveFilters(filters)) {
            if (nodeKeys.length > 0) {
                nodeIds = await this.redis!.sunion(...nodeKeys);
            } else {
                // Active filters but no matches found
                nodeIds = [];
            }
        } else {
            // No filters - return all nodes
            nodeIds = await this.redis!.smembers('graph:nodes:all');
        }

        // Build response from Redis data
        return await this.buildGraphResponseRedis(nodeIds);
    }

    /**
     * Build graph response from Redis data
     */
    private async buildGraphResponseRedis(nodeIds: string[]): Promise<GraphResponse> {
        const nodes = new Set(nodeIds);
        const edges = new Map<string, Set<string>>();

        // Get edges for included nodes
        for (const nodeId of nodeIds) {
            const targets = await this.redis!.smembers(`graph:edges:${nodeId}`);
            targets.forEach(target => {
                if (nodes.has(target)) {
                    if (!edges.has(nodeId)) {
                        edges.set(nodeId, new Set());
                    }
                    edges.get(nodeId)!.add(target);
                }
            });
        }

        // Fetch node data from Redis
        const graphNodes = await Promise.all(
            Array.from(nodes).map(async (nodeId) => {
                const nodeData = await this.redis!.hgetall(`graph:node:${nodeId}`);
                return {
                    id: nodeId,
                    name: nodeId,
                    group: nodeData.kind || 'unknown',
                    isPublic: nodeData.publicExposed === '1',
                    isSink: await this.redis!.sismember('graph:nodes:sinks', nodeId) === 1,
                    hasVulnerability: await this.redis!.sismember('graph:nodes:vulnerable', nodeId) === 1,
                    vulnerabilities: JSON.parse(nodeData.vulnerabilities || '[]'),
                    metadata: JSON.parse(nodeData.metadata || '{}'),
                };
            })
        );

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

    /**
     * Fallback: In-memory filtering
     */
    private async getFilteredGraphMemory(filters: FilterOptions): Promise<GraphResponse> {
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

        // Metadata filters for in-memory fallback
        if (filters.metadataFilters) {
            const metaFilters = filters.metadataFilters;
            filteredRoutes.forEach(route => {
                // Check if any node in the route has the metadata
                const matches = route.path.some(nodeId => {
                    const node = this.nodes.get(nodeId);
                    if (!node || !node.metadata) return false;
                    return Object.entries(metaFilters).every(([key, value]) =>
                        node.metadata![key] === value
                    );
                });

                if (!matches) {
                    filteredRoutes.delete(route);
                }
            });
        }

        let finalRoutes = Array.from(filteredRoutes);

        // If no filters, return all precomputed routes
        if (!this.hasActiveFilters(filters)) {
            finalRoutes = this.getAllPrecomputedRoutes();
        }

        return this.buildGraphResponse(finalRoutes);
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
            filters.hasVulnerability || !!filters.metadataFilters;
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
        if (this.useRedis && this.redis) {
            return this.getStatisticsRedis();
        } else {
            return this.getStatisticsMemory();
        }
    }

    private async getStatisticsRedis() {
        const [totalNodes, publicNodes, sinkNodes, vulnerableNodes] = await Promise.all([
            this.redis!.scard('graph:nodes:all'),
            this.redis!.scard('graph:nodes:public'),
            this.redis!.scard('graph:nodes:sinks'),
            this.redis!.scard('graph:nodes:vulnerable'),
        ]);

        const allEdges = await this.redis!.smembers('graph:edges:all');

        return {
            totalNodes,
            totalEdges: allEdges.length,
            publicNodes,
            sinkNodes,
            vulnerableNodes,
            nodesByKind: {},
            storageType: 'redis' as const,
        };
    }

    private getStatisticsMemory() {
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
            vulnerableNodes: this.vulnerableNodes.size,
            storageType: 'memory' as const,
        };
    }
}