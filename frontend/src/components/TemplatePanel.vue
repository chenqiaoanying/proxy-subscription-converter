<script setup lang="ts">
import { computed, ref } from 'vue'
import MonacoEditor from './MonacoEditor.vue'
import * as monaco from 'monaco-editor'
import singboxSchema from "@/schemas/sing-box.schema.json";

const model = defineModel<string | Record<string, unknown> | null | undefined>({ required: true })

type TemplateMode = 'url' | 'inline'

const mode = ref<TemplateMode>(
  typeof model.value === 'string' ? 'url' : 'inline'
)

const urlValue = ref(typeof model.value === 'string' ? model.value : '')
const inlineValue = ref(
  typeof model.value === 'object' && model.value !== null
    ? JSON.stringify(model.value, null, 2)
    : '{}'
)

const inlineError = ref('')

function onEditorMount() {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [
      {
        uri: "https://gist.githubusercontent.com/artiga033/fea992d95ad44dc8d024b229223b1002/raw/83c676c1ec9f37af2bce0505da396b5444b30032/sing-box.schema.json",
        fileMatch: ["*"],
        schema: singboxSchema,
      },
    ],
  });
}

function onModeChange(m: TemplateMode) {
  mode.value = m
  if (m === 'url') {
    model.value = urlValue.value || null
  } else {
    try {
      model.value = JSON.parse(inlineValue.value) as Record<string, unknown>
      inlineError.value = ''
    } catch {
      model.value = null
    }
  }
}

function onUrlInput(v: string) {
  urlValue.value = v
  model.value = v || null
}

function onInlineChange(v: string) {
  inlineValue.value = v
  try {
    model.value = JSON.parse(v) as Record<string, unknown>
    inlineError.value = ''
  } catch {
    inlineError.value = 'Invalid JSON'
  }
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px; height: 100%">
    <div>
      <el-radio-group :model-value="mode" @change="onModeChange">
        <el-radio-button value="url">URL</el-radio-button>
        <el-radio-button value="inline">Inline JSON</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="mode === 'url'">
      <el-input :model-value="urlValue" placeholder="https://example.com/template.json" @input="onUrlInput" />
      <el-text type="info" size="small">
        The template will be fetched from this URL each time the generate endpoint is called.
      </el-text>
    </template>

    <template v-else>
      <el-alert v-if="inlineError" :title="inlineError" type="error" :closable="false" />
      <MonacoEditor :model-value="inlineValue" style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px"
        language="json" @update:model-value="onInlineChange" @mount="onEditorMount" />
    </template>
  </div>
</template>
