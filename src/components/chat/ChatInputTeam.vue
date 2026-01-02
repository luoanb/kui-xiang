<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverAnchor } from "reka-ui";
import { CornerDownLeft, Mic, Star, Square } from "lucide-vue-next";
import UseTool from "@/components/chat/UseTool.vue";
import UseKnowledgeBase from "@/components/chat/UseKnowledgeBase.vue";
import { useSessionStore } from "@/stores/session";
import { chatApi } from "@/api/request";

const { t } = useI18n();

interface TeamPrompt {
  id: string;
  title: string;
  content: string;
  isMain: boolean;
}

const msg = ref("");
const emit = defineEmits(["sendMsg", "promptSelected", "stop"]);
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  activeSession: {
    type: Object,
    required: true,
  },
});

const handleStop = () => {
  emit("stop");
};

const sessionStore = useSessionStore();
const prompts = ref<TeamPrompt[]>([]); // 实际使用的提示词列表（不包含"无"）
const menuPrompts = ref<TeamPrompt[]>([]); // 菜单显示的提示词列表（包含"无"）
const showPromptMenu = ref(false);
const selectedPromptId = ref<string>("");
const selectedMenuPromptId = ref<string>(""); // 菜单中选中的提示词ID
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const popoverTriggerRef = ref<HTMLElement | null>(null); // Popover trigger 引用
const slashIndex = ref(-1); // 记录 "/" 的位置

// 加载提示词列表（用于菜单显示，包含"无"选项）
const loadPromptsForMenu = async () => {
  if (!props.activeSession?.id) return [];

  try {
    // 优先从 sessionStore.settings 获取（最新数据）
    let settings = sessionStore.settings;
    
    // 如果 sessionStore 中没有数据，或者 prompts 不存在，则从 API 获取
    if (!settings || !settings.prompts || !Array.isArray(settings.prompts)) {
      console.log("[ChatInputTeam] sessionStore 中没有提示词数据，从 API 获取");
      settings = await chatApi.getSettings(props.activeSession.id);
      // 更新 sessionStore
      if (settings) {
        await sessionStore.fetchSettings(props.activeSession.id);
        settings = sessionStore.settings;
      }
    } else {
      console.log("[ChatInputTeam] 从 sessionStore 获取提示词数据");
    }

    const menuPrompts: TeamPrompt[] = [];
    
    // 添加"无"选项
    menuPrompts.push({
      id: "none",
      title: "无",
      content: "",
      isMain: false,
    });

    if (settings?.prompts && Array.isArray(settings.prompts)) {
      menuPrompts.push(...settings.prompts);
      console.log("[ChatInputTeam] 加载提示词列表，数量:", menuPrompts.length, "提示词:", menuPrompts.map(p => ({ id: p.id, title: p.title })));
    } else if (settings?.systemPrompt) {
      // 兼容旧数据
      menuPrompts.push({
        id: `prompt-${Date.now()}`,
        title: "主提示词",
        content: settings.systemPrompt,
        isMain: true,
      });
      console.log("[ChatInputTeam] 使用默认提示词，数量: 1");
    }
    
    return menuPrompts;
  } catch (error) {
    console.error("[ChatInputTeam] Failed to load prompts:", error);
    return [];
  }
};

// 加载提示词列表（用于实际使用，不包含"无"选项）
const loadPrompts = async () => {
  if (!props.activeSession?.id) return;

  try {
    // 优先从 sessionStore.settings 获取（最新数据）
    let settings = sessionStore.settings;
    
    // 如果 sessionStore 中没有数据，或者 prompts 不存在，则从 API 获取
    if (!settings || !settings.prompts || !Array.isArray(settings.prompts)) {
      console.log("[ChatInputTeam] sessionStore 中没有提示词数据，从 API 获取");
      settings = await chatApi.getSettings(props.activeSession.id);
      // 更新 sessionStore
      if (settings) {
        await sessionStore.fetchSettings(props.activeSession.id);
        settings = sessionStore.settings;
      }
    } else {
      console.log("[ChatInputTeam] 从 sessionStore 获取提示词数据");
    }

    if (settings?.prompts && Array.isArray(settings.prompts)) {
      prompts.value = settings.prompts;
      console.log("[ChatInputTeam] 加载提示词列表，数量:", prompts.value.length, "提示词:", prompts.value.map(p => ({ id: p.id, title: p.title })));
      // 默认选择主提示词
      const mainPrompt = prompts.value.find((p) => p.isMain);
      if (mainPrompt) {
        selectedPromptId.value = mainPrompt.id;
        emit("promptSelected", mainPrompt);
      }
    } else if (settings?.systemPrompt) {
      // 兼容旧数据
      const defaultPrompt: TeamPrompt = {
        id: `prompt-${Date.now()}`,
        title: "主提示词",
        content: settings.systemPrompt,
        isMain: true,
      };
      prompts.value = [defaultPrompt];
      selectedPromptId.value = defaultPrompt.id;
      emit("promptSelected", defaultPrompt);
      console.log("[ChatInputTeam] 使用默认提示词，数量: 1");
    }
  } catch (error) {
    console.error("[ChatInputTeam] Failed to load prompts:", error);
  }
};

