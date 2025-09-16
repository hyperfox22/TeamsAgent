#!/usr/bin/env node
/**
 * SOCBot Integration Test Runner
 * Simple Node.js script to test the integration components
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 SOCBot Integration Test Runner');
console.log('='.repeat(50));

/**
 * Test environment variables
 */
function testEnvironmentVariables() {
  console.log('📋 Testing Environment Variables...');
  
  const requiredEnvVars = [
    'PROJECT_CONNECTION_STRING',
    'AGENT_ID', 
    'MicrosoftAppId',
    'MicrosoftAppPassword',
    'M365_CLIENT_ID',
    'M365_TENANT_ID'
  ];

  const results = {
    present: [],
    missing: []
  };

  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      results.present.push(envVar);
      console.log(`   ✅ ${envVar}: ***`);
    } else {
      results.missing.push(envVar);
      console.log(`   ❌ ${envVar}: NOT SET`);
    }
  });

  console.log(`\n📊 Summary: ${results.present.length}/${requiredEnvVars.length} configured\n`);
  
  return results.missing.length === 0;
}

/**
 * Test project structure
 */
function testProjectStructure() {
  console.log('📁 Testing Project Structure...');
  
  const requiredFiles = [
    'src/httpTrigger.ts',
    'src/teamsBot.ts',
    'src/agentConnector.ts',
    'src/internal/initialize.ts',
    'src/internal/messageHandler.ts',
    'src/adaptiveCards/notification-default.json',
    'infra/azure.bicep',
    'infra/azure.parameters.json',
    'appPackage/manifest.json',
    'package.json',
    'host.json',
    'local.settings.json'
  ];

  const results = {
    found: [],
    missing: []
  };

  requiredFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      results.found.push(filePath);
      console.log(`   ✅ ${filePath}`);
    } else {
      results.missing.push(filePath);
      console.log(`   ❌ ${filePath}: MISSING`);
    }
  });

  console.log(`\n📊 Summary: ${results.found.length}/${requiredFiles.length} files found\n`);
  
  return results.missing.length === 0;
}

/**
 * Test package.json dependencies
 */
function testDependencies() {
  console.log('📦 Testing Dependencies...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = [
      '@azure/functions',
      '@azure/ai-projects',
      '@azure/identity',
      'botbuilder',
      '@microsoft/agents-hosting',
      'typescript',
      'adaptivecards-templating'
    ];

    const results = {
      found: [],
      missing: []
    };

    requiredDeps.forEach(dep => {
      if (dependencies[dep]) {
        results.found.push(`${dep}@${dependencies[dep]}`);
        console.log(`   ✅ ${dep}: ${dependencies[dep]}`);
      } else {
        results.missing.push(dep);
        console.log(`   ❌ ${dep}: NOT INSTALLED`);
      }
    });

    console.log(`\n📊 Summary: ${results.found.length}/${requiredDeps.length} dependencies found\n`);
    
    return results.missing.length === 0;

  } catch (error) {
    console.log(`   ❌ Error reading package.json: ${error.message}\n`);
    return false;
  }
}

/**
 * Test TypeScript compilation
 */
function testTypeScriptCompilation() {
  console.log('🔨 Testing TypeScript Compilation...');
  
  return new Promise((resolve) => {
    exec('npm run build', (error, stdout, stderr) => {
      if (error) {
        console.log(`   ❌ TypeScript compilation failed:`);
        console.log(`   ${error.message}`);
        if (stderr) {
          console.log(`   ${stderr}`);
        }
        console.log('');
        resolve(false);
      } else {
        console.log(`   ✅ TypeScript compilation successful`);
        if (stdout) {
          console.log(`   ${stdout.trim()}`);
        }
        console.log('');
        resolve(true);
      }
    });
  });
}

/**
 * Test adaptive card template validity
 */
function testAdaptiveCardTemplate() {
  console.log('🎨 Testing Adaptive Card Template...');
  
  try {
    const cardPath = 'src/adaptiveCards/notification-default.json';
    const cardContent = fs.readFileSync(cardPath, 'utf8');
    const card = JSON.parse(cardContent);
    
    const checks = {
      hasType: card.type === 'AdaptiveCard',
      hasVersion: !!card.version,
      hasBody: Array.isArray(card.body) && card.body.length > 0,
      hasActions: Array.isArray(card.actions) && card.actions.length > 0,
      hasTemplating: cardContent.includes('${')
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });

    const allPassed = Object.values(checks).every(Boolean);
    console.log(`\n📊 Card validation: ${allPassed ? 'PASSED' : 'FAILED'}\n`);
    
    return allPassed;

  } catch (error) {
    console.log(`   ❌ Error validating adaptive card: ${error.message}\n`);
    return false;
  }
}

/**
 * Test Bicep template syntax
 */
function testBicepTemplate() {
  console.log('🏗️  Testing Bicep Template...');
  
  return new Promise((resolve) => {
    exec('az bicep build --file infra/azure.bicep --stdout', (error, stdout, stderr) => {
      if (error) {
        console.log(`   ❌ Bicep template validation failed:`);
        console.log(`   ${error.message}`);
        if (stderr) {
          console.log(`   ${stderr}`);
        }
        console.log('');
        resolve(false);
      } else {
        console.log(`   ✅ Bicep template is valid`);
        try {
          const template = JSON.parse(stdout);
          console.log(`   📊 Resources: ${template.resources?.length || 0}`);
          console.log(`   📊 Outputs: ${Object.keys(template.outputs || {}).length}`);
        } catch (parseError) {
          console.log(`   ⚠️  Could not parse template output`);
        }
        console.log('');
        resolve(true);
      }
    });
  });
}

/**
 * Test Teams app manifest
 */
function testTeamsManifest() {
  console.log('🤖 Testing Teams App Manifest...');
  
  try {
    const manifestPath = 'appPackage/manifest.json';
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    const checks = {
      hasVersion: !!manifest.version,
      hasId: !!manifest.id,
      hasName: !!manifest.name?.short,
      hasBot: !!manifest.bots && manifest.bots.length > 0,
      hasBotId: !!manifest.bots?.[0]?.botId,
      hasScopes: !!manifest.bots?.[0]?.scopes && manifest.bots[0].scopes.length > 0,
      hasValidPermissions: !!manifest.permissions
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });

    const allPassed = Object.values(checks).every(Boolean);
    console.log(`\n📊 Manifest validation: ${allPassed ? 'PASSED' : 'FAILED'}\n`);
    
    return allPassed;

  } catch (error) {
    console.log(`   ❌ Error validating Teams manifest: ${error.message}\n`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Running SOCBot Integration Tests...\n');
  
  const tests = [
    { name: 'Environment Variables', fn: testEnvironmentVariables },
    { name: 'Project Structure', fn: testProjectStructure },
    { name: 'Dependencies', fn: testDependencies },
    { name: 'TypeScript Compilation', fn: testTypeScriptCompilation },
    { name: 'Adaptive Card Template', fn: testAdaptiveCardTemplate },
    { name: 'Bicep Template', fn: testBicepTemplate },
    { name: 'Teams Manifest', fn: testTeamsManifest }
  ];

  const results = [];
  
  for (const test of tests) {
    const startTime = Date.now();
    const passed = await test.fn();
    const duration = Date.now() - startTime;
    
    results.push({
      name: test.name,
      passed,
      duration
    });
  }

  // Print summary
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log('='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   • ${r.name}`);
    });
  }

  console.log('='.repeat(50));

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  testEnvironmentVariables,
  testProjectStructure,
  testDependencies,
  testAdaptiveCardTemplate,
  testTeamsManifest,
  runAllTests
};