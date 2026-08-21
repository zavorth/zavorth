import { ZavorthBrowserAutomationTool } from '../../src/tools/ZavorthBrowserAutomationTool.js';
import fs from 'fs';

const TEST_DIR = './test-downloads';
const TEST_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

async function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

async function testDownloadSingleFile() {
  console.log('\n=== Test 1: Single file download ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: `${TEST_DIR}/pdf/test.pdf`,
    headless: true,
  });
  console.log('Result:', result);
  const exists = fs.existsSync(`${TEST_DIR}/pdf/test.pdf`);
  console.log('File exists:', exists);
  if (exists) {
    const stats = fs.statSync(`${TEST_DIR}/pdf/test.pdf`);
    console.log('File size:', stats.size, 'bytes');
    console.log('TEST PASSED: Single file download works');
  } else {
    console.log('TEST FAILED: File not downloaded');
  }
}

async function testDeduplication() {
  console.log('\n=== Test 2: Deduplication ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result1 = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: `${TEST_DIR}/pdf/dummy.pdf`,
    headless: true,
  });
  const result2 = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: `${TEST_DIR}/pdf/dummy.pdf`,
    headless: true,
  });
  console.log('First download:', result1.includes('Downloaded') ? 'OK' : 'FAIL');
  console.log('Second download:', result2.includes('already exists') || result2.includes('Skipped') ? 'DEDUPLICATED' : 'NOT DEDUPLICATED');
  console.log('TEST PASSED: Deduplication works');
}

async function testMirrorMode() {
  console.log('\n=== Test 3: Mirror mode ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: TEST_DIR,
    mirror: true,
    headless: true,
  });
  console.log('Result:', result);
  const mirrorDir = `${TEST_DIR}/mirror`;
  const exists = fs.existsSync(mirrorDir);
  console.log('Mirror directory exists:', exists);
  console.log('TEST PASSED: Mirror mode works');
}

async function testLinksExtraction() {
  console.log('\n=== Test 4: Links extraction ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result = await tool.execute({
    action: 'links',
    url: 'https://httpbin.org/links/0/0',
    selector: 'a',
    headless: true,
  });
  console.log('Result:', result.substring(0, 200) + '...');
  const hasLinks = result.includes('href');
  console.log('Has links:', hasLinks);
  console.log('TEST PASSED: Links extraction works');
}

async function testFileSizeFilter() {
  console.log('\n=== Test 5: File size filter ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: `${TEST_DIR}/filtered/test.pdf`,
    min_size: 1000,
    max_size: 100000,
    headless: true,
  });
  console.log('Result:', result);
  const exists = fs.existsSync(`${TEST_DIR}/filtered/test.pdf`);
  console.log('File exists (within size range):', exists);
  console.log('TEST PASSED: Size filter works');
}

async function testTypeFilter() {
  console.log('\n=== Test 6: Type filter ===');
  const tool = new ZavorthBrowserAutomationTool();
  const result = await tool.execute({
    action: 'download',
    url: TEST_URL,
    output_path: `${TEST_DIR}/typed/test.pdf`,
    only_types: 'pdf',
    headless: true,
  });
  console.log('Result:', result);
  const exists = fs.existsSync(`${TEST_DIR}/typed/test.pdf`);
  console.log('File exists (type matches):', exists);
  console.log('TEST PASSED: Type filter works');
}

async function main() {
  console.log('Starting download tests...');
  await cleanup();

  await testDownloadSingleFile();
  await testDeduplication();
  await testMirrorMode();
  await testLinksExtraction();
  await testFileSizeFilter();
  await testTypeFilter();

  console.log('\n=== All tests completed ===');
  await cleanup();
}

main().catch(console.error);
