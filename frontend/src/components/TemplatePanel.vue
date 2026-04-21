<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const model = defineModel<ConfigTemplateMap>({ required: true })

type TemplateMode = 'url' | 'object' | 'inline'

const activeFormat = ref<TargetFormat>(
  (Object.keys(model.value)[0] as TargetFormat | undefined) ?? 'sing-box',
)

const current = computed<TemplateSource | null | undefined>(
  () => model.value[activeFormat.value],
)

const editorLanguage = computed(() => (activeFormat.value === 'clash' ? 'yaml' : 'json'))

function initialMode(v: TemplateSource | null | undefined): TemplateMode {
  if (v && typeof v === 'object' && 'type' in v) return v.type
  return 'url'
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

const mode = ref<TemplateMode>(initialMode(current.value))

const urlBuffer = ref(
  current.value && current.value.type === 'url' ? current.value.value : '',
)
const objectBuffer = ref(
  current.value && current.value.type === 'object'
    ? stringify(current.value.value, activeFormat.value)
    : activeFormat.value === 'clash' ? '' : '{}',
)
const inlineBuffer = ref(
  current.value && current.value.type === 'inline' ? current.value.value : '',
)
const objectError = ref('')

let syncing = false

function applyExternalValue(
  v: TemplateSource | null | undefined,
  fmt: TargetFormat,
): void {
  syncing = true
  try {
    mode.value = initialMode(v)
    urlBuffer.value = v && v.type === 'url' ? v.value : ''
    objectBuffer.value = v && v.type === 'object'
      ? stringify(v.value, fmt)
      : fmt === 'clash' ? '' : '{}'
    inlineBuffer.value = v && v.type === 'inline' ? v.value : ''
    objectError.value = ''
  } finally {
    syncing = false
  }
}

function setTemplate(fmt: TargetFormat, value: TemplateSource | null): void {
  syncing = true
  try {
    const next: ConfigTemplateMap = { ...model.value }
    if (
      value === null
      || (value.type === 'url' && value.value === '')
      || (value.type === 'inline' && value.value === '')
    ) {
      delete next[fmt]
    } else {
      next[fmt] = value
    }
    model.value = next
  } finally {
    syncing = false
  }
}

watch(activeFormat, (fmt) => {
  applyExternalValue(model.value[fmt], fmt)
})

watch(current, (v) => {
  if (syncing) return
  applyExternalValue(v, activeFormat.value)
})

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

function commitCurrentMode(): void {
  const fmt = activeFormat.value
  if (mode.value === 'url') {
    setTemplate(fmt, urlBuffer.value ? { type: 'url', value: urlBuffer.value } : null)
  } else if (mode.value === 'inline') {
    setTemplate(fmt, inlineBuffer.value ? { type: 'inline', value: inlineBuffer.value } : null)
  } else {
    try {
      const parsed = parseObjectText(objectBuffer.value, fmt)
      setTemplate(fmt, { type: 'object', value: parsed })
      objectError.value = ''
    } catch (e) {
      objectError.value = `Invalid ${editorLanguage.value.toUpperCase()}: ${(e as Error).message}`
    }
  }
}

function onModeChange(m: TemplateMode): void {
  mode.value = m
  commitCurrentMode()
}

function onUrlInput(v: string): void {
  urlBuffer.value = v
  setTemplate(activeFormat.value, v ? { type: 'url', value: v } : null)
}

function onObjectChange(v: string): void {
  objectBuffer.value = v
  try {
    const parsed = parseObjectText(v, activeFormat.value)
    setTemplate(activeFormat.value, { type: 'object', value: parsed })
    objectError.value = ''
  } catch (e) {
    objectError.value = `Invalid ${editorLanguage.value.toUpperCase()}: ${(e as Error).message}`
  }
}

function onInlineChange(v: string): void {
  inlineBuffer.value = v
  setTemplate(activeFormat.value, v ? { type: 'inline', value: v } : null)
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
        <el-radio-button value="object">Inline object</el-radio-button>
        <el-radio-button value="inline">Inline text</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="mode === 'url'">
      <el-input
        :model-value="urlBuffer"
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

    <template v-else-if="mode === 'object'">
      <el-alert v-if="objectError" :title="objectError" type="error" :closable="false" />
      <el-text type="info" size="small">
        Parsed as a {{ editorLanguage.toUpperCase() }} object and stored as structured data
        (normalised on save — comments and key ordering are not preserved).
      </el-text>
      <MonacoEditor
        :model-value="objectBuffer"
        :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        @update:model-value="onObjectChange"
        @mount="onEditorMount"
      />
    </template>

    <template v-else>
      <el-text type="info" size="small">
        Stored verbatim as raw text — preserves comments and formatting. The backend parses
        the text with YAML (which also accepts JSON). Use this for templates in any format
        where byte-for-byte fidelity matters.
      </el-text>
      <MonacoEditor
        :model-value="inlineBuffer"
        :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        @update:model-value="onInlineChange"
        @mount="onEditorMount"
      />
    </template>
  </div>
</template>
