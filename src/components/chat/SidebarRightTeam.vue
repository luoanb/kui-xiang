<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SquarePen, Plus, Trash2, Star } from "lucide-vue-next";
import { reactive, ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import PromptEditor from "@/components/chat/PromptEditor.vue";
import { chatApi } from "@/api/request";
import { useToast } from "@/components/ui/toast/use-toast";
import { useSessionStore } from "@/stores/session";
import { Checkbox } from "@/components/ui/checkbox";
import TeamPromptsDialog from "@/components/chat/TeamPromptsDialog.vue";
import {
  generateTeamPromptId,
  saveTeamPromptConfig,
  loadTeamPromptConfig,
  getCurrentTeamPromptId,
  setCurrentTeamPromptId,
  type TeamPromptConfig,
} from "@/lib/teamPromptsStorage";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const { t } = useI18n();
const { toast } = useToast();

interface TeamPrompt {
  id: string;
  title: string;
  content: string;
  isMain: boolean;
  temperature?: number[];
  top_p?: number[];
  presence_penalty?: number[];
  frequency_penalty?: number[];
}

const props = defineProps({
  activeSession: {
    type: Object,
    required: true,
  },
});

const sessionStore = useSessionStore();

// 多提示词列表
const prompts = ref<TeamPrompt[]>([]);
const activePromptId = ref<string>("");
const currentTeamPromptId = ref<string>(""); // 当前使用的团队提示词 ID

// 表单数据（用于其他设置）
const formData = computed(() => sessionStore.settings);

// 团队提示词对话框
const isTeamPromptsDialogOpen = ref(false);

// 当前活动的提示词
const currentPrompt = computed(() => {
  return prompts.value.find((p) => p.id === activePromptId.value);
});

// 初始化提示词列表
const initPrompts = async () => {
  if (!props.activeSession?.id) return;

  try {
    // 先尝试加载团队提示词配置
    const currentId = getCurrentTeamPromptId();
    if (currentId) {
      const teamConfig = await loadTeamPromptConfig(currentId);
      if (teamConfig) {
        currentTeamPromptId.value = currentId;
        // 应用团队提示词配置
        prompts.value = teamConfig.prompts.map(p => ({
          ...p,
          temperature: p.temperature || [0.6],
          top_p: p.top_p || [1],
          presence_penalty: p.presence_penalty || [0],
          frequency_penalty: p.frequency_penalty || [0],
        }));
        formData.value.title = teamConfig.title;
        if (prompts.value.length > 0) {
          activePromptId.value = prompts.value[0].id;
        }
        // 保存到会话设置
        await savePrompts();
        return;
      }
    }

    // 如果没有团队提示词配置，从会话设置加载
    const settings = await chatApi.getSettings(props.activeSession.id);
    // 如果 settings 中有 prompts 字段，使用它；否则从 systemPrompt 创建默认提示词
    if (settings.prompts && Array.isArray(settings.prompts)) {
      // 确保每个提示词都有参数默认值
      prompts.value = settings.prompts.map(p => ({
        ...p,
        temperature: p.temperature || [0.6],
        top_p: p.top_p || [1],
        presence_penalty: p.presence_penalty || [0],
        frequency_penalty: p.frequency_penalty || [0],
      }));
      if (prompts.value.length > 0) {
        activePromptId.value = prompts.value[0].id;
      }
    } else {
      // 兼容旧数据：从 systemPrompt 创建默认提示词
      const defaultPrompt: TeamPrompt = {
        id: `prompt-${Date.now()}`,
        title: "主提示词",
        content: settings.systemPrompt || "You are a helpful assistant",
        isMain: true,
        temperature: [settings.temperature ?? 0.6],
        top_p: [settings.top_p ?? 1],
        presence_penalty: [settings.presence_penalty ?? 0],
        frequency_penalty: [settings.frequency_penalty ?? 0],
      };
      prompts.value = [defaultPrompt];
      activePromptId.value = defaultPrompt.id;
      // 保存新的数据结构
      await savePrompts();
    }
  } catch (error) {
    console.error("[SidebarRightTeam] Failed to init prompts:", error);
  }
};

// 保存提示词列表
const savePrompts = async () => {
  if (!props.activeSession?.id) return;

  try {
    console.log("[SidebarRightTeam] 保存提示词到会话设置，数量:", prompts.value.length, "提示词:", prompts.value.map(p => ({ id: p.id, title: p.title })));
    await sessionStore.updateSettings(props.activeSession.id, {
      ...formData.value,
      prompts: prompts.value,
      // 为了兼容，也保存主提示词到 systemPrompt
      systemPrompt: prompts.value.find((p) => p.isMain)?.content || "",
    });
    console.log("[SidebarRightTeam] 提示词已保存到会话设置");
  } catch (error) {
    console.error("[SidebarRightTeam] Failed to save prompts:", error);
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

// 初始化时加载当前团队提示词 ID
const initCurrentTeamPromptId = () => {
  currentTeamPromptId.value = getCurrentTeamPromptId();
};

watch(
  () => props.activeSession,
  async (session) => {
    if (session?.id) {
      try {
        initCurrentTeamPromptId();
        await sessionStore.fetchSettings(session.id);
        await initPrompts();
      } catch (error) {
        console.error("[SidebarRightTeam] Failed to fetch settings:", error);
      }
    }
  },
  { immediate: true, deep: true }
);

const handleSubmit = async () => {
  try {
    if (!props.activeSession?.id) {
      throw new Error("会话不存在");
    }

    await sessionStore.updateSettings(props.activeSession.id, formData.value);
    await savePrompts();

    toast({
      title: t("common.success"),
      description: t("chat.settings.saveSuccess"),
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

const isPromptEditorOpen = ref(false);
const editingPromptId = ref<string>("");

// 打开提示词编辑器
const openPromptEditor = (promptId?: string) => {
  editingPromptId.value = promptId || activePromptId.value;
  isPromptEditorOpen.value = true;
};

// 保存提示词内容
const savePrompt = async (newPrompt: string) => {
  try {
    if (!props.activeSession?.id) return;

    const prompt = prompts.value.find((p) => p.id === editingPromptId.value);
    if (prompt) {
      prompt.content = newPrompt;
      await savePrompts();
    }
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

// 新增提示词
const addPrompt = () => {
  // 使用当前会话的默认参数或第一个提示词的参数
  const defaultParams = currentPrompt.value || {
    temperature: [0.6],
    top_p: [1],
    presence_penalty: [0],
    frequency_penalty: [0],
  };
  
  const newPrompt: TeamPrompt = {
    id: `prompt-${Date.now()}`,
    title: `提示词 ${prompts.value.length + 1}`,
    content: "",
    isMain: prompts.value.length === 0, // 第一个自动设为主提示词
    temperature: defaultParams.temperature ? [...defaultParams.temperature] : [0.6],
    top_p: defaultParams.top_p ? [...defaultParams.top_p] : [1],
    presence_penalty: defaultParams.presence_penalty ? [...defaultParams.presence_penalty] : [0],
    frequency_penalty: defaultParams.frequency_penalty ? [...defaultParams.frequency_penalty] : [0],
  };
  prompts.value.push(newPrompt);
  activePromptId.value = newPrompt.id;
  console.log("[SidebarRightTeam] 新增提示词后，当前提示词数量:", prompts.value.length, "提示词:", prompts.value.map(p => ({ id: p.id, title: p.title })));
  savePrompts();
};

// 删除提示词
const deletePrompt = async (promptId: string) => {
  const prompt = prompts.value.find((p) => p.id === promptId);
  
  // 不允许删除主提示词
  if (prompt?.isMain) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: "主提示词不允许删除",
    });
    return;
  }

  if (prompts.value.length <= 1) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: "至少需要保留一个提示词",
    });
    return;
  }

  const index = prompts.value.findIndex((p) => p.id === promptId);
  if (index !== -1) {
    prompts.value.splice(index, 1);
    // 切换到第一个提示词
    if (prompts.value.length > 0) {
      activePromptId.value = prompts.value[0].id;
    }
    await savePrompts();
  }
};

// 切换主提示词
const toggleMainPrompt = async (promptId: string) => {
  const prompt = prompts.value.find((p) => p.id === promptId);
  if (!prompt) return;

  // 如果设置为主提示词，取消其他主提示词
  if (!prompt.isMain) {
    prompts.value.forEach((p) => {
      p.isMain = p.id === promptId;
    });
    await savePrompts();
  }
};

// 更新提示词标题
const updatePromptTitle = async (promptId: string, title: string) => {
  const prompt = prompts.value.find((p) => p.id === promptId);
  if (prompt) {
    prompt.title = title;
    await savePrompts();
  }
};

// 更新提示词参数
const updatePromptParams = async (promptId: string) => {
  await savePrompts();
};

// 保存团队提示词（另存为）
const saveAsTeamPrompt = async () => {
  try {
    if (prompts.value.length === 0) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: "至少需要一个提示词",
      });
      return;
    }

    const id = generateTeamPromptId();
    const config: TeamPromptConfig = {
      id,
      title: formData.value.title || "未命名团队提示词",
      prompts: prompts.value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await saveTeamPromptConfig(config);
    // 如果保存成功，使用返回的数据库 ID
    if (result && result.id) {
      currentTeamPromptId.value = result.id;
      setCurrentTeamPromptId(result.id);
    } else {
      currentTeamPromptId.value = id;
      setCurrentTeamPromptId(id);
    }

    // 同时保存到当前会话设置
    if (props.activeSession?.id) {
      await savePrompts();
    }

    toast({
      title: t("common.success"),
      description: "团队提示词已保存",
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

// 保存团队提示词（更新或另存为）
const saveTeamPrompt = async () => {
  if (!currentTeamPromptId.value) {
    // 如果没有 ID，执行另存为
    await saveAsTeamPrompt();
  } else {
    // 如果有 ID，更新现有配置
    try {
      // 从现有配置中获取创建时间
      const existingConfig = await loadTeamPromptConfig(currentTeamPromptId.value);
      const createdAt = existingConfig?.createdAt || Date.now();

      const config: TeamPromptConfig = {
        id: currentTeamPromptId.value,
        title: formData.value.title || "未命名团队提示词",
        prompts: prompts.value,
        createdAt,
        updatedAt: Date.now(),
      };

      await saveTeamPromptConfig(config);

      // 同时保存到当前会话设置
      if (props.activeSession?.id) {
        await savePrompts();
      }

      toast({
        title: t("common.success"),
        description: "团队提示词已更新",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: (error as Error).message,
      });
    }
  }
};

// 选择团队提示词
const handleSelectTeamPrompt = async (config: TeamPromptConfig) => {
  try {
    // 应用选中的配置
    prompts.value = config.prompts.map(p => ({
      ...p,
      temperature: p.temperature || [0.6],
      top_p: p.top_p || [1],
      presence_penalty: p.presence_penalty || [0],
      frequency_penalty: p.frequency_penalty || [0],
    }));
    formData.value.title = config.title;
    
    if (prompts.value.length > 0) {
      activePromptId.value = prompts.value[0].id;
    }

    // 更新当前 ID
    currentTeamPromptId.value = config.id;
    setCurrentTeamPromptId(config.id);

    // 保存到会话设置
    await savePrompts();

    toast({
      title: t("common.success"),
      description: "团队提示词已应用",
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

// 监听提示词名称变化，同步更新左侧列表
watch(
  () => currentPrompt.value?.title,
  (newTitle) => {
    // 名称变化会自动反映在左侧列表中，因为使用的是同一个 ref
  }
);
</script>

<template>
  <Sidebar side="right" class="absolute h-[calc(100dvh-30px)]">
    <SidebarHeader class="p-4">
      <div class="flex items-center justify-between gap-2">
        <span>团队提示词</span>
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            @click="isTeamPromptsDialogOpen = true"
            type="button"
          >
            选择其他提示词
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="saveAsTeamPrompt"
            type="button"
          >
            另存为
          </Button>
          <Button
            size="sm"
            @click="saveTeamPrompt"
            type="button"
          >
            保存
          </Button>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <form class="p-4 space-y-4">
        <!-- 聊天名称 -->
        <div class="grid gap-2">
          <Label>{{ t("chat.settings.chatName") }}</Label>
          <Input type="text" placeholder="shadcn" v-model="formData.title" />
        </div>

        <!-- 多提示词管理 - 左右布局 -->
        <div class="grid gap-2 flex-1 min-h-0">
          <div class="flex justify-between items-center">
            <Label>
              <span class="space-x-1">
                <span>{{ t("chat.settings.systemPrompt") }}</span>
                <Badge variant="outline">{{
                  t("chat.settings.rolePrompt")
                }}</Badge>
              </span>
            </Label>
            <Button
              size="sm"
              variant="outline"
              @click="addPrompt"
              type="button"
            >
              <Plus class="w-4 h-4" />
            </Button>
          </div>

          <div class="flex gap-4 h-[calc(100vh-400px)] min-h-[400px]">
            <!-- 左侧：提示词列表 -->
            <div class="w-1/3 border-r pr-4 flex flex-col">
              <ScrollArea class="flex-1">
                <div class="space-y-2">
                  <div
                    v-for="prompt in prompts"
                    :key="prompt.id"
                    @click="activePromptId = prompt.id"
                    :class="[
                      'cursor-pointer p-2 rounded transition-colors',
                      activePromptId === prompt.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50',
                    ]"
                  >
                    <div class="flex items-center gap-2">
                      <Star
                        v-if="prompt.isMain"
                        class="w-3 h-3 flex-shrink-0 fill-yellow-400 text-yellow-400"
                      />
                      <span class="truncate flex-1 text-sm">{{ prompt.title }}</span>
                      <Button
                        v-if="prompts.length > 1 && !prompt.isMain"
                        size="icon"
                        variant="ghost"
                        class="h-5 w-5 flex-shrink-0"
                        @click.stop="deletePrompt(prompt.id)"
                        type="button"
                      >
                        <Trash2 class="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollBar />
              </ScrollArea>
            </div>

            <!-- 右侧：提示词内容编辑 -->
            <div class="w-2/3 flex flex-col min-h-0">
              <ScrollArea class="flex-1" v-if="currentPrompt">
                <div class="space-y-4 pr-4">
                  <!-- 提示词名称编辑 -->
                  <div class="grid gap-2">
                    <Label>提示词名称</Label>
                    <Input
                      v-model="currentPrompt.title"
                      @blur="updatePromptTitle(currentPrompt.id, currentPrompt.title)"
                      placeholder="提示词名称"
                    />
                  </div>

                  <!-- 主提示词设置 -->
                  <div class="flex items-center gap-2">
                    <Checkbox
                      :checked="currentPrompt.isMain"
                      @update:checked="() => toggleMainPrompt(currentPrompt.id)"
                      :disabled="currentPrompt.isMain"
                    />
                    <Label class="text-sm">主提示词</Label>
                  </div>

                  <!-- 提示词内容编辑 -->
                  <div class="grid gap-2">
                    <div class="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        @click="openPromptEditor(currentPrompt.id)"
                        type="button"
                      >
                        <SquarePen class="w-4 h-4" />
                        <span class="text-xs ml-1">窗口编辑</span>
                      </Button>
                    </div>
                    <Textarea
                      type="text"
                      placeholder=""
                      v-model="currentPrompt.content"
                      @blur="savePrompts"
                      class="min-h-[200px]"
                    />
                  </div>

                  <!-- 提示词参数设置 -->
                  <div class="space-y-4 pt-4 border-t">
                    <div class="grid gap-2">
                      <Label
                        >{{ t("chat.settings.creativity") }}
                        <Badge variant="outline">temperature</Badge></Label
                      >
                      <div class="flex">
                        <Slider
                          v-model="currentPrompt.temperature"
                          :default-value="[0.6]"
                          :max="1"
                          :min="0"
                          :step="0.01"
                          @update:model-value="updatePromptParams(currentPrompt.id)"
                        />
                        <Input
                          class="w-14 ml-2"
                          v-model="currentPrompt.temperature[0]"
                          @blur="updatePromptParams(currentPrompt.id)"
                        ></Input>
                      </div>
                    </div>
                    <div class="grid gap-2">
                      <Label
                        >{{ t("chat.settings.openness") }}
                        <Badge variant="outline">top_p</Badge></Label
                      >
                      <div class="flex">
                        <Slider
                          v-model="currentPrompt.top_p"
                          :default-value="[1]"
                          :max="1"
                          :min="0"
                          :step="0.01"
                          @update:model-value="updatePromptParams(currentPrompt.id)"
                        />
                        <Input
                          class="w-14 ml-2"
                          v-model="currentPrompt.top_p[0]"
                          @blur="updatePromptParams(currentPrompt.id)"
                        ></Input>
                      </div>
                    </div>
                    <div class="grid gap-2">
                      <Label
                        >{{ t("chat.settings.expressiveness") }}
                        <Badge variant="outline">presence_penalty</Badge></Label
                      >
                      <div class="flex">
                        <Slider
                          v-model="currentPrompt.presence_penalty"
                          :default-value="[0]"
                          :max="2"
                          :min="-2.0"
                          :step="0.01"
                          @update:model-value="updatePromptParams(currentPrompt.id)"
                        />
                        <Input
                          class="w-14 ml-2"
                          v-model="currentPrompt.presence_penalty[0]"
                          @blur="updatePromptParams(currentPrompt.id)"
                        ></Input>
                      </div>
                    </div>
                    <div class="grid gap-2">
                      <Label
                        >{{ t("chat.settings.vocabulary") }}
                        <Badge variant="outline">frequency_penalty</Badge></Label
                      >
                      <div class="flex">
                        <Slider
                          v-model="currentPrompt.frequency_penalty"
                          :default-value="[0]"
                          :max="2.0"
                          :min="-2.0"
                          :step="0.01"
                          @update:model-value="updatePromptParams(currentPrompt.id)"
                        />
                        <Input
                          class="w-14 ml-2"
                          v-model="currentPrompt.frequency_penalty[0]"
                          @blur="updatePromptParams(currentPrompt.id)"
                        ></Input>
                      </div>
                    </div>
                  </div>
                </div>
                <ScrollBar />
              </ScrollArea>
              <div v-else class="text-center text-muted-foreground py-8">
                请先添加提示词
              </div>
            </div>
          </div>
        </div>
      </form>
    </SidebarContent>
    <SidebarFooter>
      <Button type="submit" @click="handleSubmit">
        {{ t("chat.settings.saveSettings") }}
      </Button>
    </SidebarFooter>
  </Sidebar>

  <TeamPromptsDialog
    :open="isTeamPromptsDialogOpen"
    @update:open="isTeamPromptsDialogOpen = $event"
    @select="handleSelectTeamPrompt"
  />

  <PromptEditor
    v-model:isOpen="isPromptEditorOpen"
    :initialPrompt="currentPrompt?.content || ''"
    @save="savePrompt"
  />
</template>

