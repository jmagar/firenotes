import { describe, expect, it } from 'vitest';
import { __doctorTestables, createDoctorCommand } from '../../commands/doctor';

describe('doctor helpers', () => {
  it('parses docker compose JSON lines and skips malformed rows', () => {
    const output = [
      '{"Service":"firecrawl","State":"running","Health":"healthy"}',
      'not-json',
      '{"Service":"firecrawl-redis","State":"running","Health":"healthy"}',
    ].join('\n');

    const parsed = __doctorTestables.parseComposePsJson(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].Service).toBe('firecrawl');
    expect(parsed[1].Service).toBe('firecrawl-redis');
  });

  it('parses valid service URL and rejects invalid URL', () => {
    const parsed = __doctorTestables.parseServiceUrl(
      'REDIS_URL',
      'redis://firecrawl-redis:53379'
    );
    expect(parsed).toBeTruthy();
    expect(parsed?.protocol).toBe('redis');
    expect(parsed?.host).toBe('firecrawl-redis');
    expect(parsed?.port).toBe(53379);

    const invalid = __doctorTestables.parseServiceUrl('BROKEN', ':::');
    expect(invalid).toBeNull();
  });

  it('resolves docker service host to localhost published port', () => {
    const endpoint = __doctorTestables.parseServiceUrl(
      'REDIS_URL',
      'redis://firecrawl-redis:53379'
    );
    expect(endpoint).toBeTruthy();

    const portMap = new Map<string, Map<number, number>>([
      ['firecrawl-redis', new Map([[53379, 53379]])],
    ]);

    if (!endpoint) throw new Error('Expected endpoint to be truthy');
    const resolved = __doctorTestables.resolveEndpoint(endpoint, portMap);
    expect(resolved.resolution).toBe('compose-published-port');
    expect(resolved.resolvedHost).toBe('localhost');
    expect(resolved.resolvedPort).toBe(53379);
  });

  it('marks endpoint unreachable when compose service port is not published', () => {
    const endpoint = __doctorTestables.parseServiceUrl(
      'REDIS_URL',
      'redis://firecrawl-redis:53379'
    );
    expect(endpoint).toBeTruthy();

    const portMap = new Map<string, Map<number, number>>([
      ['firecrawl-redis', new Map([[6379, 53379]])],
    ]);

    if (!endpoint) throw new Error('Expected endpoint to be truthy');
    const resolved = __doctorTestables.resolveEndpoint(endpoint, portMap);
    expect(resolved.resolution).toBe('host-unreachable');
    expect(resolved.reason).toContain('No published port');
  });

  it('formats human output with title, summary, legend, and freshness', () => {
    const output = __doctorTestables.formatDoctorHuman(
      {
        timestamp: '2026-02-13T19:42:10.000Z',
        overallStatus: 'failed',
        summary: { pass: 1, warn: 1, fail: 1 },
        checks: [
          {
            category: 'services',
            name: 'QDRANT_URL',
            status: 'fail',
            message: 'Unreachable (connect ECONNREFUSED)',
          },
          {
            category: 'docker',
            name: 'firecrawl',
            status: 'pass',
            message: 'Container running (healthy)',
          },
          {
            category: 'directories',
            name: 'FIRECRAWL_HOME',
            status: 'warn',
            message: 'Path not configured',
          },
        ],
      },
      { timeout: 4500 }
    );

    expect(output).toContain('Doctor Checks');
    expect(output).toContain('Overall: failed');
    expect(output).toContain('Legend:');
    expect(output).toContain('Filters: timeout_ms=4500');
    expect(output).toContain('As of (EST):');
    expect(output).toContain('✗ fail');
    expect(output).toContain('⚠ warn');
    expect(output).toContain('✓ pass');
  });

  it('omits legend when all checks share one state', () => {
    const output = __doctorTestables.formatDoctorHuman({
      timestamp: '2026-02-13T19:42:10.000Z',
      overallStatus: 'ok',
      summary: { pass: 2, warn: 0, fail: 0 },
      checks: [
        {
          category: 'services',
          name: 'QDRANT_URL',
          status: 'pass',
          message: 'Reachable (200)',
        },
      ],
    });

    expect(output).not.toContain('Legend:');
  });
});

describe('createDoctorCommand', () => {
  it('exposes expected flags in help output', () => {
    const help = createDoctorCommand().helpInformation();
    expect(help).toContain('--json');
    expect(help).toContain('--pretty');
    expect(help).toContain('--timeout');
    expect(help).toContain('debug');
  });
});
