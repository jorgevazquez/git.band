const fs = require('fs');

const tests = [];

// Test 1: content.json has release data
try {
  const content = JSON.parse(fs.readFileSync('content.json', 'utf8'));
  if (content.releases && content.releases[0].tracks) {
    tests.push(`PASS: content.json has ${content.releases[0].tracks.length} tracks in "${content.releases[0].title}"`);
  }
} catch (e) {
  tests.push(`FAIL: content.json - ${e.message}`);
}

// Test 2: HTML has flip card classes
try {
  const html = fs.readFileSync('index.html', 'utf8');
  const hasFlipCSS = html.includes('release-card-front') && html.includes('release-card-back');
  const hasFlipJS = html.includes('is-flipped') && html.includes('setupReleaseCardListeners');
  const hasAudio = html.includes('currentAudio') && html.includes('playNextTrack');
  
  if (hasFlipCSS) tests.push('PASS: Flip card CSS classes present');
  if (hasFlipJS) tests.push('PASS: Flip card JavaScript logic present');
  if (hasAudio) tests.push('PASS: Audio playback logic present');
  
  if (html.includes('play-overlay')) tests.push('PASS: Play overlay button present');
  if (html.includes('track-btn')) tests.push('PASS: Track control buttons present');
  if (html.includes('releases-section')) tests.push('PASS: Centered releases section present');
} catch (e) {
  tests.push(`FAIL: index.html - ${e.message}`);
}

tests.forEach(t => console.log(t));
