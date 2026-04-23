<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SpeedInsights } from '@vercel/speed-insights/vue'
import ConfigListPage from '@/pages/ConfigListPage.vue'
import ConfigEditorPage from '@/pages/ConfigEditorPage.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { elementLocale } from '@/i18n'

type Page = 'list' | 'editor'

const { t } = useI18n()
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
  <el-config-provider :locale="elementLocale">
    <SpeedInsights />
    <el-container style="height: 100vh">
      <el-header style="display: flex; align-items: center; justify-content: space-between; background: #1d2939; padding: 0 24px">
        <span style="color: #fff; font-size: 18px; font-weight: 600">{{ t('app.title') }}</span>
        <LanguageSwitcher />
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
  </el-config-provider>
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
