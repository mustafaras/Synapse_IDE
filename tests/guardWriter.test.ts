import { assertAssistantTextWrite } from '@/utils/ai/guardWriter';

describe('assertAssistantTextWrite', () => {
  it('allows user messages', () => {
    expect(() => assertAssistantTextWrite({ type: 'user', content: '' } as any, { type: 'user', content: 'x' } as any, 'ui')).not.toThrow();
  });

  it('allows assistant reductions/no-ops from UI', () => {
    expect(() => assertAssistantTextWrite({ type: 'assistant', streamedContent: 'abc' } as any, { type: 'assistant', streamedContent: 'a' } as any, 'ui')).not.toThrow();
    expect(() => assertAssistantTextWrite({ type: 'assistant', content: 'abc' } as any, { type: 'assistant', content: 'abc' } as any, 'ui')).not.toThrow();
  });

  it('blocks growth from UI/system', () => {
    expect(() => assertAssistantTextWrite({ type: 'assistant', content: '' } as any, { type: 'assistant', content: 'hi' } as any, 'ui')).toThrowError(/Blocked non-model content/);
    expect(() => assertAssistantTextWrite({ type: 'assistant', streamedContent: 'a' } as any, { type: 'assistant', streamedContent: 'ab' } as any, 'system')).toThrowError(/Blocked non-model content/);
  });

  it('allows providerStream growth', () => {
    expect(() => assertAssistantTextWrite({ type: 'assistant', streamedContent: 'a' } as any, { type: 'assistant', streamedContent: 'ab' } as any, 'providerStream')).not.toThrow();
  });
});
