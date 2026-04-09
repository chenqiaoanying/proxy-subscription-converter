<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  type AutoRegionGroupConfig,
  type GroupConfig,
  type MatchRule,
  type ProxyInfo,
  type StaticGroupConfig,
  emptyMatchRule,
} from '@/types'
import { useConfigStore } from '@/stores/configs'
import { computeGroupProxies, computeRegionBreakdown } from '@/composables/useProxyPreview'
import AutoRegionSettingsForm from './AutoRegionSettingsForm.vue'

const model = defineModel<GroupConfig[]>({ required: true })
const props = defineProps<{ subscriptionNames: string[] }>()
const store = useConfigStore()

const showDialog = ref(false)
const editingIndex = ref<number | null>(null)
const showRegionMap = ref(false)

const PROXY_TYPES = ['vmess', 'vless', 'trojan', 'shadowsocks', 'hysteria2', 'tuic', 'wireguard', 'http', 'socks']

// Form state — covers all fields from both group types
const formTag = ref('')
const formType = ref<'selector' | 'urltest' | 'auto_region'>('selector')
const formImports = ref<string[]>([])
const formInclude = ref<MatchRule | null>(null)
const formExclude = ref<MatchRule | null>(null)
// Auto region specific
const formGroupTag = ref('')
const formGroupType = ref<'selector' | 'urltest'>('selector')
const formSubGroupTag = ref('')
const formSubGroupType = ref<'selector' | 'urltest'>('urltest')
const formRegionsMode = ref<'auto' | 'custom'>('auto')
const formRegionsList = ref<string[]>([])
const formOthersTag = ref('Others')
const formUseEmoji = ref(false)
const formRegionMapEntries = ref<{ keyword: string; region: string }[]>([])

const isAutoRegion = computed(() => formType.value === 'auto_region')
const otherGroupTags = computed(() =>
  model.value
    .filter((_, i) => i !== editingIndex.value)
    .map(g => g.type === 'auto_region' ? g.group_tag : g.tag)
    .filter(tag => tag.trim() !== '')
)
const tagMissingPlaceholder = computed(
  () => isAutoRegion.value && formSubGroupTag.value.trim() !== '' && !formSubGroupTag.value.includes('{region}')
)

function resetForm() {
  formTag.value = ''
  formType.value = 'selector'
  formImports.value = []
  formInclude.value = null
  formExclude.value = null
  formGroupTag.value = ''
  formGroupType.value = 'selector'
  formSubGroupTag.value = ''
  formSubGroupType.value = 'urltest'
  formRegionsMode.value = 'auto'
  formRegionsList.value = []
  formOthersTag.value = 'Others'
  formUseEmoji.value = false
  formRegionMapEntries.value = []
  showRegionMap.value = false
}

function loadGroup(g: GroupConfig) {
  formType.value = g.type
  formImports.value = [...g.imports]
  formInclude.value = g.include ? { ...g.include, proxy_type: [...g.include.proxy_type] } : null
  formExclude.value = g.exclude ? { ...g.exclude, proxy_type: [...g.exclude.proxy_type] } : null
  if (g.type === 'auto_region') {
    formGroupTag.value = g.group_tag
    formGroupType.value = g.group_type
    formSubGroupTag.value = g.sub_group_tag
    formSubGroupType.value = g.sub_group_type
    formRegionsMode.value = g.regions === 'auto' ? 'auto' : 'custom'
    formRegionsList.value = g.regions === 'auto' ? [] : [...g.regions]
    formOthersTag.value = g.others_tag
    formUseEmoji.value = g.use_emoji
    formRegionMapEntries.value = Object.entries(g.region_map).map(([keyword, region]) => ({ keyword, region }))
  } else {
    formTag.value = g.tag
    formGroupTag.value = ''
    formGroupType.value = 'selector'
    formSubGroupTag.value = ''
    formSubGroupType.value = 'urltest'
    formRegionsMode.value = 'auto'
    formRegionsList.value = []
    formOthersTag.value = 'Others'
    formUseEmoji.value = false
    formRegionMapEntries.value = []
  }
}

