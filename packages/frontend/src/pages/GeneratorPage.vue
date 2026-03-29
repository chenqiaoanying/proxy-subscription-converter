<script setup lang="ts">
import { type DeepReadonly, onMounted, ref } from "vue";
import GeneratorDrawer from "@components/GeneratorDrawer.vue";
import { useGeneratorStore, useFilterStore, useSubscriptionStore } from "@/stores.ts";
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import type { Generator } from "@psc/common";
import { getErrorMessage } from "@psc/common";
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
    const genFilters = generator.filterIds.map(id => filters.value.find(f => f.id === id)).filter(Boolean);

    const needsAll = genFilters.some(f => !f!.subscriptionIds || f!.subscriptionIds.length === 0);
    const involvedIds = needsAll ? subscriptions.value.map(s => s.id) : [...new Set(genFilters.flatMap(f => f!.subscriptionIds ?? []))];

    const involvedSubs = subscriptions.value.filter(s => involvedIds.includes(s.id));

    // distinct proxy count by tag across all involved subscriptions
    const tagSet = new Set<string>();
    for (const sub of involvedSubs) {
        for (const proxy of sub.proxies) tagSet.add(proxy.tag);
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
        proxyCount: tagSet.size,
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
                <el-statistic title="原始代理数" :value="generatorStats(item).proxyCount" />
            </div>
            <template v-if="generatorStats(item).usagePercent !== null">
                <el-progress type="line" text-inside :stroke-width="22" :percentage="generatorStats(item).usagePercent!" :color="(pct: number) => (pct >= 80 ? '#f56c6c' : '#409eff')" :format="() => '剩余 ' + formatBytes(generatorStats(item).remainingBytes!)" />
            </template>
            <el-text v-if="generatorStats(item).expiredAt" type="info" size="small">到期: {{ generatorStats(item).expiredAt!.toLocaleDateString() }}</el-text>
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
.el-card {
    width: 300px;
    margin: 10px;

    .card-content {
        display: flex;
        gap: 24px;
        padding: 8px 0;
    }
}

:deep(.el-progress-bar__innerText) {
    color: #fff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
}
</style>
