<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { type SubscriptionConfig, type SubscriptionUserInfo, emptySubscription } from '@/types'
import { useConfigStore } from '@/stores/configs'

const model = defineModel<Record<string, SubscriptionConfig>>({ required: true })
const store = useConfigStore()

const showDialog = ref(false)
const editingKey = ref<string | null>(null)
const formKey = ref('')
const formData = ref<SubscriptionConfig>(emptySubscription())

const PROXY_TYPES = ['vmess', 'vless', 'trojan', 'shadowsocks', 'hysteria2', 'tuic', 'wireguard']

function openAdd() {
  editingKey.value = null
  formKey.value = ''
  formData.value = emptySubscription()
  showDialog.value = true
}

function openEdit(key: string) {
  editingKey.value = key
  formKey.value = key
  formData.value = { ...model.value[key] }
  showDialog.value = true
}

function handleSave() {
  if (!formKey.value.trim()) return
  const updated = { ...model.value }
  if (editingKey.value && editingKey.value !== formKey.value) {
    delete updated[editingKey.value]
  }
  updated[formKey.value.trim()] = { ...formData.value }
  model.value = updated
  showDialog.value = false
}

function handleDelete(key: string) {
  const updated = { ...model.value }
  delete updated[key]
  model.value = updated
}

function toggleEnabled(key: string) {
  model.value[key] = { ...model.value[key], enabled: !model.value[key].enabled }
}

const entries = () => Object.entries(model.value)

async function handleLoad(key: string, sub: SubscriptionConfig) {
  try {
    await store.previewSubscription(key, sub.url, sub.user_agent)
  } catch (e) {
    ElMessage.error(`Failed to load "${key}": ${String(e)}`)
  }
}

// --- Quota helpers ---

function formatBytes(bytes: number): string {
  const gb = bytes / 1073741824
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / 1048576
  return `${mb.toFixed(0)} MB`
}

function quotaPercent(info: SubscriptionUserInfo): number {
  if (!info.total) return 0
  return Math.min(100, ((info.upload + info.download) / info.total) * 100)
}

function quotaStatus(percent: number): '' | 'warning' | 'exception' {
  if (percent >= 90) return 'exception'
  if (percent >= 75) return 'warning'
  return ''
}

// --- Expiry helpers ---

function daysLeft(expire: number): number {
  return Math.floor((expire * 1000 - Date.now()) / 86400000)
}

function formatExpiry(expire: number): string {
  return new Date(expire * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function expiryColor(expire: number): string {
  const days = daysLeft(expire)
  if (days <= 7) return 'var(--el-color-danger)'
  if (days <= 30) return 'var(--el-color-warning)'
  return 'inherit'
}
</script>

<template>
  <div>
    <div style="margin-bottom: 12px">
      <el-button type="primary" size="small" @click="openAdd">
        <el-icon><Plus /></el-icon>
        Add Subscription
      </el-button>
    </div>

    <el-table :data="entries()" border>
      <el-table-column label="Name (Key)" width="160" show-overflow-tooltip>
        <template #default="{ row: [key] }">{{ key }}</template>
      </el-table-column>
      <el-table-column label="URL" min-width="180" show-overflow-tooltip>
        <template #default="{ row: [, s] }">{{ s.url }}</template>
      </el-table-column>
      <el-table-column label="User-Agent" width="120" show-overflow-tooltip>
        <template #default="{ row: [, s] }">{{ s.user_agent ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="Enabled" width="80">
        <template #default="{ row: [key, s] }">
          <el-switch :model-value="s.enabled" @change="toggleEnabled(key)" />
        </template>
      </el-table-column>
      <el-table-column label="Proxies" width="72">
        <template #default="{ row: [key] }">
          <span v-if="store.subscriptionPreviews[key] !== undefined">
            {{ store.subscriptionPreviews[key].length }}
          </span>
          <span v-else style="color: #999">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Quota" width="190">
        <template #default="{ row: [key] }">
          <template v-if="store.subscriptionUserInfos[key] && store.subscriptionUserInfos[key].total > 0">
            <el-progress
              :percentage="quotaPercent(store.subscriptionUserInfos[key])"
              :status="quotaStatus(quotaPercent(store.subscriptionUserInfos[key])) || undefined"
              :stroke-width="7"
              :show-text="false"
            />
            <div class="quota-text">
              {{ formatBytes(store.subscriptionUserInfos[key].upload + store.subscriptionUserInfos[key].download) }}
              <span style="color: #999"> / </span>
              {{ formatBytes(store.subscriptionUserInfos[key].total) }}
            </div>
          </template>
          <span v-else style="color: #999">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Expires" width="130">
        <template #default="{ row: [key] }">
          <template v-if="store.subscriptionUserInfos[key]?.expire">
            <div :style="{ color: expiryColor(store.subscriptionUserInfos[key].expire!) }">
              <div>{{ formatExpiry(store.subscriptionUserInfos[key].expire!) }}</div>
              <div class="days-left">{{ daysLeft(store.subscriptionUserInfos[key].expire!) }} days left</div>
            </div>
          </template>
          <span v-else style="color: #999">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="140" fixed="right">
        <template #default="{ row: [key, s] }">
          <el-button
            size="small"
            :loading="store.previewLoading[key]"
            :title="s.user_agent ? 'Load via backend' : 'Load from browser'"
            @click="handleLoad(key, s)"
          >
            <el-icon v-if="!store.previewLoading[key]"><Refresh /></el-icon>
          </el-button>
          <el-button size="small" @click="openEdit(key)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(key)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="showDialog"
      :title="editingKey ? 'Edit Subscription' : 'Add Subscription'"
      width="500px"
    >
      <el-form label-width="110px">
        <el-form-item label="Name (Key)" required>
          <el-input v-model="formKey" placeholder="subscription1" />
        </el-form-item>
        <el-form-item label="URL" required>
          <el-input v-model="formData.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="User-Agent">
          <el-input v-model="formData.user_agent" placeholder="e.g. clashmeta" clearable />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="formData.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">Cancel</el-button>
        <el-button type="primary" @click="handleSave">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.el-table td .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quota-text {
  font-size: 11px;
  color: #606266;
  margin-top: 3px;
  line-height: 1.2;
}

.days-left {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}
</style>
