require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWebhookData() {
  try {
    console.log('Checking webhook test data...');
    
    // Check user profiles
    console.log('\n1. Checking user_profiles...');
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', 'user_test_123456');
    
    if (profileError) {
      console.error('❌ Profile error:', profileError);
    } else {
      console.log('✅ User profiles found:', profiles.length);
      if (profiles.length > 0) {
        console.log('   Profile:', profiles[0]);
      }
    }

    // Check organizations
    console.log('\n2. Checking organizations...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', 'user_test_123456');
    
    if (orgError) {
      console.error('❌ Organization error:', orgError);
    } else {
      console.log('✅ Organizations found:', orgs.length);
      if (orgs.length > 0) {
        console.log('   Organization:', orgs[0]);
      }
    }

    // Check teams
    if (orgs && orgs.length > 0) {
      console.log('\n3. Checking teams...');
      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', orgs[0].id);
      
      if (teamError) {
        console.error('❌ Team error:', teamError);
      } else {
        console.log('✅ Teams found:', teams.length);
        if (teams.length > 0) {
          console.log('   Team:', teams[0]);
        }
      }

      // Check team members
      console.log('\n4. Checking team_members...');
      const { data: members, error: memberError } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', 'user_test_123456');
      
      if (memberError) {
        console.error('❌ Team member error:', memberError);
      } else {
        console.log('✅ Team members found:', members.length);
        if (members.length > 0) {
          console.log('   Member:', members[0]);
        }
      }
    }

    // Check all user profiles to see if any exist
    console.log('\n5. Checking all user_profiles...');
    const { data: allProfiles, error: allProfileError } = await supabase
      .from('user_profiles')
      .select('clerk_user_id, email, first_name, last_name, created_at')
      .limit(10);
    
    if (allProfileError) {
      console.error('❌ All profiles error:', allProfileError);
    } else {
      console.log('✅ Total user profiles in database:', allProfiles.length);
      allProfiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.first_name} ${profile.last_name} (${profile.email}) - ${profile.clerk_user_id}`);
      });
    }

    // Check all organizations
    console.log('\n6. Checking all organizations...');
    const { data: allOrgs, error: allOrgError } = await supabase
      .from('organizations')
      .select('id, name, slug, owner_id, created_at')
      .limit(10);
    
    if (allOrgError) {
      console.error('❌ All organizations error:', allOrgError);
    } else {
      console.log('✅ Total organizations in database:', allOrgs.length);
      allOrgs.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (${org.slug}) - Owner: ${org.owner_id}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

checkWebhookData();
