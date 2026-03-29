<script setup lang="ts">
import FilterDialog from "@components/FilterDialog.vue";
import RegionFilterDialog from "@components/RegionFilterDialog.vue";
import { onMounted, ref, type DeepReadonly } from "vue";
import { useFilterStore, useSubscriptionStore } from "@/stores.ts";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import type { Filter } from "@psc/common";
import { FilterSchema, applyFilterToProxies } from "@psc/common";
import { Delete, Edit, Plus, List } from "@element-plus/icons-vue";

const filterDialogVisible = ref(false);
const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;

const subscriptionStore = useSubscriptionStore();
const { subscriptions } = storeToRefs(subscriptionStore);

onMounted(() => {
    Promise.all([filterStore.forceReloadFilters(), subscriptionStore.forceReloadSubscriptions()]).catch(err => {
        ElMessage.error(err.message);
    });
});

const regionFilterDialogVisible = ref(false);
const toUpdateFilter = ref<Filter | undefined>(undefined);

function proxyCount(filter: DeepReadonly<Filter>): number {
    return applyFilterToProxies(filter, subscriptions.value).length;
}

function editFilter(filter: DeepReadonly<Filter>) {
    toUpdateFilter.value = FilterSchema.parse(filter);
    filterDialogVisible.value = true;
}

function addFilter() {
    toUpdateFilter.value = undefined;
    filterDialogVisible.value = true;
}
</script>

<template>
    <el-row justify="end">
        <el-button type="primary" @click="regionFilterDialogVisible = true" :icon="List" circle style="margin-right: 8px" />
        <el-button type="primary" @click="addFilter" :icon="Plus" circle />
        <FilterDialog v-model:visible="filterDialogVisible" :to-update-filter="toUpdateFilter" />
        <RegionFilterDialog v-model:visible="regionFilterDialogVisible" />
    </el-row>
    <el-divider />
    <el-row>
        <el-card v-for="item in filters">
            <template #header>
                <el-space>
                    <span>{{ item.tag }}</span>
                    <el-tag size="small">{{ item.type }}</el-tag>
                </el-space>
            </template>
            <div class="card-content">
                <div class="card-stats">
                    <span class="stat-label">代理数量</span>
                    <span class="stat-value">{{ proxyCount(item) }}</span>
                    <span class="stat-label">订阅</span>
                    <span class="stat-value">{{ item.subscriptionIds?.length ? item.subscriptionIds.length + ' 个' : '全部' }}</span>
                </div>
            </div>
            <template #footer>
                <el-button type="primary" @click="editFilter(item)" :icon="Edit" />
                <el-button type="primary" @click="filterStore.deleteFilter(item.id)" :icon="Delete" />
            </template>
        </el-card>
    </el-row>
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
</style>
