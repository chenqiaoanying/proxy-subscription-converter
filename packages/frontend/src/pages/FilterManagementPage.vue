<script setup lang="ts">
import FilterDialog from "@components/FilterDialog.vue";
import {onMounted, ref} from "vue";
import {useFilterStore} from "@/stores.ts";
import {storeToRefs} from "pinia";
import {ElMessage} from "element-plus";
import type {Filter} from "@psc/common";
import {FilterSchema} from "@psc/common";

const filterDialogVisible = ref(false);
const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;

onMounted(() => {
  filterStore.forceReloadFilters()
      .catch(err => {
        ElMessage.error(err.message);
      });
})

const toUpdateFilter = ref<Filter | undefined>(undefined);

</script>

<template>
  <el-row justify="end">
    <el-button type="primary" @click="toUpdateFilter = undefined; filterDialogVisible = true">添加过滤器</el-button>
    <FilterDialog v-model:visible="filterDialogVisible" :to-update-filter="toUpdateFilter"/>
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
        <el-button type="primary" @click="toUpdateFilter = FilterSchema.parse(item); filterDialogVisible = true">编辑</el-button>
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
  }
}
</style>