<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFilterStore, useSubscriptionStore } from '@/stores.ts'
import { storeToRefs } from 'pinia'
import type { FilterCreateOrUpdate } from '@psc/common'
import { REGIONS, type RegionDefinition } from '@components/regionData.ts'

const filterStore = useFilterStore()
const { filters } = storeToRefs(filterStore)
const subscriptionStore = useSubscriptionStore()
const { subscriptions } = storeToRefs(subscriptionStore)

const visible = defineModel<boolean>('visible')

const form = reactive({
    selectAllSubscriptions: true,
    subscriptionIds: [] as number[],
    selectedRegionCodes: [] as string[],
    filterType: 'selector' as 'selector' | 'urltest',
    tagPrefix: '',
})

const loading = ref(false)
const resultSummary = ref<{ text: string; type: 'success' | 'warning' | 'error' }[]>([])
const onlyAvailable = ref(false)

// Track which regions had existing filters when the dialog was opened
const originalSelectedCodes = ref<string[]>([])
const originalFilterMap = ref<Map<string, number>>(new Map()) // code → filterId

const availableRegionCodes = computed<Set<string>>(() => {
    const selectedSubs = form.selectAllSubscriptions
        ? subscriptions.value
        : subscriptions.value.filter(s => form.subscriptionIds.includes(s.id))
    const allTags = selectedSubs.flatMap(s => s.proxies.map(p => p.tag))
    const result = new Set<string>()
    for (const region of REGIONS) {
        const pattern = new RegExp(region.keywords.join('|'))
        if (allTags.some(tag => pattern.test(tag))) {
            result.add(region.code)
        }
    }
    return result
})

const visibleRegions = computed(() =>
    onlyAvailable.value ? REGIONS.filter(r => availableRegionCodes.value.has(r.code)) : REGIONS
)

interface PreviewItem {
    tag: string
    includePattern: string
    action: 'create' | 'delete' | 'keep'
    filterId?: number
    region: RegionDefinition
}

const previewItems = computed<PreviewItem[]>(() => {
    const items: PreviewItem[] = []

    for (const code of form.selectedRegionCodes) {
        const region = REGIONS.find(r => r.code === code)!
        const tag = form.tagPrefix + region.code
        const existingFilter = filters.value.find(f => f.tag === tag)
        items.push({
            tag,
            includePattern: region.keywords.join('|'),
            action: existingFilter ? 'keep' : 'create',
            filterId: existingFilter?.id,
            region,
        })
    }

    for (const code of originalSelectedCodes.value) {
        if (!form.selectedRegionCodes.includes(code)) {
            const region = REGIONS.find(r => r.code === code)!
            const filterId = originalFilterMap.value.get(code)!
            if (filters.value.some(f => f.id === filterId)) {
                items.push({
                    tag: region.code,
                    includePattern: region.keywords.join('|'),
                    action: 'delete',
                    filterId,
                    region,
                })
            }
        }
    }

    return items
})

const changeItems = computed(() => previewItems.value.filter(i => i.action !== 'keep'))
const hasChanges = computed(() => changeItems.value.length > 0)

function onOpen() {
    form.tagPrefix = ''
    form.filterType = 'selector'
    form.selectAllSubscriptions = true
    form.subscriptionIds = []
    resultSummary.value = []

    // Pre-check regions that already have a filter with exact region code as tag
    const preChecked: string[] = []
    const idMap = new Map<string, number>()
    for (const region of REGIONS) {
        const existing = filters.value.find(f => f.tag === region.code)
        if (existing) {
            preChecked.push(region.code)
            idMap.set(region.code, existing.id)
        }
    }
    form.selectedRegionCodes = preChecked
    originalSelectedCodes.value = preChecked
    originalFilterMap.value = idMap
}

function buildPayload(item: PreviewItem): FilterCreateOrUpdate {
    return {
        tag: item.tag,
        type: form.filterType,
        subscriptionIds: form.selectAllSubscriptions ? [] : [...form.subscriptionIds],
        proxyTypeFilterMode: 'all',
        proxyTypes: [],
        includePattern: item.includePattern,
    }
}

