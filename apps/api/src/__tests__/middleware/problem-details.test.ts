import { describe, it, expect, vi } from 'vitest';
import { logger } from '@sonora/shared';
import {
  HTTP,
  ERRORS,
  ERRORS_5XX,
  ERRORS_4XX,
  type ErrorConstant,
  type ProblemDetails,
  problem,
  success,
  created,
  streamResponse,
  rangeNotSatisfiable,
} from '../../middleware/problem-details';

// ── HTTP constants ─────────────────────────────────────────

describe('HTTP constants', () => {
  const cases: Array<[string, number]> = [
    ['FOUND', 302],
    ['OK', 200],
    ['PARTIAL_CONTENT', 206],
    ['RANGE_NOT_SATISFIABLE', 416],
    ['BAD_REQUEST', 400],
    ['UNAUTHORIZED', 401],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['UNPROCESSABLE_ENTITY', 422],
    ['INTERNAL_SERVER_ERROR', 500],
  ];

  for (const [name, expected] of cases) {
    it(`HTTP.${name} === ${expected}`, () => {
      expect((HTTP as Record<string, number>)[name]).toBe(expected);
    });
  }
});

// ── ERRORS shape ────────────────────────────────────────────

describe('ERRORS constants', () => {
  it('every error has code, detail, status', () => {
    for (const [key, entry] of Object.entries(ERRORS)) {
      const err = entry as ErrorConstant;
      expect(err.code).toBeTypeOf('string');
      expect(err.detail).toBeTypeOf('string');
      expect(err.status).toBeTypeOf('number');
      const expectedCode =
        key === 'VALIDATION' ? 'VALIDATION_ERROR' : key === 'INTERNAL' ? 'INTERNAL_ERROR' : key;
      expect(err.code).toBe(expectedCode);
    }
  });

  it('5xx errors have generic detail ("An unexpected error occurred")', () => {
    const fiveXxEntries = Object.values(ERRORS).filter((e) => (e as ErrorConstant).status >= 500);
    for (const entry of fiveXxEntries) {
      expect((entry as ErrorConstant).detail).toBe('An unexpected error occurred');
    }
  });

  it('4xx errors have specific, non-generic detail', () => {
    const fourXxEntries = Object.values(ERRORS).filter(
      (e) => (e as ErrorConstant).status >= 400 && (e as ErrorConstant).status < 500,
    );
    for (const entry of fourXxEntries) {
      const detail = (entry as ErrorConstant).detail;
      expect(detail).not.toBe('An unexpected error occurred');
      expect(detail.length).toBeGreaterThan(5);
    }
  });

  it('5xx details are always generic (enforced by type)', () => {
    const internal = ERRORS.INTERNAL;
    expect(internal.detail).toBe('An unexpected error occurred');
    expect(internal.status).toBe(500);
  });

  it('no hardcoded numbers remain in status fields', () => {
    for (const [, entry] of Object.entries(ERRORS)) {
      const status = (entry as ErrorConstant).status;
      expect(Object.values(HTTP)).toContain(status);
    }
  });

  it('ERRORS_5XX contains only 500-level errors', () => {
    for (const [, entry] of Object.entries(ERRORS_5XX)) {
      expect((entry as ErrorConstant).status).toBe(HTTP.INTERNAL_SERVER_ERROR);
    }
  });

  it('ERRORS_4XX contains only 400-level errors', () => {
    for (const [, entry] of Object.entries(ERRORS_4XX)) {
      const status = (entry as ErrorConstant).status;
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    }
  });

  it('ERRORS is the union of ERRORS_5XX and ERRORS_4XX', () => {
    const unionCount = Object.keys(ERRORS_5XX).length + Object.keys(ERRORS_4XX).length;
    expect(Object.keys(ERRORS).length).toBe(unionCount);
  });
});

// ── problem() ───────────────────────────────────────────────

