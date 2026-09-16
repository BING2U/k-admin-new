<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getSources } from "@/api/kdata";
import { formatCell, type JsonRecord } from "@/utils/envelope";

defineOptions({
  name: "SourceConfig"
});

const loading = ref(false);
const rows = ref<JsonRecord[]>([]);
const errorText = ref("");

function columnKeys(items: JsonRecord[]) {
  const preferred = [
    "id",
    "code",
    "name",
    "type",
    "kind",
    "enabled",
    "status",
    "baseUrl",
    "url"
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of preferred) {
    if (items.some(item => key in item)) {
      keys.push(key);
      seen.add(key);
    }
  }
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (seen.has(key)) continue;
      keys.push(key);
      seen.add(key);
    }
  }
  return keys.slice(0, 12);
}

const keys = ref<string[]>([]);

async function load() {
  loading.value = true;
  errorText.value = "";
  try {
    const result = await getSources();
    rows.value = result.items;
    keys.value = columnKeys(result.items);
  } catch (error: any) {
    errorText.value =
      error?.response?.data?.message ||
      error?.message ||
      "无法读取 GET /v1/sources，请确认 k-data-new 已启动";
    ElMessage.error(errorText.value);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-base font-medium">数据源配置</div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            只读 · GET /v1/sources
          </div>
        </div>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </div>
    </template>
    <el-alert
      v-if="errorText"
      :title="errorText"
      type="error"
      show-icon
      class="mb-3"
    />
    <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无数据源">
      <el-table-column
        v-for="key in keys"
        :key="key"
        :prop="key"
        :label="key"
        min-width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ formatCell(row[key]) }}
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
