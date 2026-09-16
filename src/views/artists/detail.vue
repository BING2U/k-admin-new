<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getArtist, patchArtist } from "@/api/kdata";
import { artistId, artistName, type JsonRecord } from "@/utils/envelope";
import {
  aliasRows,
  artistTitle,
  artistTypeLabel,
  basicInfoFields,
  companyFormValue,
  companyLabel,
  externalAccountRows,
  membershipRows,
  prettyJson,
  sourceRows
} from "@/utils/artistDisplay";
import ArtistInitials from "@/components/ArtistInitials.vue";

defineOptions({
  name: "ArtistDetail"
});

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const merging = ref(false);
const errorText = ref("");
const artist = ref<JsonRecord>({});
const rawJson = ref("");

const form = reactive({
  name: "",
  company: ""
});
const mergeIntoId = ref("");

const id = computed(() => String(route.params.id ?? ""));
const title = computed(() => artistTitle(artist.value));
const company = computed(() => companyLabel(artist.value));
const typeLabel = computed(() => artistTypeLabel(artist.value));
const idText = computed(() => artistId(artist.value) || id.value);
const basicFields = computed(() => basicInfoFields(artist.value));
const aliases = computed(() => aliasRows(artist.value));
const memberships = computed(() => membershipRows(artist.value));
const membershipNameLabel = computed(() => {
  if (typeLabel.value === "团体") return "成员";
  if (typeLabel.value === "个人") return "团体";
  return "名称";
});
const accounts = computed(() => externalAccountRows(artist.value));
const sources = computed(() => sourceRows(artist.value));

async function load() {
  if (!id.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const data = await getArtist(id.value);
    artist.value = data;
    rawJson.value = prettyJson(data);
    form.name = artistName(data);
    form.company = companyFormValue(data);
  } catch (error: any) {
    errorText.value =
      error?.response?.data?.message ||
      error?.message ||
      `无法读取 GET /v1/artists/${id.value}`;
    ElMessage.error(errorText.value);
    artist.value = {};
    rawJson.value = "";
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const body: JsonRecord = {};
    if (form.name) {
      body.name = form.name;
      body.official_name = form.name;
    }
    if (form.company) body.company = form.company;
    const updated = await patchArtist(id.value, body);
    artist.value = { ...artist.value, ...updated };
    ElMessage.success("已保存（PATCH /v1/artists/{id}）");
    await load();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || "保存失败"
    );
  } finally {
    saving.value = false;
  }
}