describe('problem()', () => {
  function mockC(jsonFn?: (body: unknown, status: number) => Response) {
    return {
      json: jsonFn ?? vi.fn((body: unknown, _status: number) => body as unknown as Response),
    };
  }

  it('returns the error constant as JSON body', () => {
    const c = mockC();
    const result = problem(c, ERRORS.UNAUTHORIZED);
    const body = result as unknown as { code: string; detail: string; status: number };
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.detail).toBe('Valid authentication is required.');
    expect(body.status).toBe(401);
  });

  it('uses err.status as HTTP response status', () => {
    const json = vi.fn((_body: unknown, status: number) => ({ status }) as unknown as Response);
    const c = mockC(json);
    const result = problem(c, ERRORS.NOT_FOUND) as { status: number };
    expect(json).toHaveBeenCalledWith(expect.anything(), 404);
    expect(result.status).toBe(404);
  });

  it('logs logDetail via logger.error when provided', () => {
    const c = mockC();
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    problem(c, ERRORS.DB_NOT_AVAILABLE, 'Connection pool exhausted');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DB_NOT_AVAILABLE] Connection pool exhausted'),
    );
    spy.mockRestore();
  });

  it('does not log when logDetail is omitted', () => {
    const c = mockC();
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    problem(c, ERRORS.VALIDATION);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes errors array in response body when provided', () => {
    const c = mockC();
    const errors = [{ path: 'message', message: 'must not exceed 10 characters' }];
    const result = problem(c, ERRORS.VALIDATION, undefined, errors);
    const body = result as unknown as ProblemDetails;
    expect(body.errors).toEqual(errors);
  });

  it('does not include errors field when omitted', () => {
    const c = mockC();
    const result = problem(c, ERRORS.INTERNAL);
    const body = result as unknown as ProblemDetails;
    expect(body.errors).toBeUndefined();
  });
});

// ── success() ───────────────────────────────────────────────

describe('success()', () => {
  it('returns data with default 200', () => {
    const json = vi.fn(
      (body: unknown, _status: number) => ({ body, status: _status }) as unknown as Response,
    );
    const c = { json };
    const result = success(c, { items: [1, 2, 3] }) as { status: number; body: unknown };
    expect(json).toHaveBeenCalledWith({ items: [1, 2, 3] }, 200);
    expect(result.status).toBe(200);
  });

  it('returns data with custom status', () => {
    const json = vi.fn(
      (body: unknown, _status: number) => ({ body, status: _status }) as unknown as Response,
    );
    const c = { json };
    const result = success(c, { message: 'created' }, 201) as { status: number };
    expect(json).toHaveBeenCalledWith({ message: 'created' }, 201);
    expect(result.status).toBe(201);
  });
});

// ── created() ───────────────────────────────────────────────

describe('created()', () => {
  it('returns data with 201', () => {
    const json = vi.fn(
      (body: unknown, _status: number) => ({ body, status: _status }) as unknown as Response,
    );
    const c = { json };
    const result = created(c, { id: 'abc' }) as { status: number; body: unknown };
    expect(json).toHaveBeenCalledWith({ id: 'abc' }, 201);
    expect(result.status).toBe(201);
  });
});

// ── streamResponse() ────────────────────────────────────────

describe('streamResponse()', () => {
  it('returns a Response with body, status, headers', () => {
    const body = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const headers = new Headers({ 'Content-Type': 'audio/mpeg' });
    const result = streamResponse(body, HTTP.PARTIAL_CONTENT, headers);
    expect(result.status).toBe(206);
    expect(result.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('accepts null body', () => {
    const headers = new Headers();
    const result = streamResponse(null, 204, headers);
    expect(result.status).toBe(204);
  });
});

// ── rangeNotSatisfiable() ───────────────────────────────────

describe('rangeNotSatisfiable()', () => {
  it('returns 416 with Content-Range header', () => {
    const result = rangeNotSatisfiable(1000);
    expect(result.status).toBe(HTTP.RANGE_NOT_SATISFIABLE);
    expect(result.statusText).toBe('Range Not Satisfiable');
    expect(result.headers.get('Content-Range')).toBe('bytes */1000');
  });
});
