<script setup lang="ts">
import {computed, type DeepReadonly, reactive, ref} from 'vue';
import type {Filter, Subscription} from '@psc/common';
import {FilterCreateOrUpdateSchema} from "@psc/common";
import {useSubscriptionStore, useFilterStore} from "@/stores.ts";
import {storeToRefs} from "pinia";
import {ElMessage} from "element-plus";

const {toUpdateFilter = undefined} = defineProps<{
  toUpdateFilter?: Filter,
}>()
const subscriptionStore = useSubscriptionStore();
const subscriptionStoreRefs = storeToRefs(subscriptionStore);
const subscriptions = subscriptionStoreRefs.subscriptions;
const subscriptionsById = computed(() => subscriptions.value.reduce((map, subscription) => {
  map.set(subscription.id, subscription);
  return map;
}, new Map<number, DeepReadonly<Subscription>>))

const filterStore = useFilterStore();
const selectAllSubscriptions = ref(true)
const selectAllTypes = ref(true)

const dialogVisible = defineModel<boolean>("dialogVisible");
const filter = reactive({
  tag: "",
  subscriptions: [] as DeepReadonly<Subscription>[],
  includeTypes: [] as string[],
  includePattern: undefined as string | undefined,
  excludePattern: undefined as string | undefined,
});

const supportedTypes = computed(() => {
  const types = new Set<string>()
  const selectedSubscriptions = selectAllSubscriptions ? subscriptions.value : filter.subscriptions;
  selectedSubscriptions.flatMap(subscription => subscription.proxies)
      .forEach(proxy => {
        if (!["selector", "urltest", "direct", "dns", "block"].includes(proxy.type)) types.add(proxy.type)
      });
  return types;
});

function onConfirm() {
  if (!filter.tag) {
    ElMessage.error('请输入名称');
    return;
  }
  const toSaveFilter = FilterCreateOrUpdateSchema.parse({
    tag: filter.tag,
    subscriptionIds: filter.subscriptions.map(subscription => subscription.id),
    includeTypes: filter.includeTypes,
    includePattern: filter.includePattern,
    excludePattern: filter.excludePattern,
  })

  const update = toUpdateFilter ? filterStore.updateFilter(toUpdateFilter.id, toSaveFilter) : filterStore.createFilter(toSaveFilter);
  update.then(() => dialogVisible.value = false)
      .catch((err) => {
        ElMessage.error(err.message);
      })

}

function onOpen() {
  if (toUpdateFilter) {
    filter.tag = toUpdateFilter.tag;
    filter.subscriptions = toUpdateFilter.subscriptionIds?.map((id) => subscriptionsById.value.get(id)!) ?? [];
    filter.includeTypes = toUpdateFilter.includeTypes || [];
    filter.includePattern = toUpdateFilter.includePattern || undefined;
    filter.excludePattern = toUpdateFilter.excludePattern || undefined;
    selectAllSubscriptions.value = (toUpdateFilter.subscriptionIds?.length ?? 0) == 0;
    selectAllTypes.value = (toUpdateFilter.includeTypes?.length ?? 0) == 0;
  }
}

</script>
<template>
  <el-dialog :title='toUpdateFilter ? "编辑过滤器": "添加过滤器"' v-model="dialogVisible" @open="onOpen">
    <el-form :model="filter" label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="filter.tag" placeholder="请输入名称" :disabled="toUpdateFilter != undefined"></el-input>
      </el-form-item>
      <el-form-item label="订阅">
        <el-checkbox v-show="filter.subscriptions?.length == 0" v-model="selectAllSubscriptions" label="所有订阅" style="width: 100%"/>
        <el-checkbox-group v-show="!selectAllSubscriptions" v-model="filter.subscriptions">
          <el-checkbox v-for="subscription in subscriptions" :label="subscription.name" :value="subscription"/>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item v-show="supportedTypes.size > 0" label="代理类型">
        <el-checkbox v-show="filter.includeTypes?.length == 0" v-model="selectAllTypes" label="所有类型" style="width: 100%"/>
        <el-checkbox-group v-show="!selectAllTypes" v-model="filter.includeTypes">
          <el-checkbox v-for="type in supportedTypes" :label="type" :value="type" :key="type"/>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="包含">
        <el-input v-model="filter.includePattern" placeholder="请输入正则表达式"></el-input>
      </el-form-item>
      <el-form-item label="排除">
        <el-input v-model="filter.excludePattern" placeholder="请输入正则表达式"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="onConfirm">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>