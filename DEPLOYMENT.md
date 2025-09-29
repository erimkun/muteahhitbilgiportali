# Environment Configuration Guide

This document explains how to configure the application for different environments (development and production).

## Development Environment

For development, the application uses `localhost:3001` by default. All necessary configurations are already set up.

### Frontend (.env)
```bash
VITE_CESIUM_ION_TOKEN=your_ion_token_here
VITE_API_BASE_URL=http://localhost:3001
```

### Backend (.env)
```bash
PORT=3001
API_BASE_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:5173
# ... other configurations
```

## Production Environment

When deploying to production, you need to update the environment variables to match your domain.

### Frontend Production Configuration

Update your frontend `.env` file:
```bash
VITE_CESIUM_ION_TOKEN=your_ion_token_here
VITE_API_BASE_URL=https://yourdomain.com
```

### Backend Production Configuration

Update your backend `.env` file:
```bash
PORT=3001
API_BASE_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
SESSION_SECRET=your_production_secret_here
# ... other configurations
```

## Environment Variable Explanation

### Frontend Variables
- `VITE_API_BASE_URL`: The base URL for all API requests. Frontend will use this to construct API endpoints.

### Backend Variables
- `API_BASE_URL`: Used for internal references and logging (optional, mainly for consistency)
- `CORS_ORIGIN`: Allowed origins for CORS. Must match your frontend domain.
- `PORT`: Port on which the backend server runs.

## Deployment Steps

1. **Build Frontend**: Run `npm run build` in the frontend directory
2. **Update Environment Variables**: Set production URLs in both frontend and backend `.env` files
3. **Deploy Backend**: Deploy your backend service with production environment variables
4. **Deploy Frontend**: Deploy your built frontend to a web server or CDN
5. **Test**: Verify that all API calls work correctly with the new domain

## Automatic Configuration

The application automatically detects the environment and uses the appropriate configuration:

- **Development**: Uses `localhost:3001` if no environment variable is set
- **Production**: Uses the domain specified in `VITE_API_BASE_URL`

## Important Notes

1. **No Trailing Slashes**: Don't include trailing slashes in URLs (use `https://yourdomain.com`, not `https://yourdomain.com/`)
2. **HTTPS in Production**: Always use HTTPS in production for security
3. **CORS Configuration**: Make sure backend `CORS_ORIGIN` matches your frontend domain
4. **Build Process**: Frontend environment variables are embedded during build time, so rebuild after changing them

## Example Production Deployment

### Frontend .env (production)
```bash
VITE_CESIUM_ION_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE_URL=https://api.muteahhithub.com
```

### Backend .env (production)
```bash
PORT=3001
API_BASE_URL=https://api.muteahhithub.com
CORS_ORIGIN=https://muteahhithub.com
SESSION_SECRET=super_secure_production_secret
DATABASE_PATH=/app/data/db.sqlite
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=5
```

## Testing Configuration

You can test your configuration by:
1. Checking browser developer tools for failed requests
2. Verifying API endpoints are correctly formed
3. Ensuring CORS headers are properly set
4. Confirming authentication works across domains

