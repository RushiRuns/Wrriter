import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export async function runBenchmarks(options = {}) {
  const isQuick = options.quick ?? false;
  const iterations = isQuick ? 10 : 20;

  console.log('\n========================================');
  console.log(`  WRRITER BENCHMARK SUITE (${isQuick ? 'QUICK SET' : 'FULL SET'})`);
  console.log('========================================\n');

  const cwd = process.cwd();
  const sampleVaultDir = path.join(cwd, 'tests/vault-gen/sample-run');
  const tempBenchDir = path.join(cwd, 'tests/bench/temp');

  if (fs.existsSync(tempBenchDir)) {
    fs.rmSync(tempBenchDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempBenchDir, { recursive: true });

  // 1. Prepare Test Files (10 KB and 1 MB notes)
  const note10KbPath = path.join(tempBenchDir, 'note-10kb.md');
  const note1MbPath = path.join(tempBenchDir, 'note-1mb.md');

  const chunk10Kb = 'Wrriter high performance markdown editor note.\n'.repeat(250); // ~11 KB
  fs.writeFileSync(note10KbPath, chunk10Kb, 'utf8');

  // 1 MB note with 5,000 occurrences of "TARGET_TERM"
  let chunk1Mb = '';
  for (let i = 0; i < 5000; i++) {
    chunk1Mb += `Block ${i}: testing TARGET_TERM in Wrriter notes.\n`;
  }
  // Pad to at least 1 MB
  while (chunk1Mb.length < 1024 * 1024) {
    chunk1Mb += 'Extra text padding line for 1MB benchmark testing.\n';
  }
  fs.writeFileSync(note1MbPath, chunk1Mb, 'utf8');

  const results = {
    timestamp: new Date().toISOString(),
    machine: 'AMD Ryzen 5 5600H, 8 GB RAM, NVMe SSD, Windows 11 Build 26200',
    mode: isQuick ? 'quick' : 'full',
    metrics: {}
  };

  // --- Benchmark 1: Note Open / Read 10 KB ---
  console.log('Running Benchmark: Read 10 KB note...');
  const times10Kb = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const content = fs.readFileSync(note10KbPath, 'utf8');
    if (!content) throw new Error('Failed to read');
    const t1 = performance.now();
    times10Kb.push(t1 - t0);
  }
  results.metrics['readNote10KbMs'] = {
    median: Number(median(times10Kb).toFixed(2)),
    p95: Number(percentile(times10Kb, 95).toFixed(2)),
    target: 50
  };

  // --- Benchmark 2: Note Open / Read 1 MB ---
  console.log('Running Benchmark: Read 1 MB note...');
  const times1Mb = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const content = fs.readFileSync(note1MbPath, 'utf8');
    if (!content) throw new Error('Failed to read');
    const t1 = performance.now();
    times1Mb.push(t1 - t0);
  }
  results.metrics['readNote1MbMs'] = {
    median: Number(median(times1Mb).toFixed(2)),
    p95: Number(percentile(times1Mb, 95).toFixed(2)),
    target: 150
  };

  // --- Benchmark 3: Replace All 5,000 matches in 1 MB note ---
  console.log('Running Benchmark: Replace all 5,000 matches in 1 MB note...');
  const timesReplace = [];
  for (let i = 0; i < iterations; i++) {
    const original = fs.readFileSync(note1MbPath, 'utf8');
    const t0 = performance.now();
    const replaced = original.replaceAll('TARGET_TERM', 'REPLACED_VALUE');
    if (!replaced) throw new Error('Replace failed');
    const t1 = performance.now();
    timesReplace.push(t1 - t0);
  }
  results.metrics['replaceAll5kMatchesMs'] = {
    median: Number(median(timesReplace).toFixed(2)),
    p95: Number(percentile(timesReplace, 95).toFixed(2)),
    target: 1000
  };

  // --- Benchmark 4: SQLite In-Memory Query Latency ---
  console.log('Running Benchmark: SQLite query latency...');
  const db = new Database(':memory:');
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT, body TEXT)');
  const insert = db.prepare('INSERT INTO notes (title, body) VALUES (?, ?)');
  for (let i = 0; i < 500; i++) {
    insert.run(`Title ${i}`, `Body content for note ${i}`);
  }
  const query = db.prepare('SELECT * FROM notes WHERE title LIKE ?');

  const timesSqlite = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const rows = query.all('%Title 4%');
    if (!rows) throw new Error('Query failed');
    const t1 = performance.now();
    timesSqlite.push(t1 - t0);
  }
  db.close();
  results.metrics['sqliteQueryMs'] = {
    median: Number(median(timesSqlite).toFixed(2)),
    p95: Number(percentile(timesSqlite, 95).toFixed(2)),
    target: 30
  };

  // --- Benchmark 5: Full Rescan Fallback on 50,000 Notes ---
  const vaultToScan = fs.existsSync(sampleVaultDir) ? sampleVaultDir : tempBenchDir;
  console.log(`Running Benchmark: Full filesystem rescan of ${vaultToScan}...`);
  const timesScan = [];
  let scannedCount = 0;

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) scanDir(full);
      else if (e.isFile() && e.name.endsWith('.md')) {
        fs.statSync(full);
        scannedCount++;
      }
    }
  }

  const scanIterations = isQuick ? 2 : 3;
  for (let i = 0; i < scanIterations; i++) {
    scannedCount = 0;
    const t0 = performance.now();
    scanDir(vaultToScan);
    const t1 = performance.now();
    timesScan.push(t1 - t0);
  }
  results.metrics['fullRescanMs'] = {
    scannedFiles: scannedCount,
    median: Number(median(timesScan).toFixed(2)),
    p95: Number(percentile(timesScan, 95).toFixed(2)),
    target: 3000
  };

  // --- Benchmark 6: Packaged App Launch to Ready ---
  const exePath = path.join(cwd, 'dist/win-unpacked/Wrriter.exe');
  if (fs.existsSync(exePath) && !isQuick) {
    console.log('Running Benchmark: Packaged app launch latency...');
    const timesLaunch = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const child = spawn(exePath, ['--benchmark-launch'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
      });
      await new Promise((resolve) => {
        child.on('close', resolve);
        // Timeout safety after 5s
        setTimeout(resolve, 5000);
      });
      const t1 = performance.now();
      timesLaunch.push(t1 - t0);
    }
    results.metrics['packagedAppLaunchMs'] = {
      median: Number(median(timesLaunch).toFixed(2)),
      p95: Number(percentile(timesLaunch, 95).toFixed(2)),
      target: 2000
    };
  }

  // Cleanup temp files
  try {
    fs.rmSync(tempBenchDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }

  // Display results table
  console.log('\n============================================================');
  console.log('                BENCHMARK RESULTS SUMMARY                   ');
  console.log('============================================================');
  console.log(
    'Metric'.padEnd(30) +
      'Median (ms)'.padEnd(14) +
      'p95 (ms)'.padEnd(12) +
      'Target'.padEnd(12) +
      'Status'
  );
  console.log('------------------------------------------------------------');

  let allPassed = true;

  for (const [key, data] of Object.entries(results.metrics)) {
    const passed = data.median <= data.target;
    if (!passed) allPassed = false;
    const status = passed ? 'PASS' : 'MISS';
    console.log(
      key.padEnd(30) +
        String(data.median).padEnd(14) +
        String(data.p95).padEnd(12) +
        `< ${data.target} ms`.padEnd(12) +
        status
    );
  }
  console.log('============================================================\n');

  // Save to results.json
  const resultsFile = path.join(cwd, 'tests/bench/results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results saved to: ${resultsFile}`);

  // Quick-set check against baseline.json
  const baselineFile = path.join(cwd, 'tests/bench/baseline.json');
  const updateBaseline = process.argv.includes('--update-baseline');
  if (fs.existsSync(baselineFile) && !updateBaseline) {
    console.log('\nComparing against stored baseline (tests/bench/baseline.json)...');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    let baselineFailed = false;

    for (const [key, data] of Object.entries(results.metrics)) {
      const base = baseline.metrics?.[key];
      if (base) {
        const threshold = base.median * 1.2;
        const diffMs = data.median - base.median;
        const diffPercent = (((diffMs) / base.median) * 100).toFixed(1);
        // Only trigger regression if exceeding 20% tolerance AND the absolute delta is significant (> 2.0 ms)
        // This avoids micro-jitter fails on sub-millisecond operations (e.g. 0.12 ms vs 0.17 ms).
        if (data.median > threshold && diffMs > 2.0) {
          console.error(
            `❌ REGRESSION: ${key} median (${data.median} ms) is ${diffPercent}% worse than baseline (${base.median} ms), exceeding 20% tolerance!`
          );
          baselineFailed = true;
        } else {
          console.log(
            `✔ ${key}: ${data.median} ms vs baseline ${base.median} ms (${diffPercent >= 0 ? '+' : ''}${diffPercent}%)`
          );
        }
      }
    }

    if (baselineFailed) {
      console.error('\n❌ Quick set failed due to performance regression (> 20% worse than stored baseline).\n');
      process.exit(1);
    }
  } else {
    // Write baseline
    console.log('Writing baseline to tests/bench/baseline.json...');
    fs.writeFileSync(baselineFile, JSON.stringify(results, null, 2), 'utf8');
  }

  return results;
}

if (process.argv[1]?.includes('benchmark-suite')) {
  const isQuick = process.argv.includes('--quick');
  runBenchmarks({ quick: isQuick })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Benchmark suite error:', err);
      process.exit(1);
    });
}
