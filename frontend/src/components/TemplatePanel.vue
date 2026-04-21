<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
    mode: v ? v.type : 'url',
    url: v && v.type === 'url' ? v.value : '',
    body,
    bodyError: '',
  }
}

// SKIP means "don't overwrite the previous committed value" — used while the
// user is mid-edit in object mode and the text doesn't parse yet.
const SKIP = Symbol('skip')

function templateSourceFromState(
  s: FormatState,
  fmt: TargetFormat,
): TemplateSource | null | typeof SKIP {
  if (s.mode === 'url') {
    return s.url ? { type: 'url', value: s.url } : null
  }
  if (s.mode === 'inline') {
    return s.body ? { type: 'inline', value: s.body } : null
  }
  // mode === 'object'
  if (!s.body.trim()) {
    s.bodyError = ''
    return null
  }
  try {
    const parsed = parseObjectText(s.body, fmt)
    s.bodyError = ''
    return { type: 'object', value: parsed }
  } catch (e) {
    const lang = fmt === 'clash' ? 'YAML' : 'JSON'
    s.bodyError = `Invalid ${lang}: ${(e as Error).message}`
    return SKIP
  }
}

// Single source of truth: seeded once from the initial model value, then the
// master copy for the rest of the component's lifetime. The model is derived
// from `states` via the watcher below.
const states = reactive<Record<TargetFormat, FormatState>>({
  'sing-box': stateFromValue(model.value['sing-box'], 'sing-box'),
  'clash': stateFromValue(model.value['clash'], 'clash'),
})

const activeFormat = ref<TargetFormat>(
  (Object.keys(model.value)[0] as TargetFormat | undefined) ?? 'sing-box',
)

const state = computed<FormatState>(() => states[activeFormat.value])
const editorLanguage = computed(() => (activeFormat.value === 'clash' ? 'yaml' : 'json'))

watch(states, () => {
  const next: ConfigTemplateMap = {}
  for (const fmt of TARGET_FORMATS) {
    const value = templateSourceFromState(states[fmt], fmt)
    if (value === SKIP) {
      const prev = model.value[fmt]
      if (prev !== undefined) next[fmt] = prev
    } else if (value !== null) {
      next[fmt] = value
    }
  }
  model.value = next
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
      <el-radio-group v-model="state.mode">
        <el-radio-button value="url">URL</el-radio-button>
        <el-radio-button value="object">Inline object</el-radio-button>
        <el-radio-button value="inline">Inline text</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="state.mode === 'url'">
      <el-input v-model="state.url" :placeholder="activeFormat === 'clash'
        ? 'https://example.com/clash-template.yaml'
        : 'https://example.com/sing-box-template.json'" />
      <el-text type="info" size="small">
        The {{ activeFormat }} template will be fetched from this URL each time the
        generate endpoint is called with <code>?format={{ activeFormat }}</code>.
      </el-text>
    </template>

    <template v-else>
      <el-alert v-if="state.bodyError" :title="state.bodyError" type="error" :closable="false" />
      <el-text type="info" size="small">
        <template v-if="state.mode === 'object'">
          Parsed as a {{ editorLanguage.toUpperCase() }} object and stored as structured data
          (normalised on save — comments and key ordering are not preserved).
        </template>
        <template v-else>
          Stored verbatim as raw text — preserves comments and formatting. The backend parses
          the text with YAML (which also accepts JSON). Use this for templates in any format
          where byte-for-byte fidelity matters.
        </template>
      </el-text>
      <MonacoEditor v-model="state.body" :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        @mount="onEditorMount" />
    </template>
  </div>
</template>
