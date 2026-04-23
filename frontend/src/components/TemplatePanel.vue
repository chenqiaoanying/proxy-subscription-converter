<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import YAML from 'yaml'
import MonacoEditor from './MonacoEditor.vue'
import * as monaco from 'monaco-editor'
import singboxSchema from '@/schemas/sing-box.schema.json'
import {
  TARGET_FORMATS,
  type ConfigTemplateMap,
  type TargetFormat,
  type TemplateSource,
} from '@/types'

const { t } = useI18n()

const model = defineModel<ConfigTemplateMap>({ required: true })

type TemplateMode = 'none' | 'url' | 'object' | 'inline'

interface FormatState {
  mode: TemplateMode
  url: string
  // Shared buffer between 'object' and 'inline' modes. On commit, 'object'
  // parses it into a dict; 'inline' stores it verbatim.
  body: string
  bodyError: string
}

function stringify(obj: Record<string, unknown>, fmt: TargetFormat): string {
  return fmt === 'clash' ? YAML.stringify(obj) : JSON.stringify(obj, null, 2)
}

function parseObjectText(text: string, fmt: TargetFormat): Record<string, unknown> {
  if (fmt === 'clash') {
    const parsed = YAML.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('YAML must be a mapping')
    }
    return parsed as Record<string, unknown>
  }
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be an object')
  }
  return parsed as Record<string, unknown>
}

function stateFromValue(
  v: TemplateSource | null | undefined,
  fmt: TargetFormat,
): FormatState {
  let body = ''
  if (v && v.type === 'object') body = stringify(v.value, fmt)
  else if (v && v.type === 'inline') body = v.value
  return {
    mode: v ? v.type : 'none',
    url: v && v.type === 'url' ? v.value : '',
    body,
    bodyError: '',
  }
}

// UI state: seeded from the model, then kept in sync both ways — written by
// event handlers (UI → model) and by the model→UI watcher below.
const states = reactive<Record<TargetFormat, FormatState>>({
  'sing-box': stateFromValue(model.value['sing-box'], 'sing-box'),
  'clash': stateFromValue(model.value['clash'], 'clash'),
})

const activeFormat = ref<TargetFormat>(
  (Object.keys(model.value)[0] as TargetFormat | undefined) ?? 'sing-box',
)

const state = computed<FormatState>(() => states[activeFormat.value])
const editorLanguage = computed(() => (activeFormat.value === 'clash' ? 'yaml' : 'json'))

function commitFromState(): void {
  let { mode, url, body } = state.value
  let configTemplate: TemplateSource | null = null
  switch (mode) {
    case 'none':
      break
    case 'url':
      configTemplate = url ? { type: 'url', value: url } : null
      break
    case 'inline':
      configTemplate = body ? { type: 'inline', value: body } : null
      break
    case 'object':
      if (body.trim()) {
        try {
          const parsed = parseObjectText(body, activeFormat.value)
          state.value.bodyError = ''
          configTemplate = { type: 'object', value: parsed }
        } catch (e) {
          const lang = activeFormat.value === 'clash' ? 'YAML' : 'JSON'
          state.value.bodyError = `Invalid ${lang}: ${(e as Error).message}`
          return
        }
      }
      break
  }
  model.value[activeFormat.value] = configTemplate
}

// Model → UI sync: reconcile `states[fmt]` when the parent mutates the model
// externally. Guarded by equality checks so handler-originated writes don't
// loop back as redundant state updates.
watch(model, () => {
  for (const fmt of TARGET_FORMATS) {
    const v = model.value[fmt]
    const s = states[fmt]
    if (!v) {
      if (s.mode !== 'none') { s.mode = 'none'; s.bodyError = '' }
      continue
    }
    if (v.type === 'url') {
      if (s.mode !== 'url' || s.url !== v.value) {
        s.mode = 'url'
        s.url = v.value
        s.bodyError = ''
      }
    } else if (v.type === 'inline') {
      if (s.mode !== 'inline' || s.body !== v.value) {
        s.mode = 'inline'
        s.body = v.value
        s.bodyError = ''
      }
    } else {
      // object: compare parsed equality so user's in-progress whitespace stays.
      let currentParsed: Record<string, unknown> | null = null
      try {
        currentParsed = s.body.trim() ? parseObjectText(s.body, fmt) : null
      } catch {
        currentParsed = null
      }
      const same =
        s.mode === 'object' &&
        currentParsed !== null &&
        JSON.stringify(currentParsed) === JSON.stringify(v.value)
      if (!same) {
        s.mode = 'object'
        s.body = stringify(v.value, fmt)
        s.bodyError = ''
      }
    }
  }
}, { deep: true })

function onEditorMount(): void {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [
      {
        uri: 'https://gist.githubusercontent.com/artiga033/fea992d95ad44dc8d024b229223b1002/raw/83c676c1ec9f37af2bce0505da396b5444b30032/sing-box.schema.json',
        fileMatch: ['*'],
        schema: singboxSchema,
      },
    ],
  })
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px; height: 100%">
    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
      <el-radio-group v-model="activeFormat">
        <el-radio-button v-for="fmt in TARGET_FORMATS" :key="fmt" :value="fmt">
          {{ fmt }}
        </el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="state.mode" @update:model-value="commitFromState">
        <el-radio-button value="none">{{ t('template.modeNone') }}</el-radio-button>
        <el-radio-button value="url">{{ t('template.modeUrl') }}</el-radio-button>
        <el-radio-button value="object">{{ t('template.modeObject') }}</el-radio-button>
        <el-radio-button value="inline">{{ t('template.modeInline') }}</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="state.mode === 'none'">
      <el-text type="info" size="small">
        {{ t('template.emptyHint', { format: activeFormat }) }}
      </el-text>
    </template>

    <template v-else-if="state.mode === 'url'">
      <el-input v-model="state.url" @update:model-value="commitFromState" :placeholder="activeFormat === 'clash'
        ? t('template.urlPlaceholderClash')
        : t('template.urlPlaceholderSingbox')" />
      <el-text type="info" size="small">
        {{ t('template.urlHint', { format: activeFormat }) }}
      </el-text>
    </template>

    <template v-else-if="state.mode === 'object' || state.mode === 'inline'">
      <el-alert v-if="state.bodyError" :title="state.bodyError" type="error" :closable="false" />
      <el-text type="info" size="small">
        <template v-if="state.mode === 'object'">
          {{ t('template.objectHint', { lang: editorLanguage.toUpperCase() }) }}
        </template>
        <template v-else>
          {{ t('template.inlineHint') }}
        </template>
      </el-text>
      <MonacoEditor v-model="state.body" @update:model-value="commitFromState" :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        @mount="onEditorMount" />
    </template>
  </div>
</template>