// 监听 activeSession 变化
watch(
  () => props.activeSession,
  async (session) => {
    if (session?.id) {
      await loadPrompts();
    }
  },
  { immediate: true, deep: true }
);

// 监听 sessionStore.settings 的变化，实时更新提示词列表
watch(
  () => sessionStore.settings,
  async (settings) => {
    // 如果 settings 中有 prompts 字段，更新提示词列表
    if (settings?.prompts && Array.isArray(settings.prompts)) {
      const oldCount = prompts.value.length;
      prompts.value = settings.prompts;
      const newCount = prompts.value.length;
      console.log("[ChatInputTeam] 从 sessionStore.settings 更新提示词列表，旧数量:", oldCount, "新数量:", newCount, "提示词:", prompts.value.map(p => ({ id: p.id, title: p.title })));
      // 如果当前选中的提示词不存在了，选择主提示词
      if (!prompts.value.find(p => p.id === selectedPromptId.value)) {
        const mainPrompt = prompts.value.find((p) => p.isMain);
        if (mainPrompt) {
          selectedPromptId.value = mainPrompt.id;
          emit("promptSelected", mainPrompt);
        } else if (prompts.value.length > 0) {
          selectedPromptId.value = prompts.value[0].id;
          emit("promptSelected", prompts.value[0]);
        }
      }
    }
  },
  { deep: true }
);

// 当前选中的提示词
const currentPrompt = computed(() => {
  if (!selectedPromptId.value) return null;
  return prompts.value.find((p) => p.id === selectedPromptId.value);
});

// 是否显示"无"
const showNonePrompt = computed(() => {
  return !selectedPromptId.value || selectedPromptId.value === "";
});

const handleSendMsg = (e: Event) => {
  if (!msg.value.trim()) return;
  emit("sendMsg", msg.value);
  msg.value = "";
  showPromptMenu.value = false;
};

const handleKeyDown = async (e: KeyboardEvent) => {
  // 如果菜单显示，优先处理菜单相关的按键
  if (showPromptMenu.value) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentIndex = menuPrompts.value.findIndex(
        (p) => p.id === selectedMenuPromptId.value
      );
      if (e.key === "ArrowDown") {
        const nextIndex =
          currentIndex < menuPrompts.value.length - 1 ? currentIndex + 1 : 0;
        selectedMenuPromptId.value = menuPrompts.value[nextIndex].id;
      } else {
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : menuPrompts.value.length - 1;
        selectedMenuPromptId.value = menuPrompts.value[prevIndex].id;
      }
      return;
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectPrompt(selectedMenuPromptId.value);
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      showPromptMenu.value = false;
      slashIndex.value = -1;
      return;
    } else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") {
      // 如果输入其他字符，关闭菜单
      showPromptMenu.value = false;
      slashIndex.value = -1;
      return;
    }
  }

  // 正常输入处理
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMsg(e);
  } else if (e.key === "Enter" && e.shiftKey) {
    e.stopPropagation();
  } else if (e.key === "/" && !showPromptMenu.value) {
    // 检测 "/" 键
    // 获取原生 textarea 元素
    const textarea = (textareaRef.value as any)?.$el || textareaRef.value;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = msg.value.substring(0, cursorPos);
      // 检查 "/" 是否在行首或前面是空格或换行
      const isAtLineStart = cursorPos === 0 || 
                           textBeforeCursor.endsWith(" ") || 
                           textBeforeCursor.endsWith("\n");
      
      if (isAtLineStart) {
        e.preventDefault(); // 阻止 "/" 被输入到文本框中
        slashIndex.value = cursorPos;
        // 打开菜单前重新加载提示词列表
        const oldCount = menuPrompts.value.length;
        menuPrompts.value = await loadPromptsForMenu();
        const newCount = menuPrompts.value.length;
        console.log("[ChatInputTeam] ===== 打开提示词菜单 =====");
        console.log("[ChatInputTeam] 加载前数量:", oldCount, "加载后数量:", newCount);
        console.log("[ChatInputTeam] 菜单中的提示词列表:", menuPrompts.value.map(p => ({ id: p.id, title: p.title })));
        // 从 sessionStore 获取团队提示词管理的数量进行对比
        const teamPromptsCount = sessionStore.settings?.prompts?.length || 0;
        console.log("[ChatInputTeam] 团队提示词管理中的数量:", teamPromptsCount);
        console.log("[ChatInputTeam] 数量对比 - 菜单:", newCount, "vs 管理:", teamPromptsCount, "是否一致:", newCount - 1 === teamPromptsCount);
        // 默认选中第一个（"无"选项）
        if (menuPrompts.value.length > 0) {
          selectedMenuPromptId.value = menuPrompts.value[0].id;
        }
        // 更新 anchor 位置，然后打开菜单（Popover 会自动定位）
        nextTick(() => {
          updatePopoverAnchorPosition();
          showPromptMenu.value = true;
        });
      }
    }
  }
};

