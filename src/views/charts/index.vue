<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { chartsApi } from "@/api/charts";
import { formatCell, type JsonRecord } from "@/utils/envelope";
import {
  CHART_PERIODS,
  CHART_SOURCES,
  MELON_DAY_CONSTRAINT,
  buildManualRunBody,
  failureRow,
  jobRow,
  listLoadState,
  mergeChartEntries,
  requestErrorMessage,
  snapshotRow,
  unavailableMessage,
  type EntryRow,
  type FailureRow,
  type JobRow,
  type SnapshotRow
} from "@/utils/chartDisplay";

defineOptions({
  name: "ChartAdmin"
});

const tab = ref("snapshots");
const loading = ref(false);
const errorText = ref("");
const snapshotRows = ref<SnapshotRow[]>([]);
const total = ref(0);

const query = reactive({
  source: "melon_song",
  period: "day",
  chartDate: "",
  page: 1,
  pageSize: 20
});

const selectedId = ref("");
const selectedSnapshot = ref<JsonRecord | null>(null);
const detailLoading = ref(false);
const detailError = ref("");
const entryRows = ref<EntryRow[]>([]);

const jobsLoading = ref(false);
const jobsUnavailable = ref(false);
const jobsMessage = ref("");
const jobRows = ref<JobRow[]>([]);
const runDates = reactive<Record<string, string>>({});
const runningId = ref("");

const failuresLoading = ref(false);
const failuresUnavailable = ref(false);
const failuresMessage = ref("");
const failureRows = ref<FailureRow[]>([]);
const failureTotal = ref(0);
const failureQuery = reactive({
  source: "",
  period: "",
  page: 1,
  pageSize: 20
});

const snapshotState = computed(() =>
  listLoadState({
    loading: loading.value,
    items: snapshotRows.value,
    error: errorText.value
  })
);

const jobsState = computed(() =>
  listLoadState({
    loading: jobsLoading.value,
    items: jobRows.value,
    unavailable: jobsUnavailable.value,
    unavailableMessage: jobsMessage.value
  })
);

const failuresState = computed(() =>
  listLoadState({
    loading: failuresLoading.value,
    items: failureRows.value,
    unavailable: failuresUnavailable.value,
    unavailableMessage: failuresMessage.value
  })
);

