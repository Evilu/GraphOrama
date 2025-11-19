import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    HttpStatus,
    HttpCode,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    FileTypeValidator,
    MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { GraphData } from './interfaces/graph.interfaces';
import { FilterOptions, GraphResponse } from './interfaces/filter.interfaces';
import { GraphFilterDto } from './dto/graph-filter.dto';
import { GraphDataDto } from './dto/graph-data.dto';

@ApiTags('graph')
@Controller('api/graph')
export class GraphController {
    constructor(private readonly graphService: GraphService) {}

    /**
     * Load graph data from JSON
     */
    @Post('load')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Load graph data from JSON' })
    @ApiBody({ type: GraphDataDto })
    @ApiResponse({ status: 200, description: 'Graph data loaded successfully' })
    @ApiResponse({ status: 400, description: 'Invalid graph data' })
    async loadGraph(@Body() graphData: GraphData): Promise<{ message: string; statistics: any }> {
        await this.graphService.loadGraph(graphData);
        const statistics = this.graphService.getStatistics();

        return {
            message: 'Graph loaded successfully',
            statistics
        };
    }

    /**
     * Load graph data from uploaded file
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Upload graph data from JSON file' })
    @ApiResponse({ status: 200, description: 'Graph file uploaded and processed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid file or graph data' })
    async uploadGraph(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
                    new FileTypeValidator({ fileType: 'application/json' }),
                ],
            }),
        )
        file: Express.Multer.File,
    ): Promise<{ message: string; statistics: any }> {
        const graphData = JSON.parse(file.buffer.toString());
        await this.graphService.loadGraph(graphData);
        const statistics = this.graphService.getStatistics();

        return {
            message: 'Graph file processed successfully',
            statistics
        };
    }


    /**
     * Get filtered graph for 3D visualization
     */
    @Get('query')
    @ApiOperation({ summary: 'Query graph with filters' })
    @ApiResponse({
        status: 200,
        description: 'Filtered graph data for 3D visualization'
    })
    async queryGraph(@Query() filters: GraphFilterDto): Promise<GraphResponse> {
        const filterOptions: FilterOptions = {
            startsWithPublic: filters.startsWithPublic || false,
            endsInSink: filters.endsInSink || false,
            hasVulnerability: filters.hasVulnerability || false,
        };

        return await this.graphService.getFilteredGraph(filterOptions);
    }

    /**
     * Get graph with custom filters
     */
    @Post('query/custom')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Query graph with custom filters' })
    @ApiBody({
        description: 'Custom filter options',
        schema: {
            type: 'object',
            properties: {
                startsWithPublic: { type: 'boolean' },
                endsInSink: { type: 'boolean' },
                hasVulnerability: { type: 'boolean' },
                customFilters: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of custom filter function strings'
                }
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Filtered graph data with custom filters applied'
    })
    async queryGraphWithCustomFilters(
        @Body() body: any
    ): Promise<GraphResponse> {
        const filterOptions: FilterOptions = {
            startsWithPublic: body.startsWithPublic,
            endsInSink: body.endsInSink,
            hasVulnerability: body.hasVulnerability,
        };

        // Parse custom filter functions if provided
        if (body.customFilters && Array.isArray(body.customFilters)) {
            filterOptions.customFilters = body.customFilters.map((filterStr: string) => {
                // Safe evaluation of filter functions
                return new Function('route', `return ${filterStr}`) as (route: any) => boolean;
            });
        }

        return await this.graphService.getFilteredGraph(filterOptions);
    }

    /**
     * Get graph statistics
     */
    @Get('statistics')
    @ApiOperation({ summary: 'Get current graph statistics' })
    @ApiResponse({
        status: 200,
        description: 'Graph statistics'
    })
    getStatistics() {
        return this.graphService.getStatistics();
    }

    /**
     * Get all nodes
     */
    @Get('nodes')
    @ApiOperation({ summary: 'Get all nodes in the graph' })
    @ApiResponse({
        status: 200,
        description: 'List of all nodes',
        type: [String]
    })
    async getAllNodes(): Promise<string[]> {
        const graph = await this.graphService.getFilteredGraph({});
        return graph.nodes.map(node => node.id);
    }

    /**
     * Get public entry points
     */
    @Get('entry-points')
    @ApiOperation({ summary: 'Get all public entry points' })
    @ApiResponse({
        status: 200,
        description: 'List of public entry points',
        type: [String]
    })
    async getEntryPoints(): Promise<string[]> {
        const graph = await this.graphService.getFilteredGraph({ startsWithPublic: true });
        return [...new Set(graph.nodes.filter(n => n.isPublic).map(n => n.id))];
    }

    /**
     * Get sink nodes
     */
    @Get('sinks')
    @ApiOperation({ summary: 'Get all sink nodes (databases, queues)' })
    @ApiResponse({
        status: 200,
        description: 'List of sink nodes',
        type: [String]
    })
    async getSinkNodes(): Promise<string[]> {
        const graph = await this.graphService.getFilteredGraph({ endsInSink: true });
        return [...new Set(graph.nodes.filter(n => n.isSink).map(n => n.id))];
    }

    /**
     * Get vulnerable nodes
     */
    @Get('vulnerabilities')
    @ApiOperation({ summary: 'Get all nodes with vulnerabilities' })
    @ApiResponse({
        status: 200,
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    node: { type: 'string' },
                    vulnerabilities: { type: 'array' }
                }
            }
        }
    })
    async getVulnerableNodes() {
        const graph = await this.graphService.getFilteredGraph({ hasVulnerability: true });
        return graph.nodes
            .filter(n => n.hasVulnerability)
            .map(n => ({
                node: n.id,
                vulnerabilities: n.vulnerabilities
            }));
    }
}