<script setup lang="ts">
import FilterDialog from "@components/FilterDialog.vue";
import {ref} from "vue";
import {useFilterStore} from "@/stores.ts";
import {storeToRefs} from "pinia";

const filterDialogVisible = ref(false);
const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;

</script>

<template>
  <el-row justify="end">
    <el-button type="primary" @click="filterDialogVisible = true">添加过滤器</el-button>
    <FilterDialog v-model:dialog-visible="filterDialogVisible" :providerProxies="[]"/>
  </el-row>
  <el-divider/>
  <el-row>
    <!--卡片列表，每个卡片显示一个订阅链接，点击卡片可以查看订阅内容-->
    <el-card v-for="item in filters">
      <template #header>
        <span>{{ item.tag }}</span>
      </template>
      <div class="card-content">

      </div>
      <template #footer>
        <el-button type="primary" @click="filterDialogVisible = true">编辑</el-button>
      </template>
    </el-card>
  </el-row>
</template>

<style scoped lang="scss">

</style>