# GraphOrama 🚀

A high-performance microservices graph visualization platform with Redis-backed storage and advanced security path analysis.

## 🎯 Features

- **3D Graph Visualization**: Interactive WebGL-based graph rendering with react-force-graph-3d
- **Redis-Powered Backend**: O(1) lookups with automatic fallback to in-memory storage
- **Advanced Filtering**: Built-in filters for public nodes, sinks, vulnerabilities, and generic metadata
- **Security Analysis**: Identify attack paths from public services to data stores
- **Production Ready**: Rate limiting, compression, security headers, and comprehensive testing

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              React Frontend (3D)                 │
│  • Interactive graph visualization              │
│  • Real-time filtering                          │
│  • File upload support                          │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────────────┐
│           NestJS Backend API                     │
│  • O(1) graph queries                           │
│  • Pre-computed reachability                    │
│  • Generic metadata filtering                   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         Redis (Primary Storage)                  │
│  • Graph nodes (Hashes)                         │
│  • Edges & reachability (Sets)                  │
│  • Metadata indexes                             │
│  • Automatic fallback to in-memory              │
└─────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Redis 6+ (optional, falls back to in-memory if unavailable)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd GraphOrama

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

#### 1. Start Redis (Optional)
```bash
redis-server
```

#### 2. Start Backend
```bash
cd backend
npm run start:dev
# Backend runs on http://localhost:3001
```

#### 3. Start Frontend
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

#### 4. Load Graph Data

Upload your graph JSON via the UI or use the API:

```bash
curl -X POST http://localhost:3001/api/graph/load \
  -H "Content-Type: application/json" \
  -d @docs/train-ticket-be.json
```

## 📚 API Documentation

### Swagger UI

Interactive API documentation is available at:
```
http://localhost:3001/api
```

The Swagger UI provides:
- Complete API endpoint documentation
- Request/response schemas
- Interactive testing interface
- Example requests

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/graph/load` | Load graph data |
| `GET` | `/api/graph/query` | Query graph with filters |
| `GET` | `/api/graph/statistics` | Get graph statistics |

### Filter Examples

#### Built-in Filters
```bash
# Public nodes
GET /api/graph/query?startsWithPublic=true

# Sink nodes (databases, queues)
GET /api/graph/query?endsInSink=true

# Vulnerable nodes
GET /api/graph/query?hasVulnerability=true

# Combined filters
GET /api/graph/query?startsWithPublic=true&endsInSink=true
```

#### Metadata Filters (Generic)
```bash
# Filter by cloud provider
GET /api/graph/query?metadataFilters={"cloud":"AWS"}

# Filter by database engine
GET /api/graph/query?metadataFilters={"engine":"postgres"}

# Filter by vulnerability CWE
GET /api/graph/query?metadataFilters={"cwe":"CWE-22"}

# Multiple metadata criteria
GET /api/graph/query?metadataFilters={"cloud":"AWS","engine":"postgres"}
```

## 🔒 Security Features


### Security Headers
- Helmet.js for security headers
- Rate limiting with @nestjs/throttler
- Input validation with class-validator
- CORS configuration

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Test coverage
npm run test:cov
```

## 📊 Data Format

### Input Format
```json
{
  "nodes": [
    {
      "name": "service-name",
      "kind": "service",
      "publicExposed": true,
      "vulnerabilities": [
        {
          "file": "path/to/file.java",
          "severity": "high",
          "message": "Vulnerability description",
          "metadata": {
            "cwe": "CWE-22"
          }
        }
      ],
      "metadata": {
        "cloud": "AWS",
        "engine": "postgres"
      }
    }
  ],
  "edges": [
    {
      "from": "service-a",
      "to": "service-b"
    }
  ]
}
```

### Output Format (3D Graph Compatible)
```json
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
    "totalNodes": 46,
    "totalEdges": 96,
    "publicNodes": 2,
    "sinkNodes": 2,
    "vulnerableNodes": 2
  }
}
```

## 🎨 Frontend Features

- **3D Force Graph**: WebGL-based interactive visualization
- **Node Coloring**: 
  - 🔴 Red: Vulnerable nodes
  - 🟢 Green: Public-exposed nodes
  - ⚫ Gray: Internal nodes
- **Interactive Controls**: Click nodes to focus, drag to rotate
- **Real-time Filtering**: Instant graph updates on filter changes
- **File Upload**: Drag-and-drop or paste JSON data

## 🔧 Configuration

### Backend (.env)
```bash
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Frontend
The frontend automatically detects the backend URL and handles both `/api/graph` and `/api/api/graph` paths.

## 📈 Performance

- **Node Lookup**: O(1) via Redis Hashes
- **Edge Traversal**: O(1) via Redis Sets
- **Filter Application**: O(1) via Redis SUNION on pre-computed reachability
- **Graph Loading**: O(n + e) initial processing, then O(1) queries
- **Metadata Indexing**: Automatic indexing of all metadata for dynamic filtering

## 🚢 Production Deployment

1. Set environment variables
2. Configure Redis (recommended for production)
3. Build the application:
   ```bash
   cd backend && npm run build
   cd ../frontend && npm run build
   ```
4. Use a process manager (PM2, systemd)
5. Configure reverse proxy (nginx, caddy)
6. Enable monitoring (Prometheus, Grafana)

## 📖 Documentation

- [Architecture & Flow](ARCHITECTURE_FLOW.md) - Detailed architecture documentation
- [Backend API](backend.md) - Backend implementation details
- [Swagger UI](http://localhost:3001/api) - Interactive API documentation

## 🤝 Contributing

This is a production-ready implementation with:
- ✅ Comprehensive test coverage
- ✅ Security best practices
- ✅ Performance optimizations
- ✅ Complete documentation

## 📝 License

MIT

---

**Built with**: NestJS, React, TypeScript, Redis, react-force-graph-3d
