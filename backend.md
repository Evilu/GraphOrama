# Graph Query Engine API

A high-performance, production-ready NestJS API for querying and visualizing microservices graph data with O(1) lookup optimizations.

## 🚀 Features

- **O(1) Lookups**: Pre-computed indexes and hash maps for instant access
- **Non-blocking Operations**: Async processing with event loop yielding
- **No While Loops**: Recursive implementations to prevent blocking
- **3D Force Graph Ready**: Output formatted for direct use with react-force-graph-3d
- **Advanced Filtering**: Built-in filters with extensible custom filter support
- **Memory Efficient**: Chunked processing and lazy evaluation
- **Production Ready**: Rate limiting, compression, security headers, validation

## 📊 Performance Characteristics

- **Node Lookup**: O(1) using Map data structure
- **Edge Traversal**: O(1) for adjacency list access
- **Filter Application**: O(1) for pre-computed path lookups
- **Graph Loading**: O(n + e) preprocessing, then O(1) queries
- **Memory Usage**: Optimized with chunked processing

## 🏗️ Architecture Decisions

### Data Structures

1. **Maps over Objects**: Using JavaScript Maps for true O(1) performance
2. **Sets for Collections**: Preventing duplicates with O(1) add/has operations
3. **Pre-computed Paths**: Trading initial computation for query speed
4. **Indexed Collections**: Separate indexes for public, sink, and vulnerable nodes

### Non-blocking Design

- **Async Iterators**: Processing large datasets without blocking
- **setImmediate Yielding**: Giving control back to event loop
- **Recursive over Loops**: Eliminating while loops for better control flow
- **Chunked Processing**: Breaking large operations into smaller tasks

### Filtering Strategy

- **Pre-computation**: Routes computed at load time, not query time
- **Index-based Filtering**: Using pre-built indexes for instant filtering
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
GET /api/graph/query?startsWithPublic=true&endsInSink=true&hasVulnerability=true

### Get Statistics
GET /api/graph/statistics

### Custom Filters
POST /api/graph/query/custom
Content-Type: application/json

{
"startsWithPublic": true,
"endsInSink": true,
"hasVulnerability": false,
"customFilters": [
"route.path.length > 3",
"route.path.includes('order-service')"
]
}

## 🔍 Filter Types

1. **startsWithPublic**: Routes originating from public-exposed services
2. **endsInSink**: Routes terminating at databases or queues
3. **hasVulnerability**: Routes containing vulnerable nodes
4. **customFilters**: Extensible function-based filtering

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
2. **Caching Layer**: Can add Redis for distributed caching
3. **Load Balancing**: Ready for reverse proxy deployment
4. **Database Integration**: Can persist pre-computed paths
5. **Streaming**: Can implement streaming for very large graphs

## 🚀 Production Deployment

1. Set environment variables from `.env.example`
2. Build the application: `npm run build`
3. Use process manager (PM2, systemd)
4. Configure reverse proxy (nginx, caddy)
5. Enable monitoring (Prometheus, Grafana)

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