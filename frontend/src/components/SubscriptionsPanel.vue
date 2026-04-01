<script setup lang="ts">
import { ref } from 'vue'
import { type SubscriptionConfig, emptySubscription } from '@/types'

const model = defineModel<Record<string, SubscriptionConfig>>({ required: true })

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
      <el-table-column label="Name (Key)" width="160">
        <template #default="{ row: [key] }">
          <el-text>{{ key }}</el-text>
        </template>
      </el-table-column>
      <el-table-column label="URL" min-width="200">
        <template #default="{ row: [, s] }">
          <el-text truncated>{{ s.url }}</el-text>
        </template>
      </el-table-column>
      <el-table-column label="Group Tag" width="130">
        <template #default="{ row: [, s] }">{{ s.tag ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="User-Agent" width="130">
        <template #default="{ row: [, s] }">{{ s.user_agent ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="Enabled" width="90">
        <template #default="{ row: [key, s] }">
          <el-switch :model-value="s.enabled" @change="toggleEnabled(key)" />
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="120" fixed="right">
        <template #default="{ row: [key] }">
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
        <el-form-item label="Group Tag">
          <el-input v-model="formData.tag" placeholder="Optional: creates an outbound group" clearable />
          <el-text type="info" size="small">If set, creates a selector outbound group with all proxies from this subscription</el-text>
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
