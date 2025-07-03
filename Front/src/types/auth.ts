// 🎯 Authentication Types
// These TypeScript interfaces define the "shape" of our data
// Think of them as contracts that ensure our data is always structured correctly

// What we send to the backend when logging in
export interface LoginCredentials {
  email: string;
  password: string;
}

// What the backend sends back after successful login
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// User information structure
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  department_id?: number;
}

// For handling API errors consistently
export interface AuthError {
  message: string;
  detail?: string;
}

// Authentication context state (we'll use this later)
export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