function buildGroup(): GroupConfig {
  if (formType.value === 'auto_region') {
    const region_map: Record<string, string> = {}
    for (const { keyword, region } of formRegionMapEntries.value) {
      if (keyword.trim() && region.trim()) region_map[keyword.trim()] = region.trim()
    }
    return {
      group_tag: formGroupTag.value.trim(),
      type: 'auto_region',
      group_type: formGroupType.value,
      sub_group_tag: formSubGroupTag.value.trim(),
      sub_group_type: formSubGroupType.value,
      imports: formImports.value,
      regions: formRegionsMode.value === 'auto' ? 'auto' : formRegionsList.value,
      others_tag: formOthersTag.value || 'Others',
      use_emoji: formUseEmoji.value,
      region_map,
      include: formInclude.value,
      exclude: formExclude.value,
    } satisfies AutoRegionGroupConfig
  }
  return {
    tag: formTag.value.trim(),
    type: formType.value as 'selector' | 'urltest',
    imports: formImports.value,
    include: formInclude.value,
    exclude: formExclude.value,
  } satisfies StaticGroupConfig
}

function openAdd() {
  editingIndex.value = null
  resetForm()
  showDialog.value = true
}

function openEdit(idx: number) {
  editingIndex.value = idx
  loadGroup(model.value[idx])
  showDialog.value = true
}

