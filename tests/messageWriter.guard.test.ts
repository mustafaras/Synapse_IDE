import { assertAssistantTextWrite } from '@/utils/ai/guardWriter';

function simulateSafeReplace(prev: any, replacer: (m: any) => any, source: 'providerStream' | 'ui' | 'system') {
  const before = prev;
  const after = replacer({ ...prev });
  assertAssistantTextWrite(before, after, source);
  return after;
}

describe('message writer guard (integration-lite)', () => {
  it('allows provider stream to append tokens', () => {
    const before = { id: '1', type: 'assistant', streamedContent: '' };
    const after = simulateSafeReplace(before, (m) => ({ ...m, streamedContent: 'hi' }), 'providerStream');
    expect(after.streamedContent).toBe('hi');
  });

  it('blocks UI from injecting assistant content', () => {
    const before = { id: '1', type: 'assistant', content: '' };
    expect(() => simulateSafeReplace(before, (m) => ({ ...m, content: 'template text' }), 'ui')).toThrowError(/Blocked non-model content/);
  });
});
