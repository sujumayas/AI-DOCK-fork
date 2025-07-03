// 👤 Profile Service
// Handles user profile operations (get, update, password change)

import { tokenManager } from '../utils/tokenManager';

// Configuration - where our backend lives
const API_BASE_URL = 'http://localhost:8000';

class ProfileService {
  /**
   * 👤 Get current user info (from backend using stored token)
   */
  async getCurrentUser(): Promise<any> {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: tokenManager.getAuthHeaders(),
    });

    if (!response.ok) {
      // If unauthorized, clear the token
      if (response.status === 401) {
        tokenManager.clearToken();
        throw new Error('Authentication expired. Please login again.');
      }
      throw new Error('Failed to get user information');
    }

    return response.json();
  }

  /**
   * 📝 Update user profile (including password change)
   */
  async updateProfile(updateData: {
    full_name?: string;
    email?: string;
    profile_picture_url?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<any> {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: tokenManager.getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          tokenManager.clearToken();
          throw new Error('Authentication expired. Please login again.');
        }
        
        const errorData = await response.json();
        const errorMessage = errorData.detail?.message || errorData.detail || 'Profile update failed';
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during profile update');
    }
  }

  /**
   * 🔐 Change password only (dedicated method)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: tokenManager.getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          tokenManager.clearToken();
          throw new Error('Authentication expired. Please login again.');
        }
        
        const errorData = await response.json();
        const errorMessage = errorData.detail?.message || errorData.detail || 'Password change failed';
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during password change');
    }
  }
}

// Export a single instance
export const profileService = new ProfileService();
