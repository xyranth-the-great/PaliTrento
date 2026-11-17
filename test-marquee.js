// Test script for marquee logic verification
// Simulates the rebuildLoop logic

const SLIDE_WIDTH = 284; // slide width including padding (260px card + 12px + 12px padding)
const GAP = 0; // track gap is 0, gap is in slide padding

function calculateTotalSets(viewportWidth, slideCount) {
  const setWidth = slideCount * SLIDE_WIDTH;
  if (setWidth <= 0 || viewportWidth <= 0) return 0;
  const totalSets = Math.ceil(viewportWidth / setWidth) + 1;
  return totalSets;
}

function calculateDuration(setWidth) {
  return (setWidth / 60).toFixed(2);
}

// Test cases from step 9
const testCases = [
  { stores: 5, viewport: 1905, label: '5 stores @ 1905px' },
  { stores: 5, viewport: 1440, label: '5 stores @ 1440px' },
  { stores: 5, viewport: 1024, label: '5 stores @ 1024px' },
  { stores: 5, viewport: 768, label: '5 stores @ 768px' },
  { stores: 5, viewport: 375, label: '5 stores @ 375px' },
  { stores: 6, viewport: 1905, label: '6 stores @ 1905px' },
  { stores: 6, viewport: 1440, label: '6 stores @ 1440px' },
  { stores: 6, viewport: 1024, label: '6 stores @ 1024px' },
  { stores: 6, viewport: 768, label: '6 stores @ 768px' },
  { stores: 6, viewport: 375, label: '6 stores @ 375px' },
  { stores: 12, viewport: 1905, label: '12 stores @ 1905px' },
  { stores: 12, viewport: 1440, label: '12 stores @ 1440px' },
  { stores: 12, viewport: 1024, label: '12 stores @ 1024px' },
  { stores: 12, viewport: 768, label: '12 stores @ 768px' },
  { stores: 12, viewport: 375, label: '12 stores @ 375px' },
];

console.log('=== Marquee Logic Test Results ===\n');
console.log('Slide width:', SLIDE_WIDTH, 'px');
console.log('Track gap:', GAP, 'px (gap is in slide padding)');
console.log('Speed: 60 px/sec');
console.log('');

testCases.forEach(tc => {
  const totalSets = calculateTotalSets(tc.viewport, tc.stores);
  const setWidth = tc.stores * SLIDE_WIDTH;
  const duration = calculateDuration(setWidth);
  const trackWidth = totalSets * setWidth;
  const coverage = trackWidth - setWidth; // viewport + one set should be covered
  const passesAssert = coverage >= tc.viewport;

  console.log(`${tc.label}:`);
  console.log(`  setWidth: ${setWidth}px (${tc.stores} × ${SLIDE_WIDTH})`);
  console.log(`  viewportWidth: ${tc.viewport}px`);
  console.log(`  totalSets: ${totalSets} (ceil(${tc.viewport}/${setWidth}) + 1 = ${Math.ceil(tc.viewport/setWidth)} + 1)`);
  console.log(`  clonesNeeded: ${totalSets - 1}`);
  console.log(`  trackWidth: ${trackWidth}px (${totalSets} × ${setWidth})`);
  console.log(`  duration: ${duration}s (${setWidth}/60)`);
  console.log(`  coverage (trackWidth - setWidth): ${coverage}px`);
  console.log(`  viewport covered: ${coverage >= tc.viewport ? 'YES ✅' : 'NO ❌'} (need ≥ ${tc.viewport}px)`);
  console.log(`  assert (trackWidth - setWidth >= viewportWidth): ${passesAssert ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('');
});

console.log('=== Summary Table ===');
console.log('| Stores | Viewport | setWidth | totalSets | clones | duration | Assert |');
console.log('|--------|----------|----------|-----------|--------|----------|--------|');
testCases.forEach(tc => {
  const totalSets = calculateTotalSets(tc.viewport, tc.stores);
  const setWidth = tc.stores * SLIDE_WIDTH;
  const duration = calculateDuration(setWidth);
  const trackWidth = totalSets * setWidth;
  const passesAssert = (trackWidth - setWidth) >= tc.viewport;
  console.log(`| ${tc.stores} | ${tc.viewport}px | ${setWidth}px | ${totalSets} | ${totalSets-1} | ${duration}s | ${passesAssert ? 'PASS' : 'FAIL'} |`);
});