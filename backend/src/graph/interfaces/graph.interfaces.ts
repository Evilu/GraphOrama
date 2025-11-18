// Graph data structure interfaces
export interface ServiceNode {
    name: string;
    kind: string;
    language?: string;
    path?: string;
    publicExposed?: boolean;
    vulnerabilities?: Vulnerability[];
    metadata?: Record<string, any>;
}

export interface Vulnerability {
    file: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata: {
        cwe: string;
    };
}

export interface Edge {
    from: string;
    to: string | string[];
}

export interface GraphData {
    nodes: ServiceNode[];
    edges: Edge[];
}

// Filter interfaces
export interface FilterOptions {
    startsWithPublic?: boolean;
    endsInSink?: boolean;
    hasVulnerability?: boolean;
    customFilters?: Array<(route: Route) => boolean>;
}

export interface Route {
    path: string[];
    source: string;
    target: string;
    hasVulnerability: boolean;
    isPublicSource: boolean;
    isSinkTarget: boolean;
}

// 3D Force Graph compatible response
export interface GraphNode {
    id: string;
    name: string;
    group: string;
    isPublic: boolean;
    isSink: boolean;
    hasVulnerability: boolean;
    vulnerabilities: Vulnerability[];
    metadata: Record<string, any>;
}

export interface GraphLink {
    source: string;
    target: string;
    value: number;
}

export interface GraphResponse {
    nodes: GraphNode[];
    links: GraphLink[];
    metadata: {
        totalNodes: number;
        totalEdges: number;
        publicNodes: number;
        sinkNodes: number;
        vulnerableNodes: number;
    };
}