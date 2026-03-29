<script setup lang="ts">
import { type DeepReadonly, onMounted, ref } from "vue";
import GeneratorDrawer from "@components/GeneratorDrawer.vue";
import { useGeneratorStore, useFilterStore, useSubscriptionStore } from "@/stores.ts";
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import type { Generator } from "@psc/common";
import { getErrorMessage, applyFilterToProxies } from "@psc/common";
import { Delete, Edit, Link, View, Plus } from "@element-plus/icons-vue";
import MonacoEditor from "@components/MonacoEditor.vue";
import { formatBytes } from "@/utils.ts";

const drawerVisible = ref(false);
const previewVisible = ref(false);
const previewContent = ref("");
const subscriptionGeneratorStore = useGeneratorStore();
const { generators } = storeToRefs(subscriptionGeneratorStore);

const filterStore = useFilterStore();
const { filters } = storeToRefs(filterStore);

const subscriptionStore = useSubscriptionStore();
const { subscriptions } = storeToRefs(subscriptionStore);

onMounted(() => {
    Promise.all([subscriptionGeneratorStore.forceReloadGenerators(), filterStore.forceReloadFilters(), subscriptionStore.forceReloadSubscriptions()]).catch(err => {
        ElMessage.error(getErrorMessage(err.message));
    });
});

const selectedGenerator = ref<DeepReadonly<Generator> | undefined>(undefined);

function copyLink(id: number) {
    const url = `${window.location.origin}/api/generator/generate/${id}?refresh=true`;
    navigator.clipboard.writeText(url).then(() => {
        ElMessage.success("订阅链接已复制");
    });
}

function preview(id: number) {
    subscriptionGeneratorStore
        .generate(id)
        .then(content => {
            previewContent.value = JSON.stringify(content, null, 4);
            previewVisible.value = true;
        })
        .catch(err => ElMessage.error(getErrorMessage(err.message)));
}

function generatorStats(generator: DeepReadonly<Generator>) {
    // Auto-detect referenced filters from selector/urltest outbounds in the template
    const templateOutbounds: any[] = generator.type === 'json' ? (generator.content as any)?.outbounds ?? [] : [];
    const referencedTags = new Set<string>(
        templateOutbounds
            .filter((o: any) => o.type === 'selector' || o.type === 'urltest')
            .flatMap((o: any) => o.outbounds ?? [])
    );
    const genFilters = filters.value.filter(f => referencedTags.has(f.tag));

    const needsAll = genFilters.some(f => !f.subscriptionIds || f.subscriptionIds.length === 0);
    const involvedIds = needsAll ? subscriptions.value.map(s => s.id) : [...new Set(genFilters.flatMap(f => f.subscriptionIds ?? []))];

    const involvedSubs = subscriptions.value.filter(s => involvedIds.includes(s.id));

    // proxies matched by all filters (union by tag)
    const matchedTagSet = new Set<string>();
    for (const f of genFilters) {
        for (const proxy of applyFilterToProxies(f, subscriptions.value)) {
            matchedTagSet.add(proxy.tag);
        }
    }

    // remaining traffic sum
    let totalBytes = 0;
    let usedBytes = 0;
    let hasTrafficData = false;
    for (const sub of involvedSubs) {
        if (sub.dataUsage) {
            totalBytes += sub.dataUsage.total;
            usedBytes += sub.dataUsage.upload + sub.dataUsage.download;
            hasTrafficData = true;
        }
    }
    const remainingBytes = totalBytes - usedBytes;

    let maxExpiredAt: Date | null = null;
    for (const sub of involvedSubs) {
        if (sub.dataUsage?.expiredAt) {
            if (!maxExpiredAt || sub.dataUsage.expiredAt > maxExpiredAt) {
                maxExpiredAt = sub.dataUsage.expiredAt;
            }
        }
    }

    return {
        proxyCount: generator.type === 'json' ? matchedTagSet.size : null,
        filterCount: generator.type === 'json' ? genFilters.length : null,
        usagePercent: hasTrafficData ? Math.min(100, +((usedBytes / totalBytes) * 100).toFixed(1)) : null,
        remainingBytes: hasTrafficData ? remainingBytes : null,
        expiredAt: maxExpiredAt,
    };
}

function addGenerator() {
    selectedGenerator.value = undefined;
    drawerVisible.value = true;
}
</script>

<template>
    <el-row justify="end">
        <el-button type="primary" @click="addGenerator" :icon="Plus" circle></el-button>
    </el-row>
    <el-divider />
    <el-row>
        <el-card v-for="item in generators">
            <template #header>
                <span>{{ item.name }}</span>
            </template>
            <div class="card-content">
                <el-progress v-if="generatorStats(item).usagePercent !== null" type="line" text-inside :stroke-width="22" :percentage="generatorStats(item).usagePercent!" :color="(pct: number) => (pct >= 80 ? '#f56c6c' : '#409eff')" :format="() => '剩余 ' + formatBytes(generatorStats(item).remainingBytes!)" />
                <div class="card-stats">
                    <template v-if="generatorStats(item).proxyCount !== null">
                        <span class="stat-label">可用代理</span>
                        <span class="stat-value">{{ generatorStats(item).proxyCount }}</span>
                        <span class="stat-label">分组</span>
                        <span class="stat-value">{{ generatorStats(item).filterCount }}</span>
                    </template>
                    <template v-if="generatorStats(item).expiredAt">
                        <span class="stat-label">到期</span>
                        <span class="stat-value">{{ generatorStats(item).expiredAt!.toLocaleDateString() }}</span>
                    </template>
                </div>
            </div>
            <template #footer>
                <el-button @click="copyLink(item.id)" type="primary" :icon="Link" />
                <el-button @click="preview(item.id)" type="primary" :icon="View" />
                <el-button
                    @click="
                        selectedGenerator = item;
                        drawerVisible = true;
                    "
                    type="primary"
                    :icon="Edit"
                />
                <el-button @click="subscriptionGeneratorStore.deleteGenerator(item.id)" type="primary" :icon="Delete" />
            </template>
        </el-card>
    </el-row>
    <GeneratorDrawer v-model:visible="drawerVisible" :to-update-generator="selectedGenerator" />
    <el-dialog v-model="previewVisible" width="50vh">
        <template #header>预览</template>
        <div style="height: 50vh">
            <MonacoEditor v-model="previewContent" language="json" :readonly="true" width="100%" height="100%" theme="dark" />
        </div>
    </el-dialog>
</template>

<style scoped lang="scss">
.el-row {
    align-items: stretch;
}

.el-card {
    width: 300px;
    margin: 10px;
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
        flex: 1;
    }

    .card-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 0;

        .card-stats {
            display: grid;
            grid-template-columns: auto 1fr;
            column-gap: 12px;
            row-gap: 4px;
            font-size: 13px;

            .stat-label {
                color: var(--el-text-color-secondary);
                white-space: nowrap;
            }

            .stat-value {
                color: var(--el-text-color-primary);
            }
        }
    }
}

:deep(.el-progress-bar__innerText) {
    color: #fff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
}
</style>
