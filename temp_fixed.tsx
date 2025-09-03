// removed unused icons
import AttachBar from '@/components/ai/attachments/AttachBar';
import { useAttachStore } from '@/features/attachments/store';
/* eslint-disable */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uuid as safeUuid } from '@/utils/uuid';
import { showToast } from '../../ui/toast/api';
import { reportError } from '@/lib/error-bus';
import { useKeyScope } from '../../ui/keys/useKeyScope';
import { toChord } from '../../ui/keys/router';
import styled from 'styled-components';
// Using relative path to ensure resolution before path alias tooling picks it up
import { useAiStreaming } from '../../hooks/useAiStreaming';
import {
  Activity,
  AlertCircle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Copy,
  Paperclip,
  Lightbulb,
  Download,
  Search,
  Pin,
  PinOff,
  RotateCcw,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  // titleStyles (unused after header redesign),
  buttonStyles,
  globalStyles,
  inputContainerStyles,
  messagesStyles,
  createInputStyles,
  createMessageStyles,
  getCharacterCountColor,
} from './AiAssistantStyles';
import {
  BEGINNER_PRESETS,
  MODEL_OPTIONS,
  PRO_PRESETS,
  aiModels,
  appendToThread,
  buildSummaryRequestPayload,
  buildSystemPrompt,
  classifyProviderError,
  findPresetById,
  getActiveProjectId,
  
  languages,
  loadAiSettings,
  loadPinnedContext,
  
  loadThread,
  modelOptionMap,
  parseFenceInfo,
  quickPrompts,
  replaceThread,
  saveAiSettings,
  
  selectFallbackModel,
  shouldSummarize,
  subscribeAiSettings,
  // Prompt 6 helpers
  buildSelectionUserPrompt,
  detectLangFromFilename,
  type AiSelectionAction,
  // Prompt 8 perf helpers
  VLIST_OVERSCAN_PX,
  // Prompt 3 helpers
  isOnline,
  pickEffectiveModel,
  // Dev-only telemetry helpers
  recordTelemetry,
  tStart,
  tEnd,
  flushTelemetryBuffer,
  estimateTokens,
  redactOutbound,
  type AiSettings,
  // constants referenced in this file
  ALLOW_MODEL_FALLBACK,
  CONTEXT_BUDGET_TOKENS,
  // Prompt 8 reliability helpers
  classifyError,
  userFacingMessage,
  emitTelemetry,
} from './AiAssistantConfig';
import { timeouts } from '@/config/timeouts';
import AiSettingsModalPro from '@/components/ai/settings/AiSettingsModalPro';
import { loadAiSettingsV2, mergeAiSettingsV2, saveAiSettingsV2, type AiSettings as AiSettingsV2 } from '@/stores/aiSettings.schema';
import { MAX_FILE_BYTES, readTextSafely, sanitizeName, sha256, sniffKind } from '@/features/attachments/ingest';
import type { AttachmentMeta } from '@/features/attachments/types';
import { timeAndLog } from '@/services/telemetry';
import { useEditorStore } from '@/stores/editorStore';
import CodeBlockWithActions from '../assistant/CodeBlockWithActions';
import { inferLanguageFromFence as inferFenceLang, insertIntoActive, openNewTab as editorOpenNewTab, replaceSelection } from '@/services/editorBridge';
import { extractCodeBlocks, guessByLanguage, defaultFilename } from '@/utils/markdown/extractCodeBlocks';
import { editorBridge as domEditorBridge } from '@/services/editor/bridge';
// (Apply pipeline now wired in EnhancedIDE command; no direct usage here.)
import { runPreview as previewRun } from '@/services/previewBridge';
import VirtualizedMessageList from '@/components/ai/virtual/VirtualMessageList';
import ChatMessage from '@/components/ai/ChatMessage';
import './chatMessage.css';
import './composer.css';
// a11y removed
import { useRafBatcher } from '@/hooks/useRafBatcher';
import { guardModeSwitch } from '@/utils/ai/mode/switchGuard';
// import { useResilience } from '@/utils/resilience/store';
import { SYNAPSE_COLORS, SYNAPSE_ELEVATION, withAlpha } from '@/ui/theme/synapseTheme';
import { flags } from '@/config/flags';
import { logger } from '@/lib/logger';
import { validateSelection } from '@/utils/ai/models/validator';
// Chat persistence wiring (Prompt 10)
import { subscribeStorage, type DraftV2, type HistoryV2 } from '@/state/chatPersistence';
import { initChatState, onMessagesChanged, onDraftChanged } from '@/state/chatStore';

// Styled components (no visual change; replace repeated inline styles)
const Container = styled.div<{ $w: number; $isMobile: boolean }>`
  width: ${p => `${p.$w}px`};
  height: 100vh;
  margin-top: 0px;
  margin-bottom: 0px;
  display: flex;
  flex-direction: column;
  background: ${withAlpha(SYNAPSE_COLORS.bgSecondary, 0.4)};
  border: 1px solid ${SYNAPSE_COLORS.borderSubtle};
  border-radius: 0px;
  overflow: hidden;
  position: relative;
  z-index: 1000;
  box-shadow: ${p => p.$isMobile ? SYNAPSE_ELEVATION.shadowMd : SYNAPSE_ELEVATION.shadowLg};
  backdrop-filter: blur(20px) saturate(1.8);
  color: ${SYNAPSE_COLORS.textPrimary};
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
  padding-bottom: 28px;

`;

const Header = styled.div<{ $isMobile: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => (p.$isMobile ? '16px 20px' : '20px 24px')};
  min-height: 108px;
  border-bottom: 1px solid ${SYNAPSE_COLORS.borderSubtle};
  background: ${withAlpha(SYNAPSE_COLORS.bgSecondary, 0.6)};
  position: sticky;
  top: 0;
  z-index: 1002;
  backdrop-filter: blur(16px) saturate(1.5);
  box-shadow: ${SYNAPSE_ELEVATION.shadowMd};
  border-radius: 0 0 0px 0px;
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
`;

const BeginnerDot = styled.span<{ $active?: boolean }>`
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${p => (p.$active ? `linear-gradient(135deg,${SYNAPSE_COLORS.goldPrimary},${SYNAPSE_COLORS.goldSecondary})` : 'transparent')};
  box-shadow: 0 0 0 1px ${p => (p.$active ? withAlpha(SYNAPSE_COLORS.goldPrimary, 0.67) : SYNAPSE_COLORS.textTertiary)} inset;
  transition: background 0.2s ease, box-shadow 0.2s ease;
`;

const QueuePill = styled.span`
  background: ${SYNAPSE_COLORS.warning};
  color: ${SYNAPSE_COLORS.bgDark};
  padding: 0 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
`;

const DelayLetter = styled.span<{ $dl?: string }>`
  --dl: ${p => p.$dl ?? '0.02s'};
`;

// Minimal text flow wrapper for inline highlighted segments
const TextFlow = styled.div`
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: ${SYNAPSE_COLORS.textPrimary};
`;

// Placeholder box for streaming code fences
const CodePlaceholderWrapper = styled.div`
  position: relative;
  background: linear-gradient(145deg, ${SYNAPSE_COLORS.bgDark}, ${SYNAPSE_COLORS.bgSecondary});
  border: 1px dashed ${withAlpha(SYNAPSE_COLORS.goldPrimary, 0.35)};
  border-radius: 12px;
  margin: 12px 0;
  padding: 12px 14px;
  color: ${SYNAPSE_COLORS.goldPrimary};
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
`;

const InlineRow = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SpinnerDot = styled.span`
  width: 14px;
  height: 14px;
  border: 2px solid ${withAlpha(SYNAPSE_COLORS.goldPrimary, 0.4)};
  border-top-color: ${SYNAPSE_COLORS.goldPrimary};
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  display: inline-block;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// (removed unused FlexOne)

// Types
interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  language?: string;
  model?: string;
  mode?: 'beginner' | 'pro';
  threadId?: string; // Message threading support
  parentId?: string; // For reply chains
  isThreadStart?: boolean; // Mark thread start
  // STEP 4 streaming enhancements
  isStreaming?: boolean;             // whether message still receiving tokens
  streamedContent?: string;          // incremental buffer
  openFence?: {                      // if currently inside a fenced code block
    langHint?: string;
    code: string;                    // accumulated code inside fence
    startIndex: number;              // index in streamedContent where fence began
  token?: string;                  // token used for the fence (``` or ~~~)
  } | null;
}
// Use shared SSR-safe uuid helper
const uuid = safeUuid;

// Prompt 3: Small factories for consistent message shapes
function makeSystemMessage(text: string): Message {
  return {
  id: uuid(),
    type: 'system',
    content: text,
    timestamp: new Date(),
  } as Message;
}

function makeUserMessage(text: string, modelId: string | null, language?: string): Message {
  return {
  id: uuid(),
    type: 'user',
    content: text,
    timestamp: new Date(),
    model: modelId || undefined,
    language,
  } as Message;
}

function makeAiPlaceholder(modelId: string | null, language?: string, mode?: 'beginner' | 'pro', id?: string): Message {
  return {
  id: id || uuid(),
    type: 'ai',
    content: '',
    streamedContent: '',
    isStreaming: true,
    openFence: null,
    timestamp: new Date(),
    model: modelId || undefined,
    language,
    mode,
  } as Message;
}

// Provider keys are read from advanced settings (advSettings.keys)

interface AiAssistantProps {
  width?: number;
  onClose?: () => void;
}

