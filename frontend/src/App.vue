<script setup lang="ts">
import { ref } from 'vue'
import ConfigListPage from '@/pages/ConfigListPage.vue'
import ConfigEditorPage from '@/pages/ConfigEditorPage.vue'

type Page = 'list' | 'editor'

const currentPage = ref<Page>('list')
const editingConfigId = ref<string | null>(null)

function openEditor(id: string | null) {
  editingConfigId.value = id
  currentPage.value = 'editor'
}

function closeEditor() {
  editingConfigId.value = null
  currentPage.value = 'list'
}
</script>

<template>
  <el-container style="height: 100vh">
    <el-header style="display: flex; align-items: center; background: #1d2939; padding: 0 24px">
      <span style="color: #fff; font-size: 18px; font-weight: 600">Proxy Subscription Converter</span>
    </el-header>
    <el-main style="padding: 0; overflow: hidden">
      <ConfigListPage
        v-if="currentPage === 'list'"
        @edit="openEditor"
        @create="openEditor(null)"
      />
      <ConfigEditorPage
        v-else
        :config-id="editingConfigId"
        @close="closeEditor"
      />
    </el-main>
  </el-container>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
