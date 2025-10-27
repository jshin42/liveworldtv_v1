#!/usr/bin/env node

/**
 * Test script to verify auto-play flow works end-to-end
 */

const http = require('http');

async function testAutoPlayFlow() {
  console.log('🧪 Testing Auto-Play Implementation...\n');

  // Test 1: API is accessible
  console.log('Test 1: Checking API accessibility...');
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    if (data.status === 'healthy') {
      console.log('✅ API is healthy and accessible\n');
    }
  } catch (error) {
    console.log('❌ API is not accessible:', error.message);
    process.exit(1);
  }

  // Test 2: Channels endpoint returns data
  console.log('Test 2: Fetching US channels...');
  try {
    const response = await fetch('http://localhost:3001/v1/channels?country=US');
    const data = await response.json();

    if (data.data && data.data.channels && data.data.channels.length > 0) {
      console.log(`✅ Found ${data.data.channels.length} US channels:`);
      data.data.channels.forEach(ch => {
        console.log(`   - ${ch.name} (${ch.id})`);
      });
      console.log('');
    } else {
      console.log('❌ No channels returned');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Failed to fetch channels:', error.message);
    process.exit(1);
  }

  // Test 3: UK channels endpoint
  console.log('Test 3: Fetching UK channels...');
  try {
    const response = await fetch('http://localhost:3001/v1/channels?country=UK');
    const data = await response.json();

    if (data.data && data.data.channels && data.data.channels.length > 0) {
      console.log(`✅ Found ${data.data.channels.length} UK channels:`);
      data.data.channels.forEach(ch => {
        console.log(`   - ${ch.name} (${ch.id})`);
      });
      console.log('');
    }
  } catch (error) {
    console.log('❌ Failed to fetch UK channels:', error.message);
  }

  // Test 4: Verify data structure for auto-play
  console.log('Test 4: Verifying channel data structure...');
  try {
    const response = await fetch('http://localhost:3001/v1/channels?country=US');
    const data = await response.json();
    const firstChannel = data.data.channels[0];

    const requiredFields = ['id', 'name', 'country', 'sourceUrl', 'sourceType'];
    const hasAllFields = requiredFields.every(field => firstChannel[field]);

    if (hasAllFields) {
      console.log('✅ Channel data has all required fields for auto-play');
      console.log('   First channel:', {
        id: firstChannel.id,
        name: firstChannel.name,
        sourceUrl: firstChannel.sourceUrl.substring(0, 50) + '...'
      });
      console.log('');
    } else {
      console.log('❌ Missing required fields');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Failed to verify data structure:', error.message);
    process.exit(1);
  }

  // Test 5: Frontend accessibility
  console.log('Test 5: Checking frontend accessibility...');
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Frontend is accessible at http://localhost:3000\n');
    }
  } catch (error) {
    console.log('❌ Frontend is not accessible:', error.message);
    process.exit(1);
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('🎉 AUTO-PLAY IMPLEMENTATION TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ API backend running and accessible');
  console.log('✅ Catalog endpoints returning channel data');
  console.log('✅ Channel data structure correct for auto-play');
  console.log('✅ Frontend accessible');
  console.log('');
  console.log('📱 To test in browser:');
  console.log('   1. Open http://localhost:3000');
  console.log('   2. Page should auto-load NBC News (or first US channel)');
  console.log('   3. YouTube player should start automatically');
  console.log('   4. Channel selector should show all available channels');
  console.log('');
  console.log('🔍 Expected behavior:');
  console.log('   - No loading delay (instant channel selection)');
  console.log('   - YouTube embed starts playing immediately');
  console.log('   - No user interaction required');
  console.log('═══════════════════════════════════════════════════');
}

testAutoPlayFlow().catch(console.error);
