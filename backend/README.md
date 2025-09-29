# MuteahhitHub Backend Service

This backend service is built using Express and provides functionality for user and admin authentication, file uploads, project management, gallery image management, and model version handling. The codebase has been fully refactored to use a modular architecture for better maintainability and scalability.

## Key Features

- **Security:** Uses Helmet for setting content security policies and other HTTP headers. Implements CORS with configurable origins.
- **Authentication:** Session-based authentication for users and admins. Rate limiting is applied to auth routes to prevent abuse.
- **Database:** Utilizes SQLite for data storage with a dedicated service layer for all database operations.
- **File Uploads:** Uses Multer for handling file uploads with dynamic storage configuration based on album names. Uploaded files are stored in the `/uploads` directory and served via `/uploads` and `/upload` endpoints.
- **Modular Architecture:** The backend uses a fully modular structure with separated concerns for configuration, middleware, controllers, services, routes, and utilities.

## Routes and Endpoints

- **Basic Routes:** 
  - `GET /` - Check if backend is running.

- **Authentication:** 
  - `POST /login` - User login.
  - `GET /admin/login` - Admin login page.
  - `POST /admin/login` - Admin login submission.
  - `POST /logout` - Logout route.
  - `GET /session` - Check session status.

- **User Management (Admin Only):** 
  - `GET, POST, PUT, DELETE /admin/users` - CRUD operations for users.

- **Assets and Projects:**
  - `GET /api/assets`, `PUT /api/assets` - Legacy endpoints for project assets (defaults to project 1).
  - Project-scoped assets and gallery endpoints using `/api/projects/:projectId/*` routes.

- **Gallery Management:**
  - Endpoints for listing, uploading, and deleting gallery images for both legacy and project scopes.

- **Model Management:**
  - Endpoints for handling model versions including creation, publishing, and history retrieval.

- **Project Settings:**
  - Endpoints for retrieving and updating project settings.

## Modular File Structure

The backend is organized into multiple directories to separate concerns and improve code maintainability:

```
backend/
├── config/
│   └── env.js              # Environment configurations and settings
├── controllers/
│   ├── authController.js   # Authentication logic (login, logout, sessions)
│   ├── userController.js   # User management (CRUD operations)
│   ├── projectController.js # Project assets and settings management
│   ├── galleryController.js # Gallery image management
│   └── modelController.js  # 3D model version management
├── middlewares/
│   ├── authMiddleware.js   # Authentication and authorization middleware
│   ├── errorHandler.js     # Error handling and async wrapper utilities
│   ├── rateLimiter.js      # Rate limiting configurations
│   └── uploadMiddleware.js # File upload configuration with security
├── routes/
│   ├── authRoutes.js       # Authentication endpoints
│   ├── userRoutes.js       # User management endpoints (admin only)
│   ├── projectRoutes.js    # Project and asset endpoints
│   ├── galleryRoutes.js    # Gallery management endpoints
│   └── modelRoutes.js      # Model version endpoints
├── services/
│   └── dbService.js        # Database abstraction layer with service classes
├── utils/
│   └── helpers.js          # Common utility functions and validators
├── uploads/                # File upload directory
├── index.js                # Main application entry point (modular)
├── legacy/                 # Archived legacy entry points and test scripts
│   ├── index_original.js   # Legacy stub
│   ├── index_old.js        # Legacy stub
│   ├── index_modular.js    # Legacy stub
│   ├── index_clean.js      # Legacy stub
│   ├── test_admin_login.js # Legacy test script
│   └── test_parseProjectId.js # Legacy test script
└── database.js             # SQLite database connection and table setup
```

## Architecture Benefits

This modular architecture provides:

- **Separation of Concerns:** Each module has a single, well-defined responsibility
- **Maintainability:** Updates and fixes can be applied within individual modules
- **Scalability:** New features can be added by extending existing modules or creating new ones
- **Testability:** Decoupled components can be individually unit tested
- **Readability:** Logical separation makes the codebase easier to understand and navigate
- **Reusability:** Services and utilities can be easily reused across different controllers
- **Error Handling:** Centralized error handling provides consistent API responses

## Environment Configuration

Create a `.env` file in the backend directory with the following variables:

```env
PORT=3001
SESSION_SECRET=your_secure_session_secret_here
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
NODE_ENV=development
```

## Installation and Usage

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Server:**
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

3. **Default Admin Account:**
   - Phone: `05000000000`
   - Password: `admin123`
   - Access admin panel at: `/admin/login`

## API Endpoints

### Authentication
- `POST /login` - User login
- `GET /admin/login` - Admin login page
- `POST /admin/login` - Admin login
- `POST /logout` - Logout (user/admin)
- `GET /session` - Get current session info

### User Management (Admin Only)
- `GET /admin/users` - List all users
- `POST /admin/users` - Create new user
- `PUT /admin/users/:id` - Update user
- `DELETE /admin/users/:id` - Delete user

### Project Assets
- `GET /api/assets` - Get project assets (legacy, project 1)
- `PUT /api/assets` - Update project assets (legacy)
- `GET /api/projects/:projectId/assets` - Get project assets
- `PUT /api/projects/:projectId/assets` - Update project assets
- `GET /api/projects/:projectId/settings` - Get project settings
- `PUT /api/projects/:projectId/settings` - Update project settings

### Gallery Management
- `GET /api/gallery/:album` - List gallery images (legacy)
- `POST /api/gallery/:album` - Upload images (admin only, legacy)
- `DELETE /api/gallery/:album/:id` - Delete single image (admin only, legacy)
- `DELETE /api/gallery/:album` - Bulk delete images (admin only, legacy)
- `GET /api/projects/:projectId/gallery/:album` - List project gallery images
- `POST /api/projects/:projectId/gallery/:album` - Upload project images (admin only)
- `DELETE /api/projects/:projectId/gallery/:album/:id` - Delete project image (admin only)
- `DELETE /api/projects/:projectId/gallery/:album` - Bulk delete project images (admin only)

### Model Management
- `GET /api/projects/:projectId/model/published` - Get published model version
- `POST /api/projects/:projectId/model/versions` - Create new model version (admin only)
- `PUT /api/projects/:projectId/model/versions/:id/publish` - Publish model version (admin only)
- `GET /api/projects/:projectId/model/versions` - Get model version history (admin only)

## Security Features

- **Rate Limiting:** Protects against brute force attacks
- **Input Validation:** Sanitizes and validates all user inputs
- **File Upload Security:** Restricts file types and sizes
- **Session Management:** Secure session handling with configurable settings
- **CORS Protection:** Configurable cross-origin resource sharing
- **Helmet Security:** Additional HTTP security headers

## Migration Notes

- Legacy server variants are stubbed out; only `index.js` is active
- All functionality from the original version has been preserved
- New modular structure improves maintainability while keeping the same API
- Existing frontend code should work without changes
- Database schema remains unchanged, ensuring data compatibility
