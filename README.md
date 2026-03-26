# t2tedit — Mapping Editor

A full-stack mapping editor for transforming JSON data between formats using visual rule definitions and optional Groovy scripting.

---

## Screenshots

| Initial view | Mapping tab (schema trees) |
|---|---|
| ![Initial](https://github.com/user-attachments/assets/0a0ead16-620a-456a-906c-08ed13d0efdc) | ![Mapping](https://github.com/user-attachments/assets/bdd07fd2-5511-4e2a-b098-598fd0b9db09) |

| Rules tab | Preview tab (live transform) |
|---|---|
| ![Rules](https://github.com/user-attachments/assets/bcf6cd43-be92-49be-9a0e-5b744369ff85) | ![Preview](https://github.com/user-attachments/assets/61204d4a-852f-47b3-bf96-46d80cf13132) |

---

## Architecture Overview

```
t2tedit/
├── backend/                   # Go HTTP API server
│   ├── cmd/server/main.go     # Entry point
│   └── internal/
│       ├── api/               # HTTP handlers & router (gorilla/mux)
│       ├── models/            # Shared data types
│       ├── parser/            # JSON schema parsing & path utilities
│       ├── transform/         # Transformation engine (direct/template/Groovy)
│       └── groovy/            # Groovy subprocess bridge
└── frontend/                  # React + TypeScript (Vite)
    └── src/
        ├── components/
        │   ├── MappingEditor  # 3-tab editor (Mapping / Rules / Preview)
        │   ├── MappingList    # Sidebar with CRUD
        │   ├── SchemaTree     # Recursive field tree with type badges
        │   ├── RuleRow        # Inline-editable rule row
        │   └── JsonEditor     # Auto-formatting JSON textarea
        ├── api.ts             # REST client
        └── types.ts           # TypeScript interfaces
```

---

## Backend

### Go Modules

| Package | Responsibility |
|---|---|
| `internal/models` | Shared types: `Mapping`, `MappingRule`, `TransformResult`, `SchemaField` … |
| `internal/parser` | `ParseSchema` – recursively converts a JSON value into a `[]SchemaField` tree; `ExtractValue` / `SetValue` for dot-notation path operations |
| `internal/transform` | `Engine.Transform` – applies rules; `Engine.ValidateMapping` – validates a mapping definition |
| `internal/groovy` | `GroovyBridge` – detects the `java` CLI at startup; the embedded `groovy-all.jar` is extracted to a temp file on first use and scripts are executed via `java -jar`. Bindings are serialised to a separate JSON temp file (loaded with `JsonSlurper`) to prevent injection through binding values |
| `internal/api` | `Handlers` struct wiring all dependencies; gorilla/mux routes |

### REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/mappings` | List all mappings |
| `POST` | `/api/mappings` | Create mapping |
| `GET` | `/api/mappings/{id}` | Get mapping |
| `PUT` | `/api/mappings/{id}` | Update mapping |
| `DELETE` | `/api/mappings/{id}` | Delete mapping |
| `POST` | `/api/transform` | Execute transformation (inline or by ID) |
| `POST` | `/api/validate` | Validate a mapping definition |
| `POST` | `/api/parse-schema` | Parse JSON into `SchemaField` tree |
| `GET` | `/api/groovy/status` | Groovy availability & version |

### Transform request

```json
POST /api/transform
{
  "mapping": {
    "rules": [
      { "id": "r1", "sourcePath": "user.firstName", "targetPath": "person.name", "transform": "direct" },
      { "id": "r2", "sourcePath": "user.age",       "targetPath": "person.age",  "transform": "template", "template": "Age: {{value}}" },
      { "id": "r3", "sourcePath": "score",           "targetPath": "grade",       "transform": "groovy",   "groovyScript": "value >= 90 ? 'A' : value >= 80 ? 'B' : 'C'" }
    ]
  },
  "inputData": { "user": { "firstName": "John", "age": 30 }, "score": 92 }
}
```

### Transform types

| Type | Behaviour |
|---|---|
| `direct` | Copy source value as-is |
| `template` | Replace `{{value}}` placeholder with the string form of the source value |
| `groovy` | Execute a Groovy script; `value` = extracted source value, `input` = full input object |

---

## Groovy / JVM Integration

The backend embeds `groovy-all-2.4.21.jar` directly in the compiled binary. No separate Groovy installation is required — only a Java runtime (JRE 8 or later) needs to be available on the host system. Java is detected at startup via `exec.LookPath("java")`.

When a `groovy`-type rule is executed the engine:

1. Extracts the embedded `groovy-all.jar` to a temporary file (once per process lifetime).
2. Serialises all variable bindings to a temporary JSON file.
3. Generates a wrapper Groovy script that uses `JsonSlurper` to load bindings from the file (never interpolated into the script string).
4. Executes `java -jar groovy-all.jar <script_file>` as a subprocess.
5. Parses the JSON output from stdout as the result.

### Groovy script example

```groovy
// Groovy script for a mapping rule (groovyScript field)
// Bindings: `value` = source field value, `input` = full input object
value.trim().toUpperCase()
```

---

## Frontend

Built with React 18 + TypeScript + Vite. No external UI component library — styled entirely with CSS variables and Flexbox.

### Workflow

1. **Create mapping** — click "+ New Mapping" in the sidebar.
2. **Define schemas** — paste source/target JSON into the schema editors and click "Parse Schema" to populate the field trees.
3. **Add rules** — click a source field, then a target field to create a `direct` rule automatically. Or use "+ Add Rule" for manual entry.
4. **Edit rules** — switch to the Rules tab; click "Edit" on any row to change the transform type, add a Groovy script, or modify paths inline.
5. **Live preview** — switch to the Preview tab, enter sample input JSON, and click "▶ Transform" to see the real-time output, execution logs, and duration.
6. **Save** — click "Save" to persist the mapping to the backend in-memory store.

---

## Running Locally

### Backend

```bash
cd backend
go run ./cmd/server/main.go
# Server starts on :8080  (override with PORT env var)
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev
# Dev server starts on http://localhost:5173
```

### Frontend (production build)

```bash
cd frontend
npm run build
# Output in frontend/dist/ — serve with any static file server
```

### Running tests

```bash
cd backend
go test ./...
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Backend HTTP listen port |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `VITE_API_URL` | `http://localhost:8080` | Backend URL used by the frontend |

---

## Deployment

### Web (Docker)

A two-stage build compiles the Go backend and React frontend into a single Docker image:

```dockerfile
# Stage 1 – frontend
FROM node:20-alpine AS fe
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2 – backend + embedded frontend
FROM golang:1.21-alpine AS be
WORKDIR /app/backend
COPY backend/ .
RUN go build -o /t2tedit ./cmd/server

FROM alpine:3.19
COPY --from=be /t2tedit /t2tedit
COPY --from=fe /app/frontend/dist /frontend/dist
ENV PORT=8080
EXPOSE 8080
CMD ["/t2tedit"]
```

The backend serves the compiled React app from `/frontend/dist` when a `STATIC_DIR` environment variable is set, falling back to the API-only mode otherwise.

### Desktop (Electron / Wails)

The frontend can be packaged as a desktop application using [Wails](https://wails.io) (Go + WebView) or [Electron](https://electronjs.org):

**Wails** is the recommended option — the Go backend becomes the Wails application backend, and the React frontend is embedded via the Wails embed filesystem. A single binary is produced.

**Electron** wraps the dev server or built frontend in a Chromium window; the Go backend process can be spawned as a child process from the Electron main process.
