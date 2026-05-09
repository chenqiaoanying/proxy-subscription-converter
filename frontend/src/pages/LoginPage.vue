<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

function signIn() {
  const next = typeof route.query.next === 'string' ? route.query.next : undefined
  window.location.href = auth.loginUrl(next)
}
</script>

<template>
  <div style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 24px">
    <el-card shadow="never" style="max-width: 420px; width: 100%; border-radius: 12px">
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: center; padding: 16px 8px">
        <h2 style="font-size: 20px; font-weight: 600">{{ t('auth.loginRequired') }}</h2>
        <p style="color: var(--el-text-color-secondary); text-align: center; font-size: 14px">
          {{ t('auth.loginIntro') }}
        </p>
        <el-button type="primary" size="large" @click="signIn">
          {{ t('auth.signInWithGithub') }}
        </el-button>
        <router-link to="/" style="font-size: 13px; color: var(--el-text-color-secondary)">
          {{ t('auth.continueWithout') }}
        </router-link>
      </div>
    </el-card>
  </div>
</template>
