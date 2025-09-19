# Frontend - React + TypeScript + Vite

A modern React 18 frontend application built with TypeScript, Vite, ShadcnUI, and Tailwind CSS.

## 🚀 Features

- **React 18** with TypeScript
- **Vite** for fast development and building
- **ShadcnUI** for beautiful, accessible components
- **Tailwind CSS** for utility-first styling
- **Clerk** for authentication
- **React Router** for client-side routing
- **Socket.io** for real-time communication
- **Axios** for HTTP requests

## 📦 Tech Stack

- React 18
- TypeScript
- Vite
- ShadcnUI
- Tailwind CSS
- Clerk (Authentication)
- React Router DOM
- Socket.io Client
- Axios
- Lucide React (Icons)

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   - Copy `.env.example` to `.env`
   - Update the environment variables with your actual values:
     ```env
     VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
     VITE_API_URL=http://localhost:3001
     VITE_SUPABASE_URL=your_supabase_url_here
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
     ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   └── ui/             # ShadcnUI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API services and utilities
├── types/              # TypeScript type definitions
├── lib/                # Utility functions
└── assets/             # Static assets
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🎨 Styling

This project uses Tailwind CSS with ShadcnUI components. The design system includes:

- CSS variables for theming
- Dark/light mode support
- Responsive design utilities
- Custom component variants

## 🔐 Authentication

Authentication is handled by Clerk. To set up:

1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your publishable key to the `.env` file
4. Configure your authentication flow in the components

## 🌐 API Integration

The frontend communicates with the backend through:

- **REST API** - Using Axios for HTTP requests
- **WebSocket** - Using Socket.io for real-time features
- **Authentication** - JWT tokens from Clerk

## 📱 Responsive Design

The application is fully responsive and works on:

- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Deploy to Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Deploy to Netlify

1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Configure environment variables in Netlify dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🧪 Testing

To test the application:

1. Start the backend server first
2. Start the frontend development server
3. Open `http://localhost:5173` in your browser
4. Verify that the application loads correctly

## 📄 License

This project is licensed under the MIT License.
