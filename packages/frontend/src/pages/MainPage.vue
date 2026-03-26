<script setup lang="ts">
import SubscriptionPage from "@/pages/SubscriptionPage.vue";
import FilterManagementPage from "@/pages/FilterManagementPage.vue";
import GeneratorPage from "@/pages/GeneratorPage.vue";

</script>
<template>
  <el-tabs tab-position="left" style="height: 100%">
    <el-tab-pane label="管理订阅">
      <SubscriptionPage/>
    </el-tab-pane>
    <el-tab-pane label="管理分组">
      <FilterManagementPage/>
    </el-tab-pane>
    <el-tab-pane label="生成订阅">
      <GeneratorPage/>
    </el-tab-pane>
  </el-tabs>
</template>
<style lang="scss" scoped>
</style>
