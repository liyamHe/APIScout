# APIScout
A simple API discovery tool. Passively map undocumented endpoints while you hunt, with local PII-stripping and deduplication.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Access the dashboard at http://localhost:3000
```

The container automatically:
- Creates logs.json on first run
- Persists data to your host machine
- Restarts on failure

### Option 2: Local Development

1. **Load the extension** (Choose your browser):

   **Chrome:**
   - Go to `chrome://extensions/`
   - Enable Developer Mode (top right)
   - Click "Load unpacked"
   - Select the `APIScout` folder

   **Firefox:**
   - Go to `about:debugging`
   - Click "This Firefox" (left sidebar)
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from the `APIScout` folder
   - Note: Firefox requires reloading after each code change

2. **Start the backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **View the dashboard**: Visit `http://localhost:3000`

## How to View Results

Visit `http://localhost:3000` in your browser to see all collected API logs. 

**Search & Filter:**
- **Search bar**: Find APIs by hostname (partial match), method (exact), or path segment
- **Method buttons**: Filter by GET, POST, PUT, DELETE
- **Hide Assets**: Toggle to hide common static files (.js, .css, .png, etc.)
- **Clear**: Reset all filters

## Data Model

Each logged endpoint is stored with minimal fields:
- `hostname`: Domain where the request was made
- `method`: HTTP method (GET, POST, etc.)
- `normalizedPath`: Path with IDs stripped (e.g., `/users/{id}`)
- `queryKeys`: Query parameter names found
- `statusCodes`: Array of HTTP status codes seen
- `timestamp`: When first discovered
- `discoveryCount`: How many times this endpoint was accessed
- `fingerprint`: SHA-256 hash for deduplication

## Browser Support

APIScout is **cross-browser compatible** and works on both:
- **Chrome** (v90+)
- **Firefox** (v109+)

The extension uses a browser compatibility layer that automatically detects and uses the appropriate API namespace (`chrome.*` for Chrome, `browser.*` for Firefox).

### Production Deployment

To use the extension with a remote backend:

1. Update `extension/config/Config.js`:
   ```javascript
   BASE_URL: 'https://your-backend-domain.com'
   ```

2. Deploy the backend to your server (Docker recommended)

3. Reload the extension

**Note**: The extension filters out localhost requests by default to prevent logging the dashboard itself.

## How it Works

The extension captures all network requests and:
1. **Filters** obvious noise (static assets, telemetry, etc.)
2. **Normalizes paths** by removing unique identifiers
3. **Strips PII** from headers and request bodies
4. **Deduplicates** using fingerprints
5. **Uploads** to the backend with discovery counts

All data is deduplicated server-side. The UI is search-first—you manually explore and filter results.

## Architecture

```
APIScout/
├── backend/                          # Node.js/Express server
│   ├── models/
│   │   └── LogStore.js              # File-based persistence (logs.json)
│   ├── routes/
│   │   ├── logRoutes.js             # POST/GET/DELETE /api/logs endpoints
│   │   └── healthRoutes.js          # GET /api/health health check
│   ├── utils/
│   │   └── ExtensionFilter.js       # Request filtering & fingerprinting
│   ├── public/
│   │   └── react-dashboard.html     # React dashboard (built-in, no build step)
│   ├── server.js                    # Express entry point
│   └── package.json
│
├── extension/                        # Chrome Manifest V3 extension
│   ├── config/
│   │   └── Config.js                # Centralized configuration
│   ├── services/
│   │   ├── FingerprintEngine.js     # URL normalization & hashing
│   │   ├── RequestProcessor.js      # Payload parsing & classification
│   │   ├── ServerAPI.js             # HTTP client to backend
│   │   └── ExtensionStorage.js      # Chrome storage management
│   ├── background-refactored.js     # Service worker orchestration
│   ├── manifest.json                # Extension manifest
│   └── public/                      # Extension assets (icons, etc.)
│
├── frontend/                         # (Embedded in react-dashboard.html)
│   ├── components/                  # Reusable React components
│   ├── hooks/
│   │   └── useHierarchyPhysics.js   # D3.js physics simulation
│   ├── styles/                      # CSS styling
│   └── utils/                       # Utility functions
│
├── Dockerfile                       # Multi-stage Docker build
├── docker-compose.yml               # Container orchestration
├── .gitignore                       # Git exclusions
├── .dockerignore                    # Docker build exclusions
├── package.json                     # Root package.json (Docker scripts)
└── README.md                        # This file
```

### Backend

- **Express.js** REST API with modular routing
- **LogStore**: In-memory store with async file persistence to `logs.json`
- **Auto-create**: Logs file created automatically on first run
- **Filtering**: Ignores local API calls (localhost, 127.0.0.1, ::1)
- **Health checks**: Built-in `/api/health` endpoint

### Extension

- **Chrome Manifest V3** compliant service worker
- **Network interception**: Captures all HTTP/HTTPS traffic
- **URL normalization**: Strips UUIDs, IDs, timestamps from paths
- **Deduplication**: SHA-256 fingerprints (hostname + method + path)
- **PII stripping**: Removes sensitive data before upload
- **Configurable**: Centralized `Config.js` for base URL and endpoints

### Frontend

- **React 18** dashboard (embedded HTML, no build step required)
- **D3.js v7** force-directed graph visualization
- **Physics simulation**: Custom hierarchical layout with gravity and collision
- **Interactive features**:
  - Search & filter by hostname, method, path
  - Tree map view for hierarchical exploration
  - Cluster visualization
  - Inspector panel for detailed endpoint info
  - Auto-refresh (10-second interval)

### Data Flow

```
Browser (User browsing)
    ↓
Extension Service Worker (Captures requests)
    ↓
RequestProcessor (Normalizes & validates)
    ↓
ServerAPI (Sends to backend)
    ↓
Backend /api/logs (Deduplicates, persists)
    ↓
logs.json (File storage)
    ↓
Frontend (Fetches & visualizes)
    ↓
Dashboard UI (User exploration)
```

## Legal Disclaimer

**APIScout is provided for educational and authorized security testing purposes only.**

- **User Responsibility**: Users are solely responsible for their actions when using this tool. Unauthorized access to computer systems is illegal under applicable laws, including the Computer Fraud and Abuse Act (CFAA) and similar legislation.

- **Authorized Use Only**: This tool should only be used on:
  - Systems you own
  - Systems you have explicit written permission to test
  - Authorized penetration testing engagements

- **Liability**: The authors and contributors of APIScout are not responsible for:
  - Any damage caused by improper use of this tool
  - Legal consequences resulting from unauthorized access
  - Any data loss or system compromise
  - Violations of law or regulation

- **Terms of Service Compliance**: Ensure your use complies with any applicable terms of service, including web application policies and network access policies.

**By using this tool, you acknowledge that you understand these risks and take full responsibility for your actions.**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
