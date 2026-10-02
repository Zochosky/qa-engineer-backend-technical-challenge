import { appendFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { z } from 'zod';

const countsSchema = z.object({
  fetched: z.number().int().nonnegative(),
  drafts: z.number().int().nonnegative(),
  nonDrafts: z.number().int().nonnegative(),
}).refine((counts) => counts.fetched === counts.drafts + counts.nonDrafts);

export default class GitHubSummary implements Reporter {
  private suite?: Suite;

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }

  async onEnd(run: FullResult): Promise<{ status: 'failed' } | undefined> {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    const tests = this.suite?.allTests().filter((test) => test.tags.includes('@github-api')) ?? [];
    if (!tests.length) return;

    try {
      const test = tests[0];
      if (tests.length !== 1 || !test) throw new Error('Expected one GitHub API test');
      const context = `Repository: appwrite/appwrite\n\nRun started: ${run.startTime.toISOString()}\n\n`;
      // Do not present partial or failed observations as a valid PR count.
      if (run.status !== 'passed' || test.results.at(-1)?.status !== 'passed' || test.outcome() !== 'expected') {
        appendFileSync(summaryPath, '## PR MONITOR\n\n' + context + 'No confirmed counts: the run did not pass cleanly. See the test logs and HTML report.\n');
        return;
      }
      const annotations = test.annotations.filter((item) => item.type === '_pr-counts');
      if (annotations.length !== 1 || !annotations[0]?.description) {
        throw new Error('Missing or ambiguous PR count data');
      }
      const counts = countsSchema.parse(JSON.parse(annotations[0].description));
      const header = `## PR MONITOR - Open: ${counts.fetched} | Drafts: ${counts.drafts} | Non-draft: ${counts.nonDrafts}\n\n`;
      appendFileSync(summaryPath, header + context + [
        '**Test passed.**',
        '',
        '| Metric | Count |',
        '| --- | ---: |',
        `| Open PRs (including drafts) | ${counts.fetched} |`,
        `| Draft PRs | ${counts.drafts} |`,
        `| Open non-draft PRs | **${counts.nonDrafts}** |`,
        '',
        'Counts describe this run only. Detailed steps are available in the playwright-report artifact.',
        '',
      ].join('\n'));
    } catch (error) {
      console.error('Could not write GitHub Actions summary:', error);
      // Playwright swallows reporter exceptions; explicitly fail incomplete reporting.
      return { status: 'failed' };
    }
  }

  printsToStdio() {
    return false;
  }
}
