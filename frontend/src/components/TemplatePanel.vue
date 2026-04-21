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
  urlBuffer: string
  // Shared body buffer between 'object' and 'inline' modes. The only
  // difference between those modes is what commitActive does with this
  // text: 'object' parses it into a dict before saving; 'inline' stores
  // it verbatim.
  bodyBuffer: string
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
  let bodyBuffer = ''
  if (v && v.type === 'object') bodyBuffer = stringify(v.value, fmt)
  else if (v && v.type === 'inline') bodyBuffer = v.value
  return {
    mode: v ? v.type : 'url',
    urlBuffer: v && v.type === 'url' ? v.value : '',
    bodyBuffer,
    bodyError: '',
  }
}

// Per-format local state. Three buffers + current mode are kept
// independent per format so switching `activeFormat` or mode never
// loses drafts. Only the ACTIVE MODE's buffer is committed to the
// model.
const states = reactive(new Map<TargetFormat, FormatState>())

function ensureState(fmt: TargetFormat): FormatState {
  let s = states.get(fmt)
  if (!s) {
    s = stateFromValue(model.value[fmt], fmt)
    states.set(fmt, s)
  }
  return s
}

// Seed from whatever's in the model at construction time.
for (const fmt of TARGET_FORMATS) ensureState(fmt)

const activeFormat = ref<TargetFormat>(
  (Object.keys(model.value)[0] as TargetFormat | undefined) ?? 'sing-box',
)

const state = computed<FormatState>(() => ensureState(activeFormat.value))
const editorLanguage = computed(() => (activeFormat.value === 'clash' ? 'yaml' : 'json'))

// When an external model change arrives for a format whose local state
// is still in-sync with the previous model value (i.e. no unsaved user
// edits we'd clobber), re-seed that format's state. This covers the
// async config-by-id load in ConfigEditorPage.
const lastCommitted = new Map<TargetFormat, TemplateSource | null | undefined>()
for (const fmt of TARGET_FORMATS) lastCommitted.set(fmt, model.value[fmt])

watch(model, (m) => {
  for (const fmt of TARGET_FORMATS) {
    const incoming = m[fmt]
    const prev = lastCommitted.get(fmt)
    if (incoming !== prev) {
      states.set(fmt, stateFromValue(incoming, fmt))
      lastCommitted.set(fmt, incoming)
    }
  }
}, { deep: true })

function writeModel(fmt: TargetFormat, value: TemplateSource | null): void {
  const next: ConfigTemplateMap = { ...model.value }
  if (value === null) {
    delete next[fmt]
  } else {
    next[fmt] = value
  }
  lastCommitted.set(fmt, next[fmt])
  model.value = next
}

function commitActive(): void {
  const fmt = activeFormat.value
  const s = state.value
  if (s.mode === 'url') {
    writeModel(fmt, s.urlBuffer ? { type: 'url', value: s.urlBuffer } : null)
    s.bodyError = ''
    return
  }
  if (s.mode === 'inline') {
    writeModel(fmt, s.bodyBuffer ? { type: 'inline', value: s.bodyBuffer } : null)
    s.bodyError = ''
    return
  }
  // mode === 'object': parse the shared body buffer into a dict before saving.
  if (!s.bodyBuffer.trim()) {
    writeModel(fmt, null)
    s.bodyError = ''
    return
  }
  try {
    const parsed = parseObjectText(s.bodyBuffer, fmt)
    writeModel(fmt, { type: 'object', value: parsed })
    s.bodyError = ''
  } catch (e) {
    s.bodyError = `Invalid ${editorLanguage.value.toUpperCase()}: ${(e as Error).message}`
    // Don't touch the model — keep previously-committed value until syntax is fixed.
  }
}

function onModeChange(m: TemplateMode): void {
  state.value.mode = m
  commitActive()
}

function onUrlInput(v: string): void {
  state.value.urlBuffer = v
  commitActive()
}

function onBodyChange(v: string): void {
  state.value.bodyBuffer = v
  commitActive()
}

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
      <el-radio-group :model-value="state.mode" @change="onModeChange">
        <el-radio-button value="url">URL</el-radio-button>
        <el-radio-button value="object">Inline object</el-radio-button>
        <el-radio-button value="inline">Inline text</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="state.mode === 'url'">
      <el-input :model-value="state.urlBuffer" :placeholder="activeFormat === 'clash'
        ? 'https://example.com/clash-template.yaml'
        : 'https://example.com/sing-box-template.json'" @input="onUrlInput" />
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
      <MonacoEditor :model-value="state.bodyBuffer" :language="editorLanguage"
        style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px" @update:model-value="onBodyChange"
        @mount="onEditorMount" />
    </template>
  </div>
</template>
