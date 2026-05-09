<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SpeedInsights } from '@vercel/speed-insights/vue'
import { ElMessage } from 'element-plus'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { elementLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

onMounted(() => auth.ensureInitialized())

function signIn() {
  window.location.href = auth.loginUrl(router.currentRoute.value.fullPath)
}

async function signOut() {
  await auth.logout()
  ElMessage.success(t('auth.signedOut'))
  router.push('/')
}
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <SpeedInsights />
    <el-container style="height: 100vh">
      <el-header
        style="
          display: flex; align-items: center; justify-content: space-between;
          background: #1d2939; padding: 0 24px;
        "
      >
        <div style="display: flex; align-items: center; gap: 24px">
          <router-link
            to="/"
            style="color: #fff; font-size: 18px; font-weight: 600; text-decoration: none"
          >
            {{ t('app.title') }}
          </router-link>
          <router-link
            v-if="auth.isLoggedIn"
            to="/configs"
            style="color: #c9d1d9; font-size: 14px; text-decoration: none"
          >
            {{ t('auth.myConfigs') }}
          </router-link>
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <LanguageSwitcher />
          <template v-if="auth.isLoggedIn && auth.user">
            <el-avatar
              v-if="auth.user.avatar_url"
              :src="auth.user.avatar_url"
              :size="28"
            />
            <span style="color: #fff; font-size: 13px">{{ auth.user.login }}</span>
            <el-button size="small" @click="signOut">{{ t('auth.signOut') }}</el-button>
          </template>
          <template v-else-if="auth.initialized">
            <el-button size="small" type="primary" @click="signIn">
              {{ t('auth.signInWithGithub') }}
            </el-button>
          </template>
        </div>
      </el-header>
      <el-main style="padding: 0; overflow: hidden">
        <router-view />
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
