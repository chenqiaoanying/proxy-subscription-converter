<template>
  <div ref="container" :style="{ width, height }" />
</template>

<script setup lang="ts">
import { useTemplateRef, watch, onMounted, onBeforeUnmount } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

interface Props {
  modelValue: string
  language?: string
  theme?: string
  width?: string
  height?: string
}
const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue', 'editor-mounted'])

const container = useTemplateRef<HTMLElement>("container")
let editor: monaco.editor.IStandaloneCodeEditor

// 配置 Worker
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new JsonWorker()
    if (['css', 'scss', 'less'].includes(label)) return new CssWorker()
    if (['html', 'handlebars', 'razor'].includes(label)) return new HtmlWorker()
    if (['typescript', 'javascript'].includes(label)) return new TsWorker()
    return new EditorWorker()
  }
}

onMounted(() => {
  editor = monaco.editor.create(container.value!, {
    value: props.modelValue,
    language: props.language || 'javascript',
    theme: props.theme || 'vs-dark',
    automaticLayout: true,
  })
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue())
  })
  emit('editor-mounted', editor)
})

watch(() => props.modelValue, val => {
  if (editor && editor.getValue() !== val) editor.setValue(val)
})

watch(() => props.language, lang => {
  monaco.editor.setModelLanguage(editor.getModel()!, lang!)
})

onBeforeUnmount(() => {
  editor.dispose()
})
</script>
