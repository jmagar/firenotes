#!/usr/bin/env node
/**
 * Manual integration test for job history path fix
 * Tests that job history persists across directory changes
 */

const { recordJob, getRecentJobIds } = require('./dist/utils/job-history.js');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

async function test() {
  console.log('=== Job History Path Test ===\n');

  const home = os.homedir();
  const expectedPath = path.join(
    home,
    '.local',
    'share',
    'firecrawl-cli',
    'job-history.json'
  );

  console.log('Expected history path:', expectedPath);
  console.log('Current working directory:', process.cwd());
  console.log();

  // Test 1: Record a job from current directory
  console.log('Test 1: Recording job from', process.cwd());
  await recordJob('crawl', 'test-job-from-original-dir');

  let jobs = await getRecentJobIds('crawl');
  console.log('Recent jobs:', jobs);
  console.log('✓ Job recorded\n');

  // Test 2: Change directory and verify we can still see the job
  const tempDir = '/tmp';
  console.log(`Test 2: Changing to ${tempDir}`);
  process.chdir(tempDir);
  console.log('New working directory:', process.cwd());

  jobs = await getRecentJobIds('crawl');
  console.log('Recent jobs:', jobs);

  if (jobs.includes('test-job-from-original-dir')) {
    console.log('✓ Job persists across directory change\n');
  } else {
    console.log('✗ FAILED: Job not found after directory change\n');
    process.exit(1);
  }

  // Test 3: Record another job from different directory
  console.log('Test 3: Recording job from', process.cwd());
  await recordJob('crawl', 'test-job-from-temp-dir');

  jobs = await getRecentJobIds('crawl');
  console.log('Recent jobs:', jobs);

  if (
    jobs.includes('test-job-from-original-dir') &&
    jobs.includes('test-job-from-temp-dir')
  ) {
    console.log('✓ Both jobs present\n');
  } else {
    console.log('✗ FAILED: Jobs not properly stored\n');
    process.exit(1);
  }

  // Test 4: Verify file location
  console.log('Test 4: Verifying file location');
  const fileExists = fs.existsSync(expectedPath);
  console.log('File exists at expected path:', fileExists);

  if (fileExists) {
    const content = fs.readFileSync(expectedPath, 'utf-8');
    const data = JSON.parse(content);
    console.log('File contents:', JSON.stringify(data, null, 2));
    console.log('✓ File at correct location\n');
  } else {
    console.log('✗ FAILED: File not at expected location\n');
    process.exit(1);
  }

  console.log('=== All Tests Passed ===');
}

test().catch(console.error);
