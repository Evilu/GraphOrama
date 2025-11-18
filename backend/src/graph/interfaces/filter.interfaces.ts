import { Route, GraphNode, GraphLink } from './graph.interfaces';

export interface FilterOptions {
    startsWithPublic?: boolean;
    endsInSink?: boolean;
    hasVulnerability?: boolean;
    customFilters?: Array<(route: Route) => boolean>;
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

export { Route } from './graph.interfaces';