<script setup lang="ts">
import SubscriptionPage from "@/pages/SubscriptionPage.vue";
import FilterManagementPage from "@/pages/FilterManagementPage.vue";

</script>
<template>
  <!--      <el-row :gutter="24">-->
  <!--        <el-col :span="8">-->
  <!--        </el-col>-->
  <!--        <el-col :span="8">-->
  <!--          <el-row>-->
  <!--            <el-table :data="subscribes">-->
  <!--              <el-table-column type="expand">-->
  <!--                <template #default="scope">-->
  <!--                  <el-table :data="scope.row.proxies">-->
  <!--                    <el-table-column label="类型" prop="type"></el-table-column>-->
  <!--                    <el-table-column label="服务器" prop="server"></el-table-column>-->
  <!--                  </el-table>-->
  <!--                </template>-->
  <!--              </el-table-column>-->
  <!--              <el-table-column label="订阅链接" prop="url"></el-table-column>-->
  <!--              <el-table-column label="代理数量">-->
  <!--                <template #default="scope">-->
  <!--                  {{ scope.row.proxies.length }}-->
  <!--                </template>-->
  <!--              </el-table-column>-->
  <!--              <el-table-column prop="loaded" label="加载状态"></el-table-column>-->
  <!--            </el-table>-->
  <!--          </el-row>-->
  <!--          <el-row>-->
  <!--            &lt;!&ndash;添加一个按钮，点击后弹出对话框添加过滤器&ndash;&gt;-->
  <!--            <el-button type="primary" @click="filterDialogVisible = true">添加过滤器</el-button>-->
  <!--            <FilterDialog v-model:dialog-visible="filterDialogVisible" :provider-proxies="providerProxies"-->
  <!--              @filter-add="addFilter" />-->
  <!--          </el-row>-->
  <!--        </el-col>-->
  <!--        <el-col :span="8">-->
  <!--        </el-col>-->
  <!--      </el-row>-->
  <el-tabs tab-position="left" style="height: 100svh">
    <el-tab-pane label="管理订阅">
      <SubscriptionPage/>
    </el-tab-pane>
    <el-tab-pane label="管理分组">
      <FilterManagementPage/>
    </el-tab-pane>
    <el-tab-pane label="生成订阅">Role</el-tab-pane>
  </el-tabs>
</template>
<style lang="scss" scoped>
</style>
