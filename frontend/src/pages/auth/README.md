# Authentication Pages

This directory contains all authentication-related pages for the Status Page application.

## Pages

### SignIn.tsx
The main login page with two authentication options:

#### Features:
- **Quick Sign In**: Uses Clerk authentication with social providers and email/password
- **Email & Password**: Custom form with enhanced UX features
- **Responsive Design**: Split-screen layout on desktop, mobile-optimized
- **Security Features**: Password visibility toggle, remember me option
- **Branding**: Left panel showcases platform features and benefits

#### Components Used:
- Clerk's `SignIn` component for quick authentication
- Custom form with validation
- Lucide React icons for enhanced UX
- Tailwind CSS for styling

### SignUp.tsx
User registration page (existing)

### ForgotPassword.tsx
Password reset functionality with email verification flow.

#### Features:
- Email input with validation
- Loading states during submission
- Success confirmation with email display
- Option to retry if email not received
- Clean, centered design with clear CTAs

## Authentication Flow

1. **Home Page** (`/`) - Landing page with sign-in/sign-up CTAs
2. **Sign In** (`/sign-in`) - Login with Clerk or custom form
3. **Sign Up** (`/sign-up`) - Registration page
4. **Forgot Password** (`/forgot-password`) - Password reset
5. **Dashboard** (`/dashboard`) - Protected route after authentication

## Integration

### Clerk Integration
The application uses Clerk for authentication with the following configuration:
- Social providers (Google, GitHub, etc.)
- Email/password authentication
- Session management
- Protected routes via `RequireAuth` component

### Custom Authentication
The custom form provides an alternative login method that can be integrated with:
- Custom backend authentication
- Enterprise SSO
- Legacy authentication systems

## Styling

All pages use:
- Tailwind CSS for styling
- Consistent color scheme (blue/indigo gradient)
- Responsive design patterns
- Accessible form elements
- Loading states and animations

## Security Features

- HTTPS enforcement (production)
- CSRF protection
- Input validation
- Secure password handling
- Session management
- Protected route redirection

## Usage

```tsx
// Navigate to sign-in
<Link to="/sign-in">Sign In</Link>

// Navigate with redirect
<Link to="/sign-in" state={{ from: location }}>Sign In</Link>

// Forgot password
<Link to="/forgot-password">Forgot Password?</Link>
```

## Customization

To customize the authentication pages:

1. **Branding**: Update logos, colors, and messaging in the components
2. **Features**: Modify the feature list in the left panel
3. **Styling**: Adjust Tailwind classes for different themes
4. **Authentication**: Configure Clerk settings or implement custom auth logic
5. **Validation**: Add custom form validation rules

## Environment Variables

Required environment variables:
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_API_URL=your_api_url
```
