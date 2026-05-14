import { create } from "zustand";
import type { AIContextType, PromptTemplate } from "../constants/ai";
import type { ContentFormat } from "../constants/content-formats";

export interface AIContext {
  type: AIContextType;
  contextId: string | null;
  label: string;
  // Optional refinement so the prompt list can be format-aware (e.g., video
  // contexts get the Generate Script / Suggest Hooks templates).
  entryFormat?: ContentFormat;
  // Free-form payload sent to the AI alongside the user message
  payload?: Record<string, unknown>;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIState {
  isOpen: boolean;
  context: AIContext;
  conversationId: string | null;
  template: PromptTemplate;
  messages: AIMessage[];
  // Set when an inline ✨ Generate button asks the panel to auto-send a
  // prompt as soon as it opens. The panel reads + clears this on mount/effect.
  pendingAutoPrompt: string | null;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setContext: (ctx: AIContext) => void;
  resetContextToFreeform: () => void;
  setTemplate: (template: PromptTemplate) => void;
  appendMessage: (msg: AIMessage) => void;
  setConversationId: (id: string) => void;
  resetConversation: () => void;
  // Open the panel preconfigured for inline generation. Resets the
  // conversation so each ✨ click starts fresh.
  triggerInlineGenerate: (template: PromptTemplate, prompt: string) => void;
  consumePendingAutoPrompt: () => string | null;
}

export const FREEFORM_CONTEXT: AIContext = {
  type: "freeform",
  contextId: null,
  label: "Free-form",
};

export const useAIStore = create<AIState>((set, get) => ({
  isOpen: false,
  context: FREEFORM_CONTEXT,
  conversationId: null,
  template: "freeform",
  messages: [],
  pendingAutoPrompt: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setContext: (ctx) =>
    set((s) => {
      // If the context changes, reset the conversation so the panel doesn't
      // mix a chat about Entry A with one about Campaign B.
      const sameContext =
        s.context.type === ctx.type && s.context.contextId === ctx.contextId;
      if (sameContext) return { context: ctx };
      return {
        context: ctx,
        conversationId: null,
        messages: [],
      };
    }),
  resetContextToFreeform: () =>
    set({
      context: FREEFORM_CONTEXT,
      conversationId: null,
      messages: [],
      template: "freeform",
    }),
  setTemplate: (template) => set({ template }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setConversationId: (id) => set({ conversationId: id }),
  resetConversation: () => set({ conversationId: null, messages: [] }),
  triggerInlineGenerate: (template, prompt) =>
    set({
      isOpen: true,
      template,
      conversationId: null,
      messages: [],
      pendingAutoPrompt: prompt,
    }),
  consumePendingAutoPrompt: () => {
    const value = get().pendingAutoPrompt;
    if (value !== null) set({ pendingAutoPrompt: null });
    return value;
  },
}));
