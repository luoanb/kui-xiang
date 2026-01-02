<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-vue-next";
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@/components/ui/toast/use-toast";
import {
  getTeamPromptsList,
  deleteTeamPromptConfig,
  type TeamPromptConfig,
} from "@/lib/teamPromptsStorage";

const { t } = useI18n();
const { toast } = useToast();

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [config: TeamPromptConfig];
}>();

const teamPromptsList = ref<TeamPromptConfig[]>([]);

// 加载团队提示词列表
const loadTeamPromptsList = () => {
  teamPromptsList.value = getTeamPromptsList();
};

// 监听对话框打开状态
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      loadTeamPromptsList();
    }
  }
);

// 选择团队提示词
const handleSelect = (config: TeamPromptConfig) => {
  emit("select", config);
  emit("update:open", false);
};

// 删除团队提示词
const handleDelete = (id: string, event: Event) => {
  event.stopPropagation();
  try {
    deleteTeamPromptConfig(id);
    loadTeamPromptsList();
    toast({
      title: t("common.success"),
      description: "删除成功",
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: (error as Error).message,
    });
  }
};

// 格式化时间
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>选择其他提示词</DialogTitle>
        <DialogDescription>
          从已保存的团队提示词中选择一个应用到当前会话
        </DialogDescription>
      </DialogHeader>
      <ScrollArea class="max-h-[400px]">
        <div class="space-y-2">
          <div
            v-for="config in teamPromptsList"
            :key="config.id"
            @click="handleSelect(config)"
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ config.title }}</div>
              <div class="text-sm text-muted-foreground mt-1">
                <span>提示词数量: {{ config.prompts.length }}</span>
                <span class="mx-2">•</span>
                <span>创建时间: {{ formatDate(config.createdAt) }}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="ml-2 flex-shrink-0"
              @click="handleDelete(config.id, $event)"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
          <div
            v-if="teamPromptsList.length === 0"
            class="text-center py-8 text-muted-foreground"
          >
            暂无保存的团队提示词
          </div>
        </div>
        <ScrollBar />
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>

