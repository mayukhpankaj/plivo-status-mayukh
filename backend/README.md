# Backend - Node.js + Express + TypeScript

A robust Node.js backend API built with Express.js, TypeScript, Supabase, and Clerk authentication.

## 🚀 Features

- **Node.js** with Express.js framework
- **TypeScript** for type safety
- **Supabase** for PostgreSQL database
- **Clerk** for user authentication
- **Socket.io** for real-time communication
- **Security middleware** (Helmet, CORS, Rate limiting)
- **Environment-based configuration**

## 📦 Tech Stack

- Node.js
- Express.js
- TypeScript
- Supabase (PostgreSQL)
- Clerk SDK
- Socket.io
- Helmet (Security)
- CORS
- Express Rate Limit
- Nodemon (Development)

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account
- Clerk account

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   - Copy `.env.example` to `.env`
   - Update the environment variables with your actual values:
     ```env
     PORT=3001
     NODE_ENV=development
     CLERK_SECRET_KEY=your_clerk_secret_key_here
     CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
     SUPABASE_URL=your_supabase_url_here
     SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
     FRONTEND_URL=http://localhost:5173
     ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3001`

## 📁 Project Structure

```
src/
├── routes/              # API route handlers
├── middleware/          # Custom middleware functions
├── services/            # Business logic and external services
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── index.ts             # Main application entry point
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (placeholder)

## 🛡️ Security Features

- **Helmet** - Sets various HTTP headers for security
- **CORS** - Configurable cross-origin resource sharing
- **Rate Limiting** - Prevents abuse with request rate limiting
- **Authentication** - JWT token verification with Clerk
- **Environment Variables** - Sensitive data protection

## 🔐 Authentication

Authentication is handled by Clerk:

1. **Setup Clerk:**
   - Create account at [clerk.com](https://clerk.com)
   - Create new application
   - Copy secret key to `.env` file

2. **Protected Routes:**
   - Use `authenticateUser` middleware for token verification
   - Use `requireAuth` middleware for route protection

3. **Available Endpoints:**
   - `GET /api/auth/profile` - Get current user profile
   - `POST /api/auth/verify` - Verify authentication token

## 🗄️ Database (Supabase)

Supabase provides PostgreSQL database with:

1. **Setup:**
   - Create account at [supabase.com](https://supabase.com)
   - Create new project
   - Copy URL and service role key to `.env`

2. **Database Helpers:**
   - Located in `src/services/supabase.ts`
   - Includes user management functions
   - Extensible for additional tables

## 🔌 Real-time Features

Socket.io integration for real-time communication:

- WebSocket server runs alongside HTTP server
- CORS configured for frontend connection
- Connection/disconnection logging
- Extensible for custom events

## 📡 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `GET /api/auth/profile` - Get user profile (protected)
- `POST /api/auth/verify` - Verify token

### General
- `GET /api` - API status check

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Railway

1. Connect repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Deploy to Heroku

1. Create Heroku app
2. Set environment variables: `heroku config:set KEY=value`
3. Deploy: `git push heroku main`

### Deploy to DigitalOcean App Platform

1. Connect repository to DigitalOcean
2. Configure environment variables
3. Deploy with automatic builds

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `CLERK_SECRET_KEY` | Clerk authentication secret | Yes |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `FRONTEND_URL` | Frontend application URL | No (default: http://localhost:5173) |

## 🧪 Testing

To test the API:

1. Start the server: `npm run dev`
2. Test health endpoint: `curl http://localhost:3001/health`
3. Test API endpoint: `curl http://localhost:3001/api`
4. Use Postman or similar tool for protected endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
