import { IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class VulnerabilityDto {
    @ApiProperty()
    file: string;

    @ApiProperty()
    severity: string;

    @ApiProperty()
    message: string;

    @ApiProperty()
    metadata: {
        cwe: string;
    };
}

class ServiceNodeDto {
    @ApiProperty()
    name: string;

    @ApiProperty()
    kind: string;

    @ApiProperty({ required: false })
    language?: string;

    @ApiProperty({ required: false })
    path?: string;

    @ApiProperty({ required: false })
    publicExposed?: boolean;

    @ApiProperty({ type: [VulnerabilityDto], required: false })
    @ValidateNested({ each: true })
    @Type(() => VulnerabilityDto)
    vulnerabilities?: VulnerabilityDto[];

    @ApiProperty({ required: false })
    metadata?: Record<string, any>;
}

class EdgeDto {
    @ApiProperty()
    from: string;

    @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
    to: string | string[];
}

export class GraphDataDto {
    @ApiProperty({ type: [ServiceNodeDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceNodeDto)
    nodes: ServiceNodeDto[];

    @ApiProperty({ type: [EdgeDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EdgeDto)
    edges: EdgeDto[];
}