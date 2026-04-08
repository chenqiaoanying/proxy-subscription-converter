<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useConfigStore } from '@/stores/configs'
import { type ConfigData, ConfigDataSchema, emptyConfigData } from '@/types'
import SubscriptionsPanel from '@/components/SubscriptionsPanel.vue'
import GroupsPanel from '@/components/GroupsPanel.vue'
import TemplatePanel from '@/components/TemplatePanel.vue'
import MonacoEditor from '@/components/MonacoEditor.vue'

const props = defineProps<{ configId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useConfigStore()
const localConfigId = ref<string | null>(props.configId)
const configName = ref('New Config')
const configData = ref<ConfigData>(emptyConfigData())
const activeTab = ref('subscriptions')
const saving = ref(false)
const loading = ref(false)
const generating = ref(false)
const configUrl = ref('')
const previewVisible = ref(false)
const previewJson = ref('')
const dirty = ref(false)
let skipDirtyWatch = false

const statelessGenerateUrl = computed(() =>
  configUrl.value ? store.getStatelessGenerateUrl(configUrl.value) : ''
)

onMounted(async () => {
  if (props.configId) {
    loading.value = true
    skipDirtyWatch = true
    try {
      const c = await store.fetchOne(props.configId)
      configName.value = c.name
      configData.value = c.data as ConfigData
      await nextTick()
    } finally {
      loading.value = false
      skipDirtyWatch = false
    }
  }
})

watch(
  [configData, configName],
  () => {
    if (skipDirtyWatch) return
    dirty.value = true
  },
  { deep: true }
)

function downloadJson(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function handleBack() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('You have unsaved changes. Discard and go back?', 'Unsaved changes', {
        type: 'warning',
        confirmButtonText: 'Discard',
        cancelButtonText: 'Stay',
      })
    } catch {
      return
    }
  }
  emit('close')
}

async function handleSave() {
  saving.value = true
  try {
    if (localConfigId.value) {
      await store.update(localConfigId.value, configName.value, configData.value)
      ElMessage.success('Saved')
    } else {
      const created = await store.create(configName.value, configData.value)
      localConfigId.value = created.id
      ElMessage.success('Config saved to server')
    }
    dirty.value = false
  } catch (e) {
    const msg = String(e)
    if (msg.includes('503') || msg.includes('Network') || msg.includes('database')) {
      ElMessage.error('Database not configured. Use Export to save your config as a file.')
    } else {
      ElMessage.error('Save failed: ' + msg)
    }
  } finally {
    saving.value = false
  }
}

async function handleGenerate() {
  generating.value = true
  try {
    const result = await store.generate(configData.value)
    downloadJson(result, 'singbox-config.json')
  } catch (e) {
    ElMessage.error('Generate failed: ' + String(e))
  } finally {
    generating.value = false
  }
}

async function handlePreview() {
  generating.value = true
  try {
    const result = await store.generate(configData.value)
    previewJson.value = JSON.stringify(result, null, 2)
    previewVisible.value = true
  } catch (e) {
    ElMessage.error('Generate failed: ' + String(e))
  } finally {
    generating.value = false
  }
}

function handleExportConfigJson() {
  downloadJson(configData.value, 'proxy-subscribe-config.json')
  dirty.value = false
}

function handleImportConfigJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = ConfigDataSchema.parse(JSON.parse(ev.target?.result as string))
        skipDirtyWatch = true
        configData.value = parsed
        nextTick(() => { skipDirtyWatch = false })
        dirty.value = true
        ElMessage.success('Config imported')
      } catch {
        ElMessage.error('Invalid config file')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success('Copied')
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%; padding: 24px; gap: 16px">
    <!-- Header toolbar -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
      <el-button @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        Back
      </el-button>
      <el-input v-model="configName" style="max-width: 320px" placeholder="Config name" />
      <el-button @click="handleImportConfigJson">
        <el-icon><Upload /></el-icon>
        Import
      </el-button>
      <el-button @click="handleExportConfigJson">
        <el-icon><Download /></el-icon>
        Export
      </el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        <el-icon><Check /></el-icon>
        Save
      </el-button>
      <template v-if="localConfigId">
        <el-divider direction="vertical" />
        <el-text type="info" size="small">Saved generate URL:</el-text>
        <el-link :href="store.getGenerateUrl(localConfigId)" target="_blank" type="primary">
          {{ store.getGenerateUrl(localConfigId) }}
        </el-link>
        <el-button size="small" @click="copyToClipboard(store.getGenerateUrl(localConfigId!))">
          <el-icon><CopyDocument /></el-icon>
        </el-button>
      </template>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" v-loading="loading" style="flex: 1; overflow: hidden">
      <el-tab-pane label="Subscriptions" name="subscriptions">
        <SubscriptionsPanel v-model="configData.subscriber.subscriptions" />
      </el-tab-pane>
      <el-tab-pane label="Groups" name="groups">
        <GroupsPanel
          v-model="configData.subscriber.groups"
          :subscription-names="Object.keys(configData.subscriber.subscriptions)"
        />
      </el-tab-pane>
      <el-tab-pane label="Template" name="template">
        <TemplatePanel v-model="configData.config_template" />
      </el-tab-pane>
      <el-tab-pane label="Generate" name="generate">
        <div style="padding: 8px 0; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; max-height: 100%">

          <!-- Case 1: Direct generate & download -->
          <el-card>
            <template #header>
              <el-text tag="b">Generate Sing-box Config</el-text>
            </template>
            <el-text type="info">
              Fetch your subscriptions, apply groups, and download the merged sing-box config.
            </el-text>
            <div style="margin-top: 16px; display: flex; gap: 12px">
              <el-button type="primary" :loading="generating" @click="handlePreview">
                <el-icon><View /></el-icon>
                Preview
              </el-button>
              <el-button type="success" :loading="generating" @click="handleGenerate">
                <el-icon><Download /></el-icon>
                Generate &amp; Download
              </el-button>
            </div>
          </el-card>

          <!-- Case 2: Stateless URL -->
          <el-card>
            <template #header>
              <el-text tag="b">Stateless Generate URL</el-text>
            </template>
            <el-text type="info">
              Host your config on GitHub Gist or S3 to get a permanent shareable generate URL — no account on this server needed.
            </el-text>

            <el-steps :active="configUrl ? 2 : 0" finish-status="success" style="margin: 20px 0">
              <el-step title="Export config JSON" />
              <el-step title="Upload &amp; paste URL" />
              <el-step title="Share generate URL" />
            </el-steps>

            <div style="display: flex; flex-direction: column; gap: 20px">
              <!-- Step 1 -->
              <div>
                <el-text tag="b" size="small">Step 1 — Export your config JSON</el-text>
                <div style="margin-top: 10px; display: flex; align-items: center; gap: 12px">
                  <el-button @click="handleExportConfigJson">
                    <el-icon><Download /></el-icon>
                    Export Config JSON
                  </el-button>
                  <el-text type="info" size="small">
                    Upload this file to a GitHub Gist or S3 bucket and copy the raw URL.
                  </el-text>
                </div>
              </div>

              <el-divider style="margin: 0" />

              <!-- Step 2 -->
              <div>
                <el-text tag="b" size="small">Step 2 — Paste the raw URL of your uploaded config</el-text>
                <el-input
                  v-model="configUrl"
                  style="margin-top: 10px"
                  placeholder="https://gist.githubusercontent.com/user/abc123/raw/config.json"
                  clearable
                />
              </div>

              <el-divider style="margin: 0" />

              <!-- Step 3 -->
              <div>
                <el-text tag="b" size="small">Step 3 — Your generate URL</el-text>
                <el-input
                  :model-value="statelessGenerateUrl"
                  style="margin-top: 10px"
                  readonly
                  placeholder="Paste your config URL above to build this link"
                >
                  <template #append>
                    <el-button
                      :disabled="!statelessGenerateUrl"
                      @click="copyToClipboard(statelessGenerateUrl)"
                    >
                      <el-icon><CopyDocument /></el-icon>
                    </el-button>
                  </template>
                </el-input>
                <el-text v-if="statelessGenerateUrl" type="success" size="small" style="margin-top: 6px; display: block">
                  Use this URL as a remote profile in sing-box.
                </el-text>
              </div>
            </div>
          </el-card>

        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Preview dialog -->
    <el-dialog
      v-model="previewVisible"
      title="Generated Sing-box Config"
      width="80%"
      top="5vh"
      destroy-on-close
    >
      <MonacoEditor
        :model-value="previewJson"
        language="json"
        :readonly="true"
        height="70vh"
        style="border: 1px solid #dcdfe6; border-radius: 4px"
      />
    </el-dialog>
  </div>
</template>
