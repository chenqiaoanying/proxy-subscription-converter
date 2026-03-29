<script setup lang="ts">
import FilterDialog from "@components/FilterDialog.vue";
import { onMounted, ref, type DeepReadonly } from "vue";
import { useFilterStore, useSubscriptionStore } from "@/stores.ts";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import type { Filter } from "@psc/common";
import { FilterSchema, applyFilterToProxies } from "@psc/common";
import { Delete, Edit, Plus } from "@element-plus/icons-vue";

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

const toUpdateFilter = ref<Filter | undefined>(undefined);

function proxyCount(filter: DeepReadonly<Filter>): number {
    return applyFilterToProxies(filter, subscriptions.value.filter(sub => sub.id == filter.id)).length;
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
        <el-button type="primary" @click="addFilter" :icon="Plus" circle></el-button>
        <FilterDialog v-model:visible="filterDialogVisible" :to-update-filter="toUpdateFilter" />
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
                <el-statistic title="代理数量" :value="proxyCount(item)" />
            </div>
            <template #footer>
                <el-button type="primary" @click="editFilter(item)" :icon="Edit" />
                <el-button type="primary" @click="filterStore.deleteFilter(item.id)" :icon="Delete" />
            </template>
        </el-card>
    </el-row>
</template>

<style scoped lang="scss">
.el-card {
    width: 300px;
    margin: 10px;

    .card-content {
        height: 100px;
        display: flex;
        align-items: center;
    }
}
</style>
