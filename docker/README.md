# Docker Compose for GraphOrama

This repository includes a Docker Compose setup that runs Redis, the backend, and the frontend. Services communicate over an internal Docker network:
- Redis: `redis`
- Backend: `backend` (internal service, not exposed to host)
- Frontend: exposed on host port 3000

Important: This setup builds the backend and frontend images using the Dockerfiles in `./backend` and `./frontend` respectively.

Start everything:

```bash
# From project root
docker compose up --build -d
```

View logs:

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f redis
```

Stop and remove containers (and volumes if you want a clean state):

```bash
docker compose down
# remove volumes too
docker compose down -v
```

Notes:
- The backend reads `REDIS_URL` from the environment; the compose file injects `redis://redis:6379`.
- The frontend uses `NEXT_PUBLIC_API_URL` to call the backend; in the compose file it is set to `http://backend:3001`.
- If you prefer to run backend locally instead of in Docker, you can keep Redis in Docker and set `REDIS_URL=redis://localhost:6379` in your `.env`.