async function onConfirm() {
    if (!hasChanges.value) {
        ElMessage.info('没有变更')
        return
    }

    const toCreate = changeItems.value.filter(i => i.action === 'create')
    const toDelete = changeItems.value.filter(i => i.action === 'delete')

    if (toDelete.length > 0) {
        const parts: string[] = []
        if (toDelete.length > 0) parts.push(`删除 ${toDelete.length} 个（${toDelete.map(i => i.tag).join(', ')}）`)
        if (toCreate.length > 0) parts.push(`创建 ${toCreate.length} 个（${toCreate.map(i => i.tag).join(', ')}）`)
        try {
            await ElMessageBox.confirm(parts.join('，'), '确认变更', {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'warning',
            })
        } catch {
            return
        }
    }

    loading.value = true
    resultSummary.value = []
    const errors: string[] = []
    const successes: string[] = []

    for (const item of toDelete) {
        try {
            await filterStore.deleteFilter(item.filterId!)
            successes.push(`删除 ${item.tag}`)
        } catch (err: any) {
            errors.push(`删除 ${item.tag}: ${err.message}`)
        }
    }

    for (const item of toCreate) {
        try {
            await filterStore.createFilter(buildPayload(item))
            successes.push(`创建 ${item.tag}`)
        } catch (err: any) {
            errors.push(`创建 ${item.tag}: ${err.message}`)
        }
    }

    loading.value = false

    if (errors.length === 0) {
        const parts: string[] = []
        if (toDelete.length > 0) parts.push(`删除 ${toDelete.length} 个`)
        if (toCreate.length > 0) parts.push(`创建 ${toCreate.length} 个`)
        ElMessage.success(parts.join('，') + ' 地区分组')
        visible.value = false
    } else {
        resultSummary.value = [
            ...(successes.length > 0 ? [{ text: `成功：${successes.join(', ')}`, type: 'success' as const }] : []),
            ...errors.map(e => ({ text: e, type: 'error' as const })),
        ]
    }
}
</script>

<template>
    <el-dialog title="快速设置地区分组" v-model="visible" @open="onOpen" width="min(900px, 90vw)">
        <div class="region-dialog-scroll">
        <el-form label-width="90px">
            <el-form-item label="订阅范围">
                <div>
                    <el-checkbox v-model="form.selectAllSubscriptions">所有订阅</el-checkbox>
                    <el-checkbox-group
                        v-if="!form.selectAllSubscriptions"
                        v-model="form.subscriptionIds"
                        style="margin-top: 6px"
                    >
                        <el-checkbox
                            v-for="sub in subscriptions"
                            :key="sub.id"
                            :value="sub.id"
                        >{{ sub.name }}</el-checkbox>
                    </el-checkbox-group>
                </div>
            </el-form-item>

            <el-form-item label="选择地区">
                <div>
                    <div style="margin-bottom: 6px">
                        <el-checkbox v-model="onlyAvailable">只显示有代理的地区</el-checkbox>
                    </div>
                    <el-checkbox-group v-model="form.selectedRegionCodes" class="region-grid">
                        <el-checkbox
                            v-for="r in visibleRegions"
                            :key="r.code"
                            :value="r.code"
                        >{{ r.label }}</el-checkbox>
                    </el-checkbox-group>
                    <div style="margin-top: 6px">
                        <el-button link size="small" @click="form.selectedRegionCodes = visibleRegions.map(r => r.code)">全选</el-button>
                        <el-button link size="small" @click="form.selectedRegionCodes = []">清空</el-button>
                    </div>
                </div>
            </el-form-item>

            <el-form-item label="类型">
                <el-radio-group v-model="form.filterType">
                    <el-radio value="selector">选择器</el-radio>
                    <el-radio value="urltest">URL 测试</el-radio>
                </el-radio-group>
            </el-form-item>

            <el-form-item label="标签前缀">
                <el-input
                    v-model="form.tagPrefix"
                    placeholder="例：Region-（可留空）"
                    style="width: 240px"
                />
            </el-form-item>

            <el-form-item label="预览" v-if="changeItems.length > 0">
                <el-table :data="changeItems" size="small" style="width: 100%">
                    <el-table-column prop="tag" label="标签" width="120" />
                    <el-table-column prop="includePattern" label="匹配规则" show-overflow-tooltip />
                    <el-table-column label="操作" width="80">
                        <template #default="{ row }">
                            <el-tag :type="row.action === 'delete' ? 'danger' : 'success'" size="small">
                                {{ row.action === 'delete' ? '删除' : '新建' }}
                            </el-tag>
                        </template>
                    </el-table-column>
                </el-table>
            </el-form-item>

            <el-form-item v-if="resultSummary.length > 0">
                <el-alert
                    v-for="(msg, i) in resultSummary"
                    :key="i"
                    :title="msg.text"
                    :type="msg.type"
                    show-icon
                    :closable="false"
                    style="margin-bottom: 4px"
                />
            </el-form-item>
        </el-form>
        </div>

        <template #footer>
            <el-button @click="visible = false">取 消</el-button>
            <el-button
                type="primary"
                :loading="loading"
                :disabled="!hasChanges"
                @click="onConfirm"
            >确 认</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.region-dialog-scroll {
    max-height: 70vh;
    overflow-y: auto;
}

.region-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px 0;
}
</style>