function handleSave() {
  if (isAutoRegion.value) {
    if (!formGroupTag.value.trim()) return
    if (!formSubGroupTag.value.trim() || !formSubGroupTag.value.includes('{region}')) return
  } else {
    if (!formTag.value.trim()) return
  }
  const updated = [...model.value]
  if (editingIndex.value !== null) {
    updated[editingIndex.value] = buildGroup()
  } else {
    updated.push(buildGroup())
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

function ensureInclude() { formInclude.value = emptyMatchRule() }
function ensureExclude() { formExclude.value = emptyMatchRule() }
function clearInclude() { formInclude.value = null }
function clearExclude() { formExclude.value = null }

interface GroupRow {
  _id: string; _index: number; _isChild: boolean
  tag: string; type: string
  imports: string[]; include: MatchRule | null; exclude: MatchRule | null
  proxyCount: number | undefined; hasChildren?: boolean; children?: GroupRow[]
}
const tableData = computed((): GroupRow[] => {
  const gr: Record<string, ProxyInfo[]> = {}
  return model.value.map((group, i) => {
    const tag = group.type === 'auto_region' ? group.group_tag : group.tag
    const proxies = computeGroupProxies(group, store.subscriptionPreviews, gr)
    if (proxies !== null) gr[tag] = proxies
    const breakdown = group.type === 'auto_region' && proxies !== null
      ? computeRegionBreakdown(group, proxies) : undefined
    const row: GroupRow = {
      _id: `g-${i}`, _index: i, _isChild: false, tag,
      type: group.type === 'auto_region' ? group.group_type : group.type,
      imports: group.imports,
      include: group.include ?? null, exclude: group.exclude ?? null,
      proxyCount: proxies?.length,
      hasChildren: group.type === 'auto_region',
    }
    if (breakdown?.length && group.type === 'auto_region')
      row.children = breakdown.map((item, ri) => ({
        _id: `g-${i}-r-${ri}`, _index: -1, _isChild: true,
        tag: item.label, type: group.sub_group_type,
        imports: [], include: null, exclude: null, proxyCount: item.count,
      }))
    return row
  })
})
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
        Add Group
      </el-button>
    </div>

    <el-table :data="tableData" border row-key="_id" :tree-props="{ children: 'children', hasChildren: 'hasChildren' }">
      <el-table-column label="Tag" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.tag }}</template>
      </el-table-column>
      <el-table-column label="Type" width="120">
        <template #default="{ row }">
          <el-tag :type="row.type === 'auto_region' ? 'warning' : 'info'" size="small">
            {{ row.type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Import" width="140">
        <template #default="{ row }">
          <span v-if="!row._isChild">{{ row.imports.length ? row.imports.join(', ') : 'All' }}</span>
          <span v-else style="color: #999">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Proxies" width="80">
        <template #default="{ row }">{{ row.proxyCount ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="Include" min-width="160">
        <template #default="{ row }">{{ row._isChild ? '—' : describeRule(row.include) }}</template>
      </el-table-column>
      <el-table-column label="Exclude" min-width="160">
        <template #default="{ row }">{{ row._isChild ? '—' : describeRule(row.exclude) }}</template>
      </el-table-column>
      <el-table-column label="Actions" width="180" fixed="right">
        <template #default="{ row }">
          <div v-if="!row._isChild" style="white-space: nowrap">
            <el-button-group>
              <el-button size="small" :disabled="row._index === 0" @click="moveUp(row._index)">
                <el-icon><ArrowUp /></el-icon>
              </el-button>
              <el-button size="small" :disabled="row._index === model.length - 1" @click="moveDown(row._index)">
                <el-icon><ArrowDown /></el-icon>
              </el-button>
            </el-button-group>
            <el-button size="small" style="margin-left: 4px" @click="openEdit(row._index)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row._index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="showDialog"
      :title="editingIndex !== null ? 'Edit Group' : 'Add Group'"
      width="580px"
    >
      <el-form label-width="130px">
        <el-form-item label="Type" required>
          <el-radio-group v-model="formType">
            <el-radio value="selector">selector</el-radio>
            <el-radio value="urltest">urltest</el-radio>
            <el-radio value="auto_region">auto region</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="!isAutoRegion" label="Tag" required>
          <el-input v-model="formTag" placeholder="group_tag" />
        </el-form-item>

        <template v-if="isAutoRegion">
          <el-form-item label="Parent tag" required>
            <el-input v-model="formGroupTag" placeholder="My Proxies" />
          </el-form-item>
          <el-form-item label="Sub-group tag" required>
            <el-input v-model="formSubGroupTag" placeholder="{region} Nodes" />
            <el-text v-if="tagMissingPlaceholder" type="danger" size="small">
              Tag must contain <code>{region}</code>
            </el-text>
          </el-form-item>
        </template>

        <el-form-item label="Import">
          <el-select
            v-model="formImports"
            multiple
            placeholder="All subscriptions (empty = all)"
            style="width: 100%"
          >
            <el-option-group v-if="props.subscriptionNames.length" label="Subscriptions">
              <el-option v-for="name in props.subscriptionNames" :key="name" :label="name" :value="name" />
            </el-option-group>
            <el-option-group v-if="otherGroupTags.length" label="Groups">
              <el-option v-for="name in otherGroupTags" :key="name" :label="name" :value="name" />
            </el-option-group>
          </el-select>
        </el-form-item>

        <AutoRegionSettingsForm
          v-if="isAutoRegion"
          :subscription-names="props.subscriptionNames"
          v-model:group-type="formGroupType"
          v-model:sub-group-type="formSubGroupType"
          v-model:regions-mode="formRegionsMode"
          v-model:regions-list="formRegionsList"
          v-model:others-tag="formOthersTag"
          v-model:use-emoji="formUseEmoji"
          v-model:region-map-entries="formRegionMapEntries"
          v-model:show-region-map="showRegionMap"
        />

        <el-divider>Include Rule</el-divider>
        <template v-if="formInclude">
          <el-form-item label="Pattern">
            <el-input v-model="formInclude.pattern" placeholder="e.g. HK|Hong Kong" clearable />
          </el-form-item>
          <el-form-item label="Proxy Types">
            <el-select v-model="formInclude.proxy_type" multiple placeholder="Any type" style="width: 100%">
              <el-option v-for="t in PROXY_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formInclude.regex">Regex</el-checkbox>
            <el-checkbox v-model="formInclude.match_case" style="margin-left: 12px">Match Case</el-checkbox>
            <el-checkbox v-model="formInclude.match_whole_word" style="margin-left: 12px">Whole Word</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearInclude">Remove</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureInclude">+ Add Include Rule</el-button>
        </el-form-item>

        <el-divider>Exclude Rule</el-divider>
        <template v-if="formExclude">
          <el-form-item label="Pattern">
            <el-input v-model="formExclude.pattern" placeholder="e.g. TEST|EXPIRE" clearable />
          </el-form-item>
          <el-form-item label="Proxy Types">
            <el-select v-model="formExclude.proxy_type" multiple placeholder="Any type" style="width: 100%">
              <el-option v-for="t in PROXY_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formExclude.regex">Regex</el-checkbox>
            <el-checkbox v-model="formExclude.match_case" style="margin-left: 12px">Match Case</el-checkbox>
            <el-checkbox v-model="formExclude.match_whole_word" style="margin-left: 12px">Whole Word</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearExclude">Remove</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureExclude">+ Add Exclude Rule</el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">Cancel</el-button>
        <el-button type="primary" :disabled="tagMissingPlaceholder" @click="handleSave">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>
