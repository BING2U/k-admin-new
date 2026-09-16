<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getArtist, patchArtist } from "@/api/kdata";
import {
  artistCompany,
  artistId,
  artistName,
  formatCell,
  type JsonRecord
} from "@/utils/envelope";

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

const form = reactive({
  name: "",
  company: ""
});
const mergeIntoId = ref("");

const id = computed(() => String(route.params.id ?? ""));

const extraEntries = computed(() => {
  const skip = new Set([
    "id",
    "artistId",
    "artist_id",
    "_id",
    "name",
    "displayName",
    "display_name",
    "company",
    "companyName",
    "company_name",
    "agency",
    "agencyName",
    "agency_name"
  ]);
  return Object.entries(artist.value).filter(([key]) => !skip.has(key));
});

async function load() {
  if (!id.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const data = await getArtist(id.value);
    artist.value = data;
    form.name = artistName(data);
    form.company = artistCompany(data);
  } catch (error: any) {
    errorText.value =
      error?.response?.data?.message ||
      error?.message ||
      `无法读取 GET /v1/artists/${id.value}`;
    ElMessage.error(errorText.value);
    artist.value = {};
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const body: JsonRecord = {};
    if (form.name) body.name = form.name;
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
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-base font-medium">艺人详情</div>
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

      <el-descriptions :column="2" border>
        <el-descriptions-item label="ID">
          {{ artistId(artist) || id }}
        </el-descriptions-item>
        <el-descriptions-item label="名称">
          {{ artistName(artist) || "—" }}
        </el-descriptions-item>
        <el-descriptions-item label="公司">
          {{ artistCompany(artist) || "—" }}
        </el-descriptions-item>
        <el-descriptions-item
          v-for="[key, value] in extraEntries"
          :key="key"
          :label="key"
        >
          {{ formatCell(value) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>改名 / 编辑</span>
      </template>
      <el-form label-width="96px" style="max-width: 560px" @submit.prevent="save">
        <el-form-item label="艺人名称">
          <el-input v-model="form.name" placeholder="name" />
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
      <el-form label-width="96px" style="max-width: 560px" @submit.prevent="merge">
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
