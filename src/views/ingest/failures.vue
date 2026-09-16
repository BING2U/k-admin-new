<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getIngestFailures } from "@/api/kdata";
import { formatCell, str, type JsonRecord } from "@/utils/envelope";

defineOptions({
  name: "IngestFailures"
});

const loading = ref(false);
const rows = ref<JsonRecord[]>([]);
const total = ref(0);
const errorText = ref("");

const query = reactive({
  q: "",
  page: 1,
  pageSize: 20
});

function failId(row: JsonRecord) {
  return str(row, "id", "failureId", "failure_id", "_id");
}

async function load() {
  loading.value = true;
  errorText.value = "";
  try {
    const result = await getIngestFailures({
      q: query.q.trim() || undefined,
      page: query.page,
      pageSize: query.pageSize
    });
    rows.value = result.items;
    total.value = result.total;
  } catch (error: any) {
    errorText.value =
      error?.response?.data?.message ||
      error?.message ||
      "无法读取 GET /v1/ingest/failures，请确认 k-data-new 已启动";
    ElMessage.error(errorText.value);
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-base font-medium">入库失败</div>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            GET /v1/ingest/failures
          </div>
        </div>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </div>
    </template>

    <el-form :inline="true" :model="query" class="mb-3" @submit.prevent="search">
      <el-form-item label="搜索">
        <el-input
          v-model="query.q"
          clearable
          placeholder="错误信息 / 源 / 艺人"
          style="width: 260px"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="search">查询</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="errorText"
      :title="errorText"
      type="error"
      show-icon
      class="mb-3"
    />

    <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无失败记录">
      <el-table-column label="ID" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ failId(row) || "—" }}</template>
      </el-table-column>
      <el-table-column label="数据源" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{
            formatCell(
              row.source ?? row.sourceId ?? row.source_id ?? row.sourceName
            )
          }}
        </template>
      </el-table-column>
      <el-table-column label="艺人" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{
            formatCell(
              row.artist ?? row.artistName ?? row.artist_id ?? row.artistId
            )
          }}
        </template>
      </el-table-column>
      <el-table-column label="错误" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          {{
            formatCell(
              row.error ?? row.message ?? row.reason ?? row.detail ?? row.msg
            )
          }}
        </template>
      </el-table-column>
      <el-table-column label="时间" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">
          {{
            formatCell(
              row.createdAt ??
                row.created_at ??
                row.failedAt ??
                row.failed_at ??
                row.time
            )
          }}
        </template>
      </el-table-column>
      <el-table-column label="原始数据" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatCell(row.payload ?? row.raw ?? row.body ?? row.data) }}
        </template>
      </el-table-column>
    </el-table>

    <div class="flex justify-end mt-3">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="load"
        @size-change="
          query.page = 1;
          load();
        "
      />
    </div>
  </el-card>
</template>
