<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  name?: string;
  size?: number;
}>();

const initials = computed(() => {
  const raw = (props.name || "").trim();
  if (!raw) return "?";
  const parts = raw.split(/[\s·•]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const chars = Array.from(raw);
  return chars.slice(0, 2).join("").toUpperCase();
});

const px = computed(() => `${props.size ?? 32}px`);
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-full bg-[var(--el-color-primary-light-7)] text-[var(--el-color-primary)] font-medium select-none shrink-0"
    :style="{
      width: px,
      height: px,
      fontSize: `${Math.max(12, (props.size ?? 32) * 0.38)}px`
    }"
    :title="name || 'artist'"
  >
    {{ initials }}
  </span>
</template>
