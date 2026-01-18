<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
import { useChatStore } from "@/stores/chatStore";
import { useI18n } from "vue-i18n";
import { LLMModel } from "@/types/llm";
import SidebarLeft from "@/components/chat/SidebarLeft.vue";
// import SidebarRightTeam from "@/components/chat/SidebarRightTeam.vue"
import FileManagerDrawer from "@/components/FileManagerDrawer.vue";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import Message from "@/components/chat/Message.vue";
import ChatInputTeam from "@/components/chat/ChatInputTeam.vue";
import ModelSelect from "@/components/ModelSelect.vue";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Theme from "@/components/Theme.vue";
import { chatApi, llmApi, teamPromptApi } from "@/api/request";
import {
  PanelLeft,
  PanelRight,
  ArrowDownToLine,
  PictureInPicture2,
  SquareArrowLeft,
  Pin,
  PinOff,
} from "lucide-vue-next";
import { useAssistantStore } from "@/stores/assistant";
import { useRoute } from "vue-router";

// 导入 sessionStore
import { useSessionStore } from "@/stores/session";
import { useMcpStore } from "@/stores/mcp";
import { computed } from "vue";
import { useEnvStore } from "@/stores/env";
import { useRagStore } from "@/stores/rag";
const envStore = useEnvStore();

const sessionStore = useSessionStore();
const mcpStore = useMcpStore();
const ragStore = useRagStore();

const route = useRoute();
const assistantStore = useAssistantStore();

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  reasoning_content?: string;
  id?: number;
}
const { t } = useI18n();
const chatStore = useChatStore();
const activeSession = ref({ title: "", id: 0 });
const chatHistory = ref<Message[]>([]);
const loading = ref(false);
const isStreaming = ref(false); // 跟踪对话是否正在进行中（流式响应）
const currentAssistantMessage = ref("");
const sidebarLeftOpen = ref(true);
const sidebarRightOpen = ref(false);
const selectedPrompt = ref<any>(null); // 当前选中的提示词
const abortController = ref<AbortController | null>(null);

watch(
  () => sessionStore.currentSession,
  (newValue, oldValue) => {
    if (newValue?.id != oldValue?.id) {
      console.log("[team_vue]", "Active session changed:", newValue);
      handleSessionChange(newValue);
    }
  },
  { deep: true }
);

// MCP 开关（使用 store 中的 toolsEnabled）
const enableMcp = computed(() => mcpStore.toolsEnabled);

const knowledge = computed(() => {
  return ragStore.getUsingBases;
});

const handleSessionChange = async (session) => {
  activeSession.value = session;
  console.log("[team_vue]", "Session changed:", session.id);
  localStorage.setItem("activeSession", JSON.stringify(session));
  chatHistory.value = [];
  try {
    const messages = await chatApi.getMessages(session.id);
    chatHistory.value = messages.data;
    nextTick(() => {
      setTimeout(() => {
        scrollToBottom(false);
      }, 1);
    });
  } catch (error) {
    console.error("Error loading chat history:", error);
  }
};

const sendMsgLocalOllama = async (model: LLMModel, msg: string) => {
  if (loading.value || isStreaming.value) return;
  loading.value = true;
  isStreaming.value = true; // 开始流式响应
  
  // 创建新的AbortController
  abortController.value = new AbortController();

  try {
    chatHistory.value.push({ role: "user", content: msg });
    chatHistory.value.push({ role: "assistant", content: "" });
    
    // 构建消息列表，如果选中了提示词，将其作为 system 消息添加到开头
    let messages = [...chatHistory.value.slice(0, -1)];
    if (selectedPrompt.value && selectedPrompt.value.content) {
      messages = [
        { role: "system", content: selectedPrompt.value.content },
        ...messages,
      ];
    }
    
    // 构建提示词配置
    const promptConfig = selectedPrompt.value ? {
      temperature: selectedPrompt.value.temperature?.[0] ?? 0.6,
      top_p: selectedPrompt.value.top_p?.[0] ?? 1,
      presence_penalty: selectedPrompt.value.presence_penalty?.[0] ?? 0,
      frequency_penalty: selectedPrompt.value.frequency_penalty?.[0] ?? 0,
    } : undefined;

    await chatApi.sendMessage(
      model,
      messages,
      activeSession.value.id,
      (content: string) => {
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        lastMessage.content += content;
      },
      (reasoning_content) => {
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        if (typeof lastMessage.reasoning_content == "undefined") {
          lastMessage.reasoning_content = "";
        }
        lastMessage.reasoning_content += reasoning_content;
      },
      [], // 本地对话不使用工具
      knowledge.value?.join(","),
      promptConfig,
      abortController.value.signal, // 传递AbortSignal
      () => {
        // 流式响应结束的回调
        isStreaming.value = false;
      },
      (messageId: number) => {
        // 接收消息ID并更新消息对象
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        lastMessage.id = messageId;
      },
    );
  } catch (error: any) {
    console.error("[team_vue] Error during chat:", error);
    // 如果是用户主动取消，不显示错误
    if (error.name === 'AbortError') {
      console.log('[team_vue]', '用户取消了对话');
    } else {
      chatHistory.value.pop();
    }
  } finally {
    loading.value = false;
    isStreaming.value = false; // 确保在错误时也重置
    abortController.value = null;
  }
};

