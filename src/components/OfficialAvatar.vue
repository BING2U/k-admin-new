<script setup lang="ts">
import ArtistInitials from "@/components/ArtistInitials.vue";

defineProps<{
  src?: string;
  name?: string;
  size?: number;
}>();
</script>

<template>
  <!--
    Product: the only legal artist photo is a hotlink to official avatar_url.
    Never download, mirror, CDN-cache, or <img src="data:"> / blob.
  -->
  <img
    v-if="src"
    :src="src"
    :alt="name || 'avatar'"
    referrerpolicy="no-referrer"
    class="rounded-full object-cover shrink-0 bg-[var(--el-fill-color-light)]"
    :style="{
      width: `${size ?? 32}px`,
      height: `${size ?? 32}px`
    }"
  />
  <ArtistInitials v-else :name="name" :size="size" />
</template>
