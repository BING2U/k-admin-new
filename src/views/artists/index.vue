<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getArtists } from "@/api/kdata";
import {
  artistCompany,
  artistId,
  artistName,
  formatCell,
  type JsonRecord
} from "@/utils/envelope";
import ArtistInitials from "@/components/ArtistInitials.vue";

defineOptions({
  name: "ArtistList"
});

const router = useRouter();
const loading = ref(false);
const rows = ref<JsonRecord[]>([]);
const total = ref(0);
const companies = ref<string[]>([]);
const errorText = ref("");

const query = reactive({
  q: "",
  company: "",
  page: 1,
  pageSize: 20
});

function collectCompanies(items: JsonRecord[]) {
  const set = new Set(companies.value);
  for (const item of items) {
    const company = artistCompany(item);
    if (company) set.add(company);
  }
  companies.value = [...set].sort();
}

async function load() {
  loading.value = true;
  errorText.value = "";
  try {
    const result = await getArtists({
      q: query.q.trim() || undefined,
      company: query.company || undefined,
      page: query.page,
      pageSize: query.pageSize
    });
    rows.value = result.items;
    total.value = result.total;
    collectCompanies(result.items);
  } catch (error: any) {
    errorText.value =
      error?.response?.data?.message ||
      error?.message ||
      "无法读取 GET /v1/artists，请确认 k-data-new 已启动";
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

function openDetail(row: JsonRecord) {
  const id = artistId(row);
  if (!id) {
    ElMessage.warning("该行缺少 id");
    return;
  }
  router.push(`/artists/${encodeURIComponent(id)}`);
}

onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div>
        <div class="text-base font-medium">艺人核对</div>
        <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
          GET /v1/artists · 搜索 / 公司过滤后进入详情改名或合并
        </div>
      </div>
    </template>

    <el-form
      :inline="true"
      :model="query"
      class="mb-3"
      @submit.prevent="search"
    >
      <el-form-item label="搜索">
        <el-input
          v-model="query.q"
          clearable
          placeholder="艺人名称 / 关键词"
          style="width: 220px"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item label="公司">
        <el-select
          v-model="query.company"
          clearable
          filterable
          allow-create
          default-first-option
          placeholder="全部公司"
          style="width: 200px"
        >
          <el-option
            v-for="item in companies"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="search"
          >查询</el-button
        >
        <el-button
          @click="
            query.q = '';
            query.company = '';
            search();
          "
        >
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="errorText"
      :title="errorText"
      type="error"
      show-icon
      class="mb-3"
    />

    <el-table
      v-loading="loading"
      :data="rows"
      border
      stripe
      empty-text="暂无艺人"
      @row-dblclick="openDetail"
    >
      <el-table-column label="ID" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ artistId(row) || "—" }}</template>
      </el-table-column>
      <el-table-column label="名称" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <ArtistInitials :name="artistName(row)" />
            <span>{{ artistName(row) || "—" }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="公司" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ artistCompany(row) || "—" }}</template>
      </el-table-column>
      <el-table-column label="别名" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatCell(row.aliases ?? row.alias ?? row.nameAliases) }}
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">
          {{
            formatCell(
              row.updatedAt ?? row.updated_at ?? row.modifiedAt ?? row.mtime
            )
          }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)"
            >详情</el-button
          >
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