// 更新 Popover anchor 位置到输入框顶部
// Popover 会自动将 Content 定位到 anchor 上方，菜单底部会贴着输入框顶部
const updatePopoverAnchorPosition = () => {
  const textarea = (textareaRef.value as any)?.$el || textareaRef.value;
  if (!textarea || !popoverTriggerRef.value) return;

  const rect = textarea.getBoundingClientRect();
  
  // 将 anchor 定位到输入框顶部，Popover 的 side="top" 会让菜单显示在 anchor 上方
  // sideOffset 控制菜单底部和 anchor 之间的间距，设为 0 让菜单底部贴着输入框顶部
  Object.assign(popoverTriggerRef.value.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left + 10}px`,
    width: '1px',
    height: '1px',
    pointerEvents: 'none',
    opacity: '0',
  });
};

// 选择提示词
const selectPrompt = (promptId: string) => {
  const prompt = menuPrompts.value.find((p) => p.id === promptId);
  if (!prompt) return;

  // 如果是"无"选项，发送空提示词
  if (promptId === "none") {
    emit("promptSelected", { id: "none", title: "无", content: "", isMain: false });
    selectedPromptId.value = "";
  } else {
    // 从实际提示词列表中找到对应的提示词
    const actualPrompt = prompts.value.find((p) => p.id === promptId);
    if (actualPrompt) {
      selectedPromptId.value = promptId;
      emit("promptSelected", actualPrompt);
    }
  }

  // 移除 "/" 字符
  if (slashIndex.value >= 0) {
    const textBefore = msg.value.substring(0, slashIndex.value);
    const textAfter = msg.value.substring(slashIndex.value + 1);
    msg.value = textBefore + textAfter;
  }

  showPromptMenu.value = false;
  const savedSlashIndex = slashIndex.value;
  slashIndex.value = -1;

  // 聚焦到输入框
  nextTick(() => {
    const textarea = (textareaRef.value as any)?.$el || textareaRef.value;
    if (textarea) {
      textarea.focus();
      // 恢复光标位置
      const newCursorPos = savedSlashIndex >= 0 ? savedSlashIndex : textarea.selectionStart;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
  });
};

// 处理菜单内的键盘事件
const handleMenuKeyDown = (e: KeyboardEvent) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const currentIndex = menuPrompts.value.findIndex(
      (p) => p.id === selectedMenuPromptId.value
    );
    if (e.key === "ArrowDown") {
      const nextIndex =
        currentIndex < menuPrompts.value.length - 1 ? currentIndex + 1 : 0;
      selectedMenuPromptId.value = menuPrompts.value[nextIndex].id;
    } else {
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : menuPrompts.value.length - 1;
      selectedMenuPromptId.value = menuPrompts.value[prevIndex].id;
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    selectPrompt(selectedMenuPromptId.value);
  }
};

// 监听输入变化，如果 "/" 被删除或输入其他内容，关闭菜单
watch(msg, (newValue, oldValue) => {
  if (showPromptMenu.value && slashIndex.value >= 0) {
    // 检查 "/" 是否还在
    const textBeforeSlash = newValue.substring(0, slashIndex.value);
    const charAtSlash = newValue[slashIndex.value];
    
    // 如果 "/" 被删除或位置发生变化，关闭菜单
    if (!textBeforeSlash.endsWith("/") || charAtSlash !== "/") {
      showPromptMenu.value = false;
      slashIndex.value = -1;
    }
  }
});

const isRecording = ref(false);
const handleRecord = () => {
  isRecording.value = !isRecording.value;
  const recognition = new (window as any).webkitSpeechRecognition();
  recognition.lang = "cmn-Hans-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    msg.value = `${transcript}`;
  });

  recognition.addEventListener("speechend", () => {
    recognition.stop();
    isRecording.value = false;
  });

  recognition.addEventListener("error", (event) => {
    console.log("[ChatInputTeam]", event);
    msg.value = `Error: ${event.error}`;
    isRecording.value = false;
  });
  recognition.start();
};
</script>

<template>
  <div class="relative l-footer">
    <form @submit.prevent="handleSendMsg">
      <Textarea
        ref="textareaRef"
        v-model="msg"
        class="h-[120px] min-h-[120px] max-h-[120px] rounded-none focus-visible:ring-offset-0 focus-visible:ring-0 border-l-0 outline-none appearance-none resize-none"
        :placeholder="t('chat.inputPlaceholder')"
        @keydown="handleKeyDown"
      ></Textarea>
      <!-- 当前选中的提示词 tag（左侧） -->
      <div class="absolute bottom-4 left-4">
        <Badge
          v-if="currentPrompt || showNonePrompt"
          variant="outline"
          class="flex items-center gap-1 max-w-[120px]"
        >
          <Star
            v-if="currentPrompt?.isMain"
            class="w-3 h-3 flex-shrink-0 fill-yellow-400 text-yellow-400"
          />
          <span class="truncate">{{ currentPrompt ? currentPrompt.title : "无" }}</span>
        </Badge>
      </div>
      <!-- 操作按钮（右侧） -->
      <div
        class="ml-auto gap-1.5 absolute bottom-4 right-4 flex items-center space-x-1"
      >
        <UseTool class="relative"></UseTool>
        <UseKnowledgeBase class="relative"></UseKnowledgeBase>
        <Button
          @click="handleRecord"
          :variant="isRecording ? 'destructive' : 'outline'"
          :disabled="isRecording"
          size="icon"
          class="ml-auto gap-1.5"
        >
          <Mic class="size-3.5" />
        </Button>
        <Button
          v-if="!loading"
          type="submit"
          :disabled="disabled"
          size="icon"
          class="ml-auto gap-1.5"
        >
          <CornerDownLeft class="size-3.5" />
        </Button>
        <Button
          v-else
          type="button"
          @click="handleStop"
          variant="destructive"
          size="icon"
          class="ml-auto gap-1.5"
        >
          <Square class="size-3.5" />
        </Button>
      </div>
    </form>

    <!-- 提示词选择菜单 -->
    <Popover v-model:open="showPromptMenu">
      <!-- 隐藏的 anchor，用于定位 -->
      <PopoverAnchor as-child>
        <div ref="popoverTriggerRef" class="absolute pointer-events-none opacity-0" />
      </PopoverAnchor>
      <PopoverContent
        v-if="menuPrompts.length > 0"
        side="top"
        align="start"
        :side-offset="0"
        class="w-64 p-1"
        @keydown="handleMenuKeyDown"
      >
        <div class="max-h-64 overflow-y-auto">
          <div
            v-for="prompt in menuPrompts"
            :key="prompt.id"
            @click="selectPrompt(prompt.id)"
            @mouseenter="selectedMenuPromptId = prompt.id"
            :class="[
              'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent',
              selectedMenuPromptId === prompt.id ? 'bg-accent' : '',
            ]"
          >
            <Star
              v-if="prompt.isMain"
              class="w-4 h-4 flex-shrink-0 fill-yellow-400 text-yellow-400"
            />
            <div class="text-sm font-medium truncate">{{ prompt.title }}</div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

