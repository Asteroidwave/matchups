/**
 * Quick script to get admin JWT token from browser
 * Run this in browser console while logged in as admin
 * 
 * Or copy this code into browser console:
 */

// Option 1: Using Supabase client (if available)
(async () => {
  try {
    // Import Supabase client dynamically
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    // Get from localStorage
    const supabaseUrl = localStorage.getItem('sb-' + window.location.hostname.split('.')[0] + '-auth-token');
    if (!supabaseUrl) {
      console.error('No Supabase token found in localStorage');
      return;
    }
    
    // Parse token
    const tokenData = JSON.parse(supabaseUrl);
    const accessToken = tokenData?.access_token;
    
    if (accessToken) {
      console.log('✅ Admin Token:');
      console.log(accessToken);
      console.log('\n📋 Copy this token and use it in your tests');
    } else {
      console.error('❌ No access token found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();

// Option 2: Direct localStorage access
(() => {
  const keys = Object.keys(localStorage);
  const authKey = keys.find(k => k.includes('auth-token'));
  
  if (authKey) {
    const tokenData = JSON.parse(localStorage.getItem(authKey));
    const accessToken = tokenData?.access_token;
    
    if (accessToken) {
      console.log('✅ Admin Token:');
      console.log(accessToken);
      console.log('\n📋 Copy this token');
      console.log('\n📝 Add to backend/.env:');
      console.log(`TEST_ADMIN_TOKEN=${accessToken}`);
    }
  }
})();