async function merge() {
  const target = mergeIntoId.value.trim();
  if (!target) {
    ElMessage.warning("请填写目标艺人 ID");
    return;
  }
  if (target === id.value) {
    ElMessage.warning("不能合并到自身");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将艺人 ${id.value} 合并到 ${target}？此操作调用 PATCH mergeIntoId，通常不可逆。`,
      "确认合并",
      { type: "warning", confirmButtonText: "合并", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  merging.value = true;
  try {
    await patchArtist(id.value, { mergeIntoId: target });
    ElMessage.success("合并请求已提交");
    router.push(`/artists/${encodeURIComponent(target)}`);
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || "合并失败"
    );
  } finally {
    merging.value = false;
  }
}

watch(id, load, { immediate: true });
</script>

<template>
  <div class="flex flex-col gap-3">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-base font-medium">艺人核对详情</div>
            <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
              GET /v1/artists/{{ id }} · PATCH 改名 / 合并
            </div>
          </div>
          <el-button @click="router.push('/artists/index')">返回列表</el-button>
        </div>
      </template>

      <el-alert
        v-if="errorText"
        :title="errorText"
        type="error"
        show-icon
        class="mb-3"
      />

      <div class="flex items-start gap-3">
        <ArtistInitials :name="title" :size="56" />
        <div class="min-w-0">
          <h1
            class="text-xl font-medium leading-7 m-0"
            data-testid="artist-title"
          >
            {{ title || "未命名艺人" }}
          </h1>
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <span data-testid="artist-company">{{ company || "—" }}</span>
            <el-tag v-if="typeLabel" size="small" data-testid="artist-type">
              {{ typeLabel }}
            </el-tag>
          </div>
          <div
            v-if="idText"
            class="text-xs text-[var(--el-text-color-secondary)] mt-1"
          >
            ID
            <span
              v-copy:click="idText"
              class="cursor-pointer underline-offset-2 hover:underline"
              title="点击复制"
            >
              {{ idText }}
            </span>
          </div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>基本信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item
          v-for="field in basicFields"
          :key="field.key"
          :label="field.label"
          :span="field.key === 'bio' ? 2 : 1"
        >
          <span class="whitespace-pre-wrap">{{ field.value }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>多语言别名</span>
      </template>
      <el-table :data="aliases" border stripe empty-text="暂无">
        <el-table-column prop="lang" label="语言" min-width="100" />
        <el-table-column prop="name" label="别名" min-width="200" />
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>成员 / 团体关系</span>
      </template>
      <el-table
        :data="memberships"
        border
        stripe
        empty-text="暂无"
        data-testid="membership-table"
      >
        <el-table-column
          prop="target"
          :label="membershipNameLabel"
          min-width="160"
        />
        <el-table-column prop="role" label="角色" min-width="100">
          <template #default="{ row }">{{ row.role || "—" }}</template>
        </el-table-column>
        <el-table-column prop="position" label="职位" min-width="100">
          <template #default="{ row }">{{ row.position || "—" }}</template>
        </el-table-column>
        <el-table-column prop="join_date" label="加入" min-width="120">
          <template #default="{ row }">{{ row.join_date || "—" }}</template>
        </el-table-column>
        <el-table-column prop="leave_date" label="离开" min-width="120">
          <template #default="{ row }">{{ row.leave_date || "—" }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="100">
          <template #default="{ row }">{{ row.status || "—" }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>社交链接</span>
      </template>
      <el-table :data="accounts" border stripe empty-text="暂无">
        <el-table-column prop="platform" label="平台" min-width="120">
          <template #default="{ row }">{{ row.platform || "—" }}</template>
        </el-table-column>
        <el-table-column prop="handle" label="账号" min-width="140">
          <template #default="{ row }">{{ row.handle || "—" }}</template>
        </el-table-column>
        <el-table-column label="链接" min-width="240">
          <template #default="{ row }">
            <a
              v-if="row.href"
              :href="row.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--el-color-primary)]"
            >
              {{ row.url }}
            </a>
            <span v-else>{{ row.url || "—" }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>来源追溯</span>
      </template>
      <el-table :data="sources" border stripe empty-text="暂无">
        <el-table-column prop="source_type" label="来源类型" min-width="120">
          <template #default="{ row }">{{ row.source_type || "—" }}</template>
        </el-table-column>
        <el-table-column label="来源 URL" min-width="240">
          <template #default="{ row }">
            <a
              v-if="row.href"
              :href="row.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--el-color-primary)]"
            >
              {{ row.source_url }}
            </a>
            <span v-else>{{ row.source_url || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="fetched_at" label="抓取时间" min-width="180">
          <template #default="{ row }">{{ row.fetched_at || "—" }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <el-collapse>
        <el-collapse-item
          title="原始 JSON（GET 完整响应，默认折叠）"
          name="raw"
        >
          <pre
            class="text-xs leading-5 overflow-auto max-h-[480px] m-0 p-3 bg-[var(--el-fill-color-light)] rounded"
            >{{ rawJson || "—" }}</pre
          >
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>改名 / 编辑</span>
      </template>
      <el-form
        label-width="96px"
        style="max-width: 560px"
        @submit.prevent="save"
      >
        <el-form-item label="官方名称">
          <el-input v-model="form.name" placeholder="official_name" />
        </el-form-item>
        <el-form-item label="公司">
          <el-input v-model="form.company" placeholder="company" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">
            保存
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>合并到其他艺人</span>
      </template>
      <el-form
        label-width="96px"
        style="max-width: 560px"
        @submit.prevent="merge"
      >
        <el-form-item label="目标 ID">
          <el-input
            v-model="mergeIntoId"
            placeholder="mergeIntoId，被当前艺人合并到的目标"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="danger" :loading="merging" @click="merge">
            合并
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
