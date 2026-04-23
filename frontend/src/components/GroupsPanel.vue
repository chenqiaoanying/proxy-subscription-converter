<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type AutoRegionGroupConfig,
  type GroupConfig,
  type MatchRule,
  type ProxyInfo,
  type StaticGroupConfig,
  type UrlTestOptions,
  emptyMatchRule,
} from '@/types'
import { useConfigStore } from '@/stores/configs'
import { computeGroupProxies, computeRegionBreakdown } from '@/composables/useProxyPreview'
import AutoRegionSettingsForm from './AutoRegionSettingsForm.vue'

const { t } = useI18n()

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
// Urltest options
const formUrltestOptions = ref<UrlTestOptions>({})
const formGroupUrltestOptions = ref<UrlTestOptions>({})
const formSubGroupUrltestOptions = ref<UrlTestOptions>({})

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
  formUrltestOptions.value = {}
  formGroupUrltestOptions.value = {}
  formSubGroupUrltestOptions.value = {}
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
    formGroupUrltestOptions.value = g.group_urltest_options ? { ...g.group_urltest_options } : {}
    formSubGroupUrltestOptions.value = g.sub_group_urltest_options ? { ...g.sub_group_urltest_options } : {}
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
    formUrltestOptions.value = g.urltest_options ? { ...g.urltest_options } : {}
  }
}

