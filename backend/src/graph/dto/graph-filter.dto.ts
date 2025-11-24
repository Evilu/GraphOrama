import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class GraphFilterDto {
    @ApiPropertyOptional({ description: 'Filter for routes starting with public exposure' })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    startsWithPublic?: boolean;

    @ApiPropertyOptional({ description: 'Filter for routes ending in sinks' })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    endsInSink?: boolean;

    @ApiPropertyOptional({ description: 'Filter for routes with vulnerabilities' })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    hasVulnerability?: boolean;

    @ApiPropertyOptional({
        description: 'JSON string of metadata filters (e.g. {"cloud": "AWS"})',
        type: 'string'
    })
    @IsOptional()
    @Transform(({ value }) => {
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
            return {};
        }
    })
    metadataFilters?: Record<string, string>;
}