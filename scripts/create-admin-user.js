/**
 * Create Admin User Script
 * Creates ritho@ralls as admin user via API
 */

const API_BASE = 'http://localhost:3001';

async function createAdminUser() {
  console.log('🔧 Creating admin user: ritho@ralls');
  
  try {
    // Step 1: Create user via Supabase Auth
    const response = await fetch(`${API_BASE}/api/test-auth/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ritho@ralls',
        password: 'admin123',  // Change this to a secure password
        isAdmin: true,
        username: 'admin_ritho',
        displayName: 'Ritho Admin',
        bankroll: 10000,
        subscriptionTier: 'admin'
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', result.user.email);
      console.log('👤 Username:', result.profile.username);
      console.log('🔑 Admin Status:', result.profile.is_admin);
      console.log('💰 Bankroll:', result.profile.bankroll);
      console.log('🆔 User ID:', result.user.id);
      
      console.log('\n🎯 Next Steps:');
      console.log('1. Go to your app and sign in with:');
      console.log('   Email: ritho@ralls');
      console.log('   Password: admin123');
      console.log('2. You should see "Admin" in the navigation');
      console.log('3. Click Admin to access the admin panel');
      
      return result;
    } else {
      console.error('❌ Failed to create admin user:', result);
      
      if (result.error && result.error.includes('already registered')) {
        console.log('\n🔄 User already exists, trying to make them admin...');
        return await makeExistingUserAdmin();
      }
      
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    return null;
  }
}

async function makeExistingUserAdmin() {
  try {
    // First, get the user ID
    const searchResponse = await fetch(`${API_BASE}/api/users/search?email=ritho@ralls`);
    const searchResult = await searchResponse.json();
    
    if (!searchResult.success || !searchResult.user) {
      console.error('❌ Could not find existing user');
      return null;
    }
    
    const userId = searchResult.user.id;
    console.log('👤 Found existing user:', userId);
    
    // Make them admin
    const adminResponse = await fetch(`${API_BASE}/api/simple-user/${userId}/admin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isAdmin: true,
        username: 'admin_ritho',
        displayName: 'Ritho Admin',
        subscriptionTier: 'admin'
      })
    });
    
    const adminResult = await adminResponse.json();
    
    if (adminResponse.ok && adminResult.success) {
      console.log('✅ Existing user made admin successfully!');
      console.log('👤 Username:', adminResult.profile.username);
      console.log('🔑 Admin Status:', adminResult.profile.is_admin);
      return adminResult;
    } else {
      console.error('❌ Failed to make user admin:', adminResult);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error making user admin:', error.message);
    return null;
  }
}

async function verifyAdminAccess(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/simple-user/${userId}/profile`);
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('\n✅ Admin verification:');
      console.log('📧 Email:', result.profile.email);
      console.log('👤 Username:', result.profile.username);
      console.log('🔑 Is Admin:', result.profile.is_admin);
      console.log('💰 Bankroll:', result.profile.bankroll);
      
      if (result.profile.is_admin) {
        console.log('🎉 SUCCESS: ritho@ralls is now an admin!');
      } else {
        console.log('⚠️  WARNING: User exists but is not admin');
      }
    }
  } catch (error) {
    console.error('❌ Error verifying admin:', error.message);
  }
}

// Run the script
(async () => {
  console.log('🚀 Starting admin user creation...\n');
  
  const result = await createAdminUser();
  
  if (result && result.user) {
    await verifyAdminAccess(result.user.id);
  }
  
  console.log('\n✨ Script completed!');
})();