const sendMsgLlmApi = async (model: LLMModel, msg: string) => {
  if (loading.value || isStreaming.value) return;
  loading.value = true;
  isStreaming.value = true; // 开始流式响应
  
  // 创建新的AbortController
  abortController.value = new AbortController();

  try {
    chatHistory.value.push({ role: "user", content: msg });
    chatHistory.value.push({
      role: "assistant",
      content: "",
      reasoning_content: "",
    });
    
    // 构建消息列表，如果选中了提示词，将其作为 system 消息添加到开头
    let messages = [...chatHistory.value.slice(0, -1)];
    if (selectedPrompt.value && selectedPrompt.value.content) {
      messages = [
        { role: "system", content: selectedPrompt.value.content },
        ...messages,
      ];
    }
    
    // 构建提示词配置
    const promptConfig = selectedPrompt.value ? {
      temperature: selectedPrompt.value.temperature?.[0] ?? 0.6,
      top_p: selectedPrompt.value.top_p?.[0] ?? 1,
      presence_penalty: selectedPrompt.value.presence_penalty?.[0] ?? 0,
      frequency_penalty: selectedPrompt.value.frequency_penalty?.[0] ?? 0,
    } : undefined;

    // 记录是否是第一次对话（用于标题更新）
    const isFirstMessage = chatHistory.value.length === 2 && activeSession.value.title === '新对话';
    
    // 使用 Team 对话 API，传递 enableMcp 开关
    await teamPromptApi.sendMessage(
      model,
      messages,
      activeSession.value.id,
      (content: string) => {
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        lastMessage.content += content;
      },
      (reasoning_content) => {
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        if (typeof lastMessage.reasoning_content == "undefined") {
          lastMessage.reasoning_content = "";
        }
        lastMessage.reasoning_content += reasoning_content;
      },
      knowledge.value?.join(","),
      promptConfig,
      enableMcp.value, // 传递 MCP 开关（使用 computed 的值）
      abortController.value.signal, // 传递AbortSignal
      async () => {
        // 流式响应结束的回调
        isStreaming.value = false;
        
        // 如果是第一次对话，更新标题
        if (isFirstMessage) {
          try {
            const config = {
              model: chatStore.model,
              messages: chatHistory.value,
              sessionId: activeSession.value,
            };
            const summaryRes = await chatApi.summarySession(config);
            console.log('[team_vue]', '标题更新结果:', summaryRes);
            
            // 同步更新 activeSession、sessionStore.currentSession 和 sessionStore.sessions
            if (summaryRes && summaryRes.title) {
              activeSession.value.title = summaryRes.title;
              
              // 更新 sessionStore 中的会话标题
              if (sessionStore.currentSession?.id === activeSession.value.id) {
                sessionStore.currentSession.title = summaryRes.title;
              }
              
              // 更新会话列表中的标题
              const sessionInList = sessionStore.sessions.find(s => s.id === activeSession.value.id);
              if (sessionInList) {
                sessionInList.title = summaryRes.title;
              }
            }
          } catch (error) {
            console.error('[team_vue]', '更新标题失败:', error);
          }
        }
      },
      (messageId: number) => {
        // 接收消息ID并更新消息对象
        const lastMessage = chatHistory.value[chatHistory.value.length - 1];
        lastMessage.id = messageId;
      },
    );
  } catch (error: any) {
    console.error("[team_vue] Error during chat:", error);
    // 如果是用户主动取消，不显示错误
    if (error.name === 'AbortError') {
      console.log('[team_vue]', '用户取消了对话');
    } else {
      chatHistory.value.pop();
    }
  } finally {
    loading.value = false;
    isStreaming.value = false; // 确保在错误时也重置
    abortController.value = null;
  }
};

// 停止当前对话
const handleStop = () => {
  console.log('[team_vue]', '用户请求停止对话');
  if (abortController.value) {
    abortController.value.abort();
    loading.value = false;
    abortController.value = null;
  }
};

const sendMsg = async (msg: string) => {
  if (chatStore.model.type === "local") {
    sendMsgLocalOllama(chatStore.model, msg);
  } else {
    sendMsgLlmApi(chatStore.model, msg);
  }
  scrollToBottom(true);
};

const scrollAreaRef = ref(null);
const showScrollButton = ref(false);
const scrollToBottom = (animate) => {
  nextTick(() => {
    if (scrollAreaRef.value) {
      const viewport = (scrollAreaRef.value as any).$el.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: animate ? "smooth" : "auto",
        });
      }
    }
  });
};

const handleScroll = () => {
  if (scrollAreaRef.value) {
    const viewport = (scrollAreaRef.value as any).$el.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (viewport) {
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 10;
      showScrollButton.value = !isAtBottom;
    }
  }
};

const isMiniMode = ref(false);
const handleMiniModeChange = () => {
  isMiniMode.value = !isMiniMode.value;
  if (!window.ipcRenderer) return;
  if (isMiniMode.value) {
    window.ipcRenderer.invoke("set-mini-mode", true);
  } else {
    window.ipcRenderer.invoke("set-mini-mode", false);
  }
};

