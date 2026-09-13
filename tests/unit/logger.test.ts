import { describe, it, expect, vi } from 'vitest';
import { Logger, LogState } from '../../lib/logger';

describe('Logger', () => {
  it('redacts PII from error logs', () => {
    // Logger uses console.error for errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    Logger.error('Test error', {
      state: LogState.AUTH_FAILED,
      password: 'supersecretpassword123',
      token: 'jwt-token-abcd',
      safeField: 'hello world'
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0][0];
    const logObj = JSON.parse(logCall);
    
    expect(logObj.data.password).toBe('[REDACTED]');
    expect(logObj.data.token).toBe('[REDACTED]');
    expect(logObj.data.safeField).toBe('hello world');
    
    consoleSpy.mockRestore();
  });
});
