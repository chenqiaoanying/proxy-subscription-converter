<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { currentLocale, setLocale, type Locale } from '@/i18n'

const { t } = useI18n()

function onChange(loc: Locale) {
  setLocale(loc)
}
</script>

<template>
  <el-dropdown trigger="click" @command="onChange">
    <el-button size="small" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.3)">
      <el-icon style="margin-right: 4px"><Position /></el-icon>
      {{ currentLocale === 'zh-cn' ? t('lang.zhCn') : t('lang.en') }}
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="en" :disabled="currentLocale === 'en'">
          {{ t('lang.en') }}
        </el-dropdown-item>
        <el-dropdown-item command="zh-cn" :disabled="currentLocale === 'zh-cn'">
          {{ t('lang.zhCn') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