const isAlwaysOnTop = ref(true);
const toggleAlwaysOnTop = async () => {
  isAlwaysOnTop.value = await window.ipcRenderer.invoke("toggle-always-on-top");
};

const initializeChat = async (assistant) => {
  try {
    // 创建新会话
    const newSession = await sessionStore.createChat();
    // 更新会话设置
    await sessionStore.updateSettings(newSession.id, {
      title: assistant.title,
      systemPrompt: assistant.prompt,
      ...(assistant.settings || {}),
    });
    // 切换到新会话
    handleSessionChange(newSession);
  } catch (error) {
    console.error("[team_vue] Failed to initialize chat:", error);
  }
};

onMounted(() => {
  const viewport = (scrollAreaRef.value as any)?.$el?.querySelector(
    "[data-radix-scroll-area-viewport]"
  );
  if (viewport) {
    viewport.addEventListener("scroll", handleScroll);
  }
  const assistantId = route.query.assistantId as string;
  if (assistantId) {
    const assistant = assistantStore.currentAssistant;
    if (assistant) {
      initializeChat(assistant);
    }
  }
  if (sessionStore.currentSession) {
    handleSessionChange(sessionStore.currentSession);
  }
});
</script>

<template>
  <div class="flex relative overflow-hidden">
    <SidebarProvider
      class="w-auto"
      :style="{ '--sidebar-width': '200px' }"
      v-model:open="sidebarLeftOpen"
    >
      <SidebarLeft />
    </SidebarProvider>
    <div
      class="w-full h-[calc(100dvh-30px)] max-h-[calc(100dvh-30px)] flex flex-col grow"
      :class="envStore.isWeb ? 'h-[100dvh] max-h-[100dvh]' : ''"
    >
      <header
        class="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4 justify-between h-[64px] py-0 max-sm:h-[40px]"
      >
        <div class="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            class="h-7 w-7 max-sm:hidden"
            @click="sidebarLeftOpen = !sidebarLeftOpen"
            style="-webkit-app-region: no-drag"
          >
            <PanelLeft></PanelLeft>
          </Button>
          <Separator orientation="vertical" class="mr-2 h-4 max-sm:hidden" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem class="hidden md:block">
                <ModelSelect></ModelSelect>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div class="flex items-center gap-2">
          <Theme></Theme>
          <Separator orientation="vertical" class="mx-1 h-4 max-sm:hidden" />
          <Button
            v-if="!isMiniMode"
            @click="handleMiniModeChange"
            size="icon"
            variant="ghost"
            class="h-7 w-7"
          >
            <PictureInPicture2></PictureInPicture2>
          </Button>
          <Separator
            v-if="!isMiniMode"
            orientation="vertical"
            class="mx-1 h-4"
          />
          <Button
            v-if="isMiniMode"
            @click="handleMiniModeChange"
            size="icon"
            variant="ghost"
            class="h-7 w-7"
          >
            <SquareArrowLeft></SquareArrowLeft>
          </Button>
          <Separator
            v-if="isMiniMode"
            orientation="vertical"
            class="mx-1 h-4 max-sm:hidden"
          />
          <Button
            @click="toggleAlwaysOnTop"
            size="icon"
            variant="ghost"
            class="h-7 w-7 hidden max-sm:flex"
          >
            <Pin v-if="isAlwaysOnTop"></Pin>
            <PinOff v-else></PinOff>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="h-7 w-7 max-sm:hidden"
            @click="sidebarRightOpen = !sidebarRightOpen"
          >
            <PanelRight></PanelRight>
          </Button>
        </div>
      </header>
      <Button
        v-if="showScrollButton"
        @click="scrollToBottom(true)"
        variant="outline"
        size="icon"
        class="fixed bottom-[140px] right-6 z-10 drop-shadow-xl"
      >
        <ArrowDownToLine class="h-4 w-4" />
        <span class="sr-only">{{ t("chat.scrollToBottom") }}</span>
      </Button>
      <ScrollArea ref="scrollAreaRef" class="h-full w-full px-6 flex-1">
        <Message
          :messages="chatHistory"
          class="py-4 xl:max-w-[1024px] xl:mx-auto"
        />
        <ScrollBar />
      </ScrollArea>
      <div
        class="sticky bottom-0 h-[120px] max-h-[120px] content-center shrink-0 items-center gap-2 border-b bg-background"
      >
        <ChatInputTeam
          :loading="isStreaming"
          :disabled="loading"
          :activeSession="activeSession"
          @sendMsg="sendMsg"
          @stop="handleStop"
          @promptSelected="(prompt) => { selectedPrompt = prompt; }"
          :placeholder="t('chat.inputPlaceholder')"
        />
      </div>
    </div>
    <SidebarProvider
      class="w-auto"
      :style="{ '--sidebar-width': '800px' }"
      v-model:open="sidebarRightOpen"
    >
      <FileManagerDrawer />
    </SidebarProvider>
  </div>
</template>