const AiAssistant: React.FC<AiAssistantProps> = ({
  width = 400,
  onClose
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI coding assistant. I can help you with code generation, debugging, explanations, and architectural guidance. What would you like to work on today?',
      timestamp: new Date()
    }
  ]);
  /**
   * Safe, deferred, idempotent message updates
   * - Prevents render→state→render loops by deferring state writes to microtasks
   * - Dedupe by message id
   * - Guards against updates after unmount
   */
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Safe microtask polyfill (queueMicrotask fallback)
  const runMicrotask = React.useCallback((fn: () => void) => {
    try { queueMicrotask(fn); } catch { Promise.resolve().then(fn); }
  }, []);

  // Defers a messages state update to the next microtask
  const deferMessagesUpdate = React.useCallback((updater: (prev: Message[]) => Message[]) => {
    runMicrotask(() => {
      if (!isMountedRef.current) return;
      setMessages(prev => updater(prev));
    });
  }, [runMicrotask]);

  // Append messages (idempotent by id)
  const appendMessagesDeferred = React.useCallback((items: Message[]) => {
    deferMessagesUpdate(prev => {
      if (!items.length) return prev;
      const seen = new Set(prev.map(m => m.id));
      const next = [...prev];
      for (const m of items) {
  if (!seen.has(m.id)) { next.push(m); seen.add(m.id); }
      }
      return next;
    });
  }, [deferMessagesUpdate]);

  // Replace/update a single message by id (deferred)
  const replaceMessageDeferred = React.useCallback((id: string, replacer: (m: Message) => Message) => {
    deferMessagesUpdate(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = replacer(next[idx]);
      return next;
    });
  }, [deferMessagesUpdate]);

  // State
  const [input, setInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem('synapse.ai.model') || 'gpt-4-turbo'; } catch { return 'gpt-4-turbo'; }
  });
  const [isTyping, setIsTyping] = useState(false);
  // Persistence bootstrap + multi-tab coherence
  const lastDraftAtRef = useRef(0);
  const lastHistoryAtRef = useRef(0);
  // Break storage↔state echo loops
  const applyingExternalDraftRef = useRef(false);
  const applyingExternalHistoryRef = useRef(false);
  useEffect(() => {
    // Cold start load (once)
    try {
      const boot = initChatState();
      if (!input && boot.draft) {
        applyingExternalDraftRef.current = true;
        setInput(boot.draft);
        runMicrotask(() => { applyingExternalDraftRef.current = false; });
      }
      if (boot.messages && boot.messages.length) {
        // Map ChatMsg -> local Message shape, omit undefined optionals
        const mapped: Message[] = boot.messages.map(m => {
          const base: any = {
            id: m.id,
            type: m.role === 'assistant' ? 'ai' : (m.role as any),
            content: m.content,
            timestamp: new Date(m.ts),
          };
          if (m.model) base.model = m.model;
          return base as Message;
        });
        applyingExternalHistoryRef.current = true;
        setMessages(mapped);
        runMicrotask(() => { applyingExternalHistoryRef.current = false; });
      }
    } catch {}
    // Multi-tab coherence: subscribe to external updates
    const unsub = subscribeStorage(
      (d: DraftV2) => {
        try {
          if (d.updatedAt > lastDraftAtRef.current) {
            lastDraftAtRef.current = d.updatedAt;
            applyingExternalDraftRef.current = true;
            setInput(d.text);
            runMicrotask(() => { applyingExternalDraftRef.current = false; });
          }
        } catch {}
      },
      (h: HistoryV2) => {
        try {
          if (h.updatedAt > lastHistoryAtRef.current) {
            lastHistoryAtRef.current = h.updatedAt;
            const mapped: Message[] = h.messages.map((m) => {
              const base: any = { id: m.id, type: m.role === 'assistant' ? 'ai' : (m.role as any), content: m.content, timestamp: new Date(m.ts) };
              if (m.model) base.model = m.model;
              return base as Message;
            });
            applyingExternalHistoryRef.current = true;
            setMessages(mapped);
            runMicrotask(() => { applyingExternalHistoryRef.current = false; });
          }
        } catch {}
      }
    );
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Prevent echo-loop: when messages were applied from external storage, skip notifying store
    if (applyingExternalHistoryRef.current) return;
    const msgs = messages.map(m => ({ id: m.id, role: (m.type === 'ai' ? 'assistant' : (m.type as any)), content: m.content, ts: m.timestamp?.getTime?.() ?? Date.now(), model: m.model }));
    onMessagesChanged(msgs as any);
  }, [messages]);
  // Keep draft (input) in sync with v2 storage; skip writes when applying external updates
  useEffect(() => {
    if (applyingExternalDraftRef.current) return;
    try { onDraftChanged(input); } catch {}
  }, [input]);
  // Removed local isResizing state (external panel handle controls width)
  // Width now fully controlled by parent (EnhancedIDE)
  const currentWidth = width;
  // Inline API settings removed; settings live in modal
  
  // Thread tools moved into AI Settings modal (Thread & Context tab)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [languageCategory, setLanguageCategory] = useState<string>('all');
  const [modelProvider, setModelProvider] = useState<string>('all');
  // Experimental models toggle (UI) – persists to localStorage 'synapse.ai.experimentalModels' ('1' | '0')
  // experimental models toggle removed from this scope to reduce unused state
  const [ollama, setOllamaModels] = useState<string[]>([]);
  // Local UI states needed before settings subscription
  const [autoPreview, setAutoPreview] = useState<boolean>(() => {
    try { return localStorage.getItem('synapse.ai.autoPreview') === 'false' ? false : true; } catch { return true; }
  });
  const [insertBehavior, setInsertBehavior] = useState<'cursor'|'newTab'>(() => {
    try { const v = localStorage.getItem('synapse.ai.insertBehavior'); if (v === 'cursor' || v === 'newTab') return v as any; } catch {}
    return 'cursor';
  });
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  // STEP 7 mode/settings from central AI settings
  const [aiSettings, setAiSettings] = useState(() => {
    try { return loadAiSettings(); } catch { return { mode: 'beginner', modelId: null, defaultInsert: 'insert', autoPreview: true } as any; }
  });
  const [beginnerMode, setBeginnerMode] = useState<boolean>(aiSettings.mode === 'beginner');
  useEffect(() => { setBeginnerMode(aiSettings.mode === 'beginner'); }, [aiSettings.mode]);
  useEffect(() => {
    const isDev = (() => {
      try { if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) return true; } catch {}
      try { if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') return true; } catch {}
      return false;
    })();
    let updates = 0;
    const unsub = subscribeAiSettings((s) => {
      // Shallow guard for settings object
      setAiSettings((prev: AiSettings) => {
        if (
          prev.mode === s.mode &&
          prev.modelId === s.modelId &&
          prev.defaultInsert === s.defaultInsert &&
          prev.autoPreview === s.autoPreview
        ) return prev;
        if (isDev) console.warn('[DEV][store] aiSettings update (Assistant)', ++updates);
        return s;
      });
      // Apply derived local states only if changed
      if (s.modelId && s.modelId !== selectedModel) setSelectedModel(s.modelId);
      const nextInsert = s.defaultInsert === 'new-tab' ? 'newTab' : 'cursor';
      if (autoPreview !== !!s.autoPreview) setAutoPreview(!!s.autoPreview);
      if (insertBehavior !== nextInsert) setInsertBehavior(nextInsert);
      // Mirror to localStorage (idempotent)
      try { localStorage.setItem('synapse.ai.autoPreview', String(!!s.autoPreview)); } catch {}
      try { localStorage.setItem('synapse.ai.insertBehavior', nextInsert); } catch {}
    });
    return () => { try { unsub(); } catch { /* ignore */ } };
  }, [selectedModel, autoPreview, insertBehavior]);
  // expose setter for dev toggling (debug only)
  if (typeof window !== 'undefined') {
    (window as any).__setSynapseBeginner = (v: boolean) => {
      const next = { ...aiSettings, mode: v ? 'beginner' : 'pro' } as any;
      setAiSettings(next);
      saveAiSettings(next);
    };
  }

  // Pinned presets (mode-specific)
  const [pinnedBeginner, setPinnedBeginner] = useState<string[]>(() => {
  try { return JSON.parse(localStorage.getItem('synapse.ai.pinned.beginner')||'[]'); } catch { return []; }
  });
  const [pinnedPro, setPinnedPro] = useState<string[]>(() => {
  try { return JSON.parse(localStorage.getItem('synapse.ai.pinned.pro')||'[]'); } catch { return []; }
  });
  const pinnedForMode = aiSettings.mode === 'beginner' ? pinnedBeginner : pinnedPro;
  const setPinnedForMode = (ids: string[]) => {
    if (aiSettings.mode === 'beginner') {
      setPinnedBeginner(ids);
  try { localStorage.setItem('synapse.ai.pinned.beginner', JSON.stringify(ids)); } catch { /* ignore */ }
    } else {
      setPinnedPro(ids);
  try { localStorage.setItem('synapse.ai.pinned.pro', JSON.stringify(ids)); } catch { /* ignore */ }
    }
  };
  const togglePin = (id: string) => {
    const set = new Set(pinnedForMode);
    if (set.has(id)) set.delete(id); else set.add(id);
    setPinnedForMode(Array.from(set));
  };
  const [activePreset, setActivePreset] = useState<string | null>(() => {
  try { return localStorage.getItem('synapse.ai.lastPreset'); } catch { return null; }
  });
  // Debug expose (non-production suggestion)
  if (typeof window !== 'undefined') {
    (window as any).__synapseBeginner = beginnerMode;
  }

  // Notifications are centralized via Toaster; keep local API for compatibility
  // Test button state
  // Removed dev-only test and self-check controls to reduce confusion
  const [connectionStatus, setConnectionStatus] = useState<{
    [key: string]: 'connected' | 'disconnected' | 'testing' | 'error';
  }>({});
  const [apiResponseTimes, setApiResponseTimes] = useState<{
    [key: string]: number;
  }>({});

  // Recreated refs lost during refactor
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // IME/Send control refs (Prompt 5)
  const composingRef = useRef<boolean>(false);
  const pendingEnterRef = useRef<boolean>(false);
  const lastSendAtRef = useRef<number>(0);
  const projectIdRef = useRef<string>('default');
  
  // Local pinned/summary controls managed in AI Settings modal
  const idleTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hardTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const streamedCharsRef = useRef<number>(0);
  // Track current streaming message id
  const currentStreamingMsgIdRef = useRef<string | null>(null);
  // Track last aborted message (for Continue)
  const lastAbortedMsgIdRef = useRef<string | null>(null);
  // Stream coalescing buffer (Prompt 8)
  const streamBufferRef = useRef<string>('');      // accumulates raw delta
  const flushTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastFlushAtRef = useRef<number>(0);
  // Stream buffer config (Prompt 2)
  // Streaming buffer cap kept by rAF batching; old constant retained for docs but unused
  // const MAX_BUFFER_CHARS_BETWEEN_FLUSH = 800;
  const STREAM_IDLE_TIMEOUT_MS = (typeof timeouts?.idleMs === 'number' ? timeouts.idleMs : 25000);       // align with global idle timeout

  // Idle timeout for lack of flush activity
  // const MAX_BUFFER_CHARS_BETWEEN_FLUSH = 800; // no longer used with rAF batching
  const idleFlushTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const armIdleTimeout = useCallback(() => {
    if (idleFlushTimerRef.current) clearTimeout(idleFlushTimerRef.current);
  idleFlushTimerRef.current = window.setTimeout(() => {
      try {
        const last = lastFlushAtRef.current || 0;
        const ago = Date.now() - last;
        if (ago >= STREAM_IDLE_TIMEOUT_MS) {
          abortStreaming('idle_timeout');
        }
      } catch { /* no-op */ }
  }, STREAM_IDLE_TIMEOUT_MS + 200) as unknown as ReturnType<typeof window.setTimeout>;
  }, []);
  const clearIdleTimeout = useCallback(() => {
    if (idleFlushTimerRef.current) {
      window.clearTimeout(idleFlushTimerRef.current);
      idleFlushTimerRef.current = null;
    }
  }, []);

  // Ensure chat view jumps to the latest message reliably
  const scrollToBottom = useCallback(() => {
    try {
      requestAnimationFrame(() => {
        const v = messageListRef.current as any;
        if (v?.scrollToBottom) v.scrollToBottom();
        else {
          const el = v as HTMLDivElement | null;
          if (el) el.scrollTop = el.scrollHeight;
          messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
        }
      });
    } catch {}
  }, []);

  // Advanced Settings (v2)
  const [advSettings, setAdvSettings] = useState<AiSettingsV2>(() => {
    try { return loadAiSettingsV2(); } catch { return loadAiSettingsV2(); }
  });

  // One-time auto-config: if OpenAI key is missing, read from env and persist (no logs, no echo)
  useEffect(() => {
    try {
      const hasKey = !!advSettings?.keys?.openai;
      if (hasKey) return;
      const envKey: string | undefined = (() => {
        try { return (import.meta as any)?.env?.VITE_OPENAI_API_KEY as string | undefined; } catch { return undefined; }
      })() || ((): string | undefined => {
        try { return (window as any)?.__OPENAI_API_KEY as string | undefined; } catch { return undefined; }
      })();
      if (envKey && typeof envKey === 'string') {
        setAdvSettings(prev => {
          const next = mergeAiSettingsV2(prev as any, { keys: { openai: envKey } } as any) as AiSettingsV2;
          try { saveAiSettingsV2(next as any); } catch { /* ignore */ }
          return next;
        });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advSettings?.keys?.openai]);
  const syncLegacyFromV2 = useCallback((patch: Partial<AiSettingsV2>) => {
    const legacy = loadAiSettings();
    let changed = false;
    const next = { ...legacy } as AiSettings;
    if (typeof patch.mode !== 'undefined' && (legacy as any).mode !== patch.mode) { (next as any).mode = patch.mode as any; changed = true; }
    if (typeof patch.model !== 'undefined') {
      const modelId = (patch.model ?? null) as any;
      if ((legacy as any).modelId !== modelId) { (next as any).modelId = modelId; changed = true; }
    }
    if (changed) saveAiSettings(next);
  }, []);
  const handleAdvChange = useCallback((nextPartial: Partial<AiSettingsV2>) => {
    setAdvSettings(prev => {
      const merged = mergeAiSettingsV2(prev as any, nextPartial as any) as any as AiSettingsV2;
      saveAiSettingsV2(merged as any);
      syncLegacyFromV2(nextPartial);
      return merged;
    });
  }, [syncLegacyFromV2]);
  const handleAdvSave = useCallback(() => {
    try { saveAiSettingsV2(advSettings as any); showToast({ kind: 'success', contextKey: 'settings:v2:save', title: 'Settings saved', message: 'Your preferences are up to date.' }); } catch {
      showToast({ kind: 'error', contextKey: 'settings:v2:save', title: 'Save failed', message: 'Could not persist settings.' });
    }
  }, [advSettings]);
  const handleAdvExport = useCallback((includeKeys: boolean) => {
    try {
      const data = { ...advSettings, keys: includeKeys ? (advSettings.keys || {}) : {} } as AiSettingsV2;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date();
      const name = `ai-settings-${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}.json`;
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast({ kind: 'success', contextKey: 'settings:v2:export', title: 'Exported settings JSON', message: 'Download started.' });
    } catch {
  showToast({ kind: 'error', contextKey: 'settings:v2:export', title: 'Export failed', message: 'Could not create file.' });
    }
  }, [advSettings]);
  const handleAdvImport = useCallback(async (file: File, overwriteKeys: boolean) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AiSettingsV2>;
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
      const nextPatch: Partial<AiSettingsV2> = { ...parsed };
      if (!overwriteKeys) delete (nextPatch as any).keys;
      setAdvSettings(prev => {
        const merged = mergeAiSettingsV2(prev as any, nextPatch as any) as any as AiSettingsV2;
        saveAiSettingsV2(merged as any);
        syncLegacyFromV2(nextPatch);
        return merged;
      });
  showToast({ kind: 'success', contextKey: 'settings:v2:import', title: 'Imported settings', message: 'Profile applied.' });
    } catch (e) {
  showToast({ kind: 'error', contextKey: 'settings:v2:import', title: 'Import failed', message: 'Invalid or unreadable file.' });
    }
  }, [syncLegacyFromV2]);

  // (applyChunkToLastAssistantMessage) inlined into flushStreamBuffer for single-update flushes

  function flushStreamBuffer() {
    const pending = streamBufferRef.current;
    const msgId = currentStreamingMsgIdRef.current;
    if (!pending || !msgId) return;
    // Clear buffer first to avoid re-entrancy
    streamBufferRef.current = '';
    lastFlushAtRef.current = Date.now();
    replaceMessageDeferred(msgId, (m: any) => {
      if (!m) return m as any;
      const prev = (m.streamedContent || m.content || '') as string;
      const aggregated = prev + pending;
      // Optional: lightweight fence tracking (keep cheap)
      let openFence = m.openFence || null;
      try {
        // Track the last unmatched opening fence. Support backtick and tilde.
        const fenceOpenRe = /(?:^|\n)(`{3,}|~{3,})([^\n]*)\n/g;
        const fenceClose = (token: string) => new RegExp(`(?:^|\n)${token}(?:\n|$)`);
        if (!openFence) {
          // Find all openings, pick the last one that is not yet closed
          let match: RegExpExecArray | null;
          let lastStart = -1;
          let lastLang: string | undefined = undefined;
          let lastToken = '```';
          while ((match = fenceOpenRe.exec(aggregated)) !== null) {
            const token = match[1];
            const start = match.index + match[0].length;
            const langHint = (match[2] || '').trim() || undefined;
            // Check if there is a matching closer after this start
            const closeRe = fenceClose(token);
            closeRe.lastIndex = start;
            const closeFound = closeRe.test(aggregated.slice(start));
            if (!closeFound) {
              lastStart = start; lastLang = langHint; lastToken = token;
            }
          }
          if (lastStart !== -1) {
            openFence = { langHint: lastLang, code: aggregated.slice(lastStart), startIndex: lastStart, token: lastToken } as any;
          }
        } else {
          const codePortion = aggregated.slice(openFence.startIndex);
          const closer = (openFence as any).token || '```';
          const closeRe = new RegExp(`(?:^|\n)${closer}(?:\n|$)`);
          const closeIdx = codePortion.search(closeRe);
          openFence = closeIdx === -1 ? { ...openFence, code: codePortion } : null;
        }
      } catch { /* ignore fence errors during stream */ }
      return { ...m, streamedContent: aggregated, content: aggregated, openFence } as Message;
    });
  // After applying the streamed delta, ensure the view stays pinned to the latest content
  try { scrollToBottom(); } catch {}
    // Re-arm idle timeout after a successful flush
    armIdleTimeout();
    // Telemetry for flushes
    try {
      flushCountRef.current = (flushCountRef.current || 0) + 1;
      emitTelemetry('delta_flush', { n: flushCountRef.current });
    } catch {}
  }

  // armFlushTimer no longer used with rAF batching
  function clearFlushTimer() {
    if (flushTimerRef.current) {
  window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }
  useEffect(() => () => { clearFlushTimer(); /* keep symbol referenced */ void flushStreamBuffer; }, []);

  // Unified cleanup across exits
  const cleanupStreamingState = useCallback(() => {
    try { clearFlushTimer(); } catch {}
    try { clearIdleTimeout(); } catch {}
    try {
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      if (hardTimerRef.current) { clearTimeout(hardTimerRef.current); hardTimerRef.current = null; }
    } catch {}
    currentStreamingMsgIdRef.current = null;
    setIsTyping(false);
  }, [clearIdleTimeout]);
  useEffect(() => () => { cleanupStreamingState(); }, [cleanupStreamingState]);

  // Abort any in-flight stream when component unmounts
  useEffect(() => {
    return () => {
      try { abortStreaming('unmount'); } catch {}
      // Revoke any object URLs created for attachments
      try {
        const list = useAttachStore.getState().list;
        list.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
      } catch {}
    };
  }, []);

  // UX Enhancement States
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [lastAbortReason, setLastAbortReason] = useState<string | null>(null); // displayed in notification when updated
  // Feature flag: show a tiny inline hint while streaming (opt-in via localStorage 'synapse.ai.showCancelHint' = 'true')
  const [showCancelHint, setShowCancelHint] = useState<boolean>(false);
  // Inline presets dropdown state (moved from removed AIHeader)
  const [showPresetMenuInline, setShowPresetMenuInline] = useState(false);
  // Keyboard overlay + search
  const [showKeysOverlay, setShowKeysOverlay] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const providerKeys = useMemo(() => ({
    openai: advSettings.keys?.openai || '',
    anthropic: advSettings.keys?.anthropic || '',
    google: advSettings.keys?.google || '',
    ollama: advSettings.keys?.ollama || 'http://localhost:11434',
  }), [advSettings.keys]);

  const guardModelAndKeys = useCallback(
    (modelMeta: { provider: 'openai' | 'anthropic' | 'google' | 'ollama' } | null, effectiveModelId: string | null) => {
      if (!effectiveModelId) {
        return 'No model is selected. Please choose a model in AI Settings and resend.';
      }
      if (!modelMeta) {
        return 'Selected model is not available. Please choose another model in AI Settings.';
      }
      if (modelMeta.provider === 'openai' && !providerKeys.openai) {
        return 'Missing OpenAI API key. Open AI Settings → API Keys, add the key, then resend.';
      }
      if (modelMeta.provider === 'anthropic' && !providerKeys.anthropic) {
        return 'Missing Anthropic API key. Open AI Settings → API Keys, add the key, then resend.';
      }
      if (modelMeta.provider === 'google' && !providerKeys.google) {
        return 'Missing Google API key. Open AI Settings → API Keys, add the key, then resend.';
      }
      return null; // ollama için key gerekmiyor
    },
    [providerKeys.openai, providerKeys.anthropic, providerKeys.google]
  );
  const { startStreaming, abortStreaming, streamState } = useAiStreaming(providerKeys);
  // Dev-only telemetry refs
  const telReqT0Ref = useRef<number>(0);
  const telCharsRef = useRef<number>(0);
  const telRetryRef = useRef<number>(0);
  const telFallbackModelRef = useRef<string | null>(null);
  const telSummT0Ref = useRef<number>(0);
  const telSummElapsedRef = useRef<number>(0);
  const handleSendMessageRef = useRef<null | (() => Promise<void>)>(null);
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    errorType: 'network' | 'auth' | 'rate_limit' | 'server' | 'unknown';
    message: string;
    retryable: boolean;
  }>({
    hasError: false,
    errorType: 'unknown',
    message: '',
    retryable: false
  });

  // Prompt 8 — reliability: last system note for SR, flush counter, and debug toggle
  const [lastSystemNote, setLastSystemNote] = useState<string>('');
  const flushCountRef = useRef<number>(0);
  const debugOn = typeof window !== 'undefined' && (localStorage.getItem('synapse.ai.debug') === '1');
  // a11y announcements removed
  // Streaming delta processor bound per request
  const processDeltaRef = useRef<(chunk: string) => void>(() => {});
  const enqueueDelta = useRafBatcher<string>((chunks) => {
    const merged = chunks.join('');
    processDeltaRef.current(merged);
  });

  // Hydrate misc flags on mount
  useEffect(() => {
    try { setShowCancelHint(localStorage.getItem('synapse.ai.showCancelHint') === 'true'); } catch {}
  }, []);

  // Resolve active project id at mount
  useEffect(() => {
    try { projectIdRef.current = getActiveProjectId(); } catch { projectIdRef.current = 'default'; }
  }, []);
  // Pinned context handled in AI Settings modal

  // Respect user-selected model; do not auto-downgrade. Fallbacks are handled later when errors occur.
  // (Removed legacy auto-remap to gpt-4o to allow GPT-5 family and others.)

  // Responsive Design States
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  // Local UI states
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all'|string>('all');
  const [initialSettingsTab, setInitialSettingsTab] = useState<string | undefined>(undefined);

  // Message Threading States (For future use)
  // const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  // const [threadMessages, setThreadMessages] = useState<{ [threadId: string]: Message[] }>({});
  // const [showThreadView, setShowThreadView] = useState(false);

  // Effect: track abort reason from hook (friendly toasts)
  useEffect(() => {
    if (!streamState.abortReason) return;
    if (lastAbortReason === streamState.abortReason) return; // coalesce same reason back-to-back
    setLastAbortReason(streamState.abortReason);
    const r = streamState.abortReason;
  if (flags.aiTrace) logger.info('[STREAM_ABORT]', 'reason=', r);
  // Deterministic cleanup
  try { setIsTyping(false); } catch {}
  try { cleanupStreamingState(); } catch {}
  // Ensure any active assistant bubble is marked as not streaming
  try {
    const activeId = currentStreamingMsgIdRef.current;
    if (activeId) replaceMessageDeferred(activeId, (m) => ({ ...m, isStreaming: false } as Message));
  } catch {}
    const toast =
  r === 'user_cancel' || r === 'user_escape' ? ['info', 'Generation cancelled.'] :
      r === 'new_request' ? ['info', 'Cancelled previous request'] :
      r === 'idle_timeout' ? ['warning', 'Connection stalled; request aborted.'] :
      r === 'request_timeout' ? ['warning', 'Request timed out.'] :
      ['info', 'Stream aborted'];
    addNotification(toast[0] as any, toast[1] as string);
  // a11y removed
  try { emitTelemetry('send_abort', { reason: r }); } catch {}
  // Also surface via unified error bus to ensure single toast policy
  try {
    const code = r === 'user_escape' || r === 'user_cancel' ? 'aborted' : (r?.includes('timeout') ? 'timeout' : 'unknown');
    reportError({ source: 'fsm', code });
  } catch {}
  }, [streamState.abortReason, lastAbortReason]);
  // Close inline preset menu on outside click
  useEffect(() => {
    if (!showPresetMenuInline) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-presets-inline]')) setShowPresetMenuInline(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPresetMenuInline]);
  
  // Optional: ESC to cancel active generation (no UI change)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el?.closest?.('[data-chat-input]'))) return;
      if (e.key === 'Escape') {
  // Mark the currently streaming message as aborted for Continue control
  try { lastAbortedMsgIdRef.current = currentStreamingMsgIdRef.current; } catch {}
  // a11y removed
        abortStreaming('user_escape');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [abortStreaming]);
  // Alt+S to send (accessible shortcut)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const target = (e.target as HTMLElement | null);
      const inChat = !!(
        (active && (active.tagName === 'TEXTAREA' || active.closest('[data-chat-input]') || active.closest('[data-component="ai-assistant"]')))
        || (target && (target.closest('[data-chat-input]') || target.closest('[data-component="ai-assistant"]')))
      );
      if (!inChat) return;
      if (e.altKey && (e.key?.toLowerCase?.() === 's' || (e as any).code === 'KeyS')) {
        e.preventDefault(); e.stopPropagation();
        if (!streamState.isStreaming) {
          // a11y removed
          const fn = (handleSendMessageRef.current);
          if (fn) void fn();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streamState.isStreaming]);
  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ai-settings]') && !target.closest('[data-ai-settings-trigger]')) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);
  // ESC key to close settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el?.closest?.('[data-chat-input]'))) return;
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global guard (bubble-phase): avoid interfering with chat input; only block necessary shortcuts globally
  useEffect(() => {
    const guard = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      const inChat = !!(
        (active && (active.tagName === 'TEXTAREA' || active.closest('[data-chat-input]') || active.closest('[data-component="ai-assistant"]')))
        || (target && (target.closest('[data-chat-input]') || target.closest('[data-component="ai-assistant"]')))
      );
      if (inChat) return; // don't touch events inside chat input/components
      // Only handle truly global shortcuts here; do not touch Enter/ESC
      // Example: prevent browser find when overlay panes use their own search (Ctrl/Cmd+F)
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && (e.key?.toLowerCase?.() === 'f' || (e as any).code === 'KeyF')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', guard, false);
    window.addEventListener('keyup', guard, false);
    return () => {
      window.removeEventListener('keydown', guard, false);
      window.removeEventListener('keyup', guard, false);
    };
  }, []);
  // Persist settings
  useEffect(() => { try { localStorage.setItem('synapse.ai.insertBehavior', insertBehavior); } catch { /* ignore */ } }, [insertBehavior]);
  useEffect(() => { try { localStorage.setItem('synapse.ai.autoPreview', String(autoPreview)); } catch { /* ignore */ } }, [autoPreview]);
  useEffect(() => { try { localStorage.setItem('synapse.ai.model', selectedModel); } catch { /* ignore */ } }, [selectedModel]);
  // Telemetry for abort reasons
  useEffect(() => {
    if (lastAbortReason) {
      try { emitTelemetry('send_abort', { reason: lastAbortReason }); } catch {}
    }
  }, [lastAbortReason]);

  // Helpers (reintroduced)
  const highlightInline = (content: string) => {
    return content
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  // anti-linkify: wrap URLs to avoid auto-link conflicts in some UI kits
  .replace(/\bhttps?:\/\/[^\s]+/g, '<span class="url">$&</span>')
      .replace(/\b(\w+)\s*\(/g, '<span class="function-name">$1</span>(')
      .replace(/\b(function|const|let|var|if|else|for|while|return|import|export|class|interface|type)\b/g, '<span class="keyword">$1</span>')
      .replace(/"([^"]+)"/g, '<span class="string">"$1"</span>')
      .replace(/'([^']+)'/g, '<span class="string">\'$1\'</span>')
      .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
      .replace(/\/\/(.+)/g, '<span class="comment">//$1</span>')
      .replace(/\/\*([\s\S]*?)\*\//g, '<span class="comment">/*$1*/</span>');
  };
  const escapeHtml = (text: string) => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const applySearchHighlight = (html: string) => {
    const q = searchQuery.trim();
    if (!q) return html;
    try {
      const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
      // Split by <code ...>...</code> while keeping tags
      const parts: string[] = [];
      const codeRe = /<code\b[^>]*>[\s\S]*?<\/code>/gi;
      let lastIndex = 0; let m: RegExpExecArray | null;
      while ((m = codeRe.exec(html)) !== null) {
        const before = html.slice(lastIndex, m.index);
        if (before) parts.push(before.replace(re, '<mark class="chat-search-hit">$1</mark>'));
        parts.push(m[0]);
        lastIndex = m.index + m[0].length;
      }
      const tail = html.slice(lastIndex);
      if (tail) parts.push(tail.replace(re, '<mark class="chat-search-hit">$1</mark>'));
      return parts.join('');
    } catch { return html; }
  };

  // Error handling helpers (restored)
  const handleError = (error: any) => {
    let errorType: 'network' | 'auth' | 'rate_limit' | 'server' | 'unknown' = 'unknown';
    let message = 'Unknown error occurred';
    let retryable = false;
    if (error instanceof Error) {
      if (/(401|403)/.test(error.message)) { errorType='auth'; message='Invalid API key'; }
      else if (/429/.test(error.message)) { errorType='rate_limit'; message='Rate limit exceeded'; retryable=true; }
      else if (/(500|502|503)/.test(error.message)) { errorType='server'; message='Server error'; retryable=true; }
      else if (/network|fetch/i.test(error.message)) { errorType='network'; message='Network error'; retryable=true; }
      else { message = error.message; retryable = true; }
    }
    setErrorState({ hasError: true, errorType, message, retryable });
    return { errorType, message, retryable };
  };
  const clearError = () => setErrorState({ hasError:false, errorType:'unknown', message:'', retryable:false });

  // Offline queue helpers
  const overrideContentRef = useRef<string | null>(null);
  const suppressNextUserAppendRef = useRef<boolean>(false);
  const OFFLINE_QUEUE_KEY = 'synapse.chat.queue';
  const enqueueOffline = useCallback((payload: { content: string; lang?: string; model?: string; ts?: number; }) => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const arr: any[] = raw ? JSON.parse(raw) : [];
      arr.push({ ...payload, ts: payload.ts || Date.now() });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(arr));
    } catch {}
  }, []);
  const flushOfflineQueue = useCallback(async () => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const arr: Array<{ content: string; lang?: string; model?: string; ts?: number; }> = raw ? JSON.parse(raw) : [];
      if (!arr.length) return;
      // Send sequentially without re-adding user bubbles
      while (arr.length) {
        const item = arr.shift()!;
        overrideContentRef.current = item.content;
        suppressNextUserAppendRef.current = true;
        // If a model was captured offline, temporarily select it for this replay
        if (item.model && item.model !== selectedModel) {
          setSelectedModel(item.model);
        }
        // eslint-disable-next-line no-await-in-loop
        await handleSendMessage();
      }
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
      addNotification('success', 'Sent queued messages');
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onOnline = () => { void flushOfflineQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushOfflineQueue]);

  // Structured renderer injecting CodeBlockWithActions for fenced code blocks
  const renderMessageContent = (content: string, message?: Message) => {
    // If streaming and there is an open fence, show placeholder reserve
    if (message?.isStreaming && message.openFence) {
      const before = content.slice(0, message.openFence.startIndex);
      const highlightedBefore = highlightInline(escapeHtml(before));
      return (
        <TextFlow>
          {before && <div dangerouslySetInnerHTML={{ __html: highlightedBefore }} />}
          <CodePlaceholderWrapper>
            <InlineRow>
              <SpinnerDot className="spinner" />
              Generating {message.openFence.langHint || 'code'}…
            </InlineRow>
          </CodePlaceholderWrapper>
        </TextFlow>
      );
    }
  // Support both backtick and tilde fences with matching closer (via backreference)
  const regex = /(?:^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\1/g; // 1=fence token, 2=info line, 3=code
    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let match: RegExpExecArray | null;
    let blockCount = 0;
    let keySeq = 0;

    // While streaming, avoid heavy parsing/Suspense; render as highlighted text only
    if ((message as any).isStreaming) {
      const highlighted = applySearchHighlight(highlightInline(escapeHtml(content)));
      return <div><TextFlow dangerouslySetInnerHTML={{ __html: highlighted }} /></div>;
    }
    while ((match = regex.exec(content)) !== null) {
      const [full, _fence, info, codeRaw] = match as any;
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore) {
        const highlighted = applySearchHighlight(highlightInline(escapeHtml(textBefore)));
        parts.push(
          <TextFlow key={`t-${blockCount}-seg-${keySeq++}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
        );
      }
      blockCount += 1;
  const code = codeRaw.replace(/\s+$/,'');
  const { lang: parsedLang, filename: fenceFilename } = parseFenceInfo(info);
  const lang = parsedLang;
      const isPrimary = blockCount === 1; // first fence full toolbar
      parts.push(
        <React.Suspense fallback={<pre>Loading...</pre>}>
          <CodeBlockWithActions
            code={code}
            language={lang}
            primary={isPrimary}
            onCopy={async () => { try { emitTelemetry('apply_copy', { lang: lang || null }); await navigator.clipboard.writeText(code); addNotification('success','Copied to clipboard',1200); } catch {} }}
  onInsert={async () => {
              try {
        emitTelemetry('apply_insert', { lang: lang || null });
                const promptContext = code + (lang ? ('\nLANG:'+lang) : '');
                const tokensApprox = estimateTokens(promptContext);
                await timeAndLog({ action: 'insert', model: selectedModel, tokensApprox, exec: async () => {
                  // Normalize using selected language & mode
                  const { normalizeAssistantMessage } = await import('@/utils/ai/lang/normalizeOutput');
                  const { getLangSpec } = await import('@/utils/ai/lang/languageMap');
                  const selectedSpec = getLangSpec(selectedLanguage) || getLangSpec('javascript')!;
                  const { files, warnings } = normalizeAssistantMessage(
                    `\n\n\u002F\u002F\u002F\u002F file: ${fenceFilename || ''}\n\n\u0060\u0060\u0060${lang || ''}\n${code}\n\u0060\u0060\u0060`,
                    { selectedLang: selectedSpec, mode: (message?.mode as any) || (aiSettings.mode as any) || 'beginner' }
                  );
                  if (warnings.length && (process.env.NODE_ENV !== 'production')) {
                    console.debug('[DEV][lang-normalize]', warnings);
                  }
                  // Beginner: single file expected; Pro: may have many
                  const toApply = files.length ? files : [{ path: fenceFilename || `snippet-${Date.now()}.${(lang||'txt')}`, code, monaco: selectedSpec.monaco, ext: selectedSpec.ext, fence: selectedSpec.fence }];
                  const first = toApply[0];
                  const langInf = inferFenceLang(first.fence, first.code);
                  let tabId: string;
                  if (insertBehavior === 'newTab') {
                    const res = await editorOpenNewTab({ filename: first.path, code: first.code, language: langInf });
                    tabId = res.tabId;
                  } else {
                    const res = await insertIntoActive({ code: first.code, language: langInf });
                    tabId = res.tabId;
                  }
                  if (autoPreview && lang && /^(html?|css|javascript)$/.test(lang.toLowerCase())) {
                    const previewTokens = estimateTokens(code);
                    await timeAndLog({ action: 'preview', model: selectedModel, tokensApprox: previewTokens, exec: async () => await previewRun(tabId) });
                  }
                }});
                addNotification('success','Inserted snippet',1500);
              } catch (e:any) {
                addNotification('error','Insert failed – Retry?',4000);
              }
            }}
  onNewTab={async () => {
      emitTelemetry('apply_newtab', { lang: lang || null });
              const { normalizeAssistantMessage } = await import('@/utils/ai/lang/normalizeOutput');
              const { getLangSpec } = await import('@/utils/ai/lang/languageMap');
              const selectedSpec = getLangSpec(selectedLanguage) || getLangSpec('javascript')!;
              const { files } = normalizeAssistantMessage(
                `\n\n\u002F\u002F\u002F\u002F file: ${fenceFilename || ''}\n\n\u0060\u0060\u0060${lang || ''}\n${code}\n\u0060\u0060\u0060`,
                { selectedLang: selectedSpec, mode: (message?.mode as any) || (aiSettings.mode as any) || 'beginner' }
              );
              const f = files[0] || { path: fenceFilename || `snippet-${Date.now()}.${(lang||'txt')}`, code, fence: lang } as any;
              await editorOpenNewTab({ filename: f.path, code: f.code, language: inferFenceLang(f.fence, f.code) });
            }}
            onReplace={async () => {
              try {
                emitTelemetry('apply_replace', { lang: lang || null });
                const promptContext = code + (lang ? ('\nLANG:'+lang) : '');
                const tokensApprox = estimateTokens(promptContext);
                await timeAndLog({ action: 'insert', model: selectedModel, tokensApprox, exec: async () => {
                  const { normalizeAssistantMessage } = await import('@/utils/ai/lang/normalizeOutput');
                  const { getLangSpec } = await import('@/utils/ai/lang/languageMap');
                  const selectedSpec = getLangSpec(selectedLanguage) || getLangSpec('javascript')!;
                  const { files } = normalizeAssistantMessage(
                    `\n\n\u002F\u002F\u002F\u002F file: ${fenceFilename || ''}\n\n\u0060\u0060\u0060${lang || ''}\n${code}\n\u0060\u0060\u0060`,
                    { selectedLang: selectedSpec, mode: (message?.mode as any) || (aiSettings.mode as any) || 'beginner' }
                  );
                  const f = files[0] || { code, fence: lang } as any;
                  const { tabId } = await replaceSelection({ code: f.code, language: inferFenceLang(f.fence, f.code) });
                  if (autoPreview && lang && /^(html?|css|javascript)$/.test(lang.toLowerCase())) {
                    const previewTokens = estimateTokens(code);
                    await timeAndLog({ action: 'preview', model: selectedModel, tokensApprox: previewTokens, exec: async () => await previewRun(tabId) });
                  }
                }});
                addNotification('success','Replaced selection',1500);
              } catch { addNotification('error','Replace failed – Retry?',4000); }
            }}
            onPreview={async () => {
              try {
                emitTelemetry('apply_preview', { lang: lang || null });
                const previewTokens = estimateTokens(code);
                await timeAndLog({ action: 'preview', model: selectedModel, tokensApprox: previewTokens, exec: async () => {
      const { normalizeAssistantMessage } = await import('@/utils/ai/lang/normalizeOutput');
      const { getLangSpec } = await import('@/utils/ai/lang/languageMap');
      const selectedSpec = getLangSpec(selectedLanguage) || getLangSpec('javascript')!;
    const { files } = normalizeAssistantMessage(
        `\n\n\u002F\u002F\u002F\u002F file: ${fenceFilename || ''}\n\n\u0060\u0060\u0060${lang || ''}\n${code}\n\u0060\u0060\u0060`,
  { selectedLang: selectedSpec, mode: (message?.mode as any) || (aiSettings.mode as any) || 'beginner' }
      );
      const f = files[0] || { path: fenceFilename || `snippet-${Date.now()}.${(lang||'txt')}`, code, fence: lang } as any;
      const { tabId } = await editorOpenNewTab({ filename: f.path, code: f.code, language: inferFenceLang(f.fence, f.code) });
                  await previewRun(tabId);
                }});
              } catch { addNotification('error','Preview failed – Retry?',4000); }
            }}
          />
        </React.Suspense>
      );
      lastIndex = match.index + full.length;
    }
    const remaining = content.slice(lastIndex);
    if (remaining) {
  const highlighted = applySearchHighlight(highlightInline(escapeHtml(remaining)));
      parts.push(<TextFlow key={`t-end`} dangerouslySetInnerHTML={{ __html: highlighted }} />);
    }
    if (parts.length === 0) {
  const highlighted = applySearchHighlight(highlightInline(escapeHtml(content)));
  return <TextFlow dangerouslySetInnerHTML={{ __html: highlighted }} />;
    }
    return <div>{parts}</div>;
  };

  // Copy All Messages Function
  const copyAllMessages = async () => {
    const allText = messages
      .map(msg => `${msg.type.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allText);
      addNotification('success', 'All messages copied to clipboard!');
    } catch (error) {
      addNotification('error', 'Cannot access clipboard. Use HTTPS or allow clipboard permissions.');
    }
  };

  // Prompt 6 — Apply handler exists in EnhancedIDE command wiring.

  const addNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string, duration = 3000) => {
    try { showToast({ kind: type, message, duration, contextKey: `ai:${type}:${message}` }); } catch {}
  };

  // removeNotification helper removed (inline closures handle dismissal)

  // Connection Status Management
  const updateConnectionStatus = (provider: string, status: 'connected' | 'disconnected' | 'testing' | 'error') => {
    setConnectionStatus(prev => ({ ...prev, [provider]: status }));
  };

  // API Response Time Tracking
  const trackApiResponseTime = (provider: string, startTime: number) => {
    const responseTime = Date.now() - startTime;
    setApiResponseTimes(prev => ({ ...prev, [provider]: responseTime }));
    return responseTime;
  };

  // Activity Tracking
  const updateActivity = () => {
    // Activity tracking logic can be added here if needed
  };

  // Prompt 6 — helper to extract first fenced code block
  function extractFirstFencedBlock(text: string) {
    const re = /(?:^|\n)(`{3,}|~{3,})([\w+-]*)[^\n]*\n([\s\S]*?)\1/m;
    const m = re.exec(text);
    return {
      languageFromFence: (m?.[2] || '').trim() || null,
      codeBlock: m?.[3] || null,
    } as { languageFromFence: string | null; codeBlock: string | null };
  }

  // Prompt 8 — small retry helper with jitter for transient errors
  const withRetries = useCallback(async function withRetries<T>(fn: () => Promise<T>, canRetry: (e:any)=>boolean, max=2): Promise<T> {
    let attempt = 0;
    for (;;) {
      try { return await fn(); }
      catch (e) {
        attempt++;
        if (attempt > max || !canRetry(e)) throw e;
        const base = 500 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 250);
        await new Promise(r => setTimeout(r, base + jitter));
      }
    }
  }, []);
  const isTransient = useCallback((e:any) => {
    try { const k = classifyError(e); return k==='rate'||k==='timeout'||k==='server'||k==='network'; }
    catch { return false; }
  }, []);

  // =========================
  // Prompt 6 — Selection actions runner
  // =========================
  function getActiveEditorLike() {
    const store = useEditorStore.getState();
    const tab = store.tabs.find((t: any) => t.id === store.activeTabId) || null;
    if (!tab) return null;
    return {
      filename: tab.name,
      language: tab.language,
      getValue: () => tab.content || '',
      getSelectionText: () => {
        // current store doesn’t persist granular selections; fallback to full file
        return '';
      },
      replaceSelection: async (text: string) => {
        await replaceSelection({ code: text, language: inferFenceLang(tab.language, text) });
      },
    };
  }

  async function runAiOnSelection(action: AiSelectionAction) {
    const active = getActiveEditorLike();
    if (!active) {
      addNotification('warning', 'No active editor.');
      return;
    }
    const filename = active.filename || 'untitled';
    const fullContent = active.getValue();
    const sel = active.getSelectionText();
    const hasSel = !!sel && sel.trim().length > 0;
    if (!hasSel && (action === 'improve' || action === 'commentize')) {
      addNotification('warning', 'Select some code first.');
      return;
    }
    const code = hasSel ? sel : fullContent;
    const lang = detectLangFromFilename(filename) || active.language || '';
    const settings = aiSettings; // already synced with center store
  const system = buildSystemPrompt({ mode: settings.mode as any, preset: null, pinnedContext: loadPinnedContext() });
  const user = buildSelectionUserPrompt({ action: action as any, code, lang, mode: settings.mode });

    // Use streaming pipeline but buffer result; preserves resilience
    const selectedModelData = aiModels.find(m => m.id === (settings.modelId || selectedModel)) || aiModels.find(m => m.id === selectedModel) || aiModels[0];
    if (!selectedModelData) {
      addNotification('error', 'No model selected.');
      return;
    }
  let output = '';
  let streamed = 0;
  // Telemetry locals for selection action
  let selRetryCount = 0;
  let selFallbackModel: string | null = null;
  const selT0 = tStart();
    const provider = selectedModelData.provider as 'openai' | 'anthropic' | 'google' | 'ollama';
    const modelId = selectedModelData.id;
  addNotification('info', `AI ${action === 'improve' ? 'refactor' : action === 'commentize' ? 'comments' : 'explain'}…`);

  const doOnce = async (mid: string) =>
      await new Promise<void>((resolve, reject) => {
        let idleTimer: any = null;
        const hardTimer = setTimeout(() => {
          abortStreaming('request_timeout');
        }, timeouts.hardMs);
        const armIdle = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => abortStreaming('idle_timeout'), timeouts.idleMs);
        };
        armIdle();
  startStreaming({
          provider,
          modelId: mid,
          systemPrompt: system,
          prompt: redactOutbound(user),
          onDelta: chunk => {
            streamed += chunk.length;
            output += chunk;
            armIdle();
          },
          onComplete: () => {
            clearTimeout(hardTimer);
            if (idleTimer) clearTimeout(idleTimer);
            resolve();
          },
          onError: err => {
            clearTimeout(hardTimer);
            if (idleTimer) clearTimeout(idleTimer);
            reject(err);
          }
  }, { groupKey: 'assistant', autoAbortOnVisibilityChange: false });
      });

  try {
    // start telemetry event
    recordTelemetry({ phase: 'selection_action', ts: Date.now(), modelId, mode: aiSettings.mode, action, ok: true });
    await doOnce(modelId);
    } catch (e: any) {
      const info = classifyProviderError(e);
      const canTryFallback = ALLOW_MODEL_FALLBACK && streamed === 0 && (info.type === 'not_found' || info.type === 'bad_request');
      if (canTryFallback) {
        const fb = selectFallbackModel(modelId, provider);
        if (fb) {
          selFallbackModel = fb;
          await doOnce(fb);
        } else {
          throw e;
        }
      } else if (streamed === 0 && info.retryable) {
  await new Promise(r => setTimeout(r, timeouts.retryBackoffMs));
        try {
          selRetryCount += 1;
          await doOnce(modelId);
        } catch (e2: any) {
          if (ALLOW_MODEL_FALLBACK && streamed === 0) {
            const fb = selectFallbackModel(modelId, provider);
            if (fb) {
              selFallbackModel = fb;
              await doOnce(fb);
            } else throw e2;
          } else throw e2;
        }
      } else {
        throw e;
      }
    }

    const result = output.trim();
    // Emit telemetry completion for selection action
    try {
      const elapsed = tEnd(selT0);
      const estTok = estimateTokens(output || '');
      const tps = estTok > 0 ? (estTok / (elapsed / 1000)) : 0;
      recordTelemetry({
        phase: 'selection_action', ts: Date.now(), modelId, mode: aiSettings.mode, action,
        elapsedMs: elapsed, streamedChars: streamed, estTokens: estTok, tokensPerSec: Math.round(tps * 10) / 10,
        retryCount: selRetryCount, fallbackModelId: selFallbackModel, ok: true,
      });
    } catch {}

    if (action === 'explain') {
      await editorOpenNewTab({ filename: `[AI] Explain — ${filename}.md`, code: result, language: 'markdown' as any });
      addNotification('success', 'Explanation generated.');
      return;
    }
    const { codeBlock, languageFromFence } = extractFirstFencedBlock(result);
    const improved = (codeBlock || result || '').trim();
    if (!improved) {
      addNotification('error', 'AI returned no code.');
      return;
    }
    const langToUse = languageFromFence || lang;
    const pref = settings.defaultInsert;
    if (pref === 'new-tab') {
      await editorOpenNewTab({ filename: `[AI] ${action === 'improve' ? 'Improved' : 'Commented'} — ${filename}`, code: improved, language: inferFenceLang(langToUse, improved) });
      addNotification('success', 'Opened AI suggestion in a new tab.');
    } else if (pref === 'replace') {
      await replaceSelection({ code: improved, language: inferFenceLang(langToUse, improved) });
      addNotification('success', 'Selection replaced. (Undo available)');
    } else {
      await insertIntoActive({ code: improved, language: inferFenceLang(langToUse, improved) });
      addNotification('success', 'Inserted AI suggestion. (Undo available)');
    }
  }

  // Expose for palette
  useEffect(() => {
    (window as any).synapseRunAiOnSelection = runAiOnSelection;
    return () => {
      try {
        delete (window as any).synapseRunAiOnSelection;
      } catch {}
    };
  }, [aiSettings, selectedModel, providerKeys]);

  // Check if API key is available for selected model
  const isModelAvailable = (model: typeof aiModels[0]) => {
  switch (model.provider) {
      case 'openai':
    return !!providerKeys.openai;
      case 'anthropic':
    return !!providerKeys.anthropic;
      case 'google':
    return !!providerKeys.google;
      case 'ollama':
    return !!providerKeys.ollama;
      default:
        return false;
    }
  };

  // Compute Ollama base URL (proxy when using localhost)
  const getOllamaBase = () => {
  const configured = providerKeys.ollama || 'http://localhost:11434';
  // If user accidentally set a generic /api base, prefer the dedicated /ollama proxy
  if (/^\/api(\/|$)/.test(configured)) return '/ollama';
  const isLocalDefault = /localhost:11434\/?$/.test(configured);
  return isLocalDefault && typeof window !== 'undefined' ? '/ollama' : configured;
  };

  // One-shot summarization (non-UI, best-effort). Runs without blocking main send.
  const summarizeThread = async (provider: string, modelId: string, payload: { system: string; user: string; keepTailFromIndex: number; }): Promise<string> => {
    try {
      // Use a separate AbortController so this never gets canceled by chat aborts
      const ac = new AbortController();
      const signal = ac.signal;
      // Hard cap for summary only
  const t = setTimeout(() => ac.abort(), timeouts.hardMs);
    // Redact outbound system/user content
    const sys = redactOutbound(payload.system);
    const usr = redactOutbound(payload.user);

      if (provider === 'openai') {
  const apiKey = providerKeys.openai; if (!apiKey) return '';
        // Send the selected model id as-is; rely on runtime fallback for unsupported models
        const effective = modelId;
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: effective, messages: [ { role: 'system', content: sys }, { role: 'user', content: usr } ], temperature: 0.2, stream: false }),
          signal
        });
  if (!res.ok) { clearTimeout(t); return ''; }
        const data = await res.json();
  clearTimeout(t);
        return data.choices?.[0]?.message?.content || '';
      }
      if (provider === 'anthropic') {
  const apiKey = providerKeys.anthropic; if (!apiKey) return '';
        const userPrompt = `${sys}\n\n${usr}`;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: modelId, max_tokens: 800, messages: [{ role: 'user', content: userPrompt }] }),
          signal
        });
  if (!res.ok) { clearTimeout(t); return ''; }
        const data = await res.json();
  clearTimeout(t);
        return data.content?.[0]?.text || '';
      }
      if (provider === 'google') {
  const apiKey = providerKeys.google; if (!apiKey) return '';
        const userPrompt = `${sys}\n\n${usr}`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }], generationConfig: { maxOutputTokens: 900, temperature: 0.2 } }),
          signal
        });
  if (!res.ok) { clearTimeout(t); return ''; }
        const data = await res.json();
  clearTimeout(t);
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      if (provider === 'ollama') {
        const base = getOllamaBase();
        const userPrompt = `${sys}\n\n${usr}`;
        const res = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, prompt: userPrompt, stream: false }), signal });
        if (!res.ok) { clearTimeout(t); return ''; }
        const data = await res.json();
        clearTimeout(t);
        return data.response || '';
      }
      clearTimeout(t);
      return '';
    } catch { return ''; }
  };

  // Fetch available Ollama models with status tracking
  const fetchOllamaModels = async () => {
    if (!providerKeys.ollama) return;
    const base = getOllamaBase();
    updateConnectionStatus('ollama', 'testing');
    const t0 = Date.now();
    try {
      const response = await fetch(`${base}/api/tags`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const modelNames = data.models?.map((m: any) => m.name) || [];
      setOllamaModels(modelNames);
      const ms = trackApiResponseTime('ollama', t0);
      updateConnectionStatus('ollama', 'connected');
      addNotification('success', `Ollama connected (${ms}ms)`, 2000);
    } catch (e: any) {
      updateConnectionStatus('ollama', 'error');
      addNotification('error', `Ollama models fetch failed: ${e?.message || 'Unknown error'}`, 4000);
    }
  };

  // Provider Health Check (lightweight connectivity checks)
  /* const runHealthCheck = async () => {
    const checks: Promise<void>[] = [];

    // OpenAI
  if (providerKeys.openai) {
      updateConnectionStatus('openai', 'testing');
      const t0 = Date.now();
      checks.push((async () => {
        try {
          const res = await fetch('https://api.openai.com/v1/models?limit=1', {
            headers: { Authorization: `Bearer ${providerKeys.openai}` }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ms = trackApiResponseTime('openai', t0);
          updateConnectionStatus('openai', 'connected');
          addNotification('success', `OpenAI reachable (${ms}ms)`, 2000);
        } catch (e: any) {
          updateConnectionStatus('openai', 'error');
          addNotification('error', `OpenAI check failed: ${e?.message || 'Unknown error'}`, 4000);
        }
      })());
    }

    // Anthropic (best-effort)
  if (providerKeys.anthropic) {
      updateConnectionStatus('anthropic', 'testing');
      const t0 = Date.now();
      checks.push((async () => {
        try {
          const res = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': providerKeys.anthropic,
              'anthropic-version': '2023-06-01'
            }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ms = trackApiResponseTime('anthropic', t0);
          updateConnectionStatus('anthropic', 'connected');
          addNotification('success', `Anthropic reachable (${ms}ms)`, 2000);
        } catch (e: any) {
          updateConnectionStatus('anthropic', 'error');
          addNotification('error', `Anthropic check failed: ${e?.message || 'Unknown error'}`, 4000);
        }
      })());
    }

    // Google (Gemini) best-effort
  if (providerKeys.google) {
      updateConnectionStatus('google', 'testing');
      const t0 = Date.now();
      checks.push((async () => {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(providerKeys.google)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ms = trackApiResponseTime('google', t0);
          updateConnectionStatus('google', 'connected');
          addNotification('success', `Google reachable (${ms}ms)`, 2000);
        } catch (e: any) {
          updateConnectionStatus('google', 'error');
          addNotification('error', `Google check failed: ${e?.message || 'Unknown error'}`, 4000);
        }
      })());
    }

    // Ollama
  if (providerKeys.ollama) {
      const base = getOllamaBase();
      updateConnectionStatus('ollama', 'testing');
      const t0 = Date.now();
      checks.push((async () => {
        try {
          const ping = await fetch(`${base}/api/version`);
          if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
          await fetchOllamaModels();
          const ms = trackApiResponseTime('ollama', t0);
          updateConnectionStatus('ollama', 'connected');
          addNotification('success', `Ollama connected (${ms}ms)`, 2000);
        } catch (e: any) {
          updateConnectionStatus('ollama', 'error');
          addNotification('error', `Ollama check failed: ${e?.message || 'Unknown error'}`, 4000);
        }
      })());
    }

    if (checks.length === 0) {
      addNotification('info', 'No providers configured. Add API keys or Ollama URL first.', 3000);
      return;
    }
    await Promise.all(checks);
  }; */

  // Get filtered languages by category
  const getFilteredLanguages = () => {
    if (languageCategory === 'all') return languages;
    return languages.filter(lang => lang.category === languageCategory);
  };

  // Get filtered models by provider and availability
  const getFilteredModels = () => {
  let filtered = [...aiModels];
    
    // Add dynamically fetched Ollama models
    if (ollama.length > 0) {
      const dynamicOllamaModels = ollama.map(modelName => ({
        id: modelName,
        name: modelName,
        provider: 'ollama' as const,
        description: `Local Ollama model: ${modelName}`,
        contextLength: 'Variable',
        strengths: ['Local', 'Privacy', 'No API costs', 'Fast']
      }));
      
      // Remove static Ollama models that aren't actually installed
      filtered = filtered.filter(model => 
        model.provider !== 'ollama' || ollama.includes(model.id)
      );
      
      // Add dynamic Ollama models that aren't already in the static list
      dynamicOllamaModels.forEach(dynamicModel => {
        if (!filtered.find(model => model.id === dynamicModel.id)) {
          filtered.push(dynamicModel);
        }
      });
    } else {
      // If no Ollama models fetched yet, keep curated static Ollama entries visible
      // so the user knows local options exist and can trigger a refresh.
    }
    
    if (modelProvider !== 'all') {
  // Always allow ollama dynamic models to show when provider=ollama OR when provider filter mismatched but user selected an ollama model
  filtered = filtered.filter(model => model.provider === modelProvider || (model.provider === 'ollama' && selectedModel === model.id));
    }

    // STEP 6: apply MODEL_OPTIONS filtering (hide hidden unless selected)
    const visibleIds = new Set(
      MODEL_OPTIONS.filter(opt => !opt.hidden || selectedModel === opt.id).map(o => o.id)
    );
  // Keep dynamic/local Ollama models even if not declared in MODEL_OPTIONS (they're discovered at runtime)
  filtered = filtered.filter(m => visibleIds.has(m.id) || m.provider === 'ollama');

    return filtered;
  };

  // Group models by provider with badges (using MODEL_OPTIONS metadata)
  const getGroupedModels = () => {
    const byProvider: Record<string, ReturnType<typeof getFilteredModels>> = {} as any;
    getFilteredModels().forEach(m => {
      if (!byProvider[m.provider]) byProvider[m.provider] = [] as any;
      byProvider[m.provider].push(m);
    });
    return byProvider;
  };

  // Get available providers based on API keys
  const getAvailableProviders = () => {
    const providers = ['all'];
  if (providerKeys.openai) providers.push('openai');
  if (providerKeys.anthropic) providers.push('anthropic');
  if (providerKeys.google) providers.push('google');
  if (providerKeys.ollama) providers.push('ollama'); // show provider always if endpoint configured
    return providers;
  };

  // provider API calls centralized in useAiStreaming hook

  // (legacy provider functions removed after central streaming hook introduction)

  // Naive language intent detector from prompt text (fences, keywords, extensions)
  const detectLanguageIntent = (text: string): string | null => {
    try {
      // code fence language
      const fence = text.match(/```\s*([a-zA-Z0-9#+-]+)/);
      if (fence && fence[1]) return fence[1].toLowerCase();
      const lower = text.toLowerCase();
      const table: Record<string, string[]> = {
        javascript: ['javascript', 'js', '.js', 'node.js', 'nodejs'],
        typescript: ['typescript', 'ts', '.ts'],
        python: ['python', 'py', '.py'],
        java: ['java', '.java'],
        csharp: ['c#', 'csharp', '.cs'],
        cpp: ['c++', 'cpp', '.cpp', '.cc', '.cxx'],
        c: ['c ', ' c\n', '.c'],
        go: ['golang', 'go ', ' go\n', '.go'],
        rust: ['rust', '.rs'],
        php: ['php', '.php'],
        ruby: ['ruby', '.rb'],
        swift: ['swift', '.swift'],
        kotlin: ['kotlin', '.kt'],
        scala: ['scala', '.scala'],
      };
      for (const [lang, keys] of Object.entries(table)) {
        if (keys.some(k => lower.includes(k))) return lang;
      }
      return null;
    } catch { return null; }
  };

  const handleSendMessage = async () => {
    // Reentrancy guard: ignore while typing or streaming
    if (isTyping || streamState.isStreaming) return;
  if (flags.aiTrace) logger.info('[SEND_CLICK]', 'isTyping=', String(isTyping), 'isStreaming=', String(streamState.isStreaming));
    const source = (overrideContentRef.current ?? input);
    const raw = source.replace(/[ \t]+$/gm, '').trim();
    if (!raw || isTyping) return;

    // Resolve effective model (do not mutate yet)
    const effectiveModelId = pickEffectiveModel(selectedModel, aiSettings);

    // Parse optional inline preset directive
    let finalContent = raw;
    let directivePresetId: string | null = null;
    const dirMatch = finalContent.match(/^\s*preset:([a-zA-Z0-9-_]+)\s*/i);
    if (dirMatch) {
      directivePresetId = dirMatch[1];
      finalContent = finalContent.slice(dirMatch[0].length);
    }

    // Validate model/provider compatibility and keys before doing anything visible
    try {
      const selectedForValidation = getFilteredModels().find(m => m.id === (effectiveModelId || selectedModel));
      const provider = (selectedForValidation?.provider || (advSettings as any)?.provider) as any;
      if (provider) {
        const v = validateSelection(provider, effectiveModelId || selectedModel, 'chat_stream');
        if (!v.ok) {
          const alt = (v.alternatives || []).map(a => a.label).slice(0, 3).join(', ');
          const msg = v.reason + (alt ? ` Try: ${alt}` : '');
          showToast({
            kind: 'warning',
            contextKey: 'model-compat',
            title: 'Model seçimi bu işlemle uyumlu değil',
            message: msg || 'Seçilen model bu akışta desteklenmiyor. Ayarlar → Model seçin veya önerilenlerden birini kullanın.'
          });
          return;
        }
      }
    } catch {}

    // (A) Append user bubble immediately (unless suppressed for queued sends)
    if (!suppressNextUserAppendRef.current) {
      const userMessage = makeUserMessage(finalContent, effectiveModelId, selectedLanguage);
      appendMessagesDeferred([userMessage]);
      if (flags.aiTrace) logger.debug('[USER_BUBBLE_APPENDED]', 'len=', String(finalContent.length));
      scrollToBottom();
  setInput('');
  scheduleAdjustTextarea();
    }
    // Reset overrides after we've captured content
    overrideContentRef.current = null;
    suppressNextUserAppendRef.current = false;

  // (B) Abort previous stream if any
    if (streamState.isStreaming) {
      if (flags.aiTrace) logger.warn('[ABORT_PREVIOUS_STREAM]', 'reason=new_request');
      try { await abortStreaming('new_request'); } catch {}
  clearFlushTimer();
  flushStreamBuffer();
      currentStreamingMsgIdRef.current = null;
      clearIdleTimeout();
  if (isMountedRef.current) setIsTyping(false);
      addNotification('info', 'Canceled previous response');
  try { emitTelemetry('send_abort', { reason: 'new_request' }); } catch {}
  await new Promise(r => setTimeout(r, 80));
    }

  updateActivity();
  const selectedModelData = getFilteredModels().find(m => m.id === (effectiveModelId || selectedModel));
  const modelMeta = selectedModelData ? { id: selectedModelData.id, name: selectedModelData.name, provider: selectedModelData.provider } : null;

    // Warn if prompt language intent mismatches selected language (non-blocking)
    try {
      const intent = detectLanguageIntent(finalContent);
      if (intent && selectedLanguage && intent !== selectedLanguage.toLowerCase()) {
        appendMessagesDeferred([makeSystemMessage(`The requested language (${intent}) doesn\'t match the selected language (${selectedLanguage}). I\'ll answer in ${selectedLanguage}.`)]);
        addNotification('warning', "Prompt language doesn't match the selected language; the response will use the selected language.", 3500);
      }
    } catch {}
    const currentInput = finalContent;
    // If we used a preset, clear it for subsequent messages (user can reselect)
    if (activePreset) {
      // activePreset preserved; no removal from localStorage for usability
    }
    // (C) Validate environment for streaming
    if (!isOnline()) {
      const note = 'You appear to be offline. Your message was queued and will send when you reconnect.';
      appendMessagesDeferred([makeSystemMessage(note)]);
      setLastSystemNote(note);
      // Queue the content for later
  enqueueOffline({ content: finalContent, lang: selectedLanguage, ...(effectiveModelId ? { model: effectiveModelId } : {}) });
      scrollToBottom();
      return;
    }

    // Centralized model/key guard
    {
      const guardMsg = guardModelAndKeys(
        modelMeta ? ({ provider: modelMeta.provider } as any) : null,
        effectiveModelId
      );
      if (guardMsg) {
        appendMessagesDeferred([makeSystemMessage(guardMsg)]);
        setLastSystemNote(guardMsg);
        scrollToBottom();
        return;
      }
    }

  // modelMeta is guaranteed from here on; use a narrowed alias to avoid non-null assertions
  const assuredModel = modelMeta as { id: string; name: string; provider: typeof modelMeta extends infer T ? T extends { provider: infer P } ? P : any : any };

  setIsTyping(true);
  // a11y removed

  // Track API call start time
  const startTime = Date.now();
  // selectedModelData is defined by validation above
  updateConnectionStatus(assuredModel.provider as any, 'testing');

  try {
  if (flags.aiTrace) logger.info('[REQUEST_INIT]', 'provider=', String(assuredModel.provider), 'model=', String(assuredModel.id));
      // Preflight: if provider is ollama, check endpoint and suggest pulling models when needed
  if (assuredModel.provider === 'ollama') {
        const configured = providerKeys.ollama || 'http://localhost:11434';
        const isLocalDefault = /localhost:11434\/?$/.test(configured);
        const base = isLocalDefault && typeof window !== 'undefined' ? '/ollama' : configured;
        try {
          const ping = await fetch(`${base}/api/version`, { method: 'GET' });
          if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
        } catch (e) {
          addNotification('error', 'Ollama is not reachable at the configured URL. Ensure Ollama is running (default http://localhost:11434).', 5000);
          throw e;
        }
      }
  const responseTime = trackApiResponseTime(assuredModel.provider, startTime);
  updateConnectionStatus(assuredModel.provider, 'connected');
  const newMsgId = uuid();
      // Conversation continuity: load thread and kick off summarization if needed (non-blocking)
      const projectId = projectIdRef.current || 'default';
      let thread = loadThread(projectId);
      if (shouldSummarize(thread)) {
        const payload = buildSummaryRequestPayload(thread);
        // Fire-and-forget summarization
        (async () => {
          telSummT0Ref.current = tStart();
          const sum = await summarizeThread(assuredModel.provider as any, assuredModel.id, payload);
          if (sum && sum.trim()) {
            replaceThread(projectId, (t) => ({
              ...t,
              summary: ((t.summary ? t.summary + '\n\n' : '') + sum).trim(),
              messages: t.messages.slice(payload.keepTailFromIndex)
            }));
            telSummElapsedRef.current = tEnd(telSummT0Ref.current);
            recordTelemetry({ phase: 'summary_run', ts: Date.now(), elapsedMs: telSummElapsedRef.current, ok: true });
          }
        })().catch(() => {
          recordTelemetry({ phase: 'summary_error', ts: Date.now(), elapsedMs: tEnd(telSummT0Ref.current), ok: false, note: 'silent summary failed' });
        });
      }
    // Freeze mode at send time (per-request) and append user to thread
    const frozenMode: 'beginner' | 'pro' = (aiSettings.mode as any) || (beginnerMode ? 'beginner' : 'pro');
    thread = appendToThread(projectId, { role: 'user', content: currentInput, ts: Date.now(), modelId: aiSettings.modelId || selectedModel, mode: frozenMode });
  let aggregated = '';
  currentStreamingMsgIdRef.current = newMsgId;
  appendMessagesDeferred([makeAiPlaceholder(effectiveModelId, selectedLanguage, frozenMode, newMsgId)]);
      scrollToBottom();
      // Start idle timeout monitoring for streaming
      armIdleTimeout();
  addNotification('success', `Streaming from ${assuredModel.name} (${responseTime}ms)` ,1500);
      // Compose system prompt using mode + preset + summary + pinned context
  const inlinePreset = directivePresetId ? findPresetById(aiSettings.mode, directivePresetId) : null;
      const resolvedPreset = inlinePreset ?? findPresetById(aiSettings.mode, activePreset);
      const pinned = loadPinnedContext();
    let systemPrompt = buildSystemPrompt({ mode: frozenMode, preset: resolvedPreset ?? null, pinnedContext: [] });
      // Enforce target language and output style for pro behavior
      if (selectedLanguage) {
        const fenceLang = selectedLanguage.toLowerCase();
        systemPrompt += `\n\nOutput requirements:\n- Target programming language: ${selectedLanguage}.\n- When the user requests code or when code is the best answer, respond primarily with a single fenced code block using \`\`\`${fenceLang}\`\`\`.\n- Keep explanations minimal unless explicitly requested; prioritize complete, runnable code.\n- If the user asks a different language, still prefer ${selectedLanguage} unless explicitly told otherwise.`;
      }
      if (thread.summary) {
        systemPrompt += `\n\nConversation summary:\n${thread.summary}`;
      }
      if (pinned.length) {
        systemPrompt += `\n\nPinned context:\n- ${pinned.join('\n- ')}`;
      }

      // Soft-limit warning on prompt size (~75% of context)
      try {
        const approx = estimateTokens(systemPrompt + "\n\n" + finalContent);
        if (approx > Math.floor(CONTEXT_BUDGET_TOKENS * 0.75)) {
          // Show non-blocking toast; require user to click Continue
          let proceed = false;
          await new Promise<void>((resolve) => {
            showToast({
              kind: 'warning',
              title: 'Large prompt',
              message: `~${approx} tokens. Continue?`,
              duration: -1,
              contextKey: 'prompt:large',
              action: { label: 'Continue', onClick: () => { proceed = true; resolve(); } }
            });
          });
          if (!proceed) {
            const msg = 'Canceled by user due to large prompt.';
            appendMessagesDeferred([makeSystemMessage(msg)]);
            setLastSystemNote(msg);
            setIsTyping(false);
            return;
          }
        }
      } catch {}

  const buildPrompt = () => {
        try {
          const margin = 1500; // leave space for response
          const reversed = [...thread.messages].reverse();
          const acc: { role: string; content: string }[] = [];
          let used = estimateTokens(systemPrompt);
          for (const m of reversed) {
            const safe = (m.role === 'user' || m.role === 'assistant') ? redactOutbound(m.content) : m.content;
            const line = `[${m.role}] ${safe}\n`;
            const cost = estimateTokens(line);
            if (used + cost > (CONTEXT_BUDGET_TOKENS - margin)) break;
            acc.push({ role: m.role, content: safe });
            used += cost;
          }
          acc.reverse();
          const historyBlob = acc.map(m => `[${m.role}] ${m.content}`).join('\n');
          return (historyBlob ? historyBlob + '\n\n' : '') + redactOutbound(currentInput);
        } catch { return currentInput; }
      };

  const clearTimers = () => {
        if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
        if (hardTimerRef.current) { clearTimeout(hardTimerRef.current); hardTimerRef.current = null; }
      };
      const armIdle = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  idleTimerRef.current = window.setTimeout(() => {
          abortStreaming('idle_timeout');
  }, timeouts.idleMs) as unknown as ReturnType<typeof window.setTimeout>;
      };
      const armHard = () => {
        if (hardTimerRef.current) clearTimeout(hardTimerRef.current);
  hardTimerRef.current = window.setTimeout(() => {
          abortStreaming('request_timeout');
  }, timeouts.hardMs) as unknown as ReturnType<typeof window.setTimeout>;
      };
      const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Telemetry start of main request
  telReqT0Ref.current = tStart();
      telCharsRef.current = 0;
      telRetryRef.current = 0;
      telFallbackModelRef.current = null;
  flushCountRef.current = 0;
  emitTelemetry('send_start', { model: assuredModel.id });
      recordTelemetry({
        phase: 'chat_start', ts: Date.now(), modelId: aiSettings.modelId || null, mode: aiSettings.mode,
        action: (directivePresetId ? `preset:${directivePresetId}` : (activePreset ? `preset:${activePreset}` : 'chat')),
        summarization: telSummElapsedRef.current
          ? { triggered: true, elapsedMs: telSummElapsedRef.current }
          : { triggered: false },
      });

  let firstTokenAt: number | null = null;
  const sendOnce = (modelIdToUse: string) => new Promise<string>((resolve, reject) => {
        let settled = false;
  streamedCharsRef.current = 0;
  aggregated = '';
  // openFence tracking handled within applyChunkToLastAssistantMessage during streaming
  // reset message content for retry or fallback
  replaceMessageDeferred(newMsgId, (m) => ({
    ...m,
  content: (frozenMode === 'beginner') ? "(Beginner Mode Enabled)\n" : '',
  streamedContent: (frozenMode === 'beginner') ? "(Beginner Mode Enabled)\n" : '',
    openFence: null,
    model: modelIdToUse
  } as Message));
        armIdle(); armHard();
        // Bind per-frame delta processor now that scoped vars are ready
        processDeltaRef.current = (chunk: string) => {
          if (!chunk) return;
          if (firstTokenAt === null) {
            try { firstTokenAt = performance.now(); } catch { firstTokenAt = 0; }
            if (flags.aiTrace) logger.info('[FIRST_DELTA]');
          }
          if (flags.aiTrace) logger.debug('[DELTA]', 'n=', String(chunk.length));
          // a11y removed: no announce
          streamedCharsRef.current += chunk.length;
          telCharsRef.current += chunk.length;
          aggregated += chunk;
          // Append to buffer and schedule rAF flush
          streamBufferRef.current += chunk;
          flushStreamBuffer();
        };
        startStreaming({
          provider: assuredModel.provider as any,
          modelId: modelIdToUse,
          prompt: buildPrompt(),
          systemPrompt,
          temperature: typeof aiSettings.temperature === 'number' ? aiSettings.temperature : undefined,
          topP: typeof aiSettings.topP === 'number' ? aiSettings.topP : undefined,
          seed: typeof aiSettings.seed !== 'undefined' ? aiSettings.seed as any : undefined,
          onDelta: (delta) => { enqueueDelta(delta || ''); },
          onComplete: (full) => {
            if (settled) return; settled = true;
            clearTimers();
            clearFlushTimer();
            flushStreamBuffer();
            clearIdleTimeout();
            if (isMountedRef.current) setIsTyping(false);
            // Mark the assistant message as finished streaming
            try { if (isMountedRef.current) replaceMessageDeferred(newMsgId, (m) => ({ ...m, isStreaming: false } as Message)); } catch {}
            // a11y removed
            if (flags.aiTrace) logger.info('[STREAM_DONE]');
            try { emitTelemetry('send_complete', { chars: (aggregated || '').length, flushes: flushCountRef.current || 0 }); } catch {}
            try {
              const elapsed = tEnd(telReqT0Ref.current);
              const estTok = estimateTokens(aggregated || '');
              const tps = estTok > 0 ? (estTok / (elapsed / 1000)) : 0;
              recordTelemetry({
                phase: 'chat_complete', ts: Date.now(), modelId: aiSettings.modelId || null, mode: aiSettings.mode,
                action: (directivePresetId ? `preset:${directivePresetId}` : (activePreset ? `preset:${activePreset}` : 'chat')),
                elapsedMs: elapsed, streamedChars: telCharsRef.current, estTokens: estTok,
                tokensPerSec: Math.round(tps * 10) / 10, retryCount: telRetryRef.current,
                fallbackModelId: telFallbackModelRef.current,
                summarization: telSummElapsedRef.current
                  ? { triggered: true, elapsedMs: telSummElapsedRef.current }
                  : { triggered: false },
                ok: true,
              });
              if ((localStorage.getItem('synapse.ai.telemetry') || '') === 'verbose') {
                console.table(flushTelemetryBuffer());
              }
            } catch {}
            resolve(full);
          },
          onError: (err) => {
            if (settled) return; settled = true;
            clearTimers();
            clearFlushTimer();
            flushStreamBuffer();
            clearIdleTimeout();
            // If we error while streaming, offer Continue for this message id
            try { lastAbortedMsgIdRef.current = newMsgId; } catch {}
            currentStreamingMsgIdRef.current = null;
            // Mark the assistant message as not streaming so footer updates
            try { if (isMountedRef.current) replaceMessageDeferred(newMsgId, (m) => ({ ...m, isStreaming: false } as Message)); } catch {}
            try { const kind = classifyError(err); emitTelemetry('send_error', { kind }); const msg = userFacingMessage(kind); appendMessagesDeferred([ makeSystemMessage(msg) ]); setLastSystemNote(msg); } catch {}
            // a11y removed block
            try {
              const code = (err && typeof err === 'object' && 'code' in (err as any)) ? String((err as any).code) : 'unknown';
              const payload: Parameters<typeof reportError>[0] = { source: 'adapter', code, provider: assuredModel.provider as any, model: modelIdToUse };
              const s = (err && typeof err === 'object' && 'status' in (err as any)) ? Number((err as any).status) : null;
              if (s !== null) (payload as any).status = s;
              const m = (err as any)?.message; if (typeof m === 'string') (payload as any).message = m;
              reportError(payload);
            } catch {}
            try {
              recordTelemetry({
                phase: 'chat_error', ts: Date.now(), modelId: aiSettings.modelId || null, mode: aiSettings.mode,
                action: (directivePresetId ? `preset:${directivePresetId}` : (activePreset ? `preset:${activePreset}` : 'chat')),
                elapsedMs: tEnd(telReqT0Ref.current), streamedChars: telCharsRef.current,
                retryCount: telRetryRef.current, fallbackModelId: telFallbackModelRef.current, ok: false, note: 'stream failed'
              });
              if ((localStorage.getItem('synapse.ai.telemetry') || '') === 'verbose') {
                console.table(flushTelemetryBuffer());
              }
            } catch {}
            if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((err as any)?.message || err));
            reject(err);
          }
  }, { groupKey: 'assistant', autoAbortOnVisibilityChange: false });
      });

      try {
        await withRetries(
          () => sendOnce(assuredModel.id),
          isTransient,
          2
        );
        addNotification('success', 'Response complete', 1500);
  } catch (err1: any) {
        const info1 = classifyProviderError(err1);
        // If the selected model is unsupported/invalid, try an immediate fallback before retrying
        if (ALLOW_MODEL_FALLBACK && streamedCharsRef.current === 0 && (info1.type === 'not_found' || info1.type === 'bad_request')) {
          const fb = selectFallbackModel(assuredModel.id, assuredModel.provider as any);
          if (fb) {
            addNotification('info', `Selected model unavailable. Falling back to ${fb}…`, 2000);
            telFallbackModelRef.current = fb;
            try {
              await sendOnce(fb);
              addNotification('success', `Response from fallback ${fb}`, 1500);
              recordTelemetry({ phase: 'fallback_used', ts: Date.now(), modelId: aiSettings.modelId || null, mode: aiSettings.mode, action: (directivePresetId ? `preset:${directivePresetId}` : (activePreset ? `preset:${activePreset}` : 'chat')), fallbackModelId: fb, ok: true });
              return;
            } catch (errFb: any) {
              // continue into regular error flow below
            }
          }
        }
        if (info1.retryable && streamedCharsRef.current === 0) {
          addNotification('warning', 'Transient error – retrying…', 1800);
          await wait(timeouts.retryBackoffMs);
          telRetryRef.current += 1;
          try {
            await sendOnce(assuredModel.id);
            addNotification('success', 'Response complete', 1500);
          } catch (err2: any) {
            classifyProviderError(err2);
            if (ALLOW_MODEL_FALLBACK && streamedCharsRef.current === 0) {
              const fb = selectFallbackModel(assuredModel.id, assuredModel.provider as any);
              if (fb) {
                addNotification('info', `Falling back to ${fb}…`, 1800);
                telFallbackModelRef.current = fb;
                try {
                  await sendOnce(fb);
                  addNotification('success', `Response from fallback ${fb}`, 1800);
                  recordTelemetry({ phase: 'fallback_used', ts: Date.now(), modelId: aiSettings.modelId || null, mode: aiSettings.mode, action: (directivePresetId ? `preset:${directivePresetId}` : (activePreset ? `preset:${activePreset}` : 'chat')), fallbackModelId: fb, ok: true });
                  return;
                } catch (err3: any) {
                  const det = handleError(err3);
                  updateConnectionStatus(assuredModel.provider as any, 'error');
                  const hint = (assuredModel.provider === 'ollama')
                    ? '\nHint: Ollama çalışıyor ve model yüklü olmalı:\n   1) Ollama’yı başlatın\n   2) Terminal:  ollama pull <model>\n   3) Ayarlar → Providers → Ollama URL kontrol edin'
                    : '';
                  const errorMessage: Message = { id: (Date.now() + 2).toString(), type: 'system', content: `❌ Error: ${det.message}${hint}`, timestamp: new Date() };
                  appendMessagesDeferred([errorMessage]);
                  setLastSystemNote(det.message);
                  setIsTyping(false);
                  if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((err3 as any)?.message || err3));
                }
              } else {
                const det = handleError(err2);
                updateConnectionStatus(assuredModel.provider as any, 'error');
                const hint = (assuredModel.provider === 'ollama')
                  ? '\nHint: Ollama çalışıyor ve model yüklü olmalı:\n   1) Ollama’yı başlatın\n   2) Terminal:  ollama pull <model>\n   3) Ayarlar → Providers → Ollama URL kontrol edin'
                  : '';
                const errorMessage: Message = { id: (Date.now() + 2).toString(), type: 'system', content: `❌ Error: ${det.message}${hint}`, timestamp: new Date() };
                appendMessagesDeferred([errorMessage]);
                setLastSystemNote(det.message);
                setIsTyping(false);
                if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((err2 as any)?.message || err2));
              }
            } else {
              const det = handleError(err2);
              updateConnectionStatus(assuredModel.provider as any, 'error');
              const hint = (assuredModel.provider === 'ollama')
                ? '\nHint: Ollama çalışıyor ve model yüklü olmalı:\n   1) Ollama’yı başlatın\n   2) Terminal:  ollama pull <model>\n   3) Ayarlar → Providers → Ollama URL kontrol edin'
                : '';
              const errorMessage: Message = { id: (Date.now() + 2).toString(), type: 'system', content: `❌ Error: ${det.message}${hint}`, timestamp: new Date() };
              appendMessagesDeferred([errorMessage]);
              setLastSystemNote(det.message);
              setIsTyping(false);
              if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((err2 as any)?.message || err2));
            }
          }
        } else {
          const det = handleError(err1);
          updateConnectionStatus(assuredModel.provider as any, 'error');
          const hint = (assuredModel.provider === 'ollama')
            ? '\nHint: Ollama çalışıyor ve model yüklü olmalı:\n   1) Ollama’yı başlatın\n   2) Terminal:  ollama pull <model>\n   3) Ayarlar → Providers → Ollama URL kontrol edin'
            : '';
          const errorMessage: Message = { id: (Date.now() + 2).toString(), type: 'system', content: `❌ Error: ${det.message}${hint}`, timestamp: new Date() };
          appendMessagesDeferred([errorMessage]);
          setLastSystemNote(det.message);
          setIsTyping(false);
          if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((err1 as any)?.message || err1));
        }
      }
      
    } catch (error) {
      console.error('API call failed:', error);
  updateConnectionStatus(assuredModel.provider as any, 'error');
      
      const errorDetails = handleError(error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
  content: `❌ Error calling ${assuredModel.provider} API: ${errorDetails.message}`,
        timestamp: new Date()
      };
      appendMessagesDeferred([errorMessage]);
  setLastSystemNote(errorDetails.message);
  addNotification(errorDetails.errorType === 'auth' ? 'warning' : 'error', `${assuredModel.name}: ${errorDetails.message}`, 5000);
  if (flags.aiTrace) logger.error('[STREAM_ERROR]', String((error as any)?.message || error));
      
    } finally {
      setIsTyping(false);
    }
  };

  // Keep a ref to the latest send function for keyboard handlers
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
    return () => { handleSendMessageRef.current = null; };
  }, [handleSendMessage]);

  // Helper: set preset as current input + flag then reuse handleSendMessage
  const sendPresetMessage = (presetKey: string, presetPrompt: string) => {
    if (isTyping) return;
    try { localStorage.setItem('synapse.ai.lastPreset', presetKey); } catch {}
    setActivePreset(presetKey);
    setInput(presetPrompt);
  scheduleAdjustTextarea();
    if (beginnerMode) {
      setTimeout(() => { handleSendMessage(); }, 0);
