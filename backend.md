# Graph Query Engine API

A high-performance, production-ready NestJS API for querying and visualizing microservices graph data with O(1) lookup optimizations.

## 🚀 Features

- **Redis-Powered Storage**: Primary storage with automatic fallback to in-memory
- **O(1) Lookups**: Pre-computed indexes and Redis Sets for instant access
- **Metadata Filtering**: Generic filtering by any metadata key-value pair
- **Non-blocking Operations**: Async processing with event loop yielding
- **No While Loops**: Recursive implementations to prevent blocking
- **3D Force Graph Ready**: Output formatted for direct use with react-force-graph-3d
- **Advanced Filtering**: Built-in filters with secure metadata-based filtering
- **Memory Efficient**: Chunked processing and lazy evaluation
- **Production Ready**: Rate limiting, compression, security headers, validation

## 📊 Performance Characteristics

- **Node Lookup**: O(1) using Redis Hashes or in-memory Maps
- **Edge Traversal**: O(1) via Redis Sets for adjacency lists
- **Filter Application**: O(1) using Redis SUNION on pre-computed reachability sets
- **Graph Loading**: O(n + e) preprocessing with Redis pipeline, then O(1) queries
- **Memory Usage**: Optimized with Redis storage and chunked processing
- **Metadata Indexing**: Automatic indexing of all metadata for dynamic filtering

## 🏗️ Architecture Decisions

### Storage Layer

1. **Redis Primary Storage**: High-performance distributed storage with persistence
2. **Automatic Fallback**: Graceful degradation to in-memory storage if Redis unavailable
3. **Pipeline Operations**: Batch Redis operations for efficient loading
4. **Reachability Cache**: Pre-computed paths stored in Redis Sets

### Data Structures

1. **Redis Hashes**: Node data stored as `graph:node:{name}`
2. **Redis Sets**: Edges, indexes, and reachability stored as Sets for O(1) SUNION
3. **Metadata Indexing**: Automatic indexing of all metadata key-value pairs
4. **In-Memory Maps**: Fallback using JavaScript Maps for true O(1) performance

### Non-blocking Design

- **Async Iterators**: Processing large datasets without blocking
- **setImmediate Yielding**: Giving control back to event loop
- **Recursive over Loops**: Eliminating while loops for better control flow
- **Chunked Processing**: Breaking large operations into smaller tasks

### Filtering Strategy

- **Pre-computation**: Reachability computed at load time, not query time
- **Index-based Filtering**: Using Redis Sets for instant filtering
- **Metadata Filters**: Generic filtering by any metadata attribute
- **Composable Filters**: Filters can be combined without re-traversal

## 🔧 Installation

npm install

## 🚀 Running the Application

# Development
npm run start:dev

# Production
npm run build
npm run start:prod

## 📚 API Endpoints

### Load Graph Data
POST /api/graph/load
Content-Type: application/json

{
"nodes": [...],
"edges": [...]
}

### Query Graph with Filters
```bash
GET /api/graph/query?startsWithPublic=true&endsInSink=true&hasVulnerability=true

# With metadata filters
GET /api/graph/query?metadataFilters={"cloud":"AWS"}
GET /api/graph/query?metadataFilters={"engine":"postgres"}
GET /api/graph/query?metadataFilters={"cwe":"CWE-22"}
```

### Get Statistics
```bash
GET /api/graph/statistics
```

## 🔍 Filter Types

1. **startsWithPublic**: Routes originating from public-exposed services
2. **endsInSink**: Routes terminating at databases or queues
3. **hasVulnerability**: Routes containing vulnerable nodes
4. **metadataFilters**: Generic filtering by any metadata key-value pair

### Metadata Filters (Secure & Generic)

Metadata filters allow you to filter by any attribute in node metadata without writing code:

```json
// Filter by cloud provider
{"cloud": "AWS"}

// Filter by database engine
{"engine": "postgres"}

// Filter by vulnerability CWE
{"cwe": "CWE-22"}

// Filter by any custom metadata
{"team": "payment-team", "env": "production"}
```

**How it works:**
- All metadata is automatically indexed in Redis during graph loading
- Supports both top-level node metadata and nested vulnerability metadata
- Returns the full subgraph context (reachability) for matching nodes
- Secure: No code execution, unlike the deprecated `customFilters`

**Security Note:** The previous `customFilters` feature has been removed due to RCE vulnerability (used `new Function()`). Metadata filters provide the same flexibility without security risks.

## 📊 Response Format (3D Force Graph Compatible)

{
"nodes": [
{
"id": "service-name",
"name": "service-name",
"group": "service",
"isPublic": true,
"isSink": false,
"hasVulnerability": false,
"vulnerabilities": [],
"metadata": {}
}
],
"links": [
{
"source": "service-a",
"target": "service-b",
"value": 1
}
],
"metadata": {
"totalNodes": 47,
"totalEdges": 89,
"publicNodes": 2,
"sinkNodes": 2,
"vulnerableNodes": 2
}
}

## 🎯 Optimization Techniques

### Memory Management
- Chunked array processing (100 items per chunk)
- Lazy evaluation of paths
- Set deduplication for routes
- Efficient data structure choices

### CPU Optimization
- Pre-computed paths eliminate runtime traversal
- Hash-based lookups avoid linear searches
- Early termination in recursive functions
- Parallel processing with Promise.all

### Event Loop Friendly
- No blocking while loops
- Regular yielding with setImmediate
- Async/await throughout
- Chunked processing prevents long tasks

## 🔐 Security Features

- Helmet.js for security headers
- Rate limiting with @nestjs/throttler
- Input validation with class-validator
- File size limits for uploads
- CORS configuration

## 🧪 Testing

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

## 📈 Scalability Considerations

1. **Horizontal Scaling**: Stateless design allows multiple instances
2. **Redis Storage**: Distributed graph storage for large datasets
3. **Load Balancing**: Ready for reverse proxy deployment
4. **Persistence**: Redis provides data persistence across restarts
5. **Streaming**: Can implement streaming for very large graphs
6. **Redis Clustering**: Can scale Redis for high availability

## 🚀 Production Deployment

1. Set environment variables from `.env.example`
2. **Configure Redis**: Set `REDIS_HOST` and `REDIS_PORT` (defaults to localhost:6379)
3. Build the application: `npm run build`
4. Use process manager (PM2, systemd)
5. Configure reverse proxy (nginx, caddy)
6. Enable monitoring (Prometheus, Grafana)
7. **Redis Monitoring**: Monitor Redis memory usage and connection health

## 📝 License

MIT
```

## 📁 Project Structure

Create the following folder structure:
```
graph-query-engine/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   └── graph/
│       ├── graph.module.ts
│       ├── graph.service.ts
│       ├── graph.controller.ts
│       ├── interfaces/
│       │   ├── graph.interfaces.ts
│       │   └── filter.interfaces.ts
│       └── dto/
│           ├── graph-filter.dto.ts
│           └── graph-data.dto.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
└── README.md