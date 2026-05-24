/**
 * Custom Jest reporter that prints how long each test file took, sorted
 * slowest-first. Runs alongside Jest's default reporter.
 *
 * Wired up in jest.config.js via:
 *   reporters: ['default', '<rootDir>/tests/timing-reporter.cjs']
 */
const path = require('path');

class TimingReporter {
  onRunComplete(_contexts, results) {
    const rows = results.testResults
      .map((r) => ({
        file: path.relative(process.cwd(), r.testFilePath).replace(/\\/g, '/'),
        ms: r.perfStats.runtime,
        tests: r.numPassingTests + r.numFailingTests + r.numPendingTests,
        failed: r.numFailingTests,
      }))
      .sort((a, b) => b.ms - a.ms);

    const totalMs = rows.reduce((s, r) => s + r.ms, 0);
    const fileW = Math.max(4, ...rows.map((r) => r.file.length));
    const msW = Math.max(8, ...rows.map((r) => `${r.ms} ms`.length));
    const testW = Math.max(5, ...rows.map((r) => `${r.tests}`.length));

    const pad = (s, w) => String(s).padStart(w);
    const padR = (s, w) => String(s).padEnd(w);

    console.log('');
    console.log('── Per-file test timings (slowest first) ─────────────────');
    console.log(
      `  ${padR('FILE', fileW)}  ${pad('TIME', msW)}  ${pad('TESTS', testW)}`,
    );
    for (const r of rows) {
      const marker = r.failed > 0 ? ' ✖' : '';
      console.log(
        `  ${padR(r.file, fileW)}  ${pad(`${r.ms} ms`, msW)}  ${pad(r.tests, testW)}${marker}`,
      );
    }
    console.log(`  ${padR('TOTAL (sum of files)', fileW)}  ${pad(`${totalMs} ms`, msW)}`);
    console.log('');
  }
}

module.exports = TimingReporter;