async function loadSnapshots() {
  loading.value = true;
  errorText.value = "";
  try {
    const result = await chartsApi.listSnapshots({
      source: query.source || undefined,
      period: query.period || undefined,
      chartDate: query.chartDate || undefined
    });
    snapshotRows.value = result.items.map(snapshotRow);
    total.value = result.total;
    if (
      selectedId.value &&
      !snapshotRows.value.some(row => row.id === selectedId.value)
    ) {
      selectedId.value = "";
      selectedSnapshot.value = null;
      entryRows.value = [];
    }
  } catch (error: unknown) {
    errorText.value = requestErrorMessage(
      error,
      "无法读取 GET /v1/charts，请确认 k-data-new 已启动"
    );
    ElMessage.error(errorText.value);
    snapshotRows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function searchSnapshots() {
  query.page = 1;
  loadSnapshots();
}

async function openSnapshot(row: SnapshotRow) {
  if (!row.id) {
    ElMessage.warning("该行缺少 id");
    return;
  }
  selectedId.value = row.id;
  detailLoading.value = true;
  detailError.value = "";
  entryRows.value = [];
  try {
    const [snapshot, entries] = await Promise.all([
      chartsApi.getSnapshot(row.id),
      chartsApi.listEntries(row.id)
    ]);
    selectedSnapshot.value = snapshot;
    let matches: JsonRecord[] = [];
    try {
      matches = (await chartsApi.listMatches(row.id)).items;
    } catch {
      matches = [];
    }
    entryRows.value = mergeChartEntries(entries.items, matches);
  } catch (error: unknown) {
    selectedSnapshot.value = null;
    detailError.value = requestErrorMessage(
      error,
      `无法读取榜单详情 GET /v1/charts/${row.id}`
    );
    ElMessage.error(detailError.value);
  } finally {
    detailLoading.value = false;
  }
}

async function loadJobs() {
  jobsLoading.value = true;
  jobsUnavailable.value = false;
  jobsMessage.value = "";
  try {
    const result = await chartsApi.listJobs();
    if (!result.ok || result.unavailable) {
      jobsUnavailable.value = true;
      jobsMessage.value =
        result.message || unavailableMessage("jobs", 404, "/v1/charts/jobs");
      jobRows.value = [];
      return;
    }
    jobRows.value = result.items.map(jobRow);
  } catch (error: unknown) {
    jobsUnavailable.value = true;
    jobsMessage.value = requestErrorMessage(
      error,
      unavailableMessage("jobs", 0, "/v1/charts/jobs")
    );
    jobRows.value = [];
  } finally {
    jobsLoading.value = false;
  }
}

async function runJob(row: JobRow) {
  if (!row.source || !row.period) {
    ElMessage.warning("缺少 source / period");
    return;
  }
  runningId.value = row.id || `${row.source}:${row.period}`;
  try {
    const date = row.showDatePicker ? runDates[row.id] : undefined;
    await chartsApi.runJob(buildManualRunBody(row.source, row.period, date));
    ElMessage.success(`已提交 ${row.source} / ${row.period}`);
    await loadJobs();
  } catch (error: unknown) {
    ElMessage.error(
      requestErrorMessage(error, "POST /v1/charts/jobs/run 失败")
    );
  } finally {
    runningId.value = "";
  }
}

async function loadFailures() {
  failuresLoading.value = true;
  failuresUnavailable.value = false;
  failuresMessage.value = "";
  try {
    const result = await chartsApi.listFailures({
      source: failureQuery.source || undefined,
      period: failureQuery.period || undefined,
      page: failureQuery.page,
      pageSize: failureQuery.pageSize
    });
    if (!result.ok || result.unavailable) {
      failuresUnavailable.value = true;
      failuresMessage.value =
        result.message ||
        unavailableMessage("failures", 404, "/v1/charts/failures");
      failureRows.value = [];
      failureTotal.value = 0;
      return;
    }
    failureRows.value = result.items.map(failureRow);
    failureTotal.value = result.total;
  } catch (error: unknown) {
    failuresUnavailable.value = true;
    failuresMessage.value = requestErrorMessage(
      error,
      unavailableMessage("failures", 0, "/v1/charts/failures")
    );
    failureRows.value = [];
    failureTotal.value = 0;
  } finally {
    failuresLoading.value = false;
  }
}

function searchFailures() {
  failureQuery.page = 1;
  loadFailures();
}

function onTabChange(name: string | number) {
  if (name === "jobs" && !jobRows.value.length && !jobsUnavailable.value) {
    loadJobs();
  }
  if (
    name === "failures" &&
    !failureRows.value.length &&
    !failuresUnavailable.value
  ) {
    loadFailures();
  }
}

onMounted(loadSnapshots);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div>
        <div class="text-base font-medium">榜单</div>
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
          GET /v1/charts · 快照已接通；定时任务 / 失败列表走拟定 /v1/charts/jobs
          与 /v1/charts/failures
        </div>
      </div>
    </template>

    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="快照" name="snapshots">
        <el-form
          :inline="true"
          :model="query"
          class="mb-3"
          @submit.prevent="searchSnapshots"
        >
          <el-form-item label="来源">
            <el-select v-model="query.source" style="width: 180px">
              <el-option
                v-for="item in CHART_SOURCES"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="周期">
            <el-select v-model="query.period" style="width: 120px">
              <el-option
                v-for="item in CHART_PERIODS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="chart_date">
            <el-date-picker
              v-model="query.chartDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="可选"
              style="width: 160px"
              clearable
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              @click="searchSnapshots"
              >查询</el-button
            >
            <el-button :loading="loading" @click="loadSnapshots"
              >刷新</el-button
            >
          </el-form-item>
        </el-form>

        <el-alert
          v-if="snapshotState.kind === 'error'"
          :title="errorText"
          type="error"
          show-icon
          class="mb-3"
        />

        <el-table
          v-loading="loading"
          :data="snapshotRows"
          border
          stripe
          highlight-current-row
          :empty-text="snapshotState.kind === 'error' ? '加载失败' : '暂无快照'"
          @row-click="openSnapshot"
        >
          <el-table-column
            label="快照时间"
            min-width="170"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.snapshotTime }}</template>
          </el-table-column>
          <el-table-column label="来源" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.source }}</template>
          </el-table-column>
          <el-table-column label="周期" width="80">
            <template #default="{ row }">{{ row.period }}</template>
          </el-table-column>
          <el-table-column label="chart_date" width="120">
            <template #default="{ row }">{{ row.chartDate }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.status }}</template>
          </el-table-column>
          <el-table-column label="条目数" width="90">
            <template #default="{ row }">{{ row.entryCount }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openSnapshot(row)"
                >详情</el-button
              >
            </template>
          </el-table-column>
        </el-table>
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-2">
          共 {{ total }} 条（当前页按接口返回展示）
        </div>

        <el-card v-if="selectedId" shadow="never" class="mt-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">快照详情 {{ selectedId }}</div>
                <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
                  GET /v1/charts/{id}/entries · matches；name_as_seen 原样显示
                </div>
              </div>
              <el-button
                :loading="detailLoading"
                @click="
                  openSnapshot({
                    id: selectedId,
                    source: '',
                    period: '',
                    chartDate: '',
                    snapshotTime: '',
                    status: '',
                    entryCount: ''
                  })
                "
                >刷新详情</el-button
              >
            </div>
          </template>
          <el-alert
            v-if="detailError"
            :title="detailError"
            type="error"
            show-icon
            class="mb-3"
          />
          <div
            v-if="selectedSnapshot"
            class="text-xs text-[var(--el-text-color-secondary)] mb-3"
          >
            状态 {{ formatCell(selectedSnapshot.status) }} · 日期
            {{
              formatCell(
                selectedSnapshot.chart_date ?? selectedSnapshot.chartDate
              )
            }}
          </div>
          <el-table
            v-loading="detailLoading"
            :data="entryRows"
            border
            stripe
            empty-text="暂无条目"
          >
            <el-table-column label="排名" width="70">
              <template #default="{ row }">{{ row.rank }}</template>
            </el-table-column>
            <el-table-column label="标题" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.title }}</template>
            </el-table-column>
            <el-table-column
              label="name_as_seen"
              min-width="160"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.nameAsSeen }}</template>
            </el-table-column>
            <el-table-column label="置信度" width="90">
              <template #default="{ row }">{{ row.confidence }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.status }}</template>
            </el-table-column>
            <el-table-column label="关联" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.matchKind === 'high'">
                  artist_id {{ row.linkedArtistId || "—" }}
                </span>
                <span v-else>{{ row.candidateState || "candidate" }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="定时任务" name="jobs">
        <el-alert
          :title="MELON_DAY_CONSTRAINT"
          type="info"
          show-icon
          class="mb-3"
          :closable="false"
        />
        <el-alert
          v-if="jobsState.kind === 'unavailable'"
          :title="jobsMessage"
          type="warning"
          show-icon
          class="mb-3"
          :closable="false"
        />
        <div class="flex justify-end mb-3">
          <el-button :loading="jobsLoading" @click="loadJobs">刷新</el-button>
        </div>
        <el-table
          v-loading="jobsLoading"
          :data="jobRows"
          border
          stripe
          :empty-text="
            jobsState.kind === 'unavailable'
              ? 'GET /v1/charts/jobs 尚不可用，未编造任务行'
              : '暂无任务'
          "
        >
          <el-table-column label="来源" min-width="130">
            <template #default="{ row }">{{ row.source || "—" }}</template>
          </el-table-column>
          <el-table-column label="周期" width="80">
            <template #default="{ row }">{{ row.period || "—" }}</template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">{{ row.enabled }}</template>
          </el-table-column>
          <el-table-column
            label="最近成功"
            min-width="170"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.lastSuccess }}</template>
          </el-table-column>
          <el-table-column
            label="最近失败"
            min-width="170"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.lastFailure }}</template>
          </el-table-column>
          <el-table-column label="限流" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.rateLimitStatus }}</template>
          </el-table-column>
          <el-table-column label="手动执行" min-width="280" fixed="right">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <el-date-picker
                  v-if="row.showDatePicker"
                  v-model="runDates[row.id]"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="可选历史日期"
                  style="width: 150px"
                  clearable
                />
                <el-button
                  size="small"
                  type="primary"
                  :loading="
                    runningId === (row.id || `${row.source}:${row.period}`)
                  "
                  @click="runJob(row)"
                  >{{ row.runLabel }}</el-button
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="失败记录" name="failures">
        <el-alert
          v-if="failuresState.kind === 'unavailable'"
          :title="failuresMessage"
          type="warning"
          show-icon
          class="mb-3"
          :closable="false"
        />
        <el-form
          :inline="true"
          :model="failureQuery"
          class="mb-3"
          @submit.prevent="searchFailures"
        >
          <el-form-item label="来源">
            <el-select
              v-model="failureQuery.source"
              clearable
              placeholder="全部"
              style="width: 180px"
            >
              <el-option
                v-for="item in CHART_SOURCES"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="周期">
            <el-select
              v-model="failureQuery.period"
              clearable
              placeholder="全部"
              style="width: 120px"
            >
              <el-option
                v-for="item in CHART_PERIODS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="failuresLoading"
              @click="searchFailures"
              >查询</el-button
            >
            <el-button :loading="failuresLoading" @click="loadFailures"
              >刷新</el-button
            >
          </el-form-item>
        </el-form>
        <el-table
          v-loading="failuresLoading"
          :data="failureRows"
          border
          stripe
          :empty-text="
            failuresState.kind === 'unavailable'
              ? 'GET /v1/charts/failures 尚不可用，未编造失败行'
              : '暂无失败记录'
          "
        >
          <el-table-column label="来源" min-width="120">
            <template #default="{ row }">{{ row.source }}</template>
          </el-table-column>
          <el-table-column label="周期" width="80">
            <template #default="{ row }">{{ row.period }}</template>
          </el-table-column>
          <el-table-column label="chart_date" width="120">
            <template #default="{ row }">{{ row.chartDate }}</template>
          </el-table-column>
          <el-table-column label="错误" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">{{ row.error }}</template>
          </el-table-column>
          <el-table-column
            label="created_at"
            min-width="170"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
        </el-table>
        <div class="flex justify-end mt-3">
          <el-pagination
            v-model:current-page="failureQuery.page"
            v-model:page-size="failureQuery.pageSize"
            :total="failureTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="loadFailures"
            @size-change="
              failureQuery.page = 1;
              loadFailures();
            "
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
