<script setup lang="ts">
import {computed, type DeepReadonly, reactive, ref} from 'vue';
import type {Filter, Subscription, FilterCreateOrUpdate} from '@psc/common';
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

const visible = defineModel<boolean>("visible");
const filter = reactive<FilterCreateOrUpdate>({
  tag: "",
  type: "selector",
  subscriptionIds: [] as number[],
  proxyTypeFilterMode: "all",
  proxyTypes: [] as string[],
  includePattern: undefined as string | undefined,
  excludePattern: undefined as string | undefined,
});

const supportedTypes = computed(() => {
  const types = new Set<string>()
  const selectedSubscriptions = selectAllSubscriptions ? subscriptions.value : filter.subscriptionIds?.map(id => subscriptionsById.value.get(id)!) || [];
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
    subscriptionIds: filter.subscriptionIds,
    proxyTypeFilterMode: filter.proxyTypeFilterMode,
    proxyTypes: filter.proxyTypes,
    includePattern: filter.includePattern,
    excludePattern: filter.excludePattern,
  })

  const update = toUpdateFilter ? filterStore.updateFilter(toUpdateFilter.id, toSaveFilter) : filterStore.createFilter(toSaveFilter);
  update.then(() => visible.value = false)
      .catch((err) => {
        ElMessage.error(err.message);
      })

}

function onOpen() {
  if (toUpdateFilter) {
    filter.tag = toUpdateFilter.tag;
    filter.subscriptionIds = [...(toUpdateFilter.subscriptionIds || [])];
    filter.proxyTypeFilterMode = toUpdateFilter.proxyTypeFilterMode;
    filter.proxyTypes = toUpdateFilter.proxyTypes || [];
    filter.includePattern = toUpdateFilter.includePattern || undefined;
    filter.excludePattern = toUpdateFilter.excludePattern || undefined;
    selectAllSubscriptions.value = (toUpdateFilter.subscriptionIds?.length ?? 0) == 0;
  } else {
    filter.tag = "";
    filter.subscriptionIds = [];
    filter.proxyTypeFilterMode = "all";
    filter.proxyTypes = [];
    filter.includePattern = undefined;
    filter.excludePattern = undefined;
    selectAllSubscriptions.value = true;
  }
}

</script>
<template>
  <el-dialog :title='toUpdateFilter ? "编辑过滤器": "添加过滤器"' v-model="visible" @open="onOpen">
    <el-form :model="filter" label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="filter.tag" placeholder="请输入名称" :disabled="toUpdateFilter != undefined"></el-input>
      </el-form-item>
      <el-form-item label="类型">
        <el-radio-group v-model="filter.type">
          <el-radio value="selector">选择器</el-radio>
          <el-radio value="urltest">URL测试</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="订阅">
        <el-checkbox v-show="filter.subscriptionIds?.length == 0" v-model="selectAllSubscriptions" label="所有订阅" style="width: 100%"/>
        <el-checkbox-group v-show="!selectAllSubscriptions" v-model="filter.subscriptionIds">
          <el-checkbox v-for="subscription in subscriptions" :label="subscription.name" :value="subscription.id"/>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="代理类型">
        <el-radio-group v-model="filter.proxyTypeFilterMode">
          <el-radio value="all">所有类型</el-radio>
          <el-radio value="include">包含类型</el-radio>
          <el-radio value="exclude">排除类型</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-show="filter.proxyTypeFilterMode != 'all' && supportedTypes.size > 0">
        <el-checkbox-group v-model="filter.proxyTypes">
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