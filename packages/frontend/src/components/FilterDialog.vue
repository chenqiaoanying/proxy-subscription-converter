<script setup lang="ts">
import {computed, reactive, ref} from 'vue';
import type {Proxy} from '@psc/common';
import {useSubscriptionStore, useFilterStore} from "@/stores.ts";
import {storeToRefs} from "pinia";
import {ElMessage} from "element-plus";

const subscriptionStore = useSubscriptionStore();
const subscriptionStoreRefs = storeToRefs(subscriptionStore);
const filterStore = useFilterStore();

const selectAllSubscriptions = ref(true)
const selectAllTypes = ref(true)

const proxiesBySubscriptions = computed(() => {
  const map = new Map<string, Readonly<Proxy[]>>();
  subscriptionStoreRefs.subscriptions.value.forEach((subscription) => {
    map.set(subscription.name, subscription.proxies);
  })
  return map;
})

const dialogVisible = defineModel<boolean>("dialogVisible");
const filter = reactive({
  tag: "",
  subscriptions: [],
  includeTypes: [],
  includePattern: undefined,
  excludePattern: undefined,
});

const supportedTypes = computed(() => {
  const types = new Set<string>()
  const selectedSubscriptions = selectAllSubscriptions ? Array.from(proxiesBySubscriptions.value.keys()) : filter.subscriptions;
  selectedSubscriptions.map(name => proxiesBySubscriptions.value.get(name))
      .forEach(proxies => {
        if (proxies) {
          proxies.filter(proxy => !["selector", "urltest", "direct", "dns", "block"].includes(proxy.type))
              .forEach(proxy => {
                types.add(proxy.type)
              })
        }
      });
  return types;
});

function onConfirm() {
  if (!filter.tag) {
    ElMessage.error('请输入名称');
    return;
  }

  filterStore.saveFilters(filter)
      .then(() => {
        dialogVisible.value = false;
      })
      .catch((err) => {
        ElMessage.error(err.message);
      })

}

</script>
<template>
  <el-dialog title="添加过滤器" v-model="dialogVisible">
    <el-form :model="filter" label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="filter.tag" placeholder="请输入名称"></el-input>
      </el-form-item>
      <el-form-item label="订阅">
        <el-checkbox v-show="filter.subscriptions?.length == 0" v-model="selectAllSubscriptions" label="所有订阅" style="width: 100%"/>
        <el-checkbox-group v-show="!selectAllSubscriptions" v-model="filter.subscriptions">
          <el-checkbox v-for="name in proxiesBySubscriptions.keys()" :label="name" :value="name" :key="name"/>
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