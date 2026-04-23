<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import YAML from 'yaml'
import { useConfigStore } from '@/stores/configs'
import {
  TARGET_FORMATS,
  type ConfigData,
  type TargetFormat,
  ConfigDataSchema,
  emptyConfigData,
} from '@/types'
import SubscriptionsPanel from '@/components/SubscriptionsPanel.vue'
import GroupsPanel from '@/components/GroupsPanel.vue'
import TemplatePanel from '@/components/TemplatePanel.vue'
import MonacoEditor from '@/components/MonacoEditor.vue'

const props = defineProps<{ configId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useConfigStore()
const localConfigId = ref<string | null>(props.configId)
const configName = ref(t('editor.defaultName'))
const configData = ref<ConfigData>(emptyConfigData())
const activeTab = ref('subscriptions')
const saving = ref(false)
const loading = ref(false)
const generating = ref(false)
const configUrl = ref('')
const previewVisible = ref(false)
const previewBody = ref('')
const previewLanguage = ref<'json' | 'yaml'>('json')
const previewDropped = ref(0)
const targetFormat = ref<TargetFormat>('sing-box')
const dirty = ref(false)

const availableFormats = computed(() =>
  TARGET_FORMATS.filter(fmt => configData.value.config_template[fmt] != null)
)

watch(availableFormats, (formats) => {
  if (formats.length > 0 && !formats.includes(targetFormat.value)) {
    targetFormat.value = formats[0]
  }
}, { immediate: true })
let skipDirtyWatch = false

const statelessGenerateUrls = computed(() =>
  configUrl.value
    ? Object.fromEntries(
        availableFormats.value.map(fmt => [fmt, store.getStatelessGenerateUrl(configUrl.value, fmt)])
      ) as Partial<Record<TargetFormat, string>>
    : {}
)

const statefulGenerateUrls = computed(() =>
  localConfigId.value
    ? Object.fromEntries(
        availableFormats.value.map(fmt => [fmt, store.getGenerateUrl(localConfigId.value!, fmt)])
      ) as Partial<Record<TargetFormat, string>>
    : {}
)

const generateFileName = computed(() =>
  targetFormat.value === 'clash' ? 'clash-config.yaml' : 'singbox-config.json',
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

function downloadText(text: string, filename: string, mediaType: string) {
  const blob = new Blob([text], { type: mediaType || 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function notifyDropped(n: number) {
  if (n > 0) {
    ElMessage.warning(t('editor.messages.dropped', { n }))
  }
}

async function handleBack() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(t('editor.unsaved.message'), t('editor.unsaved.title'), {
        type: 'warning',
        confirmButtonText: t('editor.unsaved.discard'),
        cancelButtonText: t('editor.unsaved.stay'),
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
      ElMessage.success(t('editor.messages.saved'))
    } else {
      const created = await store.create(configName.value, configData.value)
      localConfigId.value = created.id
      ElMessage.success(t('editor.messages.createdOnServer'))
    }
    dirty.value = false
  } catch (e) {
    const msg = String(e)
    if (msg.includes('503') || msg.includes('Network') || msg.includes('database')) {
      ElMessage.error(t('editor.messages.dbNotConfigured'))
    } else {
      ElMessage.error(t('editor.messages.saveFailed', { reason: msg }))
    }
  } finally {
    saving.value = false
  }
}

async function handleGenerate() {
  generating.value = true
  try {
    const result = await store.generate(configData.value, targetFormat.value)
    downloadText(result.body, generateFileName.value, result.mediaType)
    notifyDropped(result.dropped)
  } catch (e) {
    ElMessage.error(t('editor.messages.generateFailed', { reason: String(e) }))
  } finally {
    generating.value = false
  }
}

async function handlePreview() {
  generating.value = true
  try {
    const result = await store.generate(configData.value, targetFormat.value)
    previewLanguage.value = targetFormat.value === 'clash' ? 'yaml' : 'json'
    if (previewLanguage.value === 'json') {
      try {
        previewBody.value = JSON.stringify(JSON.parse(result.body), null, 2)
      } catch {
        previewBody.value = result.body
      }
    } else {
      previewBody.value = result.body
    }
    previewDropped.value = result.dropped
    previewVisible.value = true
  } catch (e) {
    ElMessage.error(t('editor.messages.generateFailed', { reason: String(e) }))
  } finally {
    generating.value = false
  }
}

function handleExportConfig() {
  downloadText(
    YAML.stringify(configData.value),
    'proxy-subscription-config.yaml',
    'application/yaml',
  )
  dirty.value = false
}

function handleImportConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.yaml,.yml,application/json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const raw = YAML.parse(text)
        const parsed = ConfigDataSchema.parse(raw)
        skipDirtyWatch = true
        configData.value = parsed
        nextTick(() => { skipDirtyWatch = false })
        dirty.value = true
        ElMessage.success(t('editor.messages.imported'))
      } catch {
        ElMessage.error(t('editor.messages.invalidFile'))
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  ElMessage.success(t('editor.messages.copied'))
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%; padding: 24px; gap: 16px">
    <!-- Header toolbar -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
      <el-button @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        {{ t('editor.back') }}
      </el-button>
      <el-input v-model="configName" style="max-width: 320px" :placeholder="t('editor.namePlaceholder')" />
      <el-button @click="handleImportConfig">
        <el-icon><Upload /></el-icon>
        {{ t('editor.import') }}
      </el-button>
      <el-button @click="handleExportConfig">
        <el-icon><Download /></el-icon>
        {{ t('editor.export') }}
      </el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        <el-icon><Check /></el-icon>
        {{ t('editor.save') }}
      </el-button>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" v-loading="loading" style="flex: 1; overflow: hidden">
      <el-tab-pane :label="t('editor.tabs.subscriptions')" name="subscriptions">
        <SubscriptionsPanel v-model="configData.subscriber.subscriptions" />
      </el-tab-pane>
      <el-tab-pane :label="t('editor.tabs.groups')" name="groups">
        <GroupsPanel
          v-model="configData.subscriber.groups"
          :subscription-names="Object.keys(configData.subscriber.subscriptions)"
        />
      </el-tab-pane>
      <el-tab-pane :label="t('editor.tabs.template')" name="template">
        <!-- Skip render until the async fetchOne has populated configData,
             so TemplatePanel seeds its local states from real data. -->
        <TemplatePanel v-if="!loading" v-model="configData.config_template" />
      </el-tab-pane>
      <el-tab-pane :label="t('editor.tabs.generate')" name="generate">
        <div style="padding: 8px 0 24px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; max-height: 100%">

          <!-- No templates warning -->
          <el-alert
            v-if="availableFormats.length === 0"
            :title="t('editor.generate.noTemplatesTitle')"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              <el-link type="warning" @click="activeTab = 'template'" style="vertical-align: baseline">{{ t('editor.generate.goToTemplateTab') }}</el-link>
              {{ t('editor.generate.goToTemplateHint') }}
            </template>
          </el-alert>

          <!-- Case 1: Direct generate & download -->
          <el-card shadow="never" style="border-radius: 8px">
            <template #header>
              <div style="display: flex; align-items: center; gap: 8px">
                <el-icon style="color: var(--el-color-primary)"><Download /></el-icon>
                <span style="font-weight: 600">{{ t('editor.generate.downloadHeader') }}</span>
              </div>
            </template>

            <div v-if="availableFormats.length === 0" style="color: var(--el-text-color-secondary); font-size: 13px">
              {{ t('editor.generate.downloadEmpty') }}
            </div>
            <template v-else>
              <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center">
                <div
                  v-for="fmt in availableFormats"
                  :key="fmt"
                  style="
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 16px;
                    border-radius: 8px;
                    border: 1px solid var(--el-border-color);
                    flex: 1; min-width: 200px;
                    background: var(--el-fill-color-lighter);
                  "
                >
                  <el-tag :type="fmt === 'clash' ? 'success' : 'primary'" effect="dark" size="small" style="flex-shrink: 0">
                    {{ fmt }}
                  </el-tag>
                  <span style="flex: 1" />
                  <el-button
                    size="small"
                    :loading="generating && targetFormat === fmt"
                    @click="targetFormat = fmt; handlePreview()"
                  >
                    <el-icon><View /></el-icon>
                    {{ t('editor.generate.preview') }}
                  </el-button>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="generating && targetFormat === fmt"
                    @click="targetFormat = fmt; handleGenerate()"
                  >
                    <el-icon><Download /></el-icon>
                    {{ t('editor.generate.download') }}
                  </el-button>
                </div>
              </div>
            </template>
          </el-card>

          <!-- Case 2: Stateful URL (saved config) -->
          <el-card shadow="never" style="border-radius: 8px">
            <template #header>
              <div style="display: flex; align-items: center; gap: 8px">
                <el-icon style="color: var(--el-color-warning)"><DataBoard /></el-icon>
                <span style="font-weight: 600">{{ t('editor.generate.statefulHeader') }}</span>
              </div>
            </template>

            <el-text type="info" size="small">
              {{ t('editor.generate.statefulIntro') }}
            </el-text>

            <div style="margin-top: 16px">
              <template v-if="!localConfigId">
                <el-alert type="warning" :closable="false" show-icon style="border-radius: 6px">
                  <template #default>
                    {{ t('editor.generate.notSavedYet') }}
                    <el-link type="warning" @click="handleSave" style="vertical-align: baseline; margin-left: 2px">{{ t('editor.generate.saveNow') }}</el-link>
                    {{ t('editor.generate.savePermanent') }}
                  </template>
                </el-alert>
              </template>
              <template v-else>
                <el-alert v-if="dirty" type="info" :closable="false" show-icon style="border-radius: 6px; margin-bottom: 12px">
                  <template #default>
                    {{ t('editor.generate.dirtyNote') }}
                    <el-link type="primary" @click="handleSave" style="vertical-align: baseline; margin-left: 2px">{{ t('editor.generate.saveNow') }}</el-link>
                    {{ t('editor.generate.saveToUpdate') }}
                  </template>
                </el-alert>
                <el-text v-if="availableFormats.length === 0" type="info" size="small">
                  {{ t('editor.generate.noTemplatesHint') }}
                </el-text>
                <div v-else style="display: flex; flex-direction: column; gap: 10px">
                  <div
                    v-for="fmt in availableFormats"
                    :key="fmt"
                    style="padding: 12px 14px; border-radius: 8px; border: 1px solid var(--el-border-color-light); background: var(--el-fill-color-lighter)"
                  >
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
                      <el-tag :type="fmt === 'clash' ? 'success' : 'primary'" effect="dark" size="small">{{ fmt }}</el-tag>
                      <el-text type="info" size="small">{{ fmt === 'clash' ? t('editor.generate.useAsProfileClash') : t('editor.generate.useAsProfileSingbox') }}</el-text>
                    </div>
                    <el-input :model-value="statefulGenerateUrls[fmt] ?? ''" readonly size="small">
                      <template #append>
                        <el-button @click="copyToClipboard(statefulGenerateUrls[fmt]!)">
                          <el-icon><CopyDocument /></el-icon>
                        </el-button>
                      </template>
                    </el-input>
                  </div>
                </div>
              </template>
            </div>
          </el-card>

          <!-- Case 3: Stateless URL -->
          <el-card shadow="never" style="border-radius: 8px">
            <template #header>
              <div style="display: flex; align-items: center; gap: 8px">
                <el-icon style="color: var(--el-color-success)"><Link /></el-icon>
                <span style="font-weight: 600">{{ t('editor.generate.statelessHeader') }}</span>
              </div>
            </template>

            <el-text type="info" size="small">
              {{ t('editor.generate.statelessIntro') }}
            </el-text>

            <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px">
              <!-- Step 1 -->
              <div style="display: flex; gap: 16px; align-items: flex-start">
                <div style="
                  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
                  background: var(--el-color-primary); color: #fff;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 13px; font-weight: 600; margin-top: 2px;
                ">1</div>
                <div style="flex: 1">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px">{{ t('editor.generate.stepExport') }}</div>
                  <div style="display: flex; align-items: center; gap: 12px">
                    <el-button size="small" @click="handleExportConfig">
                      <el-icon><Download /></el-icon>
                      {{ t('editor.generate.stepExportButton') }}
                    </el-button>
                    <el-text type="info" size="small">{{ t('editor.generate.stepExportHint') }}</el-text>
                  </div>
                </div>
              </div>

              <el-divider style="margin: 0" />

              <!-- Step 2 -->
              <div style="display: flex; gap: 16px; align-items: flex-start">
                <div style="
                  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
                  background: var(--el-color-primary); color: #fff;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 13px; font-weight: 600; margin-top: 2px;
                ">2</div>
                <div style="flex: 1">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px">{{ t('editor.generate.stepPaste') }}</div>
                  <el-input
                    v-model="configUrl"
                    :placeholder="t('editor.generate.stepPastePlaceholder')"
                    clearable
                    :prefix-icon="Link"
                  />
                </div>
              </div>

              <el-divider style="margin: 0" />

              <!-- Step 3 -->
              <div style="display: flex; gap: 16px; align-items: flex-start">
                <div style="
                  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
                  background: var(--el-color-primary); color: #fff;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 13px; font-weight: 600; margin-top: 2px;
                ">3</div>
                <div style="flex: 1">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px">{{ t('editor.generate.stepShare') }}</div>

                  <el-text v-if="availableFormats.length === 0" type="info" size="small">
                    {{ t('editor.generate.noTemplatesHint') }}
                  </el-text>
                  <div v-else style="display: flex; flex-direction: column; gap: 10px">
                    <div
                      v-for="fmt in availableFormats"
                      :key="fmt"
                      style="
                        padding: 12px 14px;
                        border-radius: 8px;
                        border: 1px solid var(--el-border-color-light);
                        background: var(--el-fill-color-lighter);
                      "
                    >
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
                        <el-tag :type="fmt === 'clash' ? 'success' : 'primary'" effect="dark" size="small">{{ fmt }}</el-tag>
                        <el-text type="info" size="small">
                          {{ fmt === 'clash' ? t('editor.generate.useAsProfileClash') : t('editor.generate.useAsProfileSingbox') }}
                        </el-text>
                      </div>
                      <el-input
                        :model-value="statelessGenerateUrls[fmt] ?? ''"
                        readonly
                        :placeholder="configUrl ? t('editor.generate.urlBuilding') : t('editor.generate.urlPlaceholder')"
                        size="small"
                      >
                        <template #append>
                          <el-button
                            :disabled="!statelessGenerateUrls[fmt]"
                            @click="copyToClipboard(statelessGenerateUrls[fmt]!)"
                          >
                            <el-icon><CopyDocument /></el-icon>
                          </el-button>
                        </template>
                      </el-input>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>

        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Preview dialog -->
    <el-dialog
      v-model="previewVisible"
      :title="t('editor.preview.title', { format: targetFormat })"
      width="80%"
      top="5vh"
      destroy-on-close
    >
      <el-alert
        v-if="previewDropped > 0"
        :title="t('editor.preview.dropped', { n: previewDropped, format: targetFormat })"
        type="warning"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <MonacoEditor
        :model-value="previewBody"
        :language="previewLanguage"
        :readonly="true"
        height="70vh"
        style="border: 1px solid #dcdfe6; border-radius: 4px"
      />
    </el-dialog>
  </div>
</template>