function toUrltestOptions(opts: UrlTestOptions): UrlTestOptions | undefined {
  const cleaned: UrlTestOptions = {}
  if (opts.url?.trim()) cleaned.url = opts.url.trim()
  if (opts.interval?.trim()) cleaned.interval = opts.interval.trim()
  if (opts.tolerance !== undefined && opts.tolerance !== null) cleaned.tolerance = opts.tolerance
  if (opts.idle_timeout?.trim()) cleaned.idle_timeout = opts.idle_timeout.trim()
  if (opts.interrupt_exist_connections !== undefined) cleaned.interrupt_exist_connections = opts.interrupt_exist_connections
  return Object.keys(cleaned).length ? cleaned : undefined
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
      group_urltest_options: formGroupType.value === 'urltest' ? toUrltestOptions(formGroupUrltestOptions.value) : undefined,
      sub_group_urltest_options: formSubGroupType.value === 'urltest' ? toUrltestOptions(formSubGroupUrltestOptions.value) : undefined,
    } satisfies AutoRegionGroupConfig
  }
  return {
    tag: formTag.value.trim(),
    type: formType.value as 'selector' | 'urltest',
    imports: formImports.value,
    include: formInclude.value,
    exclude: formExclude.value,
    urltest_options: formType.value === 'urltest' ? toUrltestOptions(formUrltestOptions.value) : undefined,
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
        {{ t('groups.addGroup') }}
      </el-button>
    </div>

    <el-table :data="tableData" border row-key="_id" :tree-props="{ children: 'children', hasChildren: 'hasChildren' }">
      <el-table-column :label="t('groups.tag')" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.tag }}</template>
      </el-table-column>
      <el-table-column :label="t('groups.type')" width="120">
        <template #default="{ row }">
          <el-tag :type="row.type === 'auto_region' ? 'warning' : 'info'" size="small">
            {{ row.type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('groups.import')" width="140">
        <template #default="{ row }">
          <span v-if="!row._isChild">{{ row.imports.length ? row.imports.join(', ') : t('groups.allSubscriptions') }}</span>
          <span v-else style="color: #999">—</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('groups.proxies')" width="80">
        <template #default="{ row }">{{ row.proxyCount ?? '—' }}</template>
      </el-table-column>
      <el-table-column :label="t('groups.include')" min-width="160">
        <template #default="{ row }">{{ row._isChild ? '—' : describeRule(row.include) }}</template>
      </el-table-column>
      <el-table-column :label="t('groups.exclude')" min-width="160">
        <template #default="{ row }">{{ row._isChild ? '—' : describeRule(row.exclude) }}</template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="180" fixed="right">
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
      :title="editingIndex !== null ? t('groups.editDialogTitle') : t('groups.addDialogTitle')"
      width="580px"
    >
      <el-form label-width="130px">
        <el-form-item :label="t('groups.type')" required>
          <el-radio-group v-model="formType">
            <el-radio value="selector">selector</el-radio>
            <el-radio value="urltest">urltest</el-radio>
            <el-radio value="auto_region">auto region</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="!isAutoRegion" :label="t('groups.tag')" required>
          <el-input v-model="formTag" :placeholder="t('groups.tagPlaceholder')" />
        </el-form-item>

        <template v-if="isAutoRegion">
          <el-form-item :label="t('groups.parentTag')" required>
            <el-input v-model="formGroupTag" :placeholder="t('groups.parentTagPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('groups.subGroupTag')" required>
            <el-input v-model="formSubGroupTag" :placeholder="t('groups.subGroupTagPlaceholder', { regionToken: '{region}' })" />
            <el-text v-if="tagMissingPlaceholder" type="danger" size="small">
              {{ t('groups.subGroupTagMustContain') }} <code>{region}</code>
            </el-text>
          </el-form-item>
        </template>

        <el-form-item :label="t('groups.import')">
          <el-select
            v-model="formImports"
            multiple
            :placeholder="t('groups.importPlaceholder')"
            style="width: 100%"
          >
            <el-option-group v-if="props.subscriptionNames.length" :label="t('groups.importSubscriptions')">
              <el-option v-for="name in props.subscriptionNames" :key="name" :label="name" :value="name" />
            </el-option-group>
            <el-option-group v-if="otherGroupTags.length" :label="t('groups.importGroups')">
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

        <template v-if="!isAutoRegion && formType === 'urltest'">
          <el-divider>{{ t('groups.urlTestOptions') }}</el-divider>
          <el-form-item :label="t('groups.urlTestUrl')">
            <el-input v-model="formUrltestOptions.url" :placeholder="t('groups.urlTestUrlPlaceholder')" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.interval')">
            <el-input v-model="formUrltestOptions.interval" :placeholder="t('groups.intervalPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.tolerance')">
            <el-input-number v-model="formUrltestOptions.tolerance" :min="0" :controls="false" :placeholder="t('groups.tolerancePlaceholder')" style="width: 120px" />
          </el-form-item>
          <el-form-item :label="t('groups.idleTimeout')">
            <el-input v-model="formUrltestOptions.idle_timeout" :placeholder="t('groups.idleTimeoutPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formUrltestOptions.interrupt_exist_connections">{{ t('groups.interrupt') }}</el-checkbox>
          </el-form-item>
        </template>

        <template v-if="isAutoRegion && formGroupType === 'urltest'">
          <el-divider>{{ t('groups.groupUrlTestOptions') }}</el-divider>
          <el-form-item :label="t('groups.urlTestUrl')">
            <el-input v-model="formGroupUrltestOptions.url" :placeholder="t('groups.urlTestUrlPlaceholder')" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.interval')">
            <el-input v-model="formGroupUrltestOptions.interval" :placeholder="t('groups.intervalPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.tolerance')">
            <el-input-number v-model="formGroupUrltestOptions.tolerance" :min="0" :controls="false" :placeholder="t('groups.tolerancePlaceholder')" style="width: 120px" />
          </el-form-item>
          <el-form-item :label="t('groups.idleTimeout')">
            <el-input v-model="formGroupUrltestOptions.idle_timeout" :placeholder="t('groups.idleTimeoutPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formGroupUrltestOptions.interrupt_exist_connections">{{ t('groups.interrupt') }}</el-checkbox>
          </el-form-item>
        </template>

        <template v-if="isAutoRegion && formSubGroupType === 'urltest'">
          <el-divider>{{ t('groups.subGroupUrlTestOptions') }}</el-divider>
          <el-form-item :label="t('groups.urlTestUrl')">
            <el-input v-model="formSubGroupUrltestOptions.url" :placeholder="t('groups.urlTestUrlPlaceholder')" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.interval')">
            <el-input v-model="formSubGroupUrltestOptions.interval" :placeholder="t('groups.intervalPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.tolerance')">
            <el-input-number v-model="formSubGroupUrltestOptions.tolerance" :min="0" :controls="false" :placeholder="t('groups.tolerancePlaceholder')" style="width: 120px" />
          </el-form-item>
          <el-form-item :label="t('groups.idleTimeout')">
            <el-input v-model="formSubGroupUrltestOptions.idle_timeout" :placeholder="t('groups.idleTimeoutPlaceholder')" style="width: 160px" clearable />
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formSubGroupUrltestOptions.interrupt_exist_connections">{{ t('groups.interrupt') }}</el-checkbox>
          </el-form-item>
        </template>

        <el-divider>{{ t('groups.includeRule') }}</el-divider>
        <template v-if="formInclude">
          <el-form-item :label="t('groups.pattern')">
            <el-input v-model="formInclude.pattern" :placeholder="t('groups.includePatternPlaceholder')" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.proxyTypes')">
            <el-select v-model="formInclude.proxy_type" multiple :placeholder="t('groups.anyType')" style="width: 100%">
              <el-option v-for="pt in PROXY_TYPES" :key="pt" :label="pt" :value="pt" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formInclude.regex">{{ t('groups.regex') }}</el-checkbox>
            <el-checkbox v-model="formInclude.match_case" style="margin-left: 12px">{{ t('groups.matchCase') }}</el-checkbox>
            <el-checkbox v-model="formInclude.match_whole_word" style="margin-left: 12px">{{ t('groups.wholeWord') }}</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearInclude">{{ t('common.remove') }}</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureInclude">{{ t('groups.addInclude') }}</el-button>
        </el-form-item>

        <el-divider>{{ t('groups.excludeRule') }}</el-divider>
        <template v-if="formExclude">
          <el-form-item :label="t('groups.pattern')">
            <el-input v-model="formExclude.pattern" :placeholder="t('groups.excludePatternPlaceholder')" clearable />
          </el-form-item>
          <el-form-item :label="t('groups.proxyTypes')">
            <el-select v-model="formExclude.proxy_type" multiple :placeholder="t('groups.anyType')" style="width: 100%">
              <el-option v-for="pt in PROXY_TYPES" :key="pt" :label="pt" :value="pt" />
            </el-select>
          </el-form-item>
          <el-form-item label="">
            <el-checkbox v-model="formExclude.regex">{{ t('groups.regex') }}</el-checkbox>
            <el-checkbox v-model="formExclude.match_case" style="margin-left: 12px">{{ t('groups.matchCase') }}</el-checkbox>
            <el-checkbox v-model="formExclude.match_whole_word" style="margin-left: 12px">{{ t('groups.wholeWord') }}</el-checkbox>
            <el-button size="small" type="danger" style="margin-left: 12px" @click="clearExclude">{{ t('common.remove') }}</el-button>
          </el-form-item>
        </template>
        <el-form-item v-else label="">
          <el-button size="small" @click="ensureExclude">{{ t('groups.addExclude') }}</el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="tagMissingPlaceholder" @click="handleSave">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
