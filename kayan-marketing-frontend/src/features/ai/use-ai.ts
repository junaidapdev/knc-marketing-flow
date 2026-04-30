import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../utils/api-client";
import { useAIStore } from "../../stores/ai-store";
import type { PromptTemplate, AIContextType } from "../../constants/ai";
import { logger } from "../../utils/logger";

interface SendInput {
  userMessage: string;
}

interface AIResponse {
  conversationId: string;
  assistantMessage: string;
}

export function useAIChat() {
  const conversationId = useAIStore((s) => s.conversationId);
  const context = useAIStore((s) => s.context);
  const template = useAIStore((s) => s.template);
  const messages = useAIStore((s) => s.messages);
  const appendMessage = useAIStore((s) => s.appendMessage);
  const setConversationId = useAIStore((s) => s.setConversationId);
  const resetConversation = useAIStore((s) => s.resetConversation);

  const send = useMutation({
    mutationFn: async (input: SendInput): Promise<AIResponse> => {
      // Optimistically render the user message
      appendMessage({ role: "user", content: input.userMessage });

      const result = await apiRequest<AIResponse>("/ai-assistant", {
        method: "POST",
        body: {
          conversationId,
          contextType: context.type satisfies AIContextType,
          contextId: context.contextId,
          promptTemplate: template satisfies PromptTemplate,
          userMessage: input.userMessage,
          contextPayload: context.payload,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      appendMessage({ role: "assistant", content: data.assistantMessage });
      logger.info("ai message sent", {
        conversationId: data.conversationId,
        template,
        contextType: context.type,
      });
    },
    onError: (err) => {
      logger.error("ai send failed", { err: String(err) });
    },
  });

  return {
    messages,
    conversationId,
    isPending: send.isPending,
    error: send.error,
    send: send.mutateAsync,
    resetConversation,
  };
}
