<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import YAML from 'yaml'
import MonacoEditor from './MonacoEditor.vue'
import * as monaco from 'monaco-editor'
import singboxSchema from '@/schemas/sing-box.schema.json'
import {
  TARGET_FORMATS,
  type ConfigTemplateMap,
  type ConfigTemplateValue,
  type TargetFormat,
} from '@/types'

const model = defineModel<ConfigTemplateMap>({ required: true })

type TemplateMode = 'url' | 'inline'

const activeFormat = ref<TargetFormat>(
  (Object.keys(model.value)[0] as TargetFormat | undefined) ?? 'sing-box',
)

const current = computed<ConfigTemplateValue | undefined>(
  () => model.value[activeFormat.value],
)

const editorLanguage = computed(() => (activeFormat.value === 'clash' ? 'yaml' : 'json'))

const mode = ref<TemplateMode>(typeof current.value === 'string' ? 'url' : 'inline')
const urlValue = ref(typeof current.value === 'string' ? current.value : '')
const inlineValue = ref(serialiseInline(current.value, activeFormat.value))
const inlineError = ref('')

function serialiseInline(v: ConfigTemplateValue | undefined, fmt: TargetFormat): string {
  if (v && typeof v === 'object') {
    return fmt === 'clash' ? YAML.stringify(v) : JSON.stringify(v, null, 2)
  }
  return fmt === 'clash' ? '' : '{}'
}

function parseInline(text: string, fmt: TargetFormat): Record<string, unknown> {
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

function setTemplate(fmt: TargetFormat, value: ConfigTemplateValue | undefined): void {
  const next: ConfigTemplateMap = { ...model.value }
  if (value === undefined || (typeof value === 'string' && value === '')) {
    delete next[fmt]
  } else {
    next[fmt] = value
  }
  model.value = next
}

watch(activeFormat, (fmt) => {
  const v = model.value[fmt]
  mode.value = typeof v === 'string' ? 'url' : 'inline'
  urlValue.value = typeof v === 'string' ? v : ''
  inlineValue.value = serialiseInline(v, fmt)
  inlineError.value = ''
})

function onEditorMount() {
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

function onModeChange(m: TemplateMode) {
  mode.value = m
  if (m === 'url') {
    setTemplate(activeFormat.value, urlValue.value || null)
  } else {
    try {
      setTemplate(activeFormat.value, parseInline(inlineValue.value, activeFormat.value))
      inlineError.value = ''
    } catch {
      setTemplate(activeFormat.value, null)
    }
  }
}

function onUrlInput(v: string) {
  urlValue.value = v
  setTemplate(activeFormat.value, v || null)
}

function onInlineChange(v: string) {
  inlineValue.value = v
  try {
    setTemplate(activeFormat.value, parseInline(v, activeFormat.value))
    inlineError.value = ''
  } catch (e) {
    inlineError.value = `Invalid ${editorLanguage.value.toUpperCase()}: ${(e as Error).message}`
  }
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
      <el-radio-group :model-value="mode" @change="onModeChange">
        <el-radio-button value="url">URL</el-radio-button>
        <el-radio-button value="inline">Inline {{ editorLanguage.toUpperCase() }}</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="mode === 'url'">
      <el-input
        :model-value="urlValue"
        :placeholder="activeFormat === 'clash'
          ? 'https://example.com/clash-template.yaml'
          : 'https://example.com/sing-box-template.json'"
        @input="onUrlInput"
      />
      <el-text type="info" size="small">
        The {{ activeFormat }} template will be fetched from this URL each time the
        generate endpoint is called with <code>?format={{ activeFormat }}</code>.
      </el-text>
    </template>

    <template v-else>
      <el-alert v-if="inlineError" :title="inlineError" type="error" :closable="false" />
      <MonacoEditor
        :model-value="inlineValue"
        :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        @update:model-value="onInlineChange"
        @mount="onEditorMount"
      />
    </template>
  </div>
</template>
