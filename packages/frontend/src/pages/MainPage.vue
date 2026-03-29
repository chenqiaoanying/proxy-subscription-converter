<script setup lang="ts">
import SubscriptionPage from "@/pages/SubscriptionPage.vue";
import FilterManagementPage from "@/pages/FilterManagementPage.vue";
import GeneratorPage from "@/pages/GeneratorPage.vue";

</script>
<template>
  <el-tabs tab-position="left" style="height: 100%">
    <el-tab-pane label="管理订阅">
      <div class="page-scroll"><SubscriptionPage/></div>
    </el-tab-pane>
    <el-tab-pane label="管理分组">
      <div class="page-scroll"><FilterManagementPage/></div>
    </el-tab-pane>
    <el-tab-pane label="生成订阅">
      <div class="page-scroll"><GeneratorPage/></div>
    </el-tab-pane>
  </el-tabs>
</template>
<style lang="scss" scoped>
.page-scroll {
  height: var(--page-height);
  overflow-y: auto;
  box-sizing: border-box;
}
</style>
