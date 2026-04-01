<script setup lang="ts">
import { ref } from 'vue'
import { type FilterConfig, type MatchRule, emptyFilter, emptyMatchRule } from '@/types'

const model = defineModel<FilterConfig[]>({ required: true })
const props = defineProps<{ subscriptionNames: string[] }>()

const showDialog = ref(false)
const editingIndex = ref<number | null>(null)
const formData = ref<FilterConfig>(emptyFilter())

const PROXY_TYPES = ['vmess', 'vless', 'trojan', 'shadowsocks', 'hysteria2', 'tuic', 'wireguard', 'http', 'socks']

function openAdd() {
  editingIndex.value = null
  formData.value = emptyFilter()
  showDialog.value = true
}

function openEdit(idx: number) {
  editingIndex.value = idx
  formData.value = JSON.parse(JSON.stringify(model.value[idx])) as FilterConfig
  showDialog.value = true
}

function handleSave() {
  if (!formData.value.tag.trim()) return
  const updated = [...model.value]
  if (editingIndex.value !== null) {
    updated[editingIndex.value] = { ...formData.value }
  } else {
    updated.push({ ...formData.value })
  }
  model.value = updated
  showDialog.value = false
}

function handleDelete(idx: number) {
  model.value = model.value.filter((_, i) => i !== idx)
}

function moveUp(idx: number) {
  if (idx === 0) return
  const arr = [...model.value]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  model.value = arr
}

function moveDown(idx: number) {
  if (idx === model.value.length - 1) return
  const arr = [...model.value]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  model.value = arr
}

function ensureInclude() {
  if (!formData.value.include) formData.value.include = emptyMatchRule()
}

function ensureExclude() {
  if (!formData.value.exclude) formData.value.exclude = emptyMatchRule()
}

function clearInclude() { formData.value.include = null }
function clearExclude() { formData.value.exclude = null }

function describeRule(rule: MatchRule | null | undefined): string {
  if (!rule) return '—'
  const parts: string[] = []
  if (rule.pattern) parts.push(`"${rule.pattern}"${rule.regex ? ' (regex)' : ''}`)
  if (rule.proxy_type.length) parts.push(`types: ${rule.proxy_type.join(', ')}`)
  return parts.join(' | ') || '(any)'
}
</script>

<template>
  <div>
    <div style="margin-bottom: 12px">
      <el-button type="primary" size="small" @click="openAdd">
        <el-icon><Plus /></el-icon>
        Add Filter
      </el-button>
    </div>

    <el-table :data="model" border>
      <el-table-column label="#" width="50">
        <template #default="{ $index }">{{ $index + 1 }}</template>
      </el-table-column>
      <el-table-column prop="tag" label="Tag" width="150" />
      <el-table-column prop="type" label="Type" width="100" />
      <el-table-column label="Subscriptions" width="150">
        <template #default="{ row }">
          {{ row.subscriptions.length ? row.subscriptions.join(', ') : 'All' }}
        </template>
      </el-table-column>
      <el-table-column label="Include" min-width="180">
        <template #default="{ row }">{{ describeRule(row.include) }}</template>
      </el-table-column>
      <el-table-column label="Exclude" min-width="180">
        <template #default="{ row }">{{ describeRule(row.exclude) }}</template>
      </el-table-column>
      <el-table-column label="Actions" width="180" fixed="right">
        <template #default="{ $index }">
          <el-button-group>
            <el-button size="small" :disabled="$index === 0" @click="moveUp($index)">
              <el-icon><ArrowUp /></el-icon>
            </el-button>
            <el-button size="small" :disabled="$index === model.length - 1" @click="moveDown($index)">
              <el-icon><ArrowDown /></el-icon>
            </el-button>
          </el-button-group>
          <el-button size="small" style="margin-left: 4px" @click="openEdit($index)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete($index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="showDialog"
      :title="editingIndex !== null ? 'Edit Filter' : 'Add Filter'"
      width="560px"
    >
      <el-form label-width="120px">
        <el-form-item label="Tag" required>
          <el-input v-model="formData.tag" placeholder="filter_tag" />
        </el-form-item>
        <el-form-item label="Type">
          <el-radio-group v-model="formData.type">
            <el-radio value="selector">selector</el-radio>
            <el-radio value="urltest">urltest</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Subscriptions">
          <el-select
            v-model="formData.subscriptions"
            multiple
            placeholder="All (empty = all)"
            style="width: 100%"
          >
            <el-option
              v-for="name in props.subscriptionNames"
              :key="name"
              :label="name"
              :value="name"
            />
          </el-select>
        </el-form-item>

        <!-- Include rule -->
        <el-divider>Include Rule</el-divider>
        <template v-if="formData.include">
          <el-form-item label="Pattern">
            <el-input v-model="formData.include.pattern" placeholder="e.g. HK|Hong Kong" clearable />
          </el-form-item>
          <el-form-item label="Proxy Types">
            <el-select v-model="formData.include.proxy_type" multiple placeholder="Any type" style="width: 100%">
              <el-option v-for="t in PROXY_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formData.include.regex">Regex</el-checkbox>
            <el-checkbox v-model="formData.include.match_case" style="margin-left: 12px">Match Case</el-checkbox>
            <el-checkbox v-model="formData.include.match_whole_word" style="margin-left: 12px">Whole Word</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearInclude">Remove</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureInclude">+ Add Include Rule</el-button>
        </el-form-item>

        <!-- Exclude rule -->
        <el-divider>Exclude Rule</el-divider>
        <template v-if="formData.exclude">
          <el-form-item label="Pattern">
            <el-input v-model="formData.exclude.pattern" placeholder="e.g. TEST|EXPIRE" clearable />
          </el-form-item>
          <el-form-item label="Proxy Types">
            <el-select v-model="formData.exclude.proxy_type" multiple placeholder="Any type" style="width: 100%">
              <el-option v-for="t in PROXY_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formData.exclude.regex">Regex</el-checkbox>
            <el-checkbox v-model="formData.exclude.match_case" style="margin-left: 12px">Match Case</el-checkbox>
            <el-checkbox v-model="formData.exclude.match_whole_word" style="margin-left: 12px">Whole Word</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearExclude">Remove</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureExclude">+ Add Exclude Rule</el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">Cancel</el-button>
        <el-button type="primary" @click="handleSave">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>
