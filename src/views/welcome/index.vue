<script setup lang="ts">
import { useRouter } from "vue-router";

defineOptions({
  name: "Welcome"
});

const router = useRouter();

const cards = [
  {
    title: "艺人核对",
    desc: "搜索、公司过滤、改名与合并",
    path: "/artists/index"
  },
  {
    title: "数据源配置",
    desc: "只读查看 k-data-new 源",
    path: "/sources/index"
  },
  {
    title: "入库失败",
    desc: "浏览 ingest failures",
    path: "/ingest/failures"
  }
];
</script>

<template>
  <el-card shadow="never">
    <h2 class="text-xl font-medium mb-2">K Admin</h2>
    <p class="text-[var(--el-text-color-secondary)] mb-6">
      v0.1 管理台，仅通过 HTTP 调用 k-data-new（默认
      <code>http://127.0.0.1:28080</code>）。
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <el-card
        v-for="card in cards"
        :key="card.path"
        shadow="hover"
        class="cursor-pointer"
        @click="router.push(card.path)"
      >
        <div class="text-base font-medium">{{ card.title }}</div>
        <div class="text-sm text-[var(--el-text-color-secondary)] mt-2">
          {{ card.desc }}
        </div>
      </el-card>
    </div>
  </el-card>
</template>
