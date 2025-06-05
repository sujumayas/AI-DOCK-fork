// 🧪 Admin Service Test
// Quick test to verify our admin service works with the backend

import { adminService } from '../services/adminService';

async function testAdminService() {
  console.log('🧪 Testing Admin Service...');
  
  try {
    // Test 1: Get user statistics (basic test)
    console.log('📊 Testing getUserStatistics...');
    const stats = await adminService.getUserStatistics();
    console.log('✅ Statistics retrieved:', stats);
    
    // Test 2: Search users with default filters
    console.log('🔍 Testing searchUsers...');
    const users = await adminService.searchUsers({
      page: 1,
      page_size: 5
    });
    console.log('✅ Users retrieved:', users);
    
    console.log('🎉 All tests passed! Admin service is working.');
    
  } catch (error) {
    console.error('❌ Admin service test failed:', error);
    console.log('Make sure your backend is running on http://localhost:8000');
    console.log('And that you are logged in as an admin user.');
  }
}

// Export for manual testing in browser console
(window as any).testAdminService = testAdminService;

export { testAdminService };
