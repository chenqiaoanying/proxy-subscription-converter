<script setup lang="ts">

import {ref} from "vue";
import FilterDialog from "@components/FilterDialog.vue";
import {Filter, Proxy} from "@psc/common";

const filterDialogVisible = ref(false);

function addFilter(filter: Filter) {
  filter.tag
}

const templateType = ref("1");
const subscribeTemplate = ref("");
const subscribeUrl = ref("");
const providerProxies = ref([

])
const subscribes = ref<{
  url: string,
  proxies: Proxy[],
  loaded: boolean,
}[]>([]);

</script>
<template>
  <el-container>
    <el-header>订阅页面</el-header>
    <el-main>
      <el-row :gutter="24">
        <el-col :span="8">
          <el-row>
            <!--一个下拉框，选择 1，提供模板链接；2，自己输入模板-->
            <el-select v-model="templateType" placeholder="请选择模板类型">
              <el-option label="1" value="1">提供模板链接</el-option>
              <el-option label="2" value="2">自己输入模板</el-option>
            </el-select>
          </el-row>
          <el-row>
            <!--一个用于输入文件模板的文本框-->
            <el-input
                v-model="subscribeTemplate"
                placeholder="请输入订阅文件模板"
                type="textarea"
                autosize
            />
          </el-row>
        </el-col>
        <el-col :span="8">
          <el-row>
            <!--输入订阅链接的输入框-->
            <el-input
                v-model="subscribeUrl"
                placeholder="请输入订阅链接"
                type="textarea"
                autosize
            />
            <el-table :data="subscribes">
              <el-table-column type="expand">
                <template #default="scope">
                  <el-table :data="scope.row.proxies">
                    <el-table-column label="类型" prop="type"></el-table-column>
                    <el-table-column label="服务器" prop="server"></el-table-column>
                  </el-table>
                </template>
              </el-table-column>
              <el-table-column label="订阅链接" prop="url"></el-table-column>
              <el-table-column label="代理数量">
                <template #default="scope">
                  {{ scope.row.proxies.length }}
                </template>
              </el-table-column>
              <el-table-column prop="loaded" label="加载状态"></el-table-column>

            </el-table>
          </el-row>
          <el-row>
            <!--添加一个按钮，点击后弹出对话框添加过滤器-->
            <el-button type="primary" @click="filterDialogVisible=true">添加过滤器</el-button>
            <FilterDialog v-model:dialog-visible="filterDialogVisible" :provider-proxies="providerProxies" @filter-add="addFilter"/>
          </el-row>
        </el-col>
        <el-col :span="8">
        </el-col>
      </el-row>
    </el-main>
  </el-container>
</template>
<style lang="scss" scoped>
.el-container {
  height: 100vh;
}
</style>
