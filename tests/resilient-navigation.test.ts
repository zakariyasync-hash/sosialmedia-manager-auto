import { NavigationHelper } from '../src/services/browser/navigation-helper';

describe('REQ-01: Resilient Tiered Navigation Tests', () => {
  it('should export gotoResilient and waitForAnySelector functions', () => {
    expect(typeof NavigationHelper.gotoResilient).toBe('function');
    expect(typeof NavigationHelper.waitForAnySelector).toBe('function');
  });

  it('should identify target selector from mock list', async () => {
    const mockPage: any = {
      locator: (sel: string) => ({
        first: () => ({
          waitFor: async () => {
            if (sel === 'button[data-testid="tweetButton"]') return Promise.resolve();
            return Promise.reject(new Error('Selector not found'));
          },
        }),
      }),
    };

    const found = await NavigationHelper.waitForAnySelector(mockPage, [
      'input[name="unknown"]',
      'button[data-testid="tweetButton"]',
      'div[role="dialog"]',
    ]);

    expect(found).toBe('button[data-testid="tweetButton"]');
  });
});
